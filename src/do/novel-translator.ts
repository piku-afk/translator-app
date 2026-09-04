import { DurableObject } from "cloudflare:workers";
import { createDb } from "../lib/database/database";
import { createChapterTranslateService } from "../lib/translator/chapter-service";
import { createGatewayModel } from "../lib/translator/gateway-model";

/**
 * RPC payload for one synchronous chapter translate (spec #45): the novel
 * slug, the operator-entered chapter number, and that chapter's pasted source
 * text. Source text is never persisted - only the translation markdown is
 * written (R2) and the glossary/chapter state committed (D1).
 */
interface TranslateChapterRpc {
  slug: string;
  chapterNumber: number;
  pastedText: string;
}

/**
 * Per-novel Durable Object (spec #45, decision #44): one instance per novel,
 * hosting the synchronous chapter-translate flow. The server action (#47)
 * derives the instance id from the novel slug (`idFromName(slug)`), then
 * fetches this DO; residency while a request is in flight covers disconnect
 * durability (decision #42). The DO itself is stateless besides its
 * constructor-bound env/ctx - the full 5-step flow (notes diff -> glossary
 * merge -> translate -> R2 put -> D1 writes) is delegated to the
 * `createChapterTranslateService` seam (ticket #46), wired to the Cloudflare
 * bindings in `runTranslate`.
 *
 * Every request is answered with a JSON body; a thrown service error is caught
 * and mapped to `{ ok: false }` so the caller always sees a contract response,
 * never an opaque DO crash / 500.
 */
export class NovelTranslator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Handle one chapter-translate RPC.
   *
   * Response contract (the #47 server action depends on this):
   * - `200 { "ok": true }` - the chapter translated and committed.
   * - `200 { "ok": false, "error": string }` - a well-formed request whose
   *   translate failed (novel not found, model error, D1/R2 failure). The
   *   action parses the body and throws `error`; no partial glossary, no
   *   written markdown (all-or-nothing, #46).
   * - `400 { "ok": false, "error": string }` - malformed RPC: non-JSON body,
   *   missing/mistyped fields, empty slug/text, non-positive chapter number.
   * - `405 { "ok": false, "error": string }` - non-POST request.
   */
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "method not allowed" }, 405);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "expected a JSON body" }, 400);
    }

    const rpc = parseTranslateRpc(body);
    if (rpc === null) {
      return jsonResponse(
        {
          ok: false,
          error: "body must be { slug: string, chapterNumber: number, pastedText: string }",
        },
        400,
      );
    }

    try {
      await runTranslate(this.env, rpc);
      return jsonResponse({ ok: true });
    } catch (error) {
      // Log for observability, then surface the cause to the caller as a
      // domain outcome (`200 ok:false`), never a Worker crash.
      console.error("chapter translate failed:", error);
      return jsonResponse({ ok: false, error: errorMessage(error) });
    }
  }
}

/**
 * Run one chapter translate over the production ports wired to this DO's
 * Cloudflare bindings (D1, R2, AI gateway). Mirrors the legacy
 * `translator.server.ts` port wiring, but reads bindings from the DO's
 * constructor-bound `env` (the module-level `cloudflare:workers` env is not
 * valid inside a Durable Object).
 */
async function runTranslate(env: Env, input: TranslateChapterRpc): Promise<void> {
  const service = createChapterTranslateService({
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
    model: createGatewayModel({
      extractionModelId: env.EXTRACTION_MODEL_ID,
      translationModelId: env.TRANSLATION_MODEL_ID,
    }),
  });
  await service.translateChapter(input);
}

/**
 * Minimal validation of the RPC body: `slug` non-empty string,
 * `chapterNumber` a positive integer, `pastedText` non-blank string.
 * Returns `null` for anything outside that shape.
 */
function parseTranslateRpc(value: unknown): TranslateChapterRpc | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { slug, chapterNumber, pastedText } = record;

  if (typeof slug !== "string" || slug.length === 0) return null;
  if (typeof chapterNumber !== "number" || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
    return null;
  }
  if (typeof pastedText !== "string" || pastedText.trim().length === 0) return null;

  return { slug, chapterNumber, pastedText };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
