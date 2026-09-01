import {
  DUPLICATE_NOVEL_ERROR,
  chapterFileKey,
  rawFileKey,
  toSlug,
  translationFileKey,
  type ActivityAction,
  type CreateNovelInput,
  type Novel,
  type NovelStatus,
  type SourceLanguage,
} from "../novels/novels-core";
import type {
  ExtractionJobMessage,
  ModelNotesDiff,
  ModelNotesEntry,
  ParseJobMessage,
  TranslationJobMessage,
  TranslatorPorts,
} from "./ports";
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
import { extractChapters } from "./extractors";
import { getErrorMessage } from "../utils";

/** Retries the parse queue allows per message; must match the wrangler
 * consumer's `max_retries` (wrangler.jsonc). The consumer treats a message on
 * this attempt as exhausted: recording the failure beats letting the message
 * drop silently, which would strand the novel in `parsing`. */
export const PARSE_MAX_RETRIES = 3;

/** Retries the extraction queue allows per message; must match the wrangler
 * consumer's `max_retries` (wrangler.jsonc), added in the production-wiring
 * ticket. On exhaustion the novel moves to `extraction failed`. */
export const EXTRACTION_MAX_RETRIES = 3;

/**
 * Retries the translation queue allows per message; must match the wrangler
 * consumer's `max_retries` (wrangler.jsonc). On exhaustion the novel moves
 * to `translation failed`. The whole message is one attempt - a retried
 * message resumes by skipping already-`translated` chapters (see ADR-0008).
 */
export const TRANSLATION_MAX_RETRIES = 3;

/**
 * Bounded concurrency for the parallel translation pass. The low end of the
 * 4-8 range keeps AI Gateway spend conservative; must match the wrangler
 * consumer's behaviour so the bound is verifiable in the seam (see ADR-0008).
 */
export const TRANSLATION_CONCURRENCY = 4;

export const NOVEL_NOT_FOUND_ERROR = "Novel not found";

/** How the queue consumer should settle a message after runParseJob. */
export type ParseSettlement = { outcome: "ack" } | { outcome: "retry" };

/** How the queue consumer should settle a message after runExtractionJob. */
export type ExtractionSettlement = { outcome: "ack" } | { outcome: "retry" };

/** How the queue consumer should settle a message after runTranslationJob. */
export type TranslationSettlement = { outcome: "ack" } | { outcome: "retry" };

/** A novel plus the parse state the details page needs. */
export interface NovelDetail {
  novel: Novel;
  chapter_count: number;
}

/** A novel plus the number of parsed chapter rows, for list views. */
export type NovelSummary = Novel & { parsed_chapters: number };

/** A recorded Activity row as the readers return it. `slug` is fetched by
 * joining novels so the UI can link to the novel's detail page. */
export interface ActivityRow {
  id: number;
  novel_id: number;
  novel_name: string;
  slug: string;
  action: ActivityAction;
  detail: string | null;
  created_at: string;
}

/**
 * The translator service seam: every Novel/Chapter domain operation, written
 * against injected ports so it runs unchanged on Cloudflare bindings or on
 * in-memory test doubles. Framework- and Cloudflare-agnostic by construction.
 */
export interface TranslatorService {
  listNovels(): Promise<NovelSummary[]>;
  listRecentNovels(): Promise<NovelSummary[]>;
  findNovelBySlug(slug: string): Promise<Novel | undefined>;
  getNovelDetail(slug: string): Promise<NovelDetail | undefined>;
  createNovel(input: CreateNovelInput): Promise<Novel>;
  /** Explicit, operator-only parse start (never automatic). */
  startParsing(slug: string): Promise<Novel>;
  /** One parse-queue consumer invocation for a single message. */
  runParseJob(job: ParseJobMessage, attempt: number): Promise<ParseSettlement>;
  /** Explicit, operator-only extraction start (never automatic). */
  startExtraction(slug: string): Promise<Novel>;
  /** One extraction-queue consumer invocation for a single message. */
  runExtractionJob(job: ExtractionJobMessage, attempt: number): Promise<ExtractionSettlement>;
  /** Explicit, operator-only translation start (never automatic). */
  startTranslation(slug: string): Promise<Novel>;
  /** One translation-queue consumer invocation for a single message. */
  runTranslationJob(job: TranslationJobMessage, attempt: number): Promise<TranslationSettlement>;
  /** The novel's current glossary; empty for a novel that has not been extracted. */
  listGlossary(slug: string): Promise<Glossary>;
  /** Most recent activity rows across all novels, newest first, capped at `limit`. */
  listRecentActivities(limit: number): Promise<ActivityRow[]>;
  /** A single novel's complete activity history, chronological (oldest first). */
  listActivitiesForNovel(novelId: number): Promise<ActivityRow[]>;
}

