import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("novels")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("source_language", "text", (col) =>
      col.notNull().check(sql`source_language IN ('ko', 'zh')`),
    )
    .addColumn("total_chapters", "integer", (col) => col.notNull().check(sql`total_chapters > 0`))
    .addColumn("status", "text", (col) =>
      col.notNull().defaultTo("draft").check(
        sql`status IN ('draft', 'parsing', 'ready', 'needs review', 'extracting', 'translating', 'completed')`,
      ),
    )
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_novels_slug")
    .ifNotExists()
    .on("novels")
    .column("slug")
    .unique()
    .execute();
}
