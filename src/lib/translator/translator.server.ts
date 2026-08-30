import { env } from "cloudflare:workers";
import { createDb } from "../database/database";
import type { ParseJobMessage, TranslatorPorts } from "./ports";
import { createTranslatorService } from "./service";

/**
 * Production ports for the translator service, wired to the Cloudflare
 * bindings in a single place. The service itself stays framework- and
 * Cloudflare-agnostic and is tested against in-memory doubles.
 */
const ports: TranslatorPorts = {
  db: createDb(env.DB),
  storage: {
    async put(key, content) {
      await env.NOVELS_BUCKET.put(key, content);
    },
    async get(key) {
      const object = await env.NOVELS_BUCKET.get(key);
      return object ? await object.text() : null;
    },
  },
  parseQueue: {
    async enqueue(job: ParseJobMessage) {
      await env.PARSE_QUEUE.send(job);
    },
  },
  // TODO(#26): replaced by the production wiring - EXTRACTION queue binding and
  // the AI-gateway model port. Kept as throwing stubs so the seam compiles
  // while the extraction pass is being built at the service level.
  extractionQueue: {
    async enqueue() {
      throw new Error("extraction queue not wired yet");
    },
  },
  model: {
    async getNewNames() {
      throw new Error("model port not wired yet");
    },
    async getNotesDiff() {
      throw new Error("model port not wired yet");
    },
  },
};

export const translatorService = createTranslatorService(ports);
