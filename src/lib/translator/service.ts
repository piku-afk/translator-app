import {
  DUPLICATE_NOVEL_ERROR,
  rawFileKey,
  toSlug,
  type CreateNovelInput,
  type Novel,
} from "../novels/novels-core";
import type { TranslatorPorts } from "./ports";

/**
 * The translator service seam: every Novel/Chapter domain operation, written
 * against injected ports so it runs unchanged on Cloudflare bindings or on
 * in-memory test doubles. Framework- and Cloudflare-agnostic by construction.
 */
export interface TranslatorService {
  listNovels(): Promise<Novel[]>;
  findNovelBySlug(slug: string): Promise<Novel | undefined>;
  createNovel(input: CreateNovelInput): Promise<Novel>;
}

export function createTranslatorService(ports: TranslatorPorts): TranslatorService {
  const { db } = ports;

  async function listNovels(): Promise<Novel[]> {
    return db
      .selectFrom("novels")
      .selectAll()
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .execute();
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
      await db.insertInto("novels").values({
        name,
        slug,
        source_language,
        total_chapters,
        status: "draft",
        created_at: timestamp,
        updated_at: timestamp,
      }).execute();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(DUPLICATE_NOVEL_ERROR);
      }
      throw error;
    }

    return (await db
      .selectFrom("novels")
      .selectAll()
      .where("slug", "=", slug)
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirstOrThrow()) as Novel;
  }

  return { listNovels, findNovelBySlug, createNovel };
}

/** SQLite reports unique violations as "UNIQUE constraint failed: <table>.<col>". */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}
