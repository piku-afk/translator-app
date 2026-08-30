import { EmptyState, Timeline } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { activityText, type ActivityAction } from "#/lib/novels/novels-core";
import { getNovelActivityQueryOptions } from "#/lib/novels/novels";

/** Color per activity action, giving the timeline a light semantic hierarchy. */
const ACTIVITY_COLORS: Record<ActivityAction, string> = {
  "novel created": "gray",
  "parsing started": "blue",
  "parsing ready": "green",
  "needs review": "yellow",
  "parsing failed": "red",
  "extraction started": "blue",
  "names extracted": "green",
  "extraction failed": "red",
};

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
    <Timeline bulletSize={20} lineWidth={2}>
      {activities.map((activity) => {
        const ago = formatDistanceToNow(activity.created_at, { addSuffix: true });
        return (
          <Timeline.Item
            key={activity.id}
            color={ACTIVITY_COLORS[activity.action]}
            title={activityText(activity.action, activity.novel_name, ago, activity.detail)}
          />
        );
      })}
    </Timeline>
  );
}
