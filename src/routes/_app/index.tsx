import { Box, Button, Group, Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { Greeting, GreetingSkeleton } from "#/components/greeting";
import { NovelList, NovelListSkeleton } from "#/components/novel/novel-list";
import { getGreetingDataQueryOptions } from "#/lib/greetings/greetings";
import { getRecentNovelsQueryOptions } from "#/lib/novels/novels";
import { Suspense } from "react";
import { NewNovelButton } from "#/components/novel/new-novel-button";
import { SectionHeading } from "#/components/ui/section-heading";

export const Route = createFileRoute("/_app/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getGreetingDataQueryOptions());
    context.queryClient.prefetchQuery(getRecentNovelsQueryOptions());
  },
  component: function HomePage() {
    return (
      <Stack className="gap-10 py-6">
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>

        {/* Your Novels */}
        <Box component="section" className="space-y-6">
          <Group className="justify-between">
            <SectionHeading>Recent Novels</SectionHeading>
            <NewNovelButton />
          </Group>

          <Suspense fallback={<NovelListSkeleton />}>
            <NovelList />
          </Suspense>

          <Group className="justify-end">
            <Button size="xs" variant="default" disabled>
              View all novels
            </Button>
          </Group>
        </Box>
      </Stack>
    );
  },
});