export function createTranslatorService(ports: TranslatorPorts): TranslatorService {
  const { db } = ports;

  // parsed_chapters is derived, never stored: COUNT over the per-chapter rows
  // joined to each novel. count (not countAll) so the LEFT JOIN's null-extended
  // row for an unparsed novel tallies 0, not 1.
  function withParsedChapters() {
    return db
      .selectFrom("novels")
      .selectAll("novels")
      .leftJoin("chapters", "chapters.novel_id", "novels.id")
      .select((eb) => eb.fn.count<number>("chapters.id").as("parsed_chapters"))
      .groupBy("novels.id");
  }

  async function listNovels(): Promise<NovelSummary[]> {
    return withParsedChapters()
      .orderBy("novels.created_at", "desc")
      .orderBy("novels.id", "desc")
      .execute();
  }

  async function listRecentNovels(): Promise<NovelSummary[]> {
    return withParsedChapters().orderBy("novels.updated_at", "desc").limit(3).execute();
  }

  async function findNovelBySlug(slug: string): Promise<Novel | undefined> {
    return db.selectFrom("novels").selectAll().where("slug", "=", slug).executeTakeFirst();
  }

  async function createNovel(input: CreateNovelInput): Promise<Novel> {
    const { name, total_chapters, source_language, raw_text } = input;
    const slug = toSlug(name);

    // Friendly pre-check for the common duplicate case; the DB unique
    // constraint on slug is the real guard (mapped below on the rare race).
    const existing = await findNovelBySlug(slug);
    if (existing) {
      throw new Error(DUPLICATE_NOVEL_ERROR);
    }

    const timestamp = new Date().toISOString();

    // Upload the raw file before persisting: a failed insert must never leave
    // a DB record pointing at a missing file. An orphaned object (insert
    // failed after upload) is harmless - nothing references it.
    await ports.storage.put(rawFileKey(slug), raw_text);

    try {
      await db
        .insertInto("novels")
        .values({
          name,
          slug,
          source_language,
          total_chapters,
          status: "draft",
          created_at: timestamp,
          updated_at: timestamp,
        })
        .execute();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(DUPLICATE_NOVEL_ERROR);
      }
      throw error;
    }

    const created = (await db
      .selectFrom("novels")
      .selectAll()
      .where("slug", "=", slug)
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirstOrThrow()) satisfies Novel;

    // Record the committed transition only now, after the insert succeeded.
    await recordActivity(created.id, created.name, "novel created");

    return created;
  }

  async function findNovelById(novelId: number): Promise<Novel | undefined> {
    return db.selectFrom("novels").selectAll().where("id", "=", novelId).executeTakeFirst();
  }

  /** Update a novel's status (and optionally its last_error); touches updated_at. */
  async function setNovelStatus(
    novelId: number,
    status: NovelStatus,
    lastError?: string | null,
  ): Promise<void> {
    await db
      .updateTable("novels")
      .set({
        status,
        updated_at: new Date().toISOString(),
        ...(lastError === undefined ? {} : { last_error: lastError }),
      })
      .where("id", "=", novelId)
      .execute();
  }

  /**
   * Append an Activity row for a committed novel-level lifecycle transition.
   * Callers invoke this only *after* the transition has truly committed (insert
   * succeeded / queue enqueue succeeded / job finalizer ran); a rolled-back
   * enqueue or pipeline-internal churn must never call it. No dedup: re-triggers
   * are distinct moments and each gets its own row.
   */
  async function recordActivity(
    novelId: number,
    novelName: string,
    action: ActivityAction,
    detail?: string | null,
  ): Promise<void> {
    await db
      .insertInto("activity")
      .values({
        novel_id: novelId,
        novel_name: novelName,
        action,
        detail: detail ?? null,
        created_at: new Date().toISOString(),
      })
      .execute();
  }

  async function listRecentActivities(limit: number): Promise<ActivityRow[]> {
    const rows = await db
      .selectFrom("activity")
      .innerJoin("novels", "novels.id", "activity.novel_id")
      .select(ACTIVITY_COLUMNS)
      .orderBy("activity.created_at", "desc")
      .limit(limit)
      .execute();
    return rows.map(toActivityRow);
  }

  async function listActivitiesForNovel(novelId: number): Promise<ActivityRow[]> {
    const rows = await db
      .selectFrom("activity")
      .innerJoin("novels", "novels.id", "activity.novel_id")
      .select(ACTIVITY_COLUMNS)
      .where("activity.novel_id", "=", novelId)
      .orderBy("activity.created_at", "asc")
      .execute();
    return rows.map(toActivityRow);
  }

  async function startParsing(slug: string): Promise<Novel> {
    const novel = await findNovelBySlug(slug);

    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }

    if (novel.status !== "draft" && novel.status !== "parsing failed" && novel.status !== "needs review") {
      throw new Error(
        `Only draft, parsing failed, or needs review novels can start parsing (currently "${novel.status}")`,
      );
    }

    await setNovelStatus(novel.id, "parsing");

    try {
      await ports.parseQueue.enqueue({ novelId: novel.id });
    } catch (error) {
      // The job never made it onto the queue, so the operator was not told
      // the truth if we stayed in `parsing`: revert to the status the novel
      // had before this call so Start parsing can be pressed again.
      await setNovelStatus(novel.id, novel.status);
      throw error;
    }

    // The enqueue committed; only now record the transition. A rolled-back
    // enqueue above never reaches this line, so no stray "parsing started"
    // row is ever written.
    await recordActivity(novel.id, novel.name, "parsing started");

    // Refetch: the caller expects the novel as it is now (status "parsing"),
    // not the row as it was read before the update.
    return (await findNovelById(novel.id))!;
  }

  async function runParseJob(job: ParseJobMessage, attempt: number): Promise<ParseSettlement> {
    const novel = await findNovelById(job.novelId);

    if (!novel) {
      return { outcome: "ack" }; // novel gone: nothing left to finalize
    }

    if (novel.status !== "parsing") {
      return { outcome: "ack" }; // stale/duplicate message: the novel moved on
    }

    try {
      const rawText = await ports.storage.get(rawFileKey(novel.slug));

      if (rawText === null) {
        throw new Error(`Raw file missing on storage for novel "${novel.slug}"`);
      }

      const chapters = extractChapters(rawText, novel.source_language as SourceLanguage);

      for (const chapter of chapters) {
        await ports.storage.put(chapterFileKey(novel.slug, chapter.number), chapter.content);
      }

      // Replace rows per attempt so a retried parse leaves exactly one row per
      // extracted chapter. No transaction - D1 has no interactive transactions;
      // a crash mid-way retries the whole job, which self-heals here.
      const timestamp = new Date().toISOString();
      await db.deleteFrom("chapters").where("novel_id", "=", novel.id).execute();

      if (chapters.length > 0) {
        await db
          .insertInto("chapters")
          .values(
            chapters.map((chapter) => ({
              novel_id: novel.id,
              number: chapter.number,
              status: "queued",
              created_at: timestamp,
              updated_at: timestamp,
            })),
          )
          .execute();
      }

      const mismatch = chapters.length !== novel.total_chapters;
      await setNovelStatus(novel.id, mismatch ? "needs review" : "ready", null);
      await recordActivity(
        novel.id,
        novel.name,
        mismatch ? "needs review" : "parsing ready",
        mismatch
          ? `${chapters.length} extracted, ${novel.total_chapters} declared`
          : `${chapters.length} chapters extracted`,
      );
      return { outcome: "ack" };
    } catch (error) {
      if (attempt >= PARSE_MAX_RETRIES) {
        try {
          await setNovelStatus(novel.id, "parsing failed", getErrorMessage(error));
          await recordActivity(novel.id, novel.name, "parsing failed", getErrorMessage(error));
          return { outcome: "ack" };
        } catch {
          // Even recording the failure failed; let the queue retry the message.
          return { outcome: "retry" };
        }
      }
      return { outcome: "retry" };
    }
  }

  async function startExtraction(slug: string): Promise<Novel> {
    const novel = await findNovelBySlug(slug);

    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }

    if (
      novel.status !== "ready" &&
      novel.status !== "names extracted" &&
      novel.status !== "extraction failed"
    ) {
      throw new Error(
        `Only ready, names extracted, or extraction failed novels can start extraction (currently "${novel.status}")`,
      );
    }

    await setNovelStatus(novel.id, "extracting");

    try {
      await ports.extractionQueue.enqueue({ novelId: novel.id });
    } catch (error) {
      // The job never made it onto the queue, so the operator was not told the
      // truth if we stayed in `extracting`: revert to the status the novel had
      // before this call so Start extraction can be pressed again.
      await setNovelStatus(novel.id, novel.status);
      throw error;
    }

    // The enqueue committed; only now record the transition.
    await recordActivity(novel.id, novel.name, "extraction started");

    return (await findNovelById(novel.id))!;
  }

  /** Load the novel's current glossary from D1, split into variation arrays. */
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

  async function runExtractionJob(
    job: ExtractionJobMessage,
    attempt: number,
  ): Promise<ExtractionSettlement> {
    const novel = await findNovelById(job.novelId);

    if (!novel) {
      return { outcome: "ack" }; // novel gone: nothing left to finalize
    }

    if (novel.status !== "extracting") {
      return { outcome: "ack" }; // stale/duplicate message: the novel moved on
    }

    try {
      // Walk chapters 1..N sequentially (the accepted ADR-0001 bottleneck).
      const chapters = await db
        .selectFrom("chapters")
        .selectAll()
        .where("novel_id", "=", novel.id)
        .orderBy("number")
        .execute();

      for (const chapter of chapters) {
        // Resume-on-retry: a chapter already at `names extracted` is skipped,
        // so a retried or re-triggered pass picks up where it broke instead of
        // replaying model calls.
        if (chapter.status === "names extracted") continue;

        const sourceText = await ports.storage.get(chapterFileKey(novel.slug, chapter.number));
        if (sourceText === null) {
          throw new Error(
            `Chapter file missing on storage for novel "${novel.slug}" chapter ${chapter.number}`,
          );
        }

        // Consult the cumulative glossary, filtered to this chapter's text so
        // model calls stay cheap.
        const glossary = await loadGlossary(novel.id);
        const filteredNotes = toModelNotes(filterNotesBySourceText(sourceText, glossary));

        // One combined model call discovers new names (against the established
        // names in the notes) and produces the diff to apply to the glossary.
        const { notesChanges } = await ports.model.getNotesDiff({ sourceText, filteredNotes });

        // Commit this chapter's diff to the cumulative glossary, then mark the
        // chapter `names extracted` before moving on.
        const updated = applyGlossaryDiff(glossary, fromModelNotesDiff(notesChanges));
        await persistGlossary(novel.id, glossary, updated);

        await db
          .updateTable("chapters")
          .set({ status: "names extracted", updated_at: new Date().toISOString() })
          .where("id", "=", chapter.id)
          .execute();
      }

      // The walk completed: the glossary is complete.
      await setNovelStatus(novel.id, "names extracted", null);
      await recordActivity(novel.id, novel.name, "names extracted");
      return { outcome: "ack" };
    } catch (error) {
      if (attempt >= EXTRACTION_MAX_RETRIES) {
        try {
          await setNovelStatus(novel.id, "extraction failed", getErrorMessage(error));
          await recordActivity(novel.id, novel.name, "extraction failed", getErrorMessage(error));
          return { outcome: "ack" };
        } catch {
          // Even recording the failure failed; let the queue retry the message.
          return { outcome: "retry" };
        }
      }
      return { outcome: "retry" };
    }
  }

  async function startTranslation(slug: string): Promise<Novel> {
    const novel = await findNovelBySlug(slug);

    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }

    if (novel.status !== "names extracted" && novel.status !== "translation failed") {
      throw new Error(
        `Only names extracted or translation failed novels can start translation (currently "${novel.status}")`,
      );
    }

    await setNovelStatus(novel.id, "translating");

    try {
      await ports.translationQueue.enqueue({ novelId: novel.id });
    } catch (error) {
      // The job never made it onto the queue, so the operator was not told the
      // truth if we stayed in `translating`: revert to the status the novel had
      // before this call so Start translation can be pressed again.
      await setNovelStatus(novel.id, novel.status);
      throw error;
    }

    // The enqueue committed; only now record the transition.
    await recordActivity(novel.id, novel.name, "translation started");

    return (await findNovelById(novel.id))!;
  }

  async function runTranslationJob(
    job: TranslationJobMessage,
    attempt: number,
  ): Promise<TranslationSettlement> {
    const novel = await findNovelById(job.novelId);

    if (!novel) {
      return { outcome: "ack" }; // novel gone: nothing left to finalize
    }

    if (novel.status !== "translating") {
      return { outcome: "ack" }; // stale/duplicate message: the novel moved on
    }

    try {
      // The not-yet-translated chapters, fanned out in parallel with bounded
      // concurrency. Resume skips `translated` chapters so a retried or
      // re-triggered pass picks up where it broke instead of re-translating
      // finished chapters (ADR-0008).
      const chapters = await db
        .selectFrom("chapters")
        .selectAll()
        .where("novel_id", "=", novel.id)
        .orderBy("number")
        .execute();
      const pending = chapters.filter((chapter) => chapter.status !== "translated");

      const errors: unknown[] = [];
      await mapWithConcurrency(pending, TRANSLATION_CONCURRENCY, async (chapter) => {
        try {
          await translateChapter(novel, chapter);
        } catch (error) {
          errors.push(error);
        }
      });
      if (errors.length > 0) throw errors[0];

      // Every eligible chapter translated: the novel is complete.
      await setNovelStatus(novel.id, "completed", null);
      await recordActivity(novel.id, novel.name, "translation completed");
      return { outcome: "ack" };
    } catch (error) {
      if (attempt >= TRANSLATION_MAX_RETRIES) {
        try {
          await setNovelStatus(novel.id, "translation failed", getErrorMessage(error));
          await recordActivity(novel.id, novel.name, "translation failed", getErrorMessage(error));
          return { outcome: "ack" };
        } catch {
          // Even recording the failure failed; let the queue retry the message.
          return { outcome: "retry" };
        }
      }
      return { outcome: "retry" };
    }
  }

  /** Translate a single chapter: read text, feed names, write markdown, commit. */
  async function translateChapter(novel: Novel, chapter: { id: number; number: number }): Promise<void> {
    // Dispatch-time bookkeeping: flip to `translating` just before the model
    // call so a failed message never strands a chapter permanently in `translating`.
    await db
      .updateTable("chapters")
      .set({ status: "translating", updated_at: new Date().toISOString() })
      .where("id", "=", chapter.id)
      .execute();

    const sourceText = await ports.storage.get(chapterFileKey(novel.slug, chapter.number));
    if (sourceText === null) {
      throw new Error(
        `Chapter file missing on storage for novel "${novel.slug}" chapter ${chapter.number}`,
      );
    }

    // Name pairs only - never Notes or descriptions (ADR-0002), and only for
    // the entities present in this chapter's text to keep the call cheap.
    const glossary = await loadGlossary(novel.id);
    const namePairs = filterNamesBySourceText(sourceText, glossary);

    const { markdown } = await ports.model.translate({ sourceText, namePairs });

    // The translated output is the file: write markdown, then commit `translated`.
    await ports.storage.put(translationFileKey(novel.slug, chapter.number), markdown);
    await db
      .updateTable("chapters")
      .set({ status: "translated", updated_at: new Date().toISOString() })
      .where("id", "=", chapter.id)
      .execute();
  }

  async function getNovelDetail(slug: string): Promise<NovelDetail | undefined> {
    const novel = await findNovelBySlug(slug);
    if (!novel) {
      return undefined;
    }
    const row = await db
      .selectFrom("chapters")
      .select((eb) => eb.fn.countAll<number>().as("chapter_count"))
      .where("novel_id", "=", novel.id)
      .executeTakeFirst();
    return { novel, chapter_count: Number(row?.chapter_count ?? 0) };
  }

  async function listGlossary(slug: string): Promise<Glossary> {
    const novel = await findNovelBySlug(slug);
    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }
    return loadGlossary(novel.id);
  }

  return {
    listNovels,
    createNovel,
    runParseJob,
    startParsing,
    runExtractionJob,
    startExtraction,
    runTranslationJob,
    startTranslation,
    getNovelDetail,
    findNovelBySlug,
    listRecentNovels,
    listGlossary,
    listRecentActivities,
    listActivitiesForNovel,
  };
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

