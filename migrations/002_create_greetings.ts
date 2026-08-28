import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("greetings")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("time", "text")
    .addColumn("days", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_greetings_message")
    .ifNotExists()
    .on("greetings")
    .column("message")
    .unique()
    .execute();
}
