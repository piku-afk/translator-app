import type { Kysely } from "kysely";
import type { Database } from "../database/database";
import { translationFileKey } from "../novels/novels-core";
import {
  applyGlossaryDiff,
  filterNamesBySourceText,
  filterNotesBySourceText,
  joinVariations,
  splitVariations,
  type Glossary,
  type GlossaryCategory,
  type GlossaryDiff,
  type GlossaryEntry,
} from "./glossary";
import type { ModelNotesDiff, ModelNotesEntry, ModelPort, ObjectStorePort } from "./ports";
import { NOVEL_NOT_FOUND_ERROR } from "./service";

/**
 * Ports the minimal chapter translate service is written against: the database,
 * durable text storage, and the AI model only. Deliberately has no queue ports -
 * the per-chapter translate runs synchronously in the request, so there is
 * nothing to enqueue (spec #45).
 */
export interface ChapterTranslatePorts {
  db: Kysely<Database>;
  storage: ObjectStorePort;
  model: ModelPort;
}

/**
 * The chapter translate service seam, hosted by the per-novel Durable Object
 * (#44/#48). One synchronous per-chapter translate, written against injected
 * ports so it runs unchanged on Cloudflare bindings or on in-memory doubles.
 * The legacy translatorService is left untouched as unused dead weight.
 */
export interface ChapterTranslateService {
  /**
   * Translate one pasted chapter synchronously and commit the result. The
   * glossary merge, the R2 markdown write, and the chapter-row upsert all
   * happen only after the model calls succeed (all-or-nothing): a failed
   * translate leaves no partial glossary and no written markdown. Source text
   * is never stored; only translation markdown is written. Never writes the
   * `translating` status (the flow is synchronous, per schema decision #40).
   */
  translateChapter(input: {
    slug: string;
    chapterNumber: number;
    pastedText: string;
  }): Promise<void>;
}

