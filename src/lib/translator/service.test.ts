import SqliteDatabase from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { describe, expect, it } from "vitest";
import { up as createNovelsTable } from "../../../migrations/001_create_novels.ts";
import type { Database } from "../database/database";
import {
  DUPLICATE_NOVEL_ERROR,
  rawFileKey,
  type CreateNovelInput,
  type Novel,
} from "../novels/novels-core";
import { createTranslatorService } from "./service";
import type { ObjectStorePort, ParseJobMessage, ParseQueuePort } from "./ports";

// ---------------------------------------------------------------------------
// Port doubles: in-memory storage/queue, real Kysely over in-memory SQLite.
// No framework, network, or Cloudflare bindings.
// ---------------------------------------------------------------------------

async function createTestDb(): Promise<Kysely<Database>> {
  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: new SqliteDatabase(":memory:") }),
  });
  for (const up of [createNovelsTable]) {
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

async function makeService() {
  const db = await createTestDb();
  const storage = createMemoryStorage();
  const parseQueue = createMemoryQueue();
  const service = createTranslatorService({ db, storage, parseQueue });
  return { db, storage, parseQueue, service };
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
  return db
    .selectFrom("novels")
    .selectAll()
    .where("slug", "=", row.slug)
    .orderBy("id", "desc")
    .executeTakeFirstOrThrow() as Promise<Novel>;
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
