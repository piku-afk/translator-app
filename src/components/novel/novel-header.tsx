import { Box, Group, Progress, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Dot } from "lucide-react";
import { getChaptersQueryOptions, getNovelDetailQueryOptions } from "#/lib/novels/novels";
import { sourceLanguageLabel, type SourceLanguage } from "#/lib/novels/novels-core";
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

/**
 * The novel's translation progress: translated chapter count over the declared
 * total (spec #45). Visual progress only - no lifecycle status plumbing. The
 * bar hides entirely while no chapter has been translated yet so the header
 * stays calm on a brand-new novel.
 */
function ProgressBar({ slug, totalChapters }: { slug: string; totalChapters: number }) {
  const { data: chapters } = useSuspenseQuery(getChaptersQueryOptions(slug));
  const translatedCount = chapters.filter((chapter) => chapter.status === "translated").length;

  if (translatedCount === 0) {
    return null;
  }

  const percent = totalChapters > 0 ? (translatedCount / totalChapters) * 100 : 0;

  return (
    <Group className="items-center gap-2">
      <Progress value={percent} size="md" className="w-32" color="myColor" />
      <Text size="sm" c="dimmed" className="whitespace-nowrap">
        {translatedCount} of {totalChapters} chapters
      </Text>
    </Group>
  );
}

export function NovelHeader({ slug }: { slug: string }) {
  const {
    data: { novel },
  } = useSuspenseQuery(getNovelDetailQueryOptions(slug));

  return (
    <Stack className="gap-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm hover:text-black">
        <ArrowLeft className="size-4" />
        Home
      </Link>
      <Box className="space-y-2">
        <Group className="items-center justify-between gap-3">
          <Title order={2} className="text-3xl font-semibold">
            {novel.name}
          </Title>
          <ProgressBar slug={slug} totalChapters={novel.total_chapters} />
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
        </Group>
      </Box>
    </Stack>
  );
}
