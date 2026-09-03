import { Badge, Box, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { usePrefetchQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Dot, ArrowLeft, ArrowRight } from "lucide-react";
import { getNovelDetailQueryOptions } from "#/lib/novels/novels";
import { STATUS_BADGE_COLORS } from "#/lib/novels/status-metadata";
import {
  sourceLanguageLabel,
  type NovelStatus,
  type SourceLanguage,
} from "#/lib/novels/novels-core";
import { formatDateTime } from "#/lib/utils";

export function NovelHeaderSkeleton() {
  return (
    <Stack className="gap-4">
      <Skeleton className="h-4 w-14" />
      <Box className="space-y-2">
        <Group className="items-center gap-3">
          <Skeleton className="h-9 w-64" />
        </Group>
        <Skeleton className="h-4 w-72" />
      </Box>
    </Stack>
  );
}

export function NovelHeader({ slug }: { slug: string }) {
  const {
    data: { novel },
  } = useSuspenseQuery(getNovelDetailQueryOptions(slug));
  const status = novel.status as NovelStatus;

  return (
    <Stack className="gap-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm hover:text-black">
        <ArrowLeft className="size-4" />
        Home
      </Link>
      <Box className="space-y-2">
        <Group className="items-center gap-3">
          <Title order={2} className="text-3xl font-semibold">
            {novel.name}
          </Title>
        </Group>
        <Group component={Text} c="dimmed" className="text-sm gap-0">
          <Group component="span" className="gap-2">
            {sourceLanguageLabel(novel.source_language as SourceLanguage)}
            <ArrowRight className="size-3.5" />
            English
          </Group>
          <Dot />
          {novel.total_chapters} declared chapters
          <Dot />
          Added {formatDateTime(novel.created_at)}
          <Dot />
          <Badge
            size="sm"
            component="span"
            color={STATUS_BADGE_COLORS[status]}
            variant={STATUS_BADGE_COLORS[status] ? "light" : "default"}
          >
            {novel.status}
          </Badge>
        </Group>
      </Box>
    </Stack>
  );
}
