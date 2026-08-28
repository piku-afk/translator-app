import { Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from "kysely";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// DDL-only guard
//
// The capturing driver below returns an empty result for every query, so any
// migration that *reads* rows (or branches on data) would silently compile
// wrong SQL. To make that a loud failure we only accept schema-mutation root
// node kinds, and reject anything that touches data.
// ---------------------------------------------------------------------------

const DDL_KINDS = new Set([
  "AlterTableNode",
  "AlterTypeNode",
  "CreateIndexNode",
  "CreateSchemaNode",
  "CreateTableNode",
  "CreateTypeNode",
  "CreateViewNode",
  "DropIndexNode",
  "DropSchemaNode",
  "DropTableNode",
  "DropTypeNode",
  "DropViewNode",
  "RefreshMaterializedViewNode",
]);

const DATA_KINDS = new Set([
  "DeleteQueryNode",
  "InsertQueryNode",
  "SelectQueryNode",
  "UpdateQueryNode",
  "MergeQueryNode",
]);

const DATA_KEYWORDS = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "merge",
  "with",
  "replace",
  "values",
]);

/**
 * Sole exception to the DDL-only rule: a data-
 * preserving table rebuild - the only way to change a CHECK constraint in
 * SQLite - needs one INSERT INTO ... SELECT copy of the old rows. Such a
 * statement is accepted only when it carries an explicit
 * `-- migration:data-copy` marker comment and is nothing but a copy:
 * comments stripped, it must start with INSERT INTO and read via SELECT.
 * Anything else data-shaped remains a loud build failure.
 */
function isMarkedDataCopy(statement: string): boolean {
  if (!statement.includes("-- migration:data-copy")) return false;
  const stripped = statement.replace(/^\s*--.*$/gm, "").trim();
  return /^INSERT\s+INTO\s/i.test(stripped) && /\bSELECT\b/i.test(stripped);
}

function createCapturingDialect(migrationName: string) {
  const statements: string[] = [];

  return {
    dialect: {
      createAdapter: () => new SqliteAdapter(),
      createIntrospector: (db: Kysely<any>) => new SqliteIntrospector(db),
      createQueryCompiler: () => new SqliteQueryCompiler(),
      createDriver: () => ({
        acquireConnection: async () => ({
          executeQuery: async (compiledQuery: { sql: string; query: { kind: string } | null }) => {
            const kind = compiledQuery.query?.kind ?? "unknown";
            const sql = compiledQuery.sql.trim();

            if (DDL_KINDS.has(kind)) {
              statements.push(sql);
              return { rows: [] };
            }

            if (kind === "RawNode") {
              if (isMarkedDataCopy(sql)) {
                statements.push(sql);
                return { rows: [] };
              }

              const firstWord = sql.split(/\s+/)[0]?.toLowerCase() ?? "";
              if (!DATA_KEYWORDS.has(firstWord)) {
                statements.push(sql);
                return { rows: [] };
              }
              throw new Error(
                `Migration emitted a raw data query starting with "${firstWord}" ` +
                  `(while generating "${migrationName}"). Migrations must be DDL-only; ` +
                  `no reads or row writes are allowed. SQL: ${sql}`,
              );
            }

            if (DATA_KINDS.has(kind)) {
              throw new Error(
                `Migration emitted a data query of kind "${kind}" (${sql}). ` +
                  `Migrations must be DDL-only; no reads or row writes are allowed.`,
              );
            }

            throw new Error(
              `Migration emitted a query of kind "${kind}" (${sql}). ` +
                `Migrations must be DDL-only; no reads or row writes are allowed.`,
            );
          },
          streamQuery: async () => {
            throw new Error("not supported");
          },
        }),
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        init: async () => {},
        destroy: async () => {},
      }),
    },
    getStatements: () => statements,
    clear: () => statements.splice(0),
  };
}

async function generate() {
  const migrationsDir = path.resolve("./migrations"); // Kysely .ts files
  const outputDir = path.resolve("./d1-migrations"); // build output for wrangler

  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts"))
    .sort();

  for (const file of files) {
    const sqlFile = path.join(outputDir, file.replace(".ts", ".sql"));
    if (fs.existsSync(sqlFile)) continue;

    const { up } = await import(path.join(migrationsDir, file));
    if (typeof up !== "function") {
      throw new Error(`Migration "${file}" does not export an "up" function.`);
    }

    const capturing = createCapturingDialect(file);
    const db = new Kysely({ dialect: capturing.dialect as any });

    await up(db);

    const statements = capturing.getStatements();
    if (statements.length === 0) {
      throw new Error(`Migration "${file}" produced no SQL - nothing to migrate.`);
    }

    const sql = statements.join(";\n") + ";";
    fs.writeFileSync(sqlFile, sql);
    console.log(`Generated: ${sqlFile}`);
  }
}

generate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
