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
import {
  DUPLICATE_NOVEL_ERROR,
  chapterFileKey,
  rawFileKey,
  translationFileKey,
  type CreateNovelInput,
  type Novel,
} from "../novels/novels-core";
import {
  EXTRACTION_MAX_RETRIES,
  NOVEL_NOT_FOUND_ERROR,
  PARSE_MAX_RETRIES,
  RERUN_MAX_RETRIES,
  TRANSLATION_CONCURRENCY,
  TRANSLATION_MAX_RETRIES,
  createTranslatorService,
} from "./service";
import type {
  ModelNotesDiff,
  ModelPort,
  ObjectStorePort,
  ParseJobMessage,
  ParseQueuePort,
} from "./ports";
import type { NamePair } from "./glossary";

// ---------------------------------------------------------------------------
// Port doubles: in-memory storage/queue, real Kysely over in-memory SQLite.
// No framework, network, or Cloudflare bindings.
// ---------------------------------------------------------------------------

async function createTestDb(): Promise<Kysely<Database>> {
  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: new SqliteDatabase(":memory:") }),
  });
  for (const up of [
    createNovelsTable,
    rebuildNovelsCreateChapters,
    createGlossaryAndStageStatuses,
    createActivity,
    addTranslationFailedToNovels,
    addTranslationActivityActions,
  ]) {
    await up(db);
  }
  return db;
}

function createMemoryStorage(): ObjectStorePort & {
  objects: Map<string, string>;
  putCount(): number;
} {
  const objects = new Map<string, string>();
  let putCount = 0;
  return {
    objects,
    putCount: () => putCount,
    async put(key, content) {
      putCount += 1;
      objects.set(key, content);
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
  };
}

function createMemoryQueue(): ParseQueuePort & {
  jobs: ParseJobMessage[];
  setFailing(failing: boolean): void;
} {
  const jobs: ParseJobMessage[] = [];
  let failing = false;
  return {
    jobs,
    setFailing(next) {
      failing = next;
    },
    async enqueue(job) {
      if (failing) {
        throw new Error("queue unavailable");
      }
      jobs.push(job);
    },
  };
}

interface FakeModel extends ModelPort {
  calls: Array<{
    chapterNumber: number;
    fn: "getNotesDiff" | "translate";
    sourceText: string;
    namePairs?: NamePair[];
  }>;
  setFailing(failing: boolean): void;
}

/**
 * A deterministic model double: filters are captured per chapter, and each
 * chapter yields a single new-names entry plus a matching notes addition. Set
 * failing to simulate a transient (or exhausting) model/gateway failure.
 */
function createFakeModel(): FakeModel {
  const calls: FakeModel["calls"] = [];
  let failing = false;
  return {
    calls,
    setFailing(next) {
      failing = next;
    },
    async getNotesDiff({ sourceText }) {
      calls.push({ chapterNumber: 0, fn: "getNotesDiff", sourceText });
      if (failing) throw new Error("model unavailable");
      const notes: ModelNotesDiff = {
        additions: [
          {
            category: "characters",
            source_names: `신규${sourceText.slice(0, 1)}`,
            english_names: `New${sourceText.slice(0, 1)}`,
            description: "New character from this chapter",
          },
        ],
        updates: [],
        deletions: [],
      };
      return { notesChanges: notes };
    },
    async translate({ sourceText, namePairs }) {
      calls.push({ chapterNumber: 0, fn: "translate", sourceText, namePairs });
      if (failing) throw new Error("model unavailable");
      const chapter = sourceText.trim().split(/\s+/)[0].replace(/[^0-9]/g, "") || "0";
      return { markdown: `# Chapter ${chapter}\n\nTranslated ${namePairs.length} names.` };
    },
  };
}

async function makeService() {
  const db = await createTestDb();
  const storage = createMemoryStorage();
  const parseQueue = createMemoryQueue();
  const extractionQueue = createMemoryQueue();
  const translationQueue = createMemoryQueue();
  const rerunQueue = createMemoryQueue();
  const model = createFakeModel();
  const service = createTranslatorService({
    db,
    storage,
    parseQueue,
    extractionQueue,
    translationQueue,
    rerunQueue,
    model,
  });
  return { db, storage, parseQueue, extractionQueue, translationQueue, rerunQueue, model, service };
}

const validInput: CreateNovelInput = {
  name: "The Beginning",
  total_chapters: 12,
  source_language: "ko",
  raw_text: "1화.\n첫 문장입니다.",
};

/** Insert a novel row directly, bypassing the service, to arrange state. */
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
  await db.insertInto("novels").values(row).execute();
  return refetchNovel(db, (await firstNovelId(db, row.slug))!);
}

async function firstNovelId(db: Kysely<Database>, slug: string): Promise<number | undefined> {
  const row = await db
    .selectFrom("novels")
    .select("id")
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row?.id;
}

async function refetchNovel(db: Kysely<Database>, id: number): Promise<Novel> {
  return (await db
    .selectFrom("novels")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow()) as Novel;
}

async function seedChapter(db: Kysely<Database>, novelId: number, number: number): Promise<void> {
  const timestamp = new Date().toISOString();
  await db
    .insertInto("chapters")
    .values({ novel_id: novelId, number, created_at: timestamp, updated_at: timestamp })
    .execute();
}

/** Upload a raw text with `chaptersPerMarker` Korean chapters for `novel`. */
async function seedRaw(
  storage: ReturnType<typeof createMemoryStorage>,
  slug: string,
  numbers: number[],
): Promise<void> {
  const raw = numbers.map((n) => `${n}화.\n본문입니다.`).join("\n\n");
  await storage.put(rawFileKey(slug), raw);
}

