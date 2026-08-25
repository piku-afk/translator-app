import { Skeleton, Stack, Text, Title } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getGreetingDataQueryOptions } from "#/lib/greetings";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/");

export function GreetingSkeleton() {
  return (
    <Stack className="items-center text-center gap-2">
      <Skeleton className="w-1/3 h-9.5" />
      <Skeleton className="w-1/2 h-5.5" />
    </Stack>
  );
}

export function Greeting({ name }: { name: string }) {
  const context = route.useRouteContext();
  const {
    data: { greeting, subtext },
  } = useSuspenseQuery(getGreetingDataQueryOptions(context.timezone));

  return (
    <Stack className="items-center text-center gap-2">
      <Title className="text-3xl font-semibold">
        {greeting},{name}
      </Title>

      <Text c="dimmed" className="text-sm">
        {subtext}
      </Text>
    </Stack>
  );
}
