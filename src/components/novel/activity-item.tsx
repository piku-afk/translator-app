import { Group, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { activityText } from "#/lib/novels/novels-core";
import type { ActivityRow } from "#/lib/translator/service";

/**
 * One activity entry rendered as a human-readable sentence (novel name +
 * relative timestamp), clickable to its novel's detail page. Shared by the
 * home-page Recent Activity feed and the per-novel History timeline.
 */
export function ActivityItem({ activity }: { activity: ActivityRow }) {
  const ago = formatDistanceToNow(activity.created_at, { addSuffix: true });
  const sentence = activityText(activity.action, activity.novel_name, ago, activity.detail);

  return (
    <Group
      component="li"
      className="gap-3 rounded-lg border border-border bg-card px-4 py-3"
      wrap="nowrap"
    >
      <Link
        to="/novels/$slug"
        params={{ slug: activity.slug }}
        className="min-w-0 flex-1 focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Text className="truncate text-sm">{sentence}</Text>
      </Link>
    </Group>
  );
}
