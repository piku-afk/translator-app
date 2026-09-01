import { type Kysely, sql } from "kysely";

/**
 * Widen the `activity.action` CHECK to include the three translation-stage
 * actions (`translation started`, `translation completed`, `translation failed`),
 * mirroring the per-stage failure taxonomy completed on the novels side by 007.
 *
 * SQLite cannot alter/drop a CHECK constraint in place, so widening the action
 * CHECK requires the full table-rebuild pattern (as in 003/004/007), with one
 * `-- migration:data-copy` preserving existing rows. This migration only adds new
 * allowed actions; no existing row needs rewriting.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("activity_new")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn("novel_id", "integer", (col) => col.notNull().references("novels.id").onDelete("cascade"))
    .addColumn("novel_name", "text", (col) => col.notNull())
    .addColumn("action", "text", (col) =>
      col
        .notNull()
        .check(
          sql`action IN ('novel created', 'parsing started', 'parsing ready', 'needs review', 'parsing failed', 'extraction started', 'names extracted', 'extraction failed', 'translation started', 'translation completed', 'translation failed')`,
        ),
    )
    .addColumn("detail", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .execute();

  // The rebuild's one and only data copy, allowed by the generator's explicit
  // `-- migration:data-copy` opt-in. Existing rows all satisfy the widened
  // CHECK, so the copy is a straight pass-through with no CASE rewrite.
  await sql`
    -- migration:data-copy
    INSERT INTO "activity_new" ("id", "novel_id", "novel_name", "action", "detail", "created_at")
    SELECT "id", "novel_id", "novel_name", "action", "detail", "created_at"
    FROM "activity"
  `.execute(db);

  await db.schema.dropTable("activity").execute();
  await db.schema.alterTable("activity_new").renameTo("activity").execute();
  await db.schema
    .createIndex("idx_activity_created_at")
    .ifNotExists()
    .on("activity")
    .column("created_at")
    .execute();
}