describe("createNovel", () => {
  it("creates a draft novel and uploads the raw text under its namespace", async () => {
    const { storage, service } = await makeService();

    const novel = await service.createNovel(validInput);

    expect(novel.status).toBe("draft");
    expect(novel.slug).toBe("the-beginning");
    expect(storage.objects.get(rawFileKey("the-beginning"))).toBe(validInput.raw_text);
  });

  it("rejects a duplicate slug without uploading anything", async () => {
    const { db, storage, service } = await makeService();
    await seedNovel(db, { slug: "the-beginning" });

    await expect(service.createNovel(validInput)).rejects.toThrow(DUPLICATE_NOVEL_ERROR);
    expect(storage.putCount()).toBe(0);
  });

  it("records a novel-created activity row once the insert succeeds", async () => {
    const { db, service } = await makeService();

    const novel = await service.createNovel(validInput);

    const rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      novel_id: novel.id,
      novel_name: "The Beginning",
      action: "novel created",
      detail: null,
    });
  });
});

describe("listNovels", () => {
  it("returns novels newest-first", async () => {
    const { db, service } = await makeService();
    await seedNovel(db, { slug: "older", created_at: "2026-01-01T00:00:00.000Z" });
    await seedNovel(db, { slug: "newer", created_at: "2026-01-02T00:00:00.000Z" });

    const novels = await service.listNovels();

    expect(novels.map((n) => n.slug)).toEqual(["newer", "older"]);
  });

  it("includes each novel's parsed chapter count, zero when unparsed", async () => {
    const { db, service } = await makeService();
    const parsed = await seedNovel(db, { slug: "parsed" });
    await seedChapter(db, parsed.id, 1);
    await seedChapter(db, parsed.id, 2);
    await seedNovel(db, { slug: "unparsed" });

    const novels = await service.listNovels();

    expect(novels.map((n) => [n.slug, n.parsed_chapters])).toEqual([
      ["unparsed", 0],
      ["parsed", 2],
    ]);
  });
});

describe("listRecentNovels", () => {
  it("returns the three most recently updated novels with parsed counts", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { slug: "recent" });
    await seedChapter(db, novel.id, 1);
    await seedNovel(db, { slug: "older", updated_at: "2026-01-01T00:00:00.000Z" });

    const novels = await service.listRecentNovels();

    expect(novels.map((n) => n.slug)).toEqual(["recent", "older"]);
    expect(novels.map((n) => n.parsed_chapters)).toEqual([1, 0]);
  });
});

describe("findNovelBySlug", () => {
  it("finds a novel by slug", async () => {
    const { db, service } = await makeService();
    await seedNovel(db, { slug: "the-beginning" });

    const novel = await service.findNovelBySlug("the-beginning");

    expect(novel?.slug).toBe("the-beginning");
  });

  it("returns undefined for an unknown slug", async () => {
    const { service } = await makeService();

    expect(await service.findNovelBySlug("missing")).toBeUndefined();
  });
});

describe("startParsing", () => {
  it("moves a draft novel to parsing and enqueues a parse job", async () => {
    const { db, parseQueue, service } = await makeService();
    const novel = await seedNovel(db);

    const updated = await service.startParsing(novel.slug);

    expect(updated.status).toBe("parsing");
    expect(parseQueue.jobs).toEqual([{ novelId: novel.id }]);
  });

  it("allows re-triggering parsing from parsing failed", async () => {
    const { db, parseQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing failed", last_error: "boom" });

    const updated = await service.startParsing(novel.slug);

    expect(updated.status).toBe("parsing");
    expect(parseQueue.jobs).toEqual([{ novelId: novel.id }]);
  });

  it("allows re-triggering parsing from needs review", async () => {
    const { db, parseQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "needs review" });

    const updated = await service.startParsing(novel.slug);

    expect(updated.status).toBe("parsing");
    expect(parseQueue.jobs).toEqual([{ novelId: novel.id }]);
  });

  it("rejects a novel that is not draft, parsing failed, or needs review", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "ready" });

    await expect(service.startParsing(novel.slug)).rejects.toThrow(
      'Only draft, parsing failed, or needs review novels can start parsing (currently "ready")',
    );
  });

  it("rejects an unknown novel", async () => {
    const { service } = await makeService();

    await expect(service.startParsing("missing")).rejects.toThrow(NOVEL_NOT_FOUND_ERROR);
  });

  it("reverts to the original status when the enqueue fails", async () => {
    const { db, parseQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing failed", last_error: "boom" });
    parseQueue.setFailing(true);

    await expect(service.startParsing(novel.slug)).rejects.toThrow("queue unavailable");

    const reverted = await refetchNovel(db, novel.id);
    expect(reverted.status).toBe("parsing failed");
    expect(parseQueue.jobs).toEqual([]);
  });

  it("records a parsing-started row only after the enqueue succeeds, and never on a rolled-back enqueue", async () => {
    const { db, parseQueue, service } = await makeService();
    const novel = await seedNovel(db);

    await service.startParsing(novel.slug);
    let rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["parsing started"]);
    expect(rows[0].novel_name).toBe(novel.name);

    // Reset to a start-eligible status, then make the enqueue fail and revert.
    await db
      .updateTable("novels")
      .set({ status: "parsing failed", last_error: "boom", updated_at: new Date().toISOString() })
      .where("id", "=", novel.id)
      .execute();
    parseQueue.setFailing(true);
    await expect(service.startParsing(novel.slug)).rejects.toThrow("queue unavailable");
    rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows).toHaveLength(1);
    const reverted = await refetchNovel(db, novel.id);
    expect(reverted.status).toBe("parsing failed");
  });
});

