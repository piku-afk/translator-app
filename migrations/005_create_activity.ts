import { type Kysely, sql } from "kysely";

/**
 * Activity: one row per committed novel-level lifecycle transition, recorded
 * application-level at the translator-service seam (never by DB triggers).
 *
 * `novel_name` is a denormalized snapshot: novels cannot be renamed, so it can
 * never go stale, and it keeps the home-page feed a single-table read. `detail`
 * is optional structured prose (e.g. the `4 ≠ 5` chapter-count mismatch figures
 * for `needs review`). The `action` CHECK constrains to the 8 lifecycle values;
 * translation-stage actions are reserved for when translation is wired up.
 *
 * No dedup and no explicit pruning: re-triggers emit a fresh "started" event
 * each time (they are distinct moments), and the feed is simply capped at read
 * time by `listRecentActivities(limit)`.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("activity")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
    .addColumn("novel_id", "integer", (col) =>
      col.notNull().references("novels.id").onDelete("cascade"),
    )
    // Denormalized snapshot of the novel name; novels are immutable so it never
    // goes stale. Keeps the feed a single-table read.
    .addColumn("novel_name", "text", (col) => col.notNull())
    .addColumn("action", "text", (col) =>
      col
        .notNull()
        .check(
          sql`action IN ('novel created', 'parsing started', 'parsing ready', 'needs review', 'parsing failed', 'extraction started', 'names extracted', 'extraction failed')`,
        ),
    )
    .addColumn("detail", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_activity_created_at")
    .ifNotExists()
    .on("activity")
    .column("created_at")
    .execute();
}
