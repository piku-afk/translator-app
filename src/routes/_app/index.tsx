import { Box, Group, Stack, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { Greeting, GreetingSkeleton } from "#/components/greeting";
import { NovelList, NovelListSkeleton } from "#/components/novel-list";
import { getGreetingDataQueryOptions } from "#/lib/greetings/greetings";
import { getRecentNovelsQueryOptions } from "#/lib/novels/novels";
import { Suspense } from "react";
import { NewNovelButton } from "#/components/new-novel-button";

export const Route = createFileRoute("/_app/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getGreetingDataQueryOptions());
    context.queryClient.prefetchQuery(getRecentNovelsQueryOptions());
  },
  component: function HomePage() {
    return (
      <Stack className="gap-10">
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>

        {/* Your Novels */}
        <Box component="section" className="space-y-6">
          <Group className="justify-between">
            <Title order={2} className="text-xl font-medium text-foreground" aria-level={2}>
              Recent Novels
            </Title>
            <NewNovelButton />
          </Group>

          <Suspense fallback={<NovelListSkeleton />}>
            <NovelList />
          </Suspense>
        </Box>

        {/* Recent Activity */}
        <Box component="section" className="space-y-6">
          <Title order={2} className="text-xl font-medium text-foreground" aria-level={2}>
            Recent Activity
          </Title>
        </Box>
      </Stack>
    );
  },
});
