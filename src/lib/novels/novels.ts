import { createServerFn } from "@tanstack/react-start";
import {
  CreateNovelSchema,
  DUPLICATE_NOVEL_ERROR,
  toSlug,
  type NewNovelRecord,
  type Novel,
} from "./novels-core";
import {
  findNovelBySlug,
  insertNovelRecord,
  listNovelRecords,
  putNovelRawText,
} from "./novels.server";

export const novelsQueryKey = ["novels"] as const;

export const listNovels = createServerFn().handler(async (): Promise<Novel[]> => {
  return listNovelRecords();
});

export const createNovel = createServerFn({ method: "POST" })
  .validator(CreateNovelSchema)
  .handler(async ({ data }): Promise<Novel> => {
    const { name, total_chapters, source_language, raw_text } = data;
    const slug = toSlug(name);

    // Friendly pre-check for the common duplicate case; the DB unique
    // constraint on slug is the real guard (mapped below on the rare race).
    const existing = await findNovelBySlug(slug);
    if (existing) {
      throw new Error(DUPLICATE_NOVEL_ERROR);
    }

    const timestamp = new Date().toISOString();
    const record: NewNovelRecord = {
      name,
      slug,
      source_language,
      total_chapters,
      status: "draft",
      created_at: timestamp,
      updated_at: timestamp,
    };

    // Upload the raw file before persisting: a failed insert must never leave
    // a DB record pointing at a missing file. An orphaned object (insert
    // failed after upload) is harmless - nothing references it.
    await putNovelRawText(slug, raw_text);

    try {
      return await insertNovelRecord(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(DUPLICATE_NOVEL_ERROR);
      }
      throw error;
    }
  });

/** SQLite reports unique violations as "UNIQUE constraint failed: <table>.<col>". */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/i.test(error.message);
}

export function getNovelsQueryOptions() {
  return { queryFn: () => listNovels(), queryKey: novelsQueryKey };
}
