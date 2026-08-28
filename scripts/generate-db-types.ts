import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_FILE = join("src", "lib", "database", "database-types.gen.ts");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");

/**
 * Derive the database types purely from the committed migration SQL
 * (`d1-migrations/*.sql`), on a throwaway local SQLite.
 */
const migrationsDir = join(repoRoot, "d1-migrations");
const sqlFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (sqlFiles.length === 0) {
  throw new Error(
    `No migrations found in ${migrationsDir}. Run \`node scripts/generate-migrations.ts\` first.`,
  );
}

// STEP 1: build a temp SQLite DB from all migration SQL, in order.
const tmp = mkdtempSync(join(tmpdir(), "d1-typegen-"));
const dbFile = join(tmp, "db.sqlite");

try {
  const sqlite = new Database(dbFile);
  for (const file of sqlFiles) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    sqlite.exec(sql);
  }
  sqlite.close();

  // STEP 2: generate kysely types from that local DB.
  const tempOutFile = join(tmp, "database.gen.ts");
  const cliBin = join(repoRoot, "node_modules", ".bin", "kysely-codegen");

  execFileSync(cliBin, ["--dialect", "sqlite", "--url", dbFile, "--out-file", tempOutFile], {
    stdio: "inherit",
  });

  // STEP 3: move the generated file into the source tree.
  copyFileSync(tempOutFile, join(repoRoot, OUT_FILE));
  console.log("Database types generated:", OUT_FILE);
} finally {
  // STEP 4: delete the temporary directory.
  rmSync(tmp, { recursive: true, force: true });
}