describe("runParseJob", () => {
  it("extracts chapters, writes one file per chapter to storage, inserts rows, and marks the novel ready", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 2 });
    await storage.put(rawFileKey(novel.slug), "1화.\n첫 문장입니다.\n\n2화.\n두 번째 문장입니다.");

    const settlement = await service.runParseJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    expect(storage.objects.get(chapterFileKey("the-beginning", 1))).toBe("1화.\n첫 문장입니다.");
    expect(storage.objects.get(chapterFileKey("the-beginning", 2))).toBe(
      "2화.\n두 번째 문장입니다.",
    );
    const rows = await db.selectFrom("chapters").selectAll().orderBy("number").execute();
    expect(rows.map((r) => [r.novel_id, r.number, r.status])).toEqual([
      [novel.id, 1, "queued"],
      [novel.id, 2, "queued"],
    ]);
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("ready");
    expect(updated.last_error).toBeNull();
  });

  it("marks a novel needs review when fewer chapters than declared are extracted", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 3 });
    await seedRaw(storage, novel.slug, [1, 2]);

    const settlement = await service.runParseJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("needs review");
    const rows = await db.selectFrom("chapters").selectAll().execute();
    expect(rows).toHaveLength(2);
  });

  it("marks a novel needs review when more chapters than declared are extracted", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 1 });
    await seedRaw(storage, novel.slug, [1, 2]);

    await service.runParseJob({ novelId: novel.id }, 1);

    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("needs review");
  });

  it("records parsing-ready on success and needs-review with the mismatch on a count mismatch", async () => {
    const { db, storage, service } = await makeService();
    const matching = await seedNovel(db, { status: "parsing", total_chapters: 1 });
    await seedRaw(storage, matching.slug, [1]);
    await service.runParseJob({ novelId: matching.id }, 1);

    const mismatching = await seedNovel(db, {
      slug: "mismatching",
      status: "parsing",
      total_chapters: 3,
    });
    await seedRaw(storage, mismatching.slug, [1, 2]);
    await service.runParseJob({ novelId: mismatching.id }, 1);

    const rows = await db.selectFrom("activity").selectAll().orderBy("id").execute();
    expect(rows.map((r) => r.action)).toEqual(["parsing ready", "needs review"]);
    expect(rows[0].detail).toBe("1 chapters extracted");
    expect(rows[1].detail).toBe("2 extracted, 3 declared");
    expect(rows[1].novel_name).toBe(mismatching.name);
  });

  it("clears a stale last_error when parsing succeeds", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 1, last_error: "boom" });
    await seedRaw(storage, novel.slug, [1]);

    await service.runParseJob({ novelId: novel.id }, 1);

    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("ready");
    expect(updated.last_error).toBeNull();
  });

  it("replaces chapter rows on a re-parse instead of duplicating them", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 1 });
    await seedChapter(db, novel.id, 9); // leftover from an earlier partial parse
    await seedRaw(storage, novel.slug, [1]);

    await service.runParseJob({ novelId: novel.id }, 1);

    const rows = await db.selectFrom("chapters").selectAll().orderBy("number").execute();
    expect(rows.map((r) => r.number)).toEqual([1]);
  });

  it("requests a retry when parsing fails, leaving the novel parsing", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 2 });
    // No raw file uploaded: reading it fails.

    const settlement = await service.runParseJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "retry" });
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("parsing");
    expect(storage.objects.size).toBe(0);
  });

  it("marks the novel parsing failed with last_error once retries are exhausted", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 2 });

    const settlement = await service.runParseJob({ novelId: novel.id }, PARSE_MAX_RETRIES);

    expect(settlement).toEqual({ outcome: "ack" });
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("parsing failed");
    expect(updated.last_error).toContain("Raw file missing");
  });

  it("records parsing-failed only on retry exhaustion, not on a transient retry", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "parsing", total_chapters: 2 });

    // A transient failure requests a retry and records nothing.
    expect((await service.runParseJob({ novelId: novel.id }, 1)).outcome).toBe("retry");
    expect(await db.selectFrom("activity").selectAll().execute()).toHaveLength(0);

    // Exhaustion finalizes, and only then records the failure.
    expect((await service.runParseJob({ novelId: novel.id }, PARSE_MAX_RETRIES)).outcome).toBe(
      "ack",
    );
    const rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["parsing failed"]);
    expect(rows[0].novel_name).toBe(novel.name);
    expect(rows[0].detail).toContain("Raw file missing");
  });

  it("records no activity for a stale or unknown-novel ack", async () => {
    const { db, service } = await makeService();

    await service.runParseJob({ novelId: 4242 }, 1);
    expect(await db.selectFrom("activity").selectAll().execute()).toHaveLength(0);
  });

  it("acks stale messages for novels no longer parsing", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "ready" });
    await storage.put(rawFileKey(novel.slug), "1화.\n본문입니다.");

    const settlement = await service.runParseJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    expect(storage.objects.size).toBe(1); // only the raw file; no chapter writes
    expect(await db.selectFrom("chapters").selectAll().execute()).toHaveLength(0);
  });

  it("acks messages for unknown novels", async () => {
    const { service } = await makeService();

    expect(await service.runParseJob({ novelId: 4242 }, 1)).toEqual({ outcome: "ack" });
  });
});

