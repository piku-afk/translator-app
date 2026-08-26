import { Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { Greeting, GreetingSkeleton } from "#/components/greeting";
import { getGreetingDataQueryOptions } from "#/lib/greetings";
import { Suspense } from "react";

export const Route = createFileRoute("/_app/")({
  context: () => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getGreetingDataQueryOptions(context.timezone));
  },
  component: function HomePage() {
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