/** SQLite reports unique violations as "UNIQUE constraint failed: <table>.<col>". */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}

/**
 * Run `worker` over `items` with at most `concurrency` in flight, stopping
 * dispatch on the first error but letting in-flight workers complete (so
 * nothing is aborted mid-write), then throw the first recorded error, if any.
 */
async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let nextIndex = 0;
  let aborted = false;
  const errors: unknown[] = [];

  const runOne = async (): Promise<void> => {
    while (nextIndex < items.length && !aborted) {
      const item = items[nextIndex++];
      try {
        await worker(item);
      } catch (error) {
        errors.push(error);
        aborted = true;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runOne()),
  );
  if (errors.length > 0) throw errors[0];
}

/** Cast the DB's `string` action to the narrower ActivityAction union. */
function toActivityRow(row: {
  id: number;
  novel_id: number;
  novel_name: string;
  slug: string;
  action: string;
  detail: string | null;
  created_at: string;
}): ActivityRow {
  return { ...row, action: row.action as ActivityAction };
}

/** Columns both activity readers project, activity + the linked novel's slug. */
const ACTIVITY_COLUMNS = [
  "activity.id",
  "activity.novel_id",
  "activity.novel_name",
  "activity.action",
  "activity.detail",
  "activity.created_at",
  "novels.slug",
] as const;
