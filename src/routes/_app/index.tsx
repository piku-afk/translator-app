import { Button, Group, Stack } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Greeting, GreetingSkeleton } from "#/components/greeting";
import { NovelList, NovelListSkeleton } from "#/components/novel-list";
import { getGreetingDataQueryOptions } from "#/lib/greetings/greetings";
import { getNovelsQueryOptions } from "#/lib/novels/novels";
import { Plus } from "lucide-react";
import { Suspense } from "react";

export const Route = createFileRoute("/_app/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getGreetingDataQueryOptions());
    await context.queryClient.ensureQueryData(getNovelsQueryOptions());
  },
  component: function HomePage() {
    return (
      <Stack className="gap-10">
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>

        {/* Your Novels */}
        <section className="space-y-8">
          <Group className="justify-between">
            <h2 className="text-xl font-medium text-foreground" aria-level={2}>
              Your Novels
            </h2>
            <Button
              variant="filled"
              renderRoot={(props) => <Link to="/novels/new" {...props} />}
            >
              <Plus />
              New Novel
            </Button>
          </Group>

          <Suspense fallback={<NovelListSkeleton />}>
            <NovelList />
          </Suspense>
        </section>

        {/* Recent Activity */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium text-foreground" aria-level={2}>
            Recent Activity
          </h2>
        </section>
      </Stack>
    );
  },
});
