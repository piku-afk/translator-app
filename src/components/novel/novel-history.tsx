import { EmptyState, Text, Timeline } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { format } from "date-fns";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "#/lib/novels/activity-metadata";
import { getNovelActivityQueryOptions } from "#/lib/novels/novels";

/** Recent entries shown before older ones are collapsed, matching the mockup. */
const TIMELINE_LIMIT = 5;

type NovelHistoryProps = {
  slug: string;
  /** True while a parse or extraction job runs; drives the live-poll cadence. */
  isActive: boolean;
};

/** A novel's activity timeline per the screens.md mockup: newest first, the
 * latest few shown, older entries collapsed into a hint. Live-refreshes on the
 * same 3s cadence as the detail page while a job runs. */
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
  const visible = [...activities].reverse().slice(0, TIMELINE_LIMIT);
  const olderCount = activities.length - visible.length;

  return (
    <Timeline bulletSize={20} lineWidth={2}>
      {visible.map((activity) => (
        <Timeline.Item
          key={activity.id}
          color={ACTIVITY_COLORS[activity.action]}
          title={ACTIVITY_LABELS[activity.action]}
        >
          {activity.detail && (
            <Text className="text-xs text-muted-foreground">{activity.detail}</Text>
          )}
          <Text className="text-xs tabular-nums text-muted-foreground">
            {format(activity.created_at, "d MMM HH:mm")}
          </Text>
        </Timeline.Item>
      ))}

      {olderCount > 0 && (
        <Timeline.Item>
          <Text c="dimmed" className="text-xs italic">
            older entries not shown
          </Text>
        </Timeline.Item>
      )}
    </Timeline>
  );
}