import { env } from "cloudflare:workers";
import { createDb } from "../database/database";
import { createGatewayModel } from "./gateway-model";
import type {
  ExtractionJobMessage,
  ObjectStorePort,
  ParseJobMessage,
  RerunJobMessage,
  TranslationJobMessage,
  TranslatorPorts,
} from "./ports";
import { createTranslatorService } from "./service";

/**
 * Production storage port (R2 backing novels), exported so the chapter-markdown
 * reader server fn (#47) reads through the same port the translator service
 * writes through.
 */
export const storage: ObjectStorePort = {
  async put(key, content) {
    await env.NOVELS_BUCKET.put(key, content);
  },
  async get(key) {
    const object = await env.NOVELS_BUCKET.get(key);
    return object ? await object.text() : null;
  },
};

/**
 * Production ports for the translator service, wired to the Cloudflare
 * bindings in a single place. The service itself stays framework- and
 * Cloudflare-agnostic and is tested against in-memory doubles.
 */
const ports: TranslatorPorts = {
  db: createDb(env.DB),
  storage,
  parseQueue: {
    async enqueue(job: ParseJobMessage) {
      await env.PARSE_QUEUE.send(job);
    },
  },
  extractionQueue: {
    async enqueue(job: ExtractionJobMessage) {
      await env.EXTRACTION_QUEUE.send(job);
    },
  },
  translationQueue: {
    async enqueue(job: TranslationJobMessage) {
      await env.TRANSLATION_QUEUE.send(job);
    },
  },
  rerunQueue: {
    async enqueue(job: RerunJobMessage) {
      await env.RERUN_QUEUE.send(job);
    },
  },
  model: createGatewayModel({
    extractionModelId: env.EXTRACTION_MODEL_ID,
    translationModelId: env.TRANSLATION_MODEL_ID,
  }),
};

export const translatorService = createTranslatorService(ports);
