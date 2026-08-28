import type { Kysely } from "kysely";
import type { Database } from "../database/database";

/**
 * Message enqueued on the parse queue. Deliberately minimal: the consumer
 * re-reads the novel's authoritative state (slug, source language, declared
 * total, status) from the database when the job runs.
 */
export interface ParseJobMessage {
  novelId: number;
}

/**
 * Durable text-object storage backing novels (R2 in production). Keys are
 * namespaced per novel: `novels/<slug>/raw` and `novels/<slug>/chapters/<n>.txt`.
 */
export interface ObjectStorePort {
  /** Store (or overwrite) the text object at `key`. */
  put(key: string, content: string): Promise<void>;
  /** Read the text object at `key`; `null` when it does not exist. */
  get(key: string): Promise<string | null>;
}

/** Queue carrying parse jobs (Cloudflare Queues in production). */
export interface ParseQueuePort {
  enqueue(job: ParseJobMessage): Promise<void>;
}

/**
 * Ports the translator service is written against. The service is framework-
 * and Cloudflare-agnostic: production wires these to D1, R2, and Queues,
 * tests to in-memory doubles and a local SQLite.
 */
export interface TranslatorPorts {
  db: Kysely<Database>;
  storage: ObjectStorePort;
  parseQueue: ParseQueuePort;
}
