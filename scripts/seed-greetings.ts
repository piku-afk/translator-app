import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Kysely, SqliteDialect } from "kysely";
import type { DB } from "../src/lib/database/database-types.gen.ts";
import { fileURLToPath } from "node:url";
import { parse } from "jsonc-parser";

interface SeedGreeting {
  message: string;
  time?: string;
  days?: string;
}

const GREETING_MESSAGES: readonly SeedGreeting[] = [
  // Generic - valid at any time on any day.
  { message: "Back at it!" },
  { message: "Hey there" },
  { message: "Hi, how are you?" },
  { message: "How's it going?" },
  { message: "Welcome" },
  { message: "What's new?" },
  { message: "What's on your mind?" },

  // Morning - 5-11.
  { message: "Good morning", time: "morning" },

  // Afternoon - 12-17.
  { message: "Good afternoon", time: "afternoon" },

  // Evening - 18-21.
  { message: "Evening", time: "evening" },
  { message: "Good evening", time: "evening" },
  { message: "How was your day?", time: "evening" },
  { message: "Evening, how are things?", time: "evening" },

  // Night - 0-4 and 22-23.
  { message: "Hello, night owl", time: "night" },
  { message: "What's on your mind tonight?", time: "night" },
  { message: "Up late?", time: "night" },

  // Per-day.
  { message: "Happy Monday", days: "mon" },
  { message: "Happy Tuesday", days: "tue" },
  { message: "Happy Wednesday", days: "wed" },
  { message: "Happy Thursday", days: "thu" },
  { message: "Happy Friday", days: "fri" },
  { message: "That Friday feeling", days: "fri" },
  { message: "Happy Saturday!", days: "sat" },
  { message: "Happy Sunday", days: "sun" },
  { message: "Sunday session?", days: "sun" },
  { message: "Welcome to the weekend", days: "sat,sun" },
];

const target = process.argv[2];

if (target !== "--local" && target !== "--remote") {
  console.error("Usage: node scripts/seed-greetings.ts --local|--remote");
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const content = readFileSync(join(repoRoot, "wrangler.jsonc"), "utf8");
const config = parse(content);
const DB_NAME = config.d1_databases[0].database_name;

// A Kysely instance used only to compile SQL; the driver is never reached.
const db = new Kysely<DB>({
  dialect: new SqliteDialect({
    database: () => {
      throw new Error("seed script only compiles SQL, it never executes queries");
    },
  }),
});

/**
 * Inline a compiled query's parameters into its SQL. Kysely emits `?`
 * placeholders; `wrangler d1 execute --file` needs literal SQL. The single
 * regex pass replaces each placeholder in order without re-scanning inserted
 * text, so a `?` inside a message value is safe.
 */
function toSql(compiled: { sql: string; parameters: readonly unknown[] }): string {
  let i = 0;
  return compiled.sql.replace(/\?/g, () => {
    const val = compiled.parameters[i++];
    if (val === null || val === undefined) return "NULL";
    // escape single quotes inside strings
    return `'${String(val).replace(/'/g, "''")}'`;
  });
}

const timestamp = new Date().toISOString();
const sql =
  toSql(
    db
      .insertInto("greetings")
      .values(
        GREETING_MESSAGES.map((m) => ({
          message: m.message,
          time: m.time ?? null,
          days: m.days ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        })),
      )
      .ignore()
      .compile(),
  ) + ";";
const tmp = mkdtempSync(join(tmpdir(), "greetings-seed-"));
const file = join(tmp, "seed.sql");

try {
  writeFileSync(file, sql);
  const flag = target === "--local" ? "--local" : "--remote";
  execFileSync("wrangler", ["d1", "execute", DB_NAME, flag, "--file", file], { stdio: "inherit" });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
