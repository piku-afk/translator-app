import { Alert, Badge, Button, Divider, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Dot, Download, ArrowLeft, ArrowRight } from "lucide-react";
import { GlossarySection } from "#/components/novel/glossary-section";
import { NovelStatusAlert } from "#/components/novel/novel-status-alert";
import { SectionHeading } from "#/components/ui/section-heading";
import { getErrorMessage } from "#/lib/utils";
import {
  getNovelDetailQueryOptions,
  novelDetailQueryKey,
  novelsQueryKey,
  startExtraction,
  startParsing,
} from "#/lib/novels/novels";
import { STATUS_ACTION_VERBS, STATUS_BADGE_COLORS } from "#/lib/novels/status-metadata";
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

    // Keep the page live while a parse or extraction job runs: poll until the
    // novel leaves `parsing`/`extracting` so the transition to its terminal
    // status shows up.
    const { data: detail } = useQuery({
      ...getNovelDetailQueryOptions(slug),
      refetchInterval: (query) =>
        query.state.data?.novel.status === "parsing" ||
        query.state.data?.novel.status === "extracting"
          ? 3000
          : false,
    });

    const startParsingMutation = useMutation({
      mutationFn: () => startParsing({ data: { slug } }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
      },
    });

    const startExtractionMutation = useMutation({
      mutationFn: () => startExtraction({ data: { slug } }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
      },
    });

    if (!detail) {
      return null; // the loader ensured the data
    }

    const { novel, chapter_count } = detail;
    const status = novel.status as NovelStatus;
    const canStartParsing =
      status === "draft" || status === "parsing failed" || status === "needs review";
    const canStartExtraction =
      status === "ready" || status === "names extracted" || status === "extraction failed";
    const isParsing = status === "parsing" || startParsingMutation.isPending;
    const isExtracting = status === "extracting" || startExtractionMutation.isPending;

    // novel-card's language for the last action, with the same updated_at proxy.
    const lastAction =
      status === "parsing" || status === "extracting"
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

          <NovelStatusAlert
            status={status}
            chapterCount={chapter_count}
            totalChapters={novel.total_chapters}
            lastError={novel.last_error}
            slug={novel.slug}
            isParsing={startParsingMutation.isPending}
            isExtracting={startExtractionMutation.isPending}
          />
          {startParsingMutation.error && (
            <Alert variant="light" color="red" title="Could not start parsing">
              {getErrorMessage(startParsingMutation.error)}
            </Alert>
          )}
          {startExtractionMutation.error && (
            <Alert variant="light" color="red" title="Could not start extraction">
              {getErrorMessage(startExtractionMutation.error)}
            </Alert>
          )}
        </Stack>

        <Divider />

        <Stack className="gap-6">
          <SectionHeading>Actions</SectionHeading>

          <Group className="gap-4">
            {(isParsing || canStartParsing) && (
              <Tooltip withArrow label="Parsing in progress - please wait" disabled={!isParsing}>
                <span className="inline-flex">
                  <Button
                    variant="default"
                    loading={isParsing}
                    onClick={() => startParsingMutation.mutate()}
                  >
                    {status === "draft" ? "Start parsing" : "Re-trigger parsing"}
                  </Button>
                </span>
              </Tooltip>
            )}
            {(isExtracting || canStartExtraction) && (
              <Tooltip
                withArrow
                label="Extraction in progress - please wait"
                disabled={!isExtracting}
              >
                <span className="inline-flex">
                  <Button
                    variant="default"
                    loading={isExtracting}
                    onClick={() => startExtractionMutation.mutate()}
                  >
                    {status === "ready" ? "Start extraction" : "Re-run extraction"}
                  </Button>
                </span>
              </Tooltip>
            )}
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
            startExtractionLabel={
              status === "ready" ? "Start extraction" : "Re-run extraction"
            }
            onStartExtraction={() => startExtractionMutation.mutate()}
          />
        </Stack>
      </Stack>
    );
  },
});
