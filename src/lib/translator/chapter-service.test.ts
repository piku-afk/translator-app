import SqliteDatabase from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { describe, expect, it } from "vitest";
import { up as createNovelsTable } from "../../../migrations/001_create_novels.ts";
import { up as rebuildNovelsCreateChapters } from "../../../migrations/003_add_failed_status_and_chapters.ts";
import { up as createGlossaryAndStageStatuses } from "../../../migrations/004_create_glossary_and_stage_statuses.ts";
import { up as createActivity } from "../../../migrations/005_create_activity.ts";
import { up as addTranslationFailedToNovels } from "../../../migrations/007_add_translation_failed_status.ts";
import { up as addTranslationActivityActions } from "../../../migrations/008_add_translation_activity_actions.ts";
import type { Database } from "../database/database";
import { translationFileKey, type Novel } from "../novels/novels-core";
import { createChapterTranslateService } from "./chapter-service";
import type { ModelNotesDiff, ModelPort, ObjectStorePort } from "./ports";
import type { NamePair } from "./glossary";

// ---------------------------------------------------------------------------
// Port doubles: in-memory storage/model, real Kysely over in-memory SQLite.
// No framework, network, or Cloudflare bindings.
// ---------------------------------------------------------------------------

const MIGRATIONS = [
  createNovelsTable,
  rebuildNovelsCreateChapters,
  createGlossaryAndStageStatuses,
  createActivity,
  addTranslationFailedToNovels,
  addTranslationActivityActions,
];

async function createTestDb(): Promise<Kysely<Database>> {
  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: new SqliteDatabase(":memory:") }),
  });
  for (const up of MIGRATIONS) {
    await up(db);
  }
  return db;
}

