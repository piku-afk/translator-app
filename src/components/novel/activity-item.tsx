import { Group, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "#/lib/novels/activity-metadata";
import type { ActivityRow } from "#/lib/translator/service";
import { ActivityIcon } from "./activity-icon";

/** One home-page feed entry per the screens.md mockup: icon · timestamp ·
 * action label · novel name, with an optional detail line underneath. The row
 * links to its novel's detail page. */
export function ActivityItem({ activity }: { activity: ActivityRow }) {
  const color = ACTIVITY_COLORS[activity.action];

  return (
    <li className="list-none">
      <Link
        to="/novels/$slug"
        params={{ slug: activity.slug }}
        className="block rounded-lg border border-border bg-card px-4 py-3 hover:border-black focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Group wrap="nowrap" className="gap-3">
          <Text c={color} component="span" className="shrink-0 leading-none">
            <ActivityIcon action={activity.action} className="size-4" />
          </Text>

          <Stack className="min-w-0 flex-1 gap-0.5">
            <Group wrap="nowrap" className="gap-2">
              <Text className="text-xs tabular-nums text-muted-foreground">
                {format(activity.created_at, "d MMM HH:mm")}
              </Text>
              <Text className="text-sm font-medium">{ACTIVITY_LABELS[activity.action]}</Text>
              <Text className="ml-auto truncate text-sm text-muted-foreground">
                {activity.novel_name}
              </Text>
            </Group>

            {activity.detail && (
              <Text className="text-xs text-muted-foreground">{activity.detail}</Text>
            )}
          </Stack>
        </Group>
      </Link>
    </li>
  );
}