describe("startExtraction", () => {
  it("moves a ready novel to extracting and enqueues an extraction job", async () => {
    const { db, extractionQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "ready" });

    const updated = await service.startExtraction(novel.slug);

    expect(updated.status).toBe("extracting");
    expect(extractionQueue.jobs).toEqual([{ novelId: novel.id }]);
  });

  it("allows re-running extraction from names extracted", async () => {
    const { db, extractionQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "names extracted" });

    const updated = await service.startExtraction(novel.slug);

    expect(updated.status).toBe("extracting");
    expect(extractionQueue.jobs).toEqual([{ novelId: novel.id }]);
  });

  it("allows re-running extraction from extraction failed", async () => {
    const { db, extractionQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "extraction failed", last_error: "boom" });

    const updated = await service.startExtraction(novel.slug);

    expect(updated.status).toBe("extracting");
    expect(extractionQueue.jobs).toEqual([{ novelId: novel.id }]);
  });

  it("rejects a novel that is not ready, names extracted, or extraction failed", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "draft" });

    await expect(service.startExtraction(novel.slug)).rejects.toThrow(
      'Only ready, names extracted, or extraction failed novels can start extraction (currently "draft")',
    );
  });

  it("rejects an unknown novel", async () => {
    const { service } = await makeService();

    await expect(service.startExtraction("missing")).rejects.toThrow(NOVEL_NOT_FOUND_ERROR);
  });

  it("reverts to the original status when the enqueue fails", async () => {
    const { db, extractionQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "extraction failed", last_error: "boom" });
    extractionQueue.setFailing(true);

    await expect(service.startExtraction(novel.slug)).rejects.toThrow("queue unavailable");

    const reverted = await refetchNovel(db, novel.id);
    expect(reverted.status).toBe("extraction failed");
    expect(extractionQueue.jobs).toEqual([]);
  });

  it("records an extraction-started row only after the enqueue succeeds, and never on a rolled-back enqueue", async () => {
    const { db, extractionQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "ready" });

    await service.startExtraction(novel.slug);
    let rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["extraction started"]);
    expect(rows[0].novel_name).toBe(novel.name);

    // Reset to a start-eligible status, then make the enqueue fail and revert.
    await db
      .updateTable("novels")
      .set({ status: "extraction failed", last_error: "boom", updated_at: new Date().toISOString() })
      .where("id", "=", novel.id)
      .execute();
    extractionQueue.setFailing(true);
    await expect(service.startExtraction(novel.slug)).rejects.toThrow("queue unavailable");
    rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows).toHaveLength(1);
    const reverted = await refetchNovel(db, novel.id);
    expect(reverted.status).toBe("extraction failed");
  });
});

describe("runExtractionJob", () => {
  /** Seed a ready novel with `numbers` chapter rows and matching chapter files. */
  async function seedExtractionNovel(
    db: Kysely<Database>,
    storage: ReturnType<typeof createMemoryStorage>,
    numbers: number[],
  ): Promise<Novel> {
    const novel = await seedNovel(db, { status: "extracting", total_chapters: numbers.length });
    for (const number of numbers) {
      await seedChapter(db, novel.id, number);
      await storage.put(chapterFileKey(novel.slug, number), `${number}화.\n${number}번째 본문입니다.`);
    }
    return novel;
  }

  it("walks chapters sequentially, commits each diff, and reaches names extracted", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1, 2]);

    const settlement = await service.runExtractionJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    const chapters = await db.selectFrom("chapters").selectAll().orderBy("number").execute();
    expect(chapters.map((c) => c.status)).toEqual(["names extracted", "names extracted"]);
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("names extracted");
    expect(updated.last_error).toBeNull();

    const entries = await db.selectFrom("glossary_entries").selectAll().orderBy("id").execute();
    expect(entries.map((e) => e.category)).toEqual(["characters", "characters"]);
    expect(entries[0].source_names).toContain("신규1");
    expect(entries[1].source_names).toContain("신규2");
  });

  it("feeds the model Fuse-filtered inputs per chapter", async () => {
    const { db, model, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1]);

    await service.runExtractionJob({ novelId: novel.id }, 1);

    expect(model.calls.map((c) => c.fn)).toEqual(["getNotesDiff"]);
    expect(model.calls[0].sourceText).toContain("1화");
  });

  it("resumes from the last completed chapter, skipping names-extracted chapters", async () => {
    const { db, model, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1, 2]);
    await db
      .updateTable("chapters")
      .set({ status: "names extracted" })
      .where("novel_id", "=", novel.id)
      .where("number", "=", 1)
      .execute();

    const settlement = await service.runExtractionJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    // Only chapter 2 was fed to the model.
    expect(model.calls.filter((c) => c.fn === "getNotesDiff")).toHaveLength(1);
    expect(model.calls[0].sourceText).toContain("2화");
    const chapters = await db.selectFrom("chapters").selectAll().orderBy("number").execute();
    expect(chapters.map((c) => c.status)).toEqual(["names extracted", "names extracted"]);
  });

  it("never duplicates entities when re-running the same diff", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1]);

    await service.runExtractionJob({ novelId: novel.id }, 1);
    await service.startExtraction(novel.slug); // re-trigger
    await service.runExtractionJob({ novelId: novel.id }, 1);

    const entries = await db.selectFrom("glossary_entries").selectAll().execute();
    expect(entries).toHaveLength(1);
  });

  it("requests a retry on a transient model error, leaving the novel extracting", async () => {
    const { db, model, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1]);
    model.setFailing(true);

    const settlement = await service.runExtractionJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "retry" });
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("extracting");
  });

  it("moves the novel to extraction failed with last_error once retries are exhausted", async () => {
    const { db, model, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1]);
    model.setFailing(true);

    const settlement = await service.runExtractionJob({ novelId: novel.id }, EXTRACTION_MAX_RETRIES);

    expect(settlement).toEqual({ outcome: "ack" });
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("extraction failed");
    expect(updated.last_error).toContain("model unavailable");
  });

  it("records names-extracted on success", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1]);

    await service.runExtractionJob({ novelId: novel.id }, 1);

    const rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["names extracted"]);
    expect(rows[0].novel_name).toBe(novel.name);
  });

  it("records extraction-failed only on retry exhaustion, not on a transient retry", async () => {
    const { db, model, storage, service } = await makeService();
    const novel = await seedExtractionNovel(db, storage, [1]);
    model.setFailing(true);

    // A transient failure requests a retry and records nothing.
    expect((await service.runExtractionJob({ novelId: novel.id }, 1)).outcome).toBe("retry");
    let rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows).toHaveLength(0);

    // Exhaustion finalizes, and only then records the failure.
    expect(
      (await service.runExtractionJob({ novelId: novel.id }, EXTRACTION_MAX_RETRIES)).outcome,
    ).toBe("ack");
    rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["extraction failed"]);
    expect(rows[0].detail).toContain("model unavailable");
  });

  it("acks stale messages for novels no longer extracting", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "ready" });

    const settlement = await service.runExtractionJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    expect(await db.selectFrom("chapters").selectAll().execute()).toHaveLength(0);
  });

  it("acks messages for unknown novels", async () => {
    const { service } = await makeService();

    expect(await service.runExtractionJob({ novelId: 4242 }, 1)).toEqual({ outcome: "ack" });
  });
});

