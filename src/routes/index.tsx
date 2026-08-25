import { Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Greeting, GreetingSkeleton } from "#/components/greeting";
import { NovelCard } from "#/components/novel-card";
import { ErrorFallback } from "#/components/error-fallback";
import { NovelCardSkeleton } from "#/components/novel-card-skeleton";
import { RecentActivitySkeleton } from "#/components/recent-activity-skeleton";
import { getGreetingDataQueryOptions, getTimezone } from "#/lib/greetings";
import type { ActivityItem, Novel } from "#/lib/mock-data";
import { Suspense } from "react";

const fetchNovelsJson = async (): Promise<Novel[]> => {
  const res = await fetch("/api/novels");
  if (!res.ok) throw new Error(`Failed to load novels`);
  return (await res.json()) as Novel[];
};

const fetchActivityJson = async (): Promise<ActivityItem[]> => {
  const res = await fetch("/api/activity");
  if (!res.ok) throw new Error("Failed to load activity");
  return (await res.json()) as ActivityItem[];
};

export const Route = createFileRoute("/")({
  context: () => ({ timezone: getTimezone() }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getGreetingDataQueryOptions(context.timezone));
  },
  component: function HomePage() {
    const novels = useQuery({ queryKey: ["novels"], queryFn: fetchNovelsJson });
    const activity = useQuery({ queryKey: ["activity"], queryFn: fetchActivityJson });

    return (
      <Stack className="gap-10">
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting name="John" />
        </Suspense>

        {/* Featured Novels */}
        <section className="space-y-8">
          <h2 className="text-xl font-medium text-foreground" aria-level={2}>
            Your Novels
          </h2>

          {novels.isPending ? (
            <div className="grid gap-4 grid-cols-3">
              {[1, 2, 3].map((i) => (
                <NovelCardSkeleton key={i} />
              ))}
            </div>
          ) : novels.isError ? (
            <ErrorFallback
              componentName="Your Novels"
              error={novels.error}
              onRetry={() => {
                novels.refetch();
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {novels.data.map((novel) => (
                <NovelCard key={novel.id} novel={novel} />
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium text-foreground" aria-level={2}>
            Recent Activity
          </h2>

          {activity.isPending ? (
            <RecentActivitySkeleton />
          ) : activity.isError ? (
            <ErrorFallback
              componentName="Recent Activity"
              error={activity.error}
              onRetry={() => {
                activity.refetch();
              }}
            />
          ) : (
            <ul className="space-y-3">
              {activity.data.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.text}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Stack>
    );
  },
});
