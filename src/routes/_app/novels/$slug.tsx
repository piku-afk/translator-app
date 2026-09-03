import { Badge, Button, Divider, Group, Stack, Text } from "@mantine/core";
import {
  noop,
  useMutation,
  usePrefetchQuery,
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
} from "@tanstack/react-query";
import { Suspense } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";
import { GlossarySection } from "#/components/novel/glossary-section";
import { LifecycleSection, LifecycleSectionSkeleton } from "#/components/novel/lifecycle-section";
import { NovelHeader, NovelHeaderSkeleton } from "#/components/novel/novel-header";
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
import { CHAPTER_STATUS_COLORS } from "#/lib/novels/status-metadata";
import { NOVEL_NOT_FOUND_ERROR } from "#/lib/translator/service";
import { type NovelStatus } from "#/lib/novels/novels-core";
import { RetryErrorBoundary } from "#/components/ui/retry-error-boundary";

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
  const chapterStatus = status as
    | "queued"
    | "names extracted"
    | "translating"
    | "translated"
    | "failed";
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
        <Button variant="default" size="xs" loading={isRerunning} onClick={onRerun}>
          Rerun
        </Button>
      )}
    </Group>
  );
}

export const Route = createFileRoute("/_app/novels/$slug")({
  loader: async ({ params, context }) => {
    try {
      void context.queryClient.query(getNovelDetailQueryOptions(params.slug)).catch(noop);
    } catch (error) {
      if (getErrorMessage(error) === NOVEL_NOT_FOUND_ERROR) {
        throw notFound();
      }
      throw error;
    }
    // // Best-effort warm-up of the first section's data (same pattern as the
    // // home route): the Lifecycle section suspends on these while they resolve.
    // context.queryClient.prefetchQuery(getChaptersQueryOptions(params.slug));
    // context.queryClient.prefetchQuery(getGlossaryQueryOptions(params.slug));
  },
  component: function NovelDetailPage() {
    const { slug } = Route.useParams();

    // const queryClient = useQueryClient();

    // // Keep the page live while a parse, extraction, or translation job runs:
    // // poll until the novel leaves `parsing`/`extracting`/`translating` so the
    // // transition to its terminal status shows up.
    // const { data: detail } = useQuery({
    //   ...getNovelDetailQueryOptions(slug),
    //   refetchInterval: (query) =>
    //     query.state.data?.novel.status === "parsing" ||
    //     query.state.data?.novel.status === "extracting" ||
    //     query.state.data?.novel.status === "translating"
    //       ? 3000
    //       : false,
    // });

    // // A job is running (as opposed to a start-* mutation being pending): the
    // // granular status has already flipped to the in-progress state.
    // const jobRunning =
    //   detail?.novel.status === "parsing" ||
    //   detail?.novel.status === "extracting" ||
    //   detail?.novel.status === "translating";

    // const startParsingMutation = useMutation({
    //   mutationFn: () => startParsing({ data: { slug } }),
    //   onSuccess: async () => {
    //     await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
    //     await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
    //     await queryClient.invalidateQueries({ queryKey: novelActivityQueryKey(slug) });
    //   },
    // });

    // const startExtractionMutation = useMutation({
    //   mutationFn: () => startExtraction({ data: { slug } }),
    //   onSuccess: async () => {
    //     await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
    //     await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
    //     await queryClient.invalidateQueries({ queryKey: novelActivityQueryKey(slug) });
    //   },
    // });

    // const startTranslationMutation = useMutation({
    //   mutationFn: () => startTranslation({ data: { slug } }),
    //   onSuccess: async () => {
    //     await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
    //     await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
    //     await queryClient.invalidateQueries({ queryKey: novelActivityQueryKey(slug) });
    //   },
    // });

    // const { data: chapters } = useQuery({
    //   ...getChaptersQueryOptions(slug),
    //   // Live stepper progress while a job runs (translated count / names-
    //   // extracted count feed the active step's progress bar).
    //   refetchInterval: jobRunning ? 3000 : false,
    // });

    // // The stepper's per-step counts reuse existing queries: parsed chapters
    // // from the novel detail, glossary size from the glossary query, and the
    // // extract/translate progress from the chapters query.
    // const { data: glossary } = useQuery({ ...getGlossaryQueryOptions(slug) });
    // const glossarySize = glossary?.length ?? 0;
    // const chapterStatuses = chapters ?? [];
    // const namesExtractedChapterCount = chapterStatuses.filter(
    //   (chapter) => chapter.status === "names extracted",
    // ).length;
    // const translatedChapterCount = chapterStatuses.filter(
    //   (chapter) => chapter.status === "translated",
    // ).length;

    // const rerunChapterMutation = useMutation({
    //   mutationFn: (chapterNumber: number) => rerunChapter({ data: { slug, chapterNumber } }),
    //   onSuccess: async () => {
    //     await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
    //     await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
    //     await queryClient.invalidateQueries({ queryKey: ["novels", slug, "chapters"] });
    //   },
    // });

    // if (!detail) {
    //   return null; // the loader ensured the data
    // }

    // const { novel, chapter_count } = detail;
    // const status = novel.status as NovelStatus;
    // const canStartExtraction =
    //   status === "ready" || status === "names extracted" || status === "extraction failed";
    // const isParsing = status === "parsing" || startParsingMutation.isPending;
    // const isExtracting = status === "extracting" || startExtractionMutation.isPending;
    // const isTranslating = status === "translating" || startTranslationMutation.isPending;

    return (
      <Stack className="gap-6">
        <RetryErrorBoundary title="Failed to render novel header">
          <Suspense fallback={<NovelHeaderSkeleton />}>
            <NovelHeader slug={slug} />
          </Suspense>
        </RetryErrorBoundary>

        <Divider />

        <RetryErrorBoundary title="Failed to render novel lifecycle">
          <Suspense fallback={<LifecycleSectionSkeleton />}>
            <LifecycleSection slug={slug} />
          </Suspense>
        </RetryErrorBoundary>

        <Divider />

        {/* <Stack className="gap-6">
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
        </Stack> */}

        {/* <Divider /> */}

        {/* <Stack className="gap-3">
          <SectionHeading>Glossary</SectionHeading>
          <GlossarySection
            slug={slug}
            isExtracting={isExtracting}
            canStartExtraction={canStartExtraction}
            startExtractionLabel={status === "ready" ? "Start extraction" : "Re-run extraction"}
            onStartExtraction={() => startExtractionMutation.mutate()}
          />
        </Stack> */}

        {/* <Divider /> */}

        {/* <Stack className="gap-3">
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
            <Text c="dimmed" className="text-sm">
              No chapters yet.
            </Text>
          )}
        </Stack> */}

        {/* <Divider /> */}

        <Stack className="gap-6">
          <SectionHeading>History</SectionHeading>
          <NovelHistory slug={slug} isActive={isParsing || isExtracting || isTranslating} />
        </Stack>
      </Stack>
    );
  },
});
