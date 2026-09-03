import { Card, Divider, EmptyState, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { History } from "lucide-react";
import { getNovelActivityQueryOptions } from "#/lib/novels/novels";
import { ActivityItem } from "./activity-item";

type NovelHistoryProps = {
  slug: string;
  /** True while a parse, extraction, or translation job runs; drives the live-poll cadence. */
  isActive: boolean;
};

/** A novel's complete activity history as a flat Recent-Activity-style list,
 * newest first, reusing `ActivityItem` with its link removed (the rows would
 * link to the page they are already on). The full retry story — repeats,
 * re-triggers, failures — stays visible without a Timeline wrapper.
 * Live-refreshes on the same 3s cadence as the detail page while a job runs. */
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
    <Card withBorder radius="md" className="px-0 py-0">
      <Stack gap={0}>
        {visible.map((activity, index) => (
          <Fragment key={activity.id}>
            {index > 0 && <Divider />}
            <ActivityItem activity={activity} showLink={false} />
          </Fragment>
        ))}
      </Stack>
    </Card>
  );
}