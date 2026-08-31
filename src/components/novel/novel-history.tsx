import { EmptyState, Stack, Text, ThemeIcon, Timeline } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "#/lib/novels/activity-metadata";
import { getNovelActivityQueryOptions } from "#/lib/novels/novels";
import { ActivityIcon } from "./activity-icon";
import { formatDateTime } from "#/lib/utils";

type NovelHistoryProps = {
  slug: string;
  /** True while a parse or extraction job runs; drives the live-poll cadence. */
  isActive: boolean;
};

/** A novel's complete activity timeline, newest first, with the same
 * per-action icons as the home feed. Live-refreshes on
 * the same 3s cadence as the detail page while a job runs. */
export function NovelHistory({ slug, isActive }: NovelHistoryProps) {
  const { data } = useQuery({
    ...getNovelActivityQueryOptions(slug),
    refetchInterval: isActive ? 3000 : false,
  });

  const activities = data ?? []; // server returns chronological asc

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

  // The mockup reads top-to-bottom, newest first.
  const visible = [...activities].reverse();

  return (
    <Timeline bulletSize={32} lineWidth={2} classNames={{ itemBullet: "bg-white overflow-hidden" }}>
      {visible.map((activity) => (
        <Timeline.Item
          key={activity.id}
          color={ACTIVITY_COLORS[activity.action]}
          title={ACTIVITY_LABELS[activity.action]}
          bullet={
            <ThemeIcon
              variant="white"
              className="rounded-sm"
              color={ACTIVITY_COLORS[activity.action]}
            >
              <ActivityIcon action={activity.action} className="size-4" />
            </ThemeIcon>
          }
          classNames={{ itemTitle: "font-medium" }}
        >
          <Stack className="gap-1">
            {activity.detail && <Text className="text-sm">{activity.detail}</Text>}
            <Text c="dimmed" className="text-xs tabular-nums">
              {formatDateTime(activity.created_at)}
            </Text>
          </Stack>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
