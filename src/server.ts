import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import type {
  ExtractionJobMessage,
  ParseJobMessage,
  TranslationJobMessage,
} from "./lib/translator/ports";
import { translatorService } from "./lib/translator/translator.server";

/**
 * Cloudflare augments the incoming worker request with a `cf` object (see
 * `worker-configuration.d.ts`), exposing the client's IANA timezone via
 * `cf.timezone`. The global `Request` type used by the server entry doesn't
 * include it, so narrow it here.
 */
type CfRequest = Request & { cf?: { timezone?: string } };

/** The extraction queue name this worker consumes, matching wrangler.jsonc. */
const EXTRACTION_QUEUE_NAME = "translator-prod-extraction-queue";

/** The translation queue name this worker consumes, matching wrangler.jsonc. */
const TRANSLATION_QUEUE_NAME = "translator-prod-translation-queue";

const server = createServerEntry({
  fetch(incomingRequest) {
    const url = new URL(incomingRequest.url);
    const request = new Request(url, incomingRequest);

    // `new Request()` does not copy the `cf` object across, so thread the
    // timezone through as a header the app reads when deriving the greeting's
    // local time. Absent (dev, unknown geo) -> falls back to UTC further down.
    const timezone = (incomingRequest as CfRequest).cf?.timezone;
    if (timezone) {
      request.headers.set("x-timezone", timezone);
    }

    return handler.fetch(request);
  },
});

export default {
  fetch: server.fetch,

  /**
   * Queue consumer. Routes each batch by its queue name: parse messages go to
   * the parse pass, extraction messages to the extraction pass. The service
   * returns a settlement per message: it has either finished the work ("ack" -
   * including a finalized novel on retry exhaustion) or asked for another
   * attempt ("retry").
   */
  async queue(batch: MessageBatch<ParseJobMessage | ExtractionJobMessage | TranslationJobMessage>): Promise<void> {
    if (batch.queue === EXTRACTION_QUEUE_NAME) {
      for (const message of batch.messages) {
        const settlement = await translatorService.runExtractionJob(
          message.body as ExtractionJobMessage,
          message.attempts,
        );
        if (settlement.outcome === "retry") {
          message.retry();
        } else {
          message.ack();
        }
      }
      return;
    }

    if (batch.queue === TRANSLATION_QUEUE_NAME) {
      for (const message of batch.messages) {
        const settlement = await translatorService.runTranslationJob(
          message.body as TranslationJobMessage,
          message.attempts,
        );
        if (settlement.outcome === "retry") {
          message.retry();
        } else {
          message.ack();
        }
      }
      return;
    }

    for (const message of batch.messages) {
      const settlement = await translatorService.runParseJob(
        message.body as ParseJobMessage,
        message.attempts,
      );
      if (settlement.outcome === "retry") {
        message.retry();
      } else {
        message.ack();
      }
    }
  },
};
