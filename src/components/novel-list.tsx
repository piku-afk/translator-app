import { Stack, Text } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRecentNovelsQueryOptions } from "#/lib/novels/novels";
import { NovelCard } from "./novel-card";
import { NovelCardSkeleton } from "./novel-card-skeleton";
import { NewNovelButton } from "./new-novel-button";

export function NovelListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <NovelCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function NovelList() {
  const { data: novels } = useSuspenseQuery(getRecentNovelsQueryOptions());

  if (novels.length === 0) {
    return (
      <Stack className="items-center gap-4">
        <Text c="dimmed" className="text-sm">
          No novels yet. Create your first novel to get started.
        </Text>
        <NewNovelButton />
      </Stack>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {novels.map((novel) => (
        <NovelCard key={novel.id ?? ""} novel={novel} />
      ))}
    </div>
  );
}
