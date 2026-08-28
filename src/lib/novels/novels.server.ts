import { env } from "cloudflare:workers";
import { createDb } from "../database/database";
import { rawFileKey, type NewNovelRecord, type Novel } from "./novels-core";

const db = createDb(env.DB);

export async function listNovelRecords(): Promise<Novel[]> {
  return db
    .selectFrom("novels")
    .selectAll()
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .execute();
}

export async function findNovelBySlug(slug: string): Promise<Novel | undefined> {
  return db.selectFrom("novels").selectAll().where("slug", "=", slug).executeTakeFirst();
}

export async function insertNovelRecord(record: NewNovelRecord): Promise<Novel> {
  await db.insertInto("novels").values(record).execute();

  const row = await db
    .selectFrom("novels")
    .select("id")
    .where("slug", "=", record.slug)
    .orderBy("id", "desc")
    .limit(1)
    .executeTakeFirstOrThrow();

  return { ...record, id: row.id } as Novel;
}

/** Upload the raw source text into the novel's R2 namespace. */
export async function putNovelRawText(slug: string, content: string): Promise<void> {
  await env.NOVELS_BUCKET.put(rawFileKey(slug), content);
}