describe("startTranslation", () => {
  it("enqueues a translation job and flips the novel to translating", async () => {
    const { db, translationQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "names extracted" });

    const updated = await service.startTranslation(novel.slug);

    expect(updated.status).toBe("translating");
    expect(translationQueue.jobs).toEqual([{ novelId: novel.id }]);
    expect((await refetchNovel(db, novel.id)).status).toBe("translating");
  });

  it("rejects statuses other than names extracted or translation failed", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "ready" });

    await expect(service.startTranslation(novel.slug)).rejects.toThrow(
      "Only names extracted or translation failed novels can start translation",
    );
  });

  it("rejects an unknown slug", async () => {
    const { service } = await makeService();

    await expect(service.startTranslation("missing")).rejects.toThrow(NOVEL_NOT_FOUND_ERROR);
  });

  it("reverts the novel to its prior status when the enqueue fails", async () => {
    const { db, translationQueue, service } = await makeService();
    const novel = await seedNovel(db, { status: "names extracted" });
    translationQueue.setFailing(true);

    await expect(service.startTranslation(novel.slug)).rejects.toThrow("queue unavailable");

    expect((await refetchNovel(db, novel.id)).status).toBe("names extracted");
  });

  it("records translation-started on a committed enqueue", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "names extracted" });

    await service.startTranslation(novel.slug);

    const rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["translation started"]);
  });
});

