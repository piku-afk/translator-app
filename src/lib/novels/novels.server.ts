import { env } from "cloudflare:workers";
import { createDb } from "../database/database";
import {
  createTranslatorService,
  type NovelStore,
  type ObjectStore,
  type TranslatorService,
} from "./novels-service";
import type { NewNovelRecord, Novel } from "./novels-core";

/**
 * Framework adapter: wires the real Cloudflare D1 + R2 bindings into the
 * translator service ports. Holds no domain logic - it only maps between the
 * service's domain shapes and the storage layer's row/object shapes.
 */

const db = createDb(env.DB);

/**
 * Map a generated D1 row back to the domain's camelCase Novel shape.
 *
 * The generated types are intentionally wide (PKs nullable, `ko`/`zh` as
 * plain `string`), so we narrow the values the domain already guarantees (
 * the DB schema CHECKs source_language and status).
 */
function mapRow(row: {
  id: number | null;
  name: string;
  slug: string;
  source_language: string;
  total_chapters: number;
  status: string;
  created_at: string;
  updated_at: string;
}): Novel {
  return {
    id: row.id ?? 0,
    name: row.name,
    slug: row.slug,
    sourceLanguage: row.source_language as Novel["sourceLanguage"],
    totalChapters: row.total_chapters,
    status: row.status as Novel["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const novelStore: NovelStore = {
  async insert(record: NewNovelRecord): Promise<Novel> {
    await db
      .insertInto("novels")
      .values({
        name: record.name,
        slug: record.slug,
        source_language: record.sourceLanguage,
        total_chapters: record.totalChapters,
        status: record.status,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      })
      .execute();

    // The row was just inserted, so it has an id; the generated type types the
    // PK as nullable, so narrow it to the non-null `number` the domain expects.
    const row = await db
      .selectFrom("novels")
      .select("id")
      .where("slug", "=", record.slug)
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();

    return { ...record, id: row.id as number }; // id is present right after insert
  },

  async findBySlug(slug: string): Promise<Novel | null> {
    const row = await db
      .selectFrom("novels")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    return row ? mapRow(row) : null;
  },

  async list(): Promise<Novel[]> {
    const rows = await db
      .selectFrom("novels")
      .selectAll()
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .execute();

    return rows.map(mapRow);
  },
};

const objectStore: ObjectStore = {
  async put(key: string, content: string): Promise<void> {
    await env.NOVELS_BUCKET.put(key, content);
  },
};

let service: TranslatorService | undefined;

/** The app-wide translator service instance wired to real D1/R2 bindings. */
export function getTranslatorService(): TranslatorService {
  service ??= createTranslatorService({ novels: novelStore, objects: objectStore });
  return service;
}
