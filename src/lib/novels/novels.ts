import { createServerFn } from "@tanstack/react-start";
import { CreateNovelSchema, type Novel } from "./novels-core";
import { translatorService } from "../translator/translator.server";

export const novelsQueryKey = ["novels"] as const;

export const listNovels = createServerFn().handler(async (): Promise<Novel[]> => {
  return translatorService.listNovels();
});

export const createNovel = createServerFn({ method: "POST" })
  .validator(CreateNovelSchema)
  .handler(async ({ data }): Promise<Novel> => {
    return translatorService.createNovel(data);
  });

export function getNovelsQueryOptions() {
  return { queryFn: () => listNovels(), queryKey: novelsQueryKey };
}
