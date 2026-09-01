import { type Kysely, sql } from "kysely";

/**
 * Translation foundation: widen `novels.status` to include `translation failed`,
 * completing the per-stage failure taxonomy (parse/extraction/translation) and
 * giving the parallel translation stage (issue #6) its unambiguous failure state.
 *
 * SQLite cannot alter/drop a CHECK constraint in place, so widening
 * `novels.status` again requires the full table-rebuild pattern (as in 003 and
 * 004). This migration only adds `translation failed` to the allowed statuses;
 * no existing row needs rewriting (no prior status collapses into it).
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
          sql`status IN ('draft', 'parsing', 'ready', 'needs review', 'parsing failed', 'extracting', 'names extracted', 'extraction failed', 'translating', 'translation failed', 'completed')`,
        ),
    )
    .addColumn("last_error", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  // The rebuild's one and only data copy, allowed by the generator's explicit
  // `-- migration:data-copy` opt-in. Existing rows all satisfy the widened
  // CHECK, so the copy is a straight pass-through with no CASE rewrite.
  await sql`
    -- migration:data-copy
    INSERT INTO "novels_new" ("id", "name", "slug", "source_language", "total_chapters", "status", "last_error", "created_at", "updated_at")
    SELECT "id", "name", "slug", "source_language", "total_chapters", "status", "last_error", "created_at", "updated_at"
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
}
