import { Skeleton, Stack, Text } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRecentActivitiesQueryOptions } from "#/lib/novels/novels";
import { ActivityItem } from "./activity-item";

export function ActivityFeedSkeleton() {
  return (
    <Stack className="gap-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={44} radius="md" />
      ))}
    </Stack>
  );
}

/** Home page's Recent Activity feed: the most recent lifecycle events across all
 * novels, newest first, capped at 5, each clickable to its novel. */
export function ActivityFeed() {
  const { data: activities } = useSuspenseQuery(getRecentActivitiesQueryOptions());

  if (activities.length === 0) {
    return (
      <Text c="dimmed" className="text-sm">
        No activity yet. Create a novel to get started.
      </Text>
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
