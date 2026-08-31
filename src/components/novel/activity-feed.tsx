import { Card, Divider, EmptyState, Skeleton, Stack } from "@mantine/core";
import { Fragment } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
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

export function ActivityFeed() {
  const { data: activities } = useSuspenseQuery(getRecentActivitiesQueryOptions());

  if (activities.length === 0) {
    return (
      <EmptyState
        classNames={{ title: "text-base font-medium" }}
        icon={<History className="size-8" aria-hidden />}
        title="No activity yet"
        description="Create a novel to see its lifecycle events here."
      />
    );
  }

  return (
    <Card withBorder radius="md" className="px-0 py-0">
      <Stack gap={0}>
        {activities.map((activity, index) => (
          <Fragment key={activity.id}>
            {index > 0 && <Divider />}
            <ActivityItem activity={activity} />
          </Fragment>
        ))}
      </Stack>
    </Card>
  );
}
