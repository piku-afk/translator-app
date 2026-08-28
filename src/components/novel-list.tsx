import { Text } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getNovelsQueryOptions } from "#/lib/novels/novels";
import { NovelCard } from "./novel-card";
import { NovelCardSkeleton } from "./novel-card-skeleton";

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
  const { data: novels } = useSuspenseQuery(getNovelsQueryOptions());

  if (novels.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No novels yet. Create your first novel to get started.
      </Text>
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
