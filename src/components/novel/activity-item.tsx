import { Group, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow, startOfDay, subDays } from "date-fns";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "#/lib/novels/activity-metadata";
import type { ActivityRow } from "#/lib/translator/service";
import { ActivityIcon } from "./activity-icon";

/**
 * Relative time for recent events (today or yesterday), otherwise a bare
 * month + year (e.g. "Aug 2026"). Older-than-yesterday events don't need a
 * precise clock time, so an exact date is dropped for scannability.
 */
export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const cutoff = startOfDay(subDays(new Date(), 1)); // start of yesterday
  return date >= cutoff
    ? formatDistanceToNow(date, { addSuffix: true })
    : format(date, "MMM yyyy");
}

/** One activity entry in the home feed card. Reads icon → action → novel, with a
 * relative timestamp right-aligned and an optional detail line underneath. */
export function ActivityItem({ activity }: { activity: ActivityRow }) {
  const color = ACTIVITY_COLORS[activity.action];

  return (
    <Link
      to="/novels/$slug"
      params={{ slug: activity.slug }}
      className="block px-4 py-3 hover:bg-muted/50 focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Group wrap="nowrap" className="gap-3">
        <Text c={color} component="span" className="shrink-0 leading-none">
          <ActivityIcon action={activity.action} className="size-4" />
        </Text>

        <Stack className="min-w-0 flex-1 gap-0.5">
          <Group wrap="nowrap" className="gap-2">
            <Text className="min-w-0 truncate text-sm font-medium">
              {ACTIVITY_LABELS[activity.action]}
            </Text>
            <Text className="shrink-0 overflow-hidden text-ellipsis text-sm text-muted-foreground">
              {activity.novel_name}
            </Text>
            <Text className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatActivityTime(activity.created_at)}
            </Text>
          </Group>

          {activity.detail && (
            <Text className="text-xs text-muted-foreground">{activity.detail}</Text>
          )}
        </Stack>
      </Group>
    </Link>
  );
}