describe("runTranslationJob", () => {
  /** Seed a `translating` novel with `numbers` chapter rows + files + glossary. */
  async function seedTranslatingNovel(
    db: Kysely<Database>,
    storage: ReturnType<typeof createMemoryStorage>,
    numbers: number[],
  ): Promise<Novel> {
    const novel = await seedNovel(db, { status: "translating", total_chapters: numbers.length });
    for (const number of numbers) {
      await seedChapter(db, novel.id, number);
      await storage.put(chapterFileKey(novel.slug, number), `${number}화.\n본문 ${number} 입니다.`);
      await db
        .insertInto("glossary_entries")
        .values({
          novel_id: novel.id,
          category: "characters",
          source_names: `${number}화`,
          english_names: `Chapter ${number}`,
          description: `character of chapter ${number}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();
    }
    return novel;
  }

  it("translates all chapters, writes markdown, and reaches completed", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedTranslatingNovel(db, storage, [1, 2]);

    const settlement = await service.runTranslationJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    const chapters = await db.selectFrom("chapters").selectAll().orderBy("number").execute();
    expect(chapters.map((c) => c.status)).toEqual(["translated", "translated"]);
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("completed");
    expect(updated.last_error).toBeNull();
    expect(model.calls.filter((c) => c.fn === "translate")).toHaveLength(2);
    expect(storage.objects.get(translationFileKey(novel.slug, 1))).toContain("# Chapter 1");
    expect(storage.objects.get(translationFileKey(novel.slug, 2))).toContain("# Chapter 2");
  });

  it("feeds the model only Name pairs, never notes or descriptions", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedTranslatingNovel(db, storage, [1]);

    await service.runTranslationJob({ novelId: novel.id }, 1);

    const translateCalls = model.calls.filter((c) => c.fn === "translate");
    expect(translateCalls).toHaveLength(1);
    expect(translateCalls[0].namePairs).toEqual([
      { source_names: "1화", english_names: "Chapter 1" },
    ]);
  });

  it("resumes from the last translated chapter, skipping translated chapters", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedTranslatingNovel(db, storage, [1, 2]);
    await db
      .updateTable("chapters")
      .set({ status: "translated", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .where("number", "=", 1)
      .execute();
    await storage.put(translationFileKey(novel.slug, 1), "# Chapter 1\n\nExisting.");

    const settlement = await service.runTranslationJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    const translateCalls = model.calls.filter((c) => c.fn === "translate");
    expect(translateCalls).toHaveLength(1);
    expect(translateCalls[0].sourceText).toContain("2화");
    const chapters = await db.selectFrom("chapters").selectAll().orderBy("number").execute();
    expect(chapters.map((c) => c.status)).toEqual(["translated", "translated"]);
    // Chapter 1's markdown was not overwritten.
    expect(storage.objects.get(translationFileKey(novel.slug, 1))).toBe("# Chapter 1\n\nExisting.");
  });

  it("bounds concurrency to TRANSLATION_CONCURRENCY", async () => {
    const db = await createTestDb();
    const storage = createMemoryStorage();
    const translationQueue = createMemoryQueue();
    const modelPort = { ...createFakeModel() };
    let inFlight = 0;
    let maxInFlight = 0;
    const originalTranslate = modelPort.translate.bind(modelPort);
    modelPort.translate = async (params) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = await originalTranslate(params);
      inFlight -= 1;
      return result;
    };
    const service = createTranslatorService({
      db,
      storage,
      parseQueue: createMemoryQueue() as never,
      extractionQueue: createMemoryQueue() as never,
      translationQueue,
      rerunQueue: createMemoryQueue() as never,
      model: modelPort,
    });
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8];
    const novel = await seedNovel(db, { status: "translating", total_chapters: numbers.length });
    for (const n of numbers) {
      await seedChapter(db, novel.id, n);
      await storage.put(chapterFileKey(novel.slug, n), `${n}화.\n본문 ${n} 입니다.`);
      await db
        .insertInto("glossary_entries")
        .values({
          novel_id: novel.id,
          category: "characters",
          source_names: `${n}화`,
          english_names: `Chapter ${n}`,
          description: `character of chapter ${n}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();
    }

    await service.runTranslationJob({ novelId: novel.id }, 1);

    expect(maxInFlight).toBeLessThanOrEqual(TRANSLATION_CONCURRENCY);
  });

  it("requests a retry on a transient model error, leaving the novel translating", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedTranslatingNovel(db, storage, [1]);
    model.setFailing(true);

    const settlement = await service.runTranslationJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "retry" });
    expect((await refetchNovel(db, novel.id)).status).toBe("translating");
  });

  it("moves the novel to translation failed with last_error once retries are exhausted", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedTranslatingNovel(db, storage, [1]);
    model.setFailing(true);

    const settlement = await service.runTranslationJob(
      { novelId: novel.id },
      TRANSLATION_MAX_RETRIES,
    );

    expect(settlement).toEqual({ outcome: "ack" });
    const updated = await refetchNovel(db, novel.id);
    expect(updated.status).toBe("translation failed");
    expect(updated.last_error).toContain("model unavailable");
  });

  it("records translation-completed on success", async () => {
    const { db, service, storage } = await makeService();
    const novel = await seedTranslatingNovel(db, storage, [1]);

    await service.runTranslationJob({ novelId: novel.id }, 1);

    const rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["translation completed"]);
  });

  it("records translation-failed only on retry exhaustion, not on a transient retry", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedTranslatingNovel(db, storage, [1]);
    model.setFailing(true);

    expect((await service.runTranslationJob({ novelId: novel.id }, 1)).outcome).toBe("retry");
    expect(await db.selectFrom("activity").selectAll().execute()).toHaveLength(0);

    expect(
      (await service.runTranslationJob({ novelId: novel.id }, TRANSLATION_MAX_RETRIES)).outcome,
    ).toBe("ack");
    const rows = await db.selectFrom("activity").selectAll().execute();
    expect(rows.map((r) => r.action)).toEqual(["translation failed"]);
    expect(rows[0].detail).toContain("model unavailable");
  });

  it("acks stale messages for novels no longer translating", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "completed" });

    const settlement = await service.runTranslationJob({ novelId: novel.id }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
  });

  it("acks messages for unknown novels", async () => {
    const { service } = await makeService();

    expect(await service.runTranslationJob({ novelId: 4242 }, 1)).toEqual({ outcome: "ack" });
  });
});

describe("rerunChapter", () => {
  /** Seed a `completed` novel with `number`s of already-handled chapters. */
  async function seedRerunnableNovel(
    db: Kysely<Database>,
    storage: ReturnType<typeof createMemoryStorage>,
    numbers: number[],
  ): Promise<Novel> {
    const novel = await seedNovel(db, { status: "completed", total_chapters: numbers.length });
    for (const number of numbers) {
      await seedChapter(db, novel.id, number);
      await storage.put(chapterFileKey(novel.slug, number), `${number}화.\n본문 ${number} 입니다.`);
      await storage.put(translationFileKey(novel.slug, number), `# Chapter ${number}\n\nOld markdown.`);
      await db
        .updateTable("chapters")
        .set({ status: "translated", updated_at: new Date().toISOString() })
        .where("novel_id", "=", novel.id)
        .where("number", "=", number)
        .execute();
    }
    return novel;
  }

  it("flips the chapter to translating and enqueues a rerun job", async () => {
    const { db, rerunQueue, service, storage } = await makeService();
    const novel = await seedRerunnableNovel(db, storage, [1, 2]);

    await service.rerunChapter(novel.slug, 1);

    expect(rerunQueue.jobs).toEqual([{ novelId: novel.id, chapterNumber: 1 }]);
    const chapter = await db
      .selectFrom("chapters")
      .select("status")
      .where("novel_id", "=", novel.id)
      .where("number", "=", 1)
      .executeTakeFirst();
    expect(chapter?.status).toBe("translating");
  });

  it("rejects non-rerunnable chapter statuses", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "completed", total_chapters: 1 });
    await seedChapter(db, novel.id, 1);
    // status defaults to `queued` - not rerunnable.

    await expect(service.rerunChapter(novel.slug, 1)).rejects.toThrow(
      "Only translated or failed chapters can be rerun",
    );
  });

  it("rejects rerun during an active pass", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "translating", total_chapters: 1 });
    await seedChapter(db, novel.id, 1);
    await db
      .updateTable("chapters")
      .set({ status: "translated", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .execute();

    await expect(service.rerunChapter(novel.slug, 1)).rejects.toThrow(
      'Cannot rerun a chapter while the novel is "translating"',
    );
  });

  it("rejects unknown novel", async () => {
    const { service } = await makeService();
    await expect(service.rerunChapter("missing", 1)).rejects.toThrow(NOVEL_NOT_FOUND_ERROR);
  });

  it("rejects an unknown chapter number", async () => {
    const { db, service, storage } = await makeService();
    const novel = await seedRerunnableNovel(db, storage, [1]);

    await expect(service.rerunChapter(novel.slug, 99)).rejects.toThrow(/not found/i);
  });

  it("reverts the chapter status if enqueue fails", async () => {
    const { db, rerunQueue, service, storage } = await makeService();
    rerunQueue.setFailing(true);
    const novel = await seedRerunnableNovel(db, storage, [1]);

    await expect(service.rerunChapter(novel.slug, 1)).rejects.toThrow("queue unavailable");
    const chapter = await db
      .selectFrom("chapters")
      .select("status")
      .where("novel_id", "=", novel.id)
      .where("number", "=", 1)
      .executeTakeFirst();
    expect(chapter?.status).toBe("translated");
  });
});

