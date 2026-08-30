import { EmptyState, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { getNovelActivityQueryOptions } from "#/lib/novels/novels";
import { ActivityItem } from "./activity-item";

type NovelHistoryProps = {
  slug: string;
  /** True while a parse or extraction job runs; drives the live-poll cadence. */
  isActive: boolean;
};

/** A novel's complete lifecycle history, chronological (oldest first), no limit.
 * Live-refreshes on the same 3s cadence as the detail page while a job runs. */
export function NovelHistory({ slug, isActive }: NovelHistoryProps) {
  const { data } = useQuery({
    ...getNovelActivityQueryOptions(slug),
    refetchInterval: isActive ? 3000 : false,
  });

  const activities = data ?? [];

  if (activities.length === 0) {
    return (
      <EmptyState
        classNames={{ title: "text-base font-medium" }}
        icon={<History className="size-8" aria-hidden />}
        title="No history yet"
        description="Lifecycle events for this novel will appear here."
      />
    );
  }

  return (
    <Stack component="ol" className="list-none gap-3">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </Stack>
  );
}
