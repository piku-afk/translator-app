import type { Kysely } from "kysely";
import type { Database } from "../database/database";
import type { GlossaryCategory } from "./glossary";

/**
 * Message enqueued on the parse queue. Deliberately minimal: the consumer
 * re-reads the novel's authoritative state (slug, source language, declared
 * total, status) from the database when the job runs.
 */
export interface ParseJobMessage {
  novelId: number;
}

/**
 * Message enqueued on the extraction queue. Like the parse message, the
 * consumer re-reads the novel's authoritative state when the job runs.
 */
export interface ExtractionJobMessage {
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

/** Queue carrying extraction jobs (Cloudflare Queues in production). */
export interface ExtractionQueuePort {
  enqueue(job: ExtractionJobMessage): Promise<void>;
}

/**
 * A glossary entry as the model sees it in the notes input: addressed by its
 * opaque numeric id, with `;`-separated variation strings.
 */
export interface ModelNotesEntry {
  id: number;
  category: GlossaryCategory;
  source_names: string;
  english_names: string;
  description: string;
}

/** A model-proposed new entry: no id (the application assigns it). */
export interface ModelNotesAddition {
  category: GlossaryCategory;
  source_names: string;
  english_names: string;
  description: string;
}

/** A model-proposed removal, addressed by id. */
export interface ModelNotesDeletion {
  id: number;
  category: GlossaryCategory;
}

/** The model's per-chapter notes diff, in the model's own shape. */
export interface ModelNotesDiff {
  updates: ModelNotesEntry[];
  additions: ModelNotesAddition[];
  deletions: ModelNotesDeletion[];
}

/**
 * The AI-gateway model port: one call per chapter that discovers new names in
 * the source (against the existing notes' established names) and produces the
 * notes diff to apply to the glossary.
 *
 * New-name discovery and the notes diff are folded into a single call because
 * our pipeline runs the extraction walk sequentially and never feeds `new
 * names` anywhere but the notes diff; there is no parallel translate step to
 * hand new names to (unlike the POC), so a separate `getNewNames` round-trip
 * would only add latency to the ADR-0001 sequential bottleneck.
 */
export interface ModelPort {
  getNotesDiff(params: {
    sourceText: string;
    filteredNotes: ModelNotesEntry[];
  }): Promise<{ notesChanges: ModelNotesDiff }>;
}

/**
 * Ports the translator service is written against. The service is framework-
 * and Cloudflare-agnostic: production wires these to D1, R2, Queues, and the
 * AI gateway; tests to in-memory doubles and a local SQLite.
 */
export interface TranslatorPorts {
  db: Kysely<Database>;
  storage: ObjectStorePort;
  parseQueue: ParseQueuePort;
  extractionQueue: ExtractionQueuePort;
  model: ModelPort;
}
