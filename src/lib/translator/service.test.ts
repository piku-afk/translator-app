import SqliteDatabase from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { describe, expect, it } from "vitest";
import { up as createNovelsTable } from "../../../migrations/001_create_novels.ts";
import { up as rebuildNovelsCreateChapters } from "../../../migrations/003_add_failed_status_and_chapters.ts";
import { up as createGlossaryAndStageStatuses } from "../../../migrations/004_create_glossary_and_stage_statuses.ts";
import type { Database } from "../database/database";
import {
  DUPLICATE_NOVEL_ERROR,
  chapterFileKey,
  rawFileKey,
  type CreateNovelInput,
  type Novel,
} from "../novels/novels-core";
import {
  EXTRACTION_MAX_RETRIES,
  NOVEL_NOT_FOUND_ERROR,
  PARSE_MAX_RETRIES,
  createTranslatorService,
} from "./service";
import type {
  ModelNotesDiff,
  ModelPort,
  ObjectStorePort,
  ParseJobMessage,
  ParseQueuePort,
} from "./ports";

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
  calls: Array<{ chapterNumber: number; fn: "getNotesDiff"; sourceText: string }>;
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
  };
}

async function makeService() {
  const db = await createTestDb();
  const storage = createMemoryStorage();
  const parseQueue = createMemoryQueue();
  const extractionQueue = createMemoryQueue();
  const model = createFakeModel();
  const service = createTranslatorService({
    db,
    storage,
    parseQueue,
    extractionQueue,
    model,
  });
  return { db, storage, parseQueue, extractionQueue, model, service };
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
