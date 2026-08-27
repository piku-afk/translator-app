import { createServerFn } from "@tanstack/react-start";
import { getTranslatorService } from "./novels.server";
import { CreateNovelSchema, type Novel } from "./novels-core";

/**
 * Server functions for the Novel create/list flow. Thin adapters: they call
 * the translator service seam and hold no domain logic.
 */

export const novelsQueryKey = ["novels"] as const;

export const listNovels = createServerFn().handler(async (): Promise<Novel[]> => {
  return getTranslatorService().listNovels();
});

export const createNovel = createServerFn({ method: "POST" })
  .validator(CreateNovelSchema)
  .handler(async ({ data }): Promise<Novel> => {
    return getTranslatorService().createNovel(data);
  });

export function getNovelsQueryOptions() {
  return { queryFn: () => listNovels(), queryKey: novelsQueryKey };
}
