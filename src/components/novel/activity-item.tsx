import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "#/lib/novels/activity-metadata";
import type { ActivityRow } from "#/lib/translator/service";
import { ActivityIcon } from "./activity-icon";
import { formatRelativeDateTime } from "#/lib/utils";

export function ActivityItem({
  activity,
  showLink = true,
}: {
  activity: ActivityRow;
  /** Set false when the row is rendered on the page it would link to. */
  showLink?: boolean;
}) {
  const color = ACTIVITY_COLORS[activity.action];
  const body = (
    <>
      <Group className="gap-2">
        <ThemeIcon variant="white" size="sm" color={color} className="bg-transparent">
          <ActivityIcon action={activity.action} className="size-4" />
        </ThemeIcon>
        <Text className="text-base font-medium">{ACTIVITY_LABELS[activity.action]}</Text>
        <Text c="dimmed" className="ml-auto text-xs tabular-nums">
          {formatRelativeDateTime(activity.created_at)}
        </Text>
      </Group>

      <Stack className="gap-1 mt-2">
        <Text className="text-sm">{activity.novel_name}</Text>
        {activity.detail && <Text className="text-xs">{activity.detail}</Text>}
      </Stack>
    </>
  );

  if (!showLink) {
    return <div className="block p-4">{body}</div>;
  }

  return (
    <Link
      to="/novels/$slug"
      params={{ slug: activity.slug }}
      className="block p-4 hover:bg-gray-100"
    >
      {body}
    </Link>
  );
}
