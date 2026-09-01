import { Badge, Button, Divider, Group, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Dot, Download, ArrowLeft, ArrowRight } from "lucide-react";
import { GlossarySection } from "#/components/novel/glossary-section";
import { LifecycleStepper } from "#/components/novel/lifecycle-stepper";
import { NovelHistory } from "#/components/novel/novel-history";
import { SectionHeading } from "#/components/ui/section-heading";
import { getErrorMessage } from "#/lib/utils";
import {
  getChaptersQueryOptions,
  getGlossaryQueryOptions,
  getNovelDetailQueryOptions,
  novelActivityQueryKey,
  novelDetailQueryKey,
  novelsQueryKey,
  rerunChapter,
  startExtraction,
  startParsing,
  startTranslation,
} from "#/lib/novels/novels";
import { CHAPTER_STATUS_COLORS, STATUS_ACTION_VERBS, STATUS_BADGE_COLORS } from "#/lib/novels/status-metadata";
import { NOVEL_NOT_FOUND_ERROR } from "#/lib/translator/service";
import {
  rawFileKey,
  sourceLanguageLabel,
  type NovelStatus,
  type SourceLanguage,
} from "#/lib/novels/novels-core";

function OverviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group className="items-baseline gap-4" wrap="nowrap">
      <Text className="w-28 shrink-0 text-sm text-muted-foreground">{label}</Text>
      {children}
    </Group>
  );
}

function ChapterRow({
  number,
  status,
  canRerun,
  isRerunning,
  onRerun,
}: {
  number: number;
  status: string;
  canRerun: boolean;
  isRerunning: boolean;
  onRerun: () => void;
}) {
  const chapterStatus = status as "queued" | "names extracted" | "translating" | "translated" | "failed";
  return (
    <Group className="w-full justify-between gap-4 py-1">
      <Group className="gap-3">
        <Text className="w-8 text-sm font-medium">#{number}</Text>
        <Badge
          variant={CHAPTER_STATUS_COLORS[chapterStatus] ? "light" : "default"}
          color={CHAPTER_STATUS_COLORS[chapterStatus]}
          size="sm"
        >
          {status}
        </Badge>
      </Group>
      {canRerun && (
        <Button
          variant="default"
          size="xs"
          loading={isRerunning}
          onClick={onRerun}
        >
          Rerun
        </Button>
      )}
    </Group>
  );
}

