import { env } from "cloudflare:workers";
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

interface NovelRow {
  id: number;
  name: string;
  slug: string;
  source_language: string;
  total_chapters: number;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: NovelRow): Novel {
  return {
    id: row.id,
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
    await env.DB.prepare(
      `INSERT INTO novels (name, slug, source_language, total_chapters, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        record.name,
        record.slug,
        record.sourceLanguage,
        record.totalChapters,
        record.status,
        record.createdAt,
        record.updatedAt,
      )
      .run();

    const row = await env.DB.prepare(`SELECT last_insert_rowid() AS id`).first<{ id: number }>();
    return { ...record, id: row?.id ?? 0 };
  },

  async findBySlug(slug: string): Promise<Novel | null> {
    const row = await env.DB.prepare(`SELECT * FROM novels WHERE slug = ?`).bind(slug).first<NovelRow>();
    return row ? mapRow(row) : null;
  },

  async list(): Promise<Novel[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM novels ORDER BY created_at DESC, id DESC`,
    ).all<NovelRow>();
    return results.map(mapRow);
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
