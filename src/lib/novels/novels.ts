import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { requireAuth } from "#/lib/auth/session.server";
import type { Glossary } from "../translator/glossary";
import {
  NOVEL_NOT_FOUND_ERROR,
  type ChapterSummary,
  type NovelDetail,
  type NovelSummary,
} from "../translator/service";
import { storage, translatorService } from "../translator/translator.server";
import { CreateNovelSchema, translationFileKey, type Novel } from "./novels-core";

export const novelsQueryKey = ["novels"] as const;
export const recentNovelsQueryKey = ["novels", "recent"] as const;
export const novelDetailQueryKey = (slug: string) => ["novels", slug] as const;
export const glossaryQueryKey = (slug: string) => ["novels", slug, "glossary"] as const; // nested under the detail key so it invalidates with the novel
/** The chapters list for a novel; invalidated together with the detail key. */
export const chaptersQueryKey = (slug: string) => ["novels", slug, "chapters"] as const;
/** Translated markdown for a single chapter (the output pane's data source). */
export const chapterMarkdownQueryKey = (slug: string, chapterNumber: number) =>
  ["novels", slug, "chapters", chapterNumber, "markdown"] as const;

const SlugSchema = z.object({ slug: z.string().min(1) });

const listNovels = createServerFn().handler(async (): Promise<NovelSummary[]> => {
  return translatorService.listNovels();
});

const listRecentNovels = createServerFn().handler(async (): Promise<NovelSummary[]> => {
  return translatorService.listRecentNovels();
});

export const createNovel = createServerFn({ method: "POST" })
  .validator(CreateNovelSchema)
  .handler(async ({ data }): Promise<Novel> => {
    return translatorService.createNovel(data);
  });

const getNovelDetail = createServerFn()
  .validator(SlugSchema)
  .handler(async ({ data }): Promise<NovelDetail> => {
    await requireAuth();
    const detail = await translatorService.getNovelDetail(data.slug);
    if (!detail) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }
    return detail;
  });

export function getNovelsQueryOptions() {
  return { queryFn: () => listNovels(), queryKey: novelsQueryKey };
}

export function getRecentNovelsQueryOptions() {
  return { queryFn: () => listRecentNovels(), queryKey: recentNovelsQueryKey };
}

const TranslateChapterSchema = z.object({
  slug: z.string().min(1),
  chapterNumber: z.number().int().positive(),
  pastedText: z.string().trim().min(1, "Pasted text is required"),
});

/**
 * The per-novel DO's translate response body, per the #48 RPC contract:
 * `200 { ok: true }`, or `{ ok: false, error }` on any failure.
 */
interface TranslateDoResult {
  ok: boolean;
  error?: string;
}

/** Parse a DO translate response body into `{ ok, error }`; never throws. */
function parseTranslateResult(body: unknown): TranslateDoResult {
  if (typeof body !== "object" || body === null) return { ok: false };
  const record = body as Record<string, unknown>;
  return {
    ok: record.ok === true,
    error: typeof record.error === "string" ? record.error : undefined,
  };
}

/**
 * One synchronous per-chapter translate, wired from the details page (#50) to
 * the per-novel Durable Object (#48). The DO instance is addressed by the
 * novel slug; the RPC payload is the pasted source plus its chapter number.
 * Source text is sent to the DO but never persisted anywhere (spec #45).
 *
 * Success returns a minimal `{ slug, chapterNumber }` - the translated
 * markdown is read back via `getChapterMarkdownQueryOptions` after the caller
 * invalidates glossary + chapters queries. The DO's `{ ok: false, error }`
 * response becomes a thrown `Error(error)` so the failure surfaces in the
 * action (spec #45, user story 9); unknown statuses and unparsable bodies fall
 * back to a generic message.
 */
export const translateChapter = createServerFn({ method: "POST" })
  .validator(TranslateChapterSchema)
  .handler(async ({ data }): Promise<{ slug: string; chapterNumber: number }> => {
    await requireAuth();
    const { slug, chapterNumber, pastedText } = data;

    const stub = env.NOVEL_TRANSLATOR.get(env.NOVEL_TRANSLATOR.idFromName(slug));
    const response = await stub.fetch("https://novel-translator/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, chapterNumber, pastedText }),
    });

    const result = parseTranslateResult(await response.json().catch(() => null));

    if (response.status === 200 && result.ok) {
      return { slug, chapterNumber };
    }
    throw new Error(result.error ?? `chapter translate failed (HTTP ${response.status})`);
  });

const getChapters = createServerFn()
  .validator(SlugSchema)
  .handler(async ({ data }): Promise<ChapterSummary[]> => {
    await requireAuth();
    return translatorService.listChapters(data.slug);
  });

export function getChaptersQueryOptions(slug: string) {
  return { queryFn: () => getChapters({ data: { slug } }), queryKey: chaptersQueryKey(slug) };
}

const ChapterMarkdownSchema = z.object({
  slug: z.string().min(1),
  chapterNumber: z.number().int().positive(),
});

const getChapterMarkdown = createServerFn()
  .validator(ChapterMarkdownSchema)
  .handler(async ({ data }): Promise<string | null> => {
    await requireAuth();
    // The latest translated markdown for one chapter, read through the same
    // storage port the translator service writes through; `null` when no
    // translation exists yet (the output pane shows its empty state).
    return storage.get(translationFileKey(data.slug, data.chapterNumber));
  });

export function getChapterMarkdownQueryOptions(slug: string, chapterNumber: number) {
  return {
    queryFn: () => getChapterMarkdown({ data: { slug, chapterNumber } }),
    queryKey: chapterMarkdownQueryKey(slug, chapterNumber),
  };
}

export function getNovelDetailQueryOptions(slug: string) {
  return { queryFn: () => getNovelDetail({ data: { slug } }), queryKey: novelDetailQueryKey(slug) };
}

const getGlossary = createServerFn()
  .validator(SlugSchema)
  .handler(async ({ data }): Promise<Glossary> => {
    await requireAuth();
    return translatorService.listGlossary(data.slug);
  });

export function getGlossaryQueryOptions(slug: string) {
  return { queryFn: () => getGlossary({ data: { slug } }), queryKey: glossaryQueryKey(slug) };
}
