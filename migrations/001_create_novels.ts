import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("novels")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull().unique())
    .addColumn("source_language", "text", (col) =>
      col.notNull().check(sql`source_language IN ('ko', 'zh')`),
    )
    .addColumn("total_chapters", "integer", (col) => col.notNull().check(sql`total_chapters > 0`))
    .addColumn("status", "text", (col) => col.notNull().defaultTo("draft"))
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_novels_created_at")
    .ifNotExists()
    .on("novels")
    .column("created_at")
    .execute();
}
