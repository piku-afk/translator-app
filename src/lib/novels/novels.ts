import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "#/lib/auth/session.server";
import { NOVEL_NOT_FOUND_ERROR, type NovelDetail } from "../translator/service";
import { translatorService } from "../translator/translator.server";
import { CreateNovelSchema, type Novel } from "./novels-core";

export const novelsQueryKey = ["novels"] as const;
export const novelDetailQueryKey = (slug: string) => ["novels", slug] as const;

const SlugSchema = z.object({ slug: z.string().min(1) });

export const listNovels = createServerFn().handler(async (): Promise<Novel[]> => {
  return translatorService.listNovels();
});

export const createNovel = createServerFn({ method: "POST" })
  .validator(CreateNovelSchema)
  .handler(async ({ data }): Promise<Novel> => {
    return translatorService.createNovel(data);
  });

export const getNovelDetail = createServerFn()
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
    const novel = await translatorService.findNovelBySlug(data.slug);
    if (!novel) {
      throw new Error(NOVEL_NOT_FOUND_ERROR);
    }
    return translatorService.startParsing(novel.id);
  });

export function getNovelsQueryOptions() {
  return { queryFn: () => listNovels(), queryKey: novelsQueryKey };
}

export function getNovelDetailQueryOptions(slug: string) {
  return { queryFn: () => getNovelDetail({ data: { slug } }), queryKey: novelDetailQueryKey(slug) };
}
