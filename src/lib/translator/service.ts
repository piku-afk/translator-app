import {
  DUPLICATE_NOVEL_ERROR,
  chapterFileKey,
  rawFileKey,
  toSlug,
  type CreateNovelInput,
  type Novel,
  type NovelStatus,
  type SourceLanguage,
} from "../novels/novels-core";
import type { ParseJobMessage, TranslatorPorts } from "./ports";
import { extractChapters } from "./extractors";
import { getErrorMessage } from "../utils";

/** Retries the parse queue allows per message; must match the wrangler
 * consumer's `max_retries` (wrangler.jsonc). The consumer treats a message on
 * this attempt as exhausted: recording the failure beats letting the message
 * drop silently, which would strand the novel in `parsing`. */
export const PARSE_MAX_RETRIES = 3;

export const NOVEL_NOT_FOUND_ERROR = "Novel not found";

/** How the queue consumer should settle a message after runParseJob. */
export type ParseSettlement = { outcome: "ack" } | { outcome: "retry" };

/** A novel plus the parse state the details page needs. */
export interface NovelDetail {
  novel: Novel;
  chapter_count: number;
}

/** A novel plus the number of parsed chapter rows, for list views. */
export type NovelSummary = Novel & { parsed_chapters: number };

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

    return (await db
      .selectFrom("novels")
      .selectAll()
      .where("slug", "=", slug)
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirstOrThrow()) satisfies Novel;
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

  async function startParsing(slug: string): Promise<Novel> {
    const novel = await findNovelBySlug(slug);

    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }

    if (novel.status !== "draft" && novel.status !== "failed") {
      throw new Error(
        `Only draft or failed novels can start parsing (currently "${novel.status}")`,
      );
    }

    await setNovelStatus(novel.id, "parsing");

    try {
      await ports.parseQueue.enqueue({ novelId: novel.id });
    } catch (error) {
      // The job never made it onto the queue, so the operator was not told
      // the truth if we stayed in `parsing`: revert (to draft, per spec, even
      // from failed) so Start parsing can be pressed again.
      await setNovelStatus(novel.id, "draft");
      throw error;
    }

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
      return { outcome: "ack" };
    } catch (error) {
      if (attempt >= PARSE_MAX_RETRIES) {
        try {
          await setNovelStatus(novel.id, "failed", getErrorMessage(error));
          return { outcome: "ack" };
        } catch {
          // Even recording the failure failed; let the queue retry the message.
          return { outcome: "retry" };
        }
      }
      return { outcome: "retry" };
    }
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

  return {
    listNovels,
    createNovel,
    runParseJob,
    startParsing,
    getNovelDetail,
    findNovelBySlug,
    listRecentNovels,
  };
}

/** SQLite reports unique violations as "UNIQUE constraint failed: <table>.<col>". */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}
