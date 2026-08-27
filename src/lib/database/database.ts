import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { DB } from "./database-types.gen";

export type Database = DB;

/** Build a Kysely instance bound to the Cloudflare D1 database. */
export function createDb(db: D1Database): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: db }),
  });
}
