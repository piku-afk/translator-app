import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // SQLite cannot alter or drop a CHECK constraint in place, so widening
  // `novels.status` to include 'failed' (and adding `last_error`) requires a
  // full table rebuild: create-new -> copy rows -> drop -> rename.
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
          sql`status IN ('draft', 'parsing', 'ready', 'needs review', 'failed', 'extracting', 'translating', 'completed')`,
        ),
    )
    .addColumn("last_error", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  // The rebuild's one and only data copy, allowed by the generator's explicit
  // `-- migration:data-copy` opt-in (ADR-0003 amendment). No branch on data:
  // the statement is fixed, and existing rows all satisfy the widened CHECK.
  await sql`
    -- migration:data-copy
    INSERT INTO "novels_new" ("id", "name", "slug", "source_language", "total_chapters", "status", "last_error", "created_at", "updated_at")
    SELECT "id", "name", "slug", "source_language", "total_chapters", "status", NULL, "created_at", "updated_at"
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

  // One row per extracted chapter, written by the parse queue consumer. The
  // unique (novel_id, number) pair keeps re-parses idempotent.
  await db.schema
    .createTable("chapters")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn("novel_id", "integer", (col) =>
      col.notNull().references("novels.id").onDelete("cascade"),
    )
    .addColumn("number", "integer", (col) => col.notNull().check(sql`number > 0`))
    .addColumn("status", "text", (col) =>
      col
        .notNull()
        .defaultTo("queued")
        .check(sql`status IN ('queued', 'names extracted', 'translating', 'translated', 'failed')`),
    )
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_chapters_novel_number")
    .ifNotExists()
    .on("chapters")
    .columns(["novel_id", "number"])
    .unique()
    .execute();
}
