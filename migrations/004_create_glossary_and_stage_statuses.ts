import { type Kysely, sql } from "kysely";

/**
 * Extraction foundation:
 *  - a `glossary_entries` table holding a novel's Glossary (one row per entity)
 *  - widen `novels.status` to the per-stage failure taxonomy (drop the generic
 *    `failed`, add `parsing failed`, `names extracted`, `extraction failed`),
 *    rewriting any existing `failed` row to `parsing failed`.
 *
 * SQLite cannot alter/drop a CHECK constraint in place, so widening
 * `novels.status` again requires the full table-rebuild pattern (as in 003).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("novels_new")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("source_language", "text", (col) =>
      col.notNull().check(sql`source_language IN ('ko', 'zh')`),
    )
    .addColumn("total_chapters", "integer", (col) => col.notNull().check(sql`total_chapters > 0`))
    .addColumn("status", "text", (col) =>
      col
        .notNull()
        .defaultTo("draft")
        .check(
          sql`status IN ('draft', 'parsing', 'ready', 'needs review', 'parsing failed', 'extracting', 'names extracted', 'extraction failed', 'translating', 'completed')`,
        ),
    )
    .addColumn("last_error", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  // The rebuild's one and only data copy. Prior `failed` rows are rewritten to
  // `parsing failed` with a fixed CASE expression - the old generic `failed`
  // was introduced by and only ever produced by the parse stage.
  await sql`
    -- migration:data-copy
    INSERT INTO "novels_new" ("id", "name", "slug", "source_language", "total_chapters", "status", "last_error", "created_at", "updated_at")
    SELECT "id", "name", "slug", "source_language", "total_chapters",
           CASE WHEN "status" = 'failed' THEN 'parsing failed' ELSE "status" END,
           "last_error", "created_at", "updated_at"
    FROM "novels"
  `.execute(db);

  await db.schema.dropTable("novels").execute();
  await db.schema.alterTable("novels_new").renameTo("novels").execute();
  await db.schema
    .createIndex("idx_novels_slug")
    .ifNotExists()
    .on("novels")
    .column("slug")
    .unique()
    .execute();

  // One row per Glossary entity. The model addresses entries by their opaque
  // numeric id (echoed back in updates/deletions), so the id is DB-generated.
  // Name variations are stored `;`-separated (one separator used consistently
  // in storage and in the extraction instruction files).
  await db.schema
    .createTable("glossary_entries")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn("novel_id", "integer", (col) =>
      col.notNull().references("novels.id").onDelete("cascade"),
    )
    .addColumn("category", "text", (col) =>
      col
        .notNull()
        .check(sql`category IN ('characters', 'places', 'misc')`),
    )
    .addColumn("source_names", "text", (col) => col.notNull())
    .addColumn("english_names", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_glossary_entries_novel_id")
    .ifNotExists()
    .on("glossary_entries")
    .column("novel_id")
    .execute();
}
