import { Card, Group, Stack } from "@mantine/core";
import { Skeleton } from "./ui/skeleton";

export function NovelCardSkeleton() {
  return (
    <Card withBorder className="bg-transparent p-4">
      <Stack className="gap-6">
        <Stack className="gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3  w-2/3" />
        </Stack>
        <Group className="items-center justify-between">
          <Skeleton className="h-3 w-15" />
          <Skeleton className="h-3 w-25" />
        </Group>
      </Stack>
    </Card>
  );
}