describe("runRerunJob", () => {
  it("re-extracts and re-translates, overwrites markdown, and commits translated", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedNovel(db, { status: "completed", total_chapters: 1 });
    await seedChapter(db, novel.id, 1);
    await storage.put(chapterFileKey(novel.slug, 1), `1화.\n본문 1 입니다.`);
    await storage.put(translationFileKey(novel.slug, 1), `# Chapter 1\n\nOld markdown.`);
    await db
      .updateTable("chapters")
      .set({ status: "translating", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .execute();

    const settlement = await service.runRerunJob({ novelId: novel.id, chapterNumber: 1 }, 1);

    expect(settlement).toEqual({ outcome: "ack" });
    const chapter = await db
      .selectFrom("chapters")
      .select(["status"])
      .where("novel_id", "=", novel.id)
      .where("number", "=", 1)
      .executeTakeFirst();
    expect(chapter?.status).toBe("translated");
    // Novel status untouched.
    expect((await refetchNovel(db, novel.id)).status).toBe("completed");
    // Overwritten markdown.
    expect(storage.objects.get(translationFileKey(novel.slug, 1))).toContain("# Chapter 1");
    // No novel-level Activity recorded.
    expect(await db.selectFrom("activity").selectAll().execute()).toHaveLength(0);
    // Both model calls happened: extraction (notes) + translation.
    const fns = model.calls.map((c) => c.fn);
    expect(fns).toContain("getNotesDiff");
    expect(fns).toContain("translate");
  });

  it("does not duplicate glossary entries on repeat rerun", async () => {
    const { db, service, storage } = await makeService();
    const novel = await seedNovel(db, { status: "completed", total_chapters: 1 });
    await seedChapter(db, novel.id, 1);
    await storage.put(chapterFileKey(novel.slug, 1), `1화.\n본문 1 입니다.`);
    await db
      .updateTable("chapters")
      .set({ status: "translating", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .execute();

    await service.runRerunJob({ novelId: novel.id, chapterNumber: 1 }, 1);
    // The first rerun commits the chapter to `translated`; a second message is
    // stale (chapter no longer `translating`) and acks without reworking.
    await service.runRerunJob({ novelId: novel.id, chapterNumber: 1 }, 1);

    const count = await db.selectFrom("glossary_entries").selectAll().execute();
    expect(count).toHaveLength(1);
  });

  it("marks the chapter failed on retry exhaustion", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedNovel(db, { status: "completed", total_chapters: 1 });
    await seedChapter(db, novel.id, 1);
    await storage.put(chapterFileKey(novel.slug, 1), `1화.\n본문 1 입니다.`);
    await db
      .updateTable("chapters")
      .set({ status: "translating", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .execute();
    model.setFailing(true);

    const settlement = await service.runRerunJob(
      { novelId: novel.id, chapterNumber: 1 },
      RERUN_MAX_RETRIES,
    );

    expect(settlement).toEqual({ outcome: "ack" });
    const chapter = await db
      .selectFrom("chapters")
      .select(["status"])
      .where("novel_id", "=", novel.id)
      .where("number", "=", 1)
      .executeTakeFirst();
    expect(chapter?.status).toBe("failed");
  });

  it("requests a retry on a transient failure", async () => {
    const { db, model, service, storage } = await makeService();
    const novel = await seedNovel(db, { status: "completed", total_chapters: 1 });
    await seedChapter(db, novel.id, 1);
    await storage.put(chapterFileKey(novel.slug, 1), `1화.\n본문 1 입니다.`);
    await db
      .updateTable("chapters")
      .set({ status: "translating", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .execute();
    model.setFailing(true);

    const settlement = await service.runRerunJob({ novelId: novel.id, chapterNumber: 1 }, 1);

    expect(settlement).toEqual({ outcome: "retry" });
    expect((await refetchNovel(db, novel.id)).status).toBe("completed");
  });

  it("acks messages when the chapter is not translating", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "completed", total_chapters: 1 });
    await seedChapter(db, novel.id, 1);
    // status stays `translated` - message is stale.
    await db
      .updateTable("chapters")
      .set({ status: "translated", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .execute();

    expect(await service.runRerunJob({ novelId: novel.id, chapterNumber: 1 }, 1)).toEqual({
      outcome: "ack",
    });
  });

  it("acks messages for unknown novels or chapters", async () => {
    const { service } = await makeService();

    expect(await service.runRerunJob({ novelId: 4242, chapterNumber: 1 }, 1)).toEqual({
      outcome: "ack",
    });
  });
});

describe("listChapters", () => {
  it("returns per-chapter stage rows ordered by number", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db, { status: "completed", total_chapters: 2 });
    await seedChapter(db, novel.id, 2);
    await seedChapter(db, novel.id, 1);
    await db
      .updateTable("chapters")
      .set({ status: "translated", updated_at: new Date().toISOString() })
      .where("novel_id", "=", novel.id)
      .execute();

    const chapters = await service.listChapters(novel.slug);

    expect(chapters.map((c) => c.number)).toEqual([1, 2]);
    expect(chapters.every((c) => c.status === "translated")).toBe(true);
  });

  it("throws for an unknown novel", async () => {
    const { service } = await makeService();

    await expect(service.listChapters("missing")).rejects.toThrow(NOVEL_NOT_FOUND_ERROR);
  });
});

describe("getNovelDetail", () => {
  it("returns the novel with its parsed chapter count", async () => {
    const { db, service } = await makeService();
    const novel = await seedNovel(db);
    await seedChapter(db, novel.id, 1);
    await seedChapter(db, novel.id, 2);

    const detail = await service.getNovelDetail("the-beginning");

    expect(detail?.novel.slug).toBe("the-beginning");
    expect(detail?.chapter_count).toBe(2);
  });

  it("reports zero chapters for an unparsed novel", async () => {
    const { db, service } = await makeService();
    await seedNovel(db);

    const detail = await service.getNovelDetail("the-beginning");

    expect(detail?.chapter_count).toBe(0);
  });

  it("returns undefined for an unknown slug", async () => {
    const { service } = await makeService();

    expect(await service.getNovelDetail("missing")).toBeUndefined();
  });
});

describe("listGlossary", () => {
  it("returns the glossary committed by extraction, split into variation arrays", async () => {
    const { db, storage, service } = await makeService();
    const novel = await seedNovel(db, { status: "extracting", total_chapters: 2 });
    await seedChapter(db, novel.id, 1);
    await seedChapter(db, novel.id, 2);
    await storage.put(chapterFileKey(novel.slug, 1), "1화.\n첫번째 본문입니다.");
    await storage.put(chapterFileKey(novel.slug, 2), "2화.\n두번째 본문입니다.");

    await service.runExtractionJob({ novelId: novel.id }, 1);

    const glossary = await service.listGlossary(novel.slug);
    expect(glossary.map((entry) => entry.category)).toEqual(["characters", "characters"]);
    expect(glossary[0].sourceNames).toContain("신규1");
    expect(glossary[1].sourceNames).toContain("신규2");
    expect(glossary[0].englishNames[0]).toBe("New1");
  });

  it("returns an empty glossary for a novel that has not been extracted", async () => {
    const { db, service } = await makeService();
    await seedNovel(db);

    expect(await service.listGlossary("the-beginning")).toEqual([]);
  });

  it("throws NOVEL_NOT_FOUND_ERROR for an unknown slug", async () => {
    const { service } = await makeService();

    await expect(service.listGlossary("missing")).rejects.toThrow(NOVEL_NOT_FOUND_ERROR);
  });
});

/** Insert an activity row directly, bypassing the service, to arrange state. */
async function seedActivity(
  db: Kysely<Database>,
  overrides: Partial<{
    novel_id: number;
    novel_name: string;
    action: string;
    detail: string | null;
    created_at: string;
  }> = {},
): Promise<void> {
  await db
    .insertInto("activity")
    .values({
      novel_id: 1,
      novel_name: "The Beginning",
      action: "novel created",
      detail: null,
      created_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    })
    .execute();
}

describe("listRecentActivities", () => {
  it("returns the most recent activity across all novels, newest first, capped at the limit", async () => {
    const { db, service } = await makeService();
    const first = await seedNovel(db, { slug: "first" });
    const second = await seedNovel(db, { slug: "second" });
    await seedActivity(db, { novel_id: first.id, created_at: "2026-01-01T00:00:00.000Z" });
    await seedActivity(db, {
      novel_id: second.id,
      action: "parsing ready",
      created_at: "2026-01-03T00:00:00.000Z",
    });
    await seedActivity(db, { novel_id: first.id, action: "parsing failed", created_at: "2026-01-02T00:00:00.000Z" });

    const rows = await service.listRecentActivities(2);

    expect(rows.map((r) => r.action)).toEqual(["parsing ready", "parsing failed"]);
    expect(rows).toHaveLength(2);
  });
});

describe("listActivitiesForNovel", () => {
  it("returns one novel's full history in chronological (oldest-first) order", async () => {
    const { db, service } = await makeService();
    const first = await seedNovel(db, { slug: "first" });
    const second = await seedNovel(db, { slug: "second" });
    await seedActivity(db, { novel_id: first.id, created_at: "2026-01-01T00:00:00.000Z" });
    await seedActivity(db, {
      novel_id: first.id,
      action: "parsing started",
      created_at: "2026-01-02T00:00:00.000Z",
    });
    await seedActivity(db, {
      novel_id: second.id,
      action: "parsing ready",
      created_at: "2026-01-03T00:00:00.000Z",
    });

    const rows = await service.listActivitiesForNovel(first.id);

    expect(rows.map((r) => r.action)).toEqual(["novel created", "parsing started"]);
    expect(rows.every((r) => r.novel_id === first.id)).toBe(true);
  });

  it("returns an empty list for a novel with no activity", async () => {
    const { service } = await makeService();

    expect(await service.listActivitiesForNovel(4242)).toEqual([]);
  });
});