export const Route = createFileRoute("/_app/novels/$slug")({
  loader: async ({ params, context }) => {
    try {
      await context.queryClient.ensureQueryData(getNovelDetailQueryOptions(params.slug));
    } catch (error) {
      if (getErrorMessage(error) === NOVEL_NOT_FOUND_ERROR) {
        throw notFound();
      }
      throw error;
    }
  },
  component: function NovelDetailPage() {
    const { slug } = Route.useParams();
    const queryClient = useQueryClient();

    // Keep the page live while a parse, extraction, or translation job runs:
    // poll until the novel leaves `parsing`/`extracting`/`translating` so the
    // transition to its terminal status shows up.
    const { data: detail } = useQuery({
      ...getNovelDetailQueryOptions(slug),
      refetchInterval: (query) =>
        query.state.data?.novel.status === "parsing" ||
        query.state.data?.novel.status === "extracting" ||
        query.state.data?.novel.status === "translating"
          ? 3000
          : false,
    });

    // A job is running (as opposed to a start-* mutation being pending): the
    // granular status has already flipped to the in-progress state.
    const jobRunning =
      detail?.novel.status === "parsing" ||
      detail?.novel.status === "extracting" ||
      detail?.novel.status === "translating";

    const startParsingMutation = useMutation({
      mutationFn: () => startParsing({ data: { slug } }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
        await queryClient.invalidateQueries({ queryKey: novelActivityQueryKey(slug) });
      },
    });

    const startExtractionMutation = useMutation({
      mutationFn: () => startExtraction({ data: { slug } }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
        await queryClient.invalidateQueries({ queryKey: novelActivityQueryKey(slug) });
      },
    });

    const startTranslationMutation = useMutation({
      mutationFn: () => startTranslation({ data: { slug } }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
        await queryClient.invalidateQueries({ queryKey: novelActivityQueryKey(slug) });
      },
    });

    const { data: chapters } = useQuery({
      ...getChaptersQueryOptions(slug),
      // Live stepper progress while a job runs (translated count / names-
      // extracted count feed the active step's progress bar).
      refetchInterval: jobRunning ? 3000 : false,
    });

    // The stepper's per-step counts reuse existing queries: parsed chapters
    // from the novel detail, glossary size from the glossary query, and the
    // extract/translate progress from the chapters query.
    const { data: glossary } = useQuery({ ...getGlossaryQueryOptions(slug) });
    const glossarySize = glossary?.length ?? 0;
    const chapterStatuses = chapters ?? [];
    const namesExtractedChapterCount = chapterStatuses.filter(
      (chapter) => chapter.status === "names extracted",
    ).length;
    const translatedChapterCount = chapterStatuses.filter(
      (chapter) => chapter.status === "translated",
    ).length;

    const rerunChapterMutation = useMutation({
      mutationFn: (chapterNumber: number) => rerunChapter({ data: { slug, chapterNumber } }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
        await queryClient.invalidateQueries({ queryKey: ["novels", slug, "chapters"] });
      },
    });

    if (!detail) {
      return null; // the loader ensured the data
    }

    const { novel, chapter_count } = detail;
    const status = novel.status as NovelStatus;
    const canStartExtraction =
      status === "ready" || status === "names extracted" || status === "extraction failed";
    const isParsing = status === "parsing" || startParsingMutation.isPending;
    const isExtracting = status === "extracting" || startExtractionMutation.isPending;
    const isTranslating = status === "translating" || startTranslationMutation.isPending;

    // novel-card's language for the last action, with the same updated_at proxy.
    const lastAction =
      status === "parsing" || status === "extracting" || status === "translating"
        ? `${STATUS_ACTION_VERBS[status]} ${formatDistanceToNow(novel.updated_at, { addSuffix: true })}`
        : `${STATUS_ACTION_VERBS[status]} ${format(novel.updated_at, "do MMM yyyy 'at' HH:mm")}`;

    return (
      <Stack className="gap-6">
        <Stack className="gap-1">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Home
          </Link>
          <Title order={2} className="text-3xl font-semibold">
            {novel.name}
          </Title>
          <Group component={Text} c="dimmed" className="text-sm gap-0">
            <Group component="span" className="gap-2">
              {sourceLanguageLabel(novel.source_language as SourceLanguage)}
              <ArrowRight className="size-3.5" />
              English
            </Group>
            <Dot />
            {novel.total_chapters} declared chapters
            <Dot />
            Added {format(novel.created_at, "do MMM yyyy")}
          </Group>
        </Stack>

        <Divider />

        <Stack className="gap-3">
          <SectionHeading>Overview</SectionHeading>
          <OverviewRow label="Status">
            <Badge
              variant={STATUS_BADGE_COLORS[status] ? "light" : "default"}
              color={STATUS_BADGE_COLORS[status]}
              size="sm"
            >
              {novel.status}
            </Badge>
          </OverviewRow>
          <OverviewRow label="Chapters">
            <Text className="text-sm font-medium">
              {chapter_count} / {novel.total_chapters}
            </Text>
          </OverviewRow>
          <OverviewRow label="Last action">
            <Text c="dimmed" className="text-sm">
              {lastAction}
            </Text>
          </OverviewRow>
          <OverviewRow label="Source file">
            <Text className="font-mono text-sm">{rawFileKey(slug)}.txt</Text>
          </OverviewRow>
          <OverviewRow label="Size">
            <Group component={Text} c="dimmed" className="text-sm gap-0">
              2.5 MB <Dot /> Uploaded {format(novel.created_at, "do MMM yyyy")}
            </Group>
          </OverviewRow>
        </Stack>

        <Divider />

        <Stack className="gap-3">
          <SectionHeading>Lifecycle</SectionHeading>
          <LifecycleStepper
            slug={slug}
            status={status}
            updatedAt={novel.updated_at}
            chapterCount={chapter_count}
            totalChapters={novel.total_chapters}
            glossarySize={glossarySize}
            namesExtractedChapterCount={namesExtractedChapterCount}
            translatedChapterCount={translatedChapterCount}
            lastError={novel.last_error}
            isParsing={isParsing}
            isExtracting={isExtracting}
            isTranslating={isTranslating}
            startParsingError={
              startParsingMutation.error ? getErrorMessage(startParsingMutation.error) : null
            }
            startExtractionError={
              startExtractionMutation.error ? getErrorMessage(startExtractionMutation.error) : null
            }
            startTranslationError={
              startTranslationMutation.error
                ? getErrorMessage(startTranslationMutation.error)
                : null
            }
            onStartParsing={() => startParsingMutation.mutate()}
            onStartExtraction={() => startExtractionMutation.mutate()}
            onStartTranslation={() => startTranslationMutation.mutate()}
          />
        </Stack>

        <Divider />

        <Stack className="gap-6">
          <SectionHeading>Actions</SectionHeading>

          <Group className="gap-4">
            <Button variant="default" disabled>
              <Download className="size-4" />
              Download raw file
            </Button>
            <Button variant="default" disabled>
              Edit novel
            </Button>
            <Button variant="default" disabled>
              Delete novel
            </Button>
          </Group>
        </Stack>

        <Divider />

        <Stack className="gap-3">
          <SectionHeading>Glossary</SectionHeading>
          <GlossarySection
            slug={slug}
            isExtracting={isExtracting}
            canStartExtraction={canStartExtraction}
            startExtractionLabel={status === "ready" ? "Start extraction" : "Re-run extraction"}
            onStartExtraction={() => startExtractionMutation.mutate()}
          />
        </Stack>

        <Divider />

        <Stack className="gap-3">
          <SectionHeading>Chapters</SectionHeading>
          {chapters?.length ? (
            chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                number={chapter.number}
                status={chapter.status}
                canRerun={
                  (chapter.status === "translated" || chapter.status === "failed") &&
                  !isParsing &&
                  !isExtracting &&
                  !isTranslating
                }
                isRerunning={rerunChapterMutation.isPending}
                onRerun={() => rerunChapterMutation.mutate(chapter.number)}
              />
            ))
          ) : (
            <Text c="dimmed" className="text-sm">No chapters yet.</Text>
          )}
        </Stack>

        <Divider />

        <Stack className="gap-6">
          <SectionHeading>History</SectionHeading>
          <NovelHistory slug={slug} isActive={isParsing || isExtracting || isTranslating} />
        </Stack>
      </Stack>
    );
  },
});