function createMemoryStorage(): ObjectStorePort & {
  objects: Map<string, string>;
} {
  const objects = new Map<string, string>();
  return {
    objects,
    async put(key, content) {
      objects.set(key, content);
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
  };
}

interface FakeModel extends ModelPort {
  calls: Array<{
    fn: "getNotesDiff" | "translate";
    sourceText: string;
    namePairs?: NamePair[];
  }>;
  /** Make only the translate call fail; the notes diff still succeeds so the
   * merge is computed in memory and must not be persisted. */
  setFailing(failing: boolean): void;
}

/** A deterministic model double: one new character per chapter text, and a
 * markdown headline taken from the first number in the text. Set failing to
 * simulate a model/gateway failure on the translate call. */
function createFakeModel(): FakeModel {
  const calls: FakeModel["calls"] = [];
  let failing = false;
  return {
    calls,
    setFailing(next) {
      failing = next;
    },
    async getNotesDiff({ sourceText }) {
      calls.push({ fn: "getNotesDiff", sourceText });
      // The notes diff always succeeds: a "failed translate" must mean the
      // merge was computed in memory but never persisted (all-or-nothing).
      const notes: ModelNotesDiff = {
        additions: [
          {
            category: "characters",
            source_names: `주인공${sourceText.slice(0, 1)}`,
            english_names: `Hero${sourceText.slice(0, 1)}`,
            description: "New character from this chapter",
          },
        ],
        updates: [],
        deletions: [],
      };
      return { notesChanges: notes };
    },
    async translate({ sourceText, namePairs }) {
      calls.push({ fn: "translate", sourceText, namePairs });
      if (failing) throw new Error("model unavailable");
      const chapter =
        sourceText
          .trim()
          .split(/\s+/)[0]
          .replace(/[^0-9]/g, "") || "0";
      return { markdown: `# Chapter ${chapter}\n\nTranslated ${namePairs.length} names.` };
    },
  };
}

async function makeService() {
  const db = await createTestDb();
  const storage = createMemoryStorage();
  const model = createFakeModel();
  const service = createChapterTranslateService({ db, storage, model });
  return { db, storage, model, service };
}

/** Insert a novel row directly, bypassing any service, to arrange state. */
async function seedNovel(db: Kysely<Database>, overrides: Partial<Novel> = {}): Promise<Novel> {
  const timestamp = new Date().toISOString();
  const row = {
    name: "The Beginning",
    slug: "the-beginning",
    source_language: "ko",
    total_chapters: 2,
    status: "draft",
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
  // The insert returns nothing; refetch by slug to get the generated id.
  await db.insertInto("novels").values(row).execute();
  return (await db
    .selectFrom("novels")
    .selectAll()
    .where("slug", "=", row.slug)
    .executeTakeFirstOrThrow()) as Novel;
}

describe("createChapterTranslateService", () => {
  it("translates a fresh chapter: writes markdown, merges the glossary, and inserts a translated row", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db);

    await service.translateChapter({
      slug: novel.slug,
      chapterNumber: 1,
      pastedText: "1화.\n본문입니다.",
    });

    // Markdown written to the translation key - nothing else on storage.
    expect(storage.objects.get(translationFileKey(novel.slug, 1))).toBe(
      "# Chapter 1\n\nTranslated 0 names.",
    );
    expect(storage.objects.size).toBe(1);
    // Glossary merged.
    const entries = await db.selectFrom("glossary_entries").selectAll().execute();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      novel_id: novel.id,
      category: "characters",
    });
    expect(entries[0].source_names).toContain("주인공1");
    // Chapter row inserted at `translated` - never `translating`.
    const rows = await db.selectFrom("chapters").selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ novel_id: novel.id, number: 1, status: "translated" });
  });

  it("re-translating an existing chapter re-merges without duplicating glossary entries", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db);
    const input = { slug: novel.slug, chapterNumber: 1, pastedText: "1화.\n본문입니다." };

    await service.translateChapter(input);
    await service.translateChapter(input);

    const entries = await db.selectFrom("glossary_entries").selectAll().execute();
    expect(entries).toHaveLength(1); // same entity merged, not duplicated
    const rows = await db.selectFrom("chapters").selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("translated");
  });

  it("a failed translate leaves no partial glossary and no written markdown", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedNovel(db);
    model.setFailing(true);

    await expect(
      service.translateChapter({
        slug: novel.slug,
        chapterNumber: 1,
        pastedText: "1화.\n본문입니다.",
      }),
    ).rejects.toThrow("model unavailable");

    // The notes diff succeeded in memory, but the failed translate means
    // nothing committed: no glossary entries, no markdown, no chapter row.
    expect(await db.selectFrom("glossary_entries").selectAll().execute()).toEqual([]);
    expect(storage.objects.size).toBe(0);
    expect(await db.selectFrom("chapters").selectAll().execute()).toEqual([]);
  });

  it("a fresh chapter number inserts a row; an existing number updates it", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db);
    await service.translateChapter({
      slug: novel.slug,
      chapterNumber: 1,
      pastedText: "1화.\n본문입니다.",
    });
    const firstRow = (await db.selectFrom("chapters").select("id").executeTakeFirstOrThrow()).id;

    // Re-translate chapter 1: same row updated (id unchanged), still one row.
    await service.translateChapter({
      slug: novel.slug,
      chapterNumber: 1,
      pastedText: "1화.\n새 본문입니다.",
    });
    // Translating a fresh number inserts a second row.
    await service.translateChapter({
      slug: novel.slug,
      chapterNumber: 2,
      pastedText: "2화.\n본문입니다.",
    });

    const rows = await db.selectFrom("chapters").selectAll().orderBy("number").execute();
    expect(rows.map((r) => [r.number, r.status])).toEqual([
      [1, "translated"],
      [2, "translated"],
    ]);
    const chapterOne = rows.find((r) => r.number === 1)!;
    expect(chapterOne.id).toBe(firstRow); // updated in place, never duplicated
    expect(storage.objects.get(translationFileKey(novel.slug, 1))).toBe(
      "# Chapter 1\n\nTranslated 0 names.",
    );
    expect(storage.objects.get(translationFileKey(novel.slug, 2))).toBe(
      "# Chapter 2\n\nTranslated 0 names.",
    );
  });

  it("throws a NOVEL_NOT_FOUND_ERROR-style error for an unknown slug", async () => {
    const { storage, service } = await makeService();

    await expect(
      service.translateChapter({ slug: "missing", chapterNumber: 1, pastedText: "1화." }),
    ).rejects.toThrow("Novel not found");
    expect(storage.objects.size).toBe(0);
  });
});
