import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "#/lib/auth/session.server";
import type { Glossary } from "../translator/glossary";
import {
  NOVEL_NOT_FOUND_ERROR,
  type ActivityRow,
  type NovelDetail,
  type NovelSummary,
} from "../translator/service";
import { translatorService } from "../translator/translator.server";
import { CreateNovelSchema, type Novel } from "./novels-core";

export const novelsQueryKey = ["novels"] as const;
export const recentNovelsQueryKey = ["novels", "recent"] as const;
export const novelDetailQueryKey = (slug: string) => ["novels", slug] as const;
export const glossaryQueryKey = (slug: string) => ["novels", slug, "glossary"] as const; // nested under the detail key so it invalidates with the novel
export const recentActivitiesQueryKey = ["activities", "recent"] as const;
export const novelActivityQueryKey = (slug: string) => ["novels", slug, "activity"] as const;

const SlugSchema = z.object({ slug: z.string().min(1) });

const listNovels = createServerFn().handler(async (): Promise<NovelSummary[]> => {
  return translatorService.listNovels();
});

const listRecentNovels = createServerFn().handler(async (): Promise<NovelSummary[]> => {
  return translatorService.listRecentNovels();
});

// limit 5: the home page's Recent Activity feed stays scannable; the DB reader
// caps it at read time. No per-function requireAuth - the _app layout guards the
// page, mirroring listRecentNovels.
export const HOME_ACTIVITY_LIMIT = 5;

const listRecentActivities = createServerFn().handler(async (): Promise<ActivityRow[]> => {
  return translatorService.listRecentActivities(HOME_ACTIVITY_LIMIT);
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

export const startParsing = createServerFn({ method: "POST" })
  .validator(SlugSchema)
  .handler(async ({ data }): Promise<Novel> => {
    await requireAuth();
    return translatorService.startParsing(data.slug);
  });

export const startExtraction = createServerFn({ method: "POST" })
  .validator(SlugSchema)
  .handler(async ({ data }): Promise<Novel> => {
    await requireAuth();
    return translatorService.startExtraction(data.slug);
  });

export function getNovelsQueryOptions() {
  return { queryFn: () => listNovels(), queryKey: novelsQueryKey };
}

export function getRecentNovelsQueryOptions() {
  return { queryFn: () => listRecentNovels(), queryKey: recentNovelsQueryKey };
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

export function getRecentActivitiesQueryOptions() {
  return { queryFn: () => listRecentActivities(), queryKey: recentActivitiesQueryKey };
}

const listActivityForNovel = createServerFn()
  .validator(SlugSchema)
  .handler(async ({ data }): Promise<ActivityRow[]> => {
    await requireAuth();
    const novel = await translatorService.findNovelBySlug(data.slug);
    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }
    return translatorService.listActivitiesForNovel(novel.id);
  });

export function getNovelActivityQueryOptions(slug: string) {
  return { queryFn: () => listActivityForNovel({ data: { slug } }), queryKey: novelActivityQueryKey(slug) };
}