export function createChapterTranslateService(
  ports: ChapterTranslatePorts,
): ChapterTranslateService {
  const { db, storage, model } = ports;

  /** Load the novel's current glossary from D1, split into variation arrays.
   * Re-read fresh on every request - no in-memory caching (spec #45). */
  async function loadGlossary(novelId: number): Promise<Glossary> {
    const rows = await db
      .selectFrom("glossary_entries")
      .selectAll()
      .where("novel_id", "=", novelId)
      .orderBy("id")
      .execute();
    return rows.map((row) => ({
      id: row.id,
      category: row.category as GlossaryCategory,
      sourceNames: splitVariations(row.source_names),
      englishNames: splitVariations(row.english_names),
      description: row.description,
    }));
  }

  /** Sync D1 to a glossary produced by applying a model diff to `before`. */
  async function persistGlossary(
    novelId: number,
    before: Glossary,
    after: Glossary,
  ): Promise<void> {
    const beforeById = new Map(before.map((entry) => [entry.id, entry]));
    const afterById = new Map(after.map((entry) => [entry.id, entry]));
    const timestamp = new Date().toISOString();

    // Deletes: rows in `before` but no longer in `after` (addressable by id).
    const deletedIds = before.filter((entry) => !afterById.has(entry.id)).map((entry) => entry.id);
    if (deletedIds.length > 0) {
      await db
        .deleteFrom("glossary_entries")
        .where("novel_id", "=", novelId)
        .where("id", "in", deletedIds)
        .execute();
    }

    // Inserts: entries in `after` whose id is not in `before`. The merge core
    // assigns new entries ids strictly above the original max id, so a
    // genuinely new entry is never mistaken for an update.
    const inserts = after.filter((entry) => !beforeById.has(entry.id));
    if (inserts.length > 0) {
      await db
        .insertInto("glossary_entries")
        .values(
          inserts.map((entry) => ({
            novel_id: novelId,
            category: entry.category,
            source_names: joinVariations(entry.sourceNames),
            english_names: joinVariations(entry.englishNames),
            description: entry.description,
            created_at: timestamp,
            updated_at: timestamp,
          })),
        )
        .execute();
    }

    // Updates: entries present in both, rewriting the row when it changed.
    for (const entry of after) {
      const beforeEntry = beforeById.get(entry.id);
      if (!beforeEntry || sameEntry(beforeEntry, entry)) continue;
      await db
        .updateTable("glossary_entries")
        .set({
          category: entry.category,
          source_names: joinVariations(entry.sourceNames),
          english_names: joinVariations(entry.englishNames),
          description: entry.description,
          updated_at: timestamp,
        })
        .where("id", "=", entry.id)
        .execute();
    }
  }

  /**
   * Upsert the chapter row by (novel_id, number): a fresh number inserts a new
   * row already at `translated`; an existing row is updated to `translated`
   * with `updated_at` touched. `translating` is never written (synchronous
   * flow, #40).
   */
  async function upsertChapter(novelId: number, number: number): Promise<void> {
    const timestamp = new Date().toISOString();
    const existing = await db
      .selectFrom("chapters")
      .select("id")
      .where("novel_id", "=", novelId)
      .where("number", "=", number)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("chapters")
        .set({ status: "translated", updated_at: timestamp })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db
        .insertInto("chapters")
        .values({
          novel_id: novelId,
          number,
          status: "translated",
          created_at: timestamp,
          updated_at: timestamp,
        })
        .execute();
    }
  }

  /**
   * The per-chapter flow (≈ the legacy rerunChapterWork, synchronous): notes
   * diff → glossary merge → translate → R2 markdown put → D1 chapter row. All
   * writes are deferred until both model calls succeed, so a failed translate
   * leaves no partial glossary and no written markdown.
   */
  async function translateChapter(input: {
    slug: string;
    chapterNumber: number;
    pastedText: string;
  }): Promise<void> {
    const { slug, chapterNumber, pastedText } = input;

    const novel = await db
      .selectFrom("novels")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();
    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }

    // Glossary re-read fresh for this request. No writes yet: everything below
    // only commits after translate succeeds.
    const glossary = await loadGlossary(novel.id);

    // Name discovery: the model's notes diff over the pasted text, consulted
    // against the notes built from the chapter's relevant glossary entries.
    const filteredNotes = toModelNotes(filterNotesBySourceText(pastedText, glossary));
    const { notesChanges } = await model.getNotesDiff({ sourceText: pastedText, filteredNotes });

    // Merge the diff in memory - nothing persisted until translate succeeds.
    const updated = applyGlossaryDiff(glossary, fromModelNotesDiff(notesChanges));

    // Translate with name pairs only (ADR-0002), from the merged glossary.
    const namePairs = filterNamesBySourceText(pastedText, updated);
    const { markdown } = await model.translate({ sourceText: pastedText, namePairs });

    // Translate succeeded: commit glossary merge, markdown, and chapter row.
    await persistGlossary(novel.id, glossary, updated);
    await storage.put(translationFileKey(slug, chapterNumber), markdown);
    await upsertChapter(novel.id, chapterNumber);
  }

  return { translateChapter };
}

/** Convert glossary entries to the model-facing notes shape (`;`-joined). */
function toModelNotes(entries: GlossaryEntry[]): ModelNotesEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    category: entry.category,
    source_names: joinVariations(entry.sourceNames),
    english_names: joinVariations(entry.englishNames),
    description: entry.description,
  }));
}

/** Convert the model's notes diff to the glossary core's diff (arrays). */
function fromModelNotesDiff(diff: ModelNotesDiff): GlossaryDiff {
  return {
    additions: diff.additions.map((addition) => ({
      category: addition.category,
      sourceNames: splitVariations(addition.source_names),
      englishNames: splitVariations(addition.english_names),
      description: addition.description,
    })),
    updates: diff.updates.map((update) => ({
      id: update.id,
      category: update.category,
      sourceNames: splitVariations(update.source_names),
      englishNames: splitVariations(update.english_names),
      description: update.description,
    })),
    deletions: diff.deletions.map((deletion) => ({
      id: deletion.id,
      category: deletion.category,
    })),
  };
}

/** True when two glossary entries carry identical content. */
function sameEntry(a: GlossaryEntry, b: GlossaryEntry): boolean {
  return (
    a.category === b.category &&
    a.description === b.description &&
    joinVariations(a.sourceNames) === joinVariations(b.sourceNames) &&
    joinVariations(a.englishNames) === joinVariations(b.englishNames)
  );
}
