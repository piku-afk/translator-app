import { Alert, Badge, Group, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Spinner } from "#/components/ui/spinner";
import { Button } from "#/components/ui/button";
import { getErrorMessage } from "#/lib/utils";
import {
  getNovelDetailQueryOptions,
  novelDetailQueryKey,
  novelsQueryKey,
  startParsing,
} from "#/lib/novels/novels";
import { NOVEL_NOT_FOUND_ERROR } from "#/lib/translator/service";
import { sourceLanguageLabel, type SourceLanguage } from "#/lib/novels/novels-core";

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

    // Keep the page live while a parse job runs: poll until the novel leaves
    // `parsing` so the transition to ready/needs review/failed shows up.
    const { data: detail } = useQuery({
      ...getNovelDetailQueryOptions(slug),
      refetchInterval: (query) => (query.state.data?.novel.status === "parsing" ? 3000 : false),
    });

    const startParsingMutation = useMutation({
      mutationFn: () => startParsing({ data: { slug } }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
      },
    });

    if (!detail) {
      return null; // the loader ensured the data
    }

    const { novel, chapter_count } = detail;
    const canStartParsing = novel.status === "draft" || novel.status === "failed";

    return (
      <Stack className="mx-auto w-full max-w-sm gap-6">
        <Stack className="gap-1">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All novels
          </Link>
          <Title order={2}>{novel.name}</Title>
          <Text c="dimmed" className="text-sm">
            {sourceLanguageLabel(novel.source_language as SourceLanguage)} -&gt; English
          </Text>
        </Stack>

        <Group className="items-center justify-between">
          <Badge variant="default" size="xs">
            {novel.status}
          </Badge>
          <Text className="text-xs font-medium">
            {chapter_count} / {novel.total_chapters} chapters parsed
          </Text>
        </Group>

        {novel.status === "parsing" && (
          <Group className="gap-2 text-sm text-muted-foreground">
            <Spinner className="size-3" />
            Parsing chapters&hellip;
          </Group>
        )}

        {canStartParsing && (
          <Button
            loading={startParsingMutation.isPending}
            loadingText="Starting"
            onClick={() => startParsingMutation.mutate()}
          >
            Start parsing
          </Button>
        )}

        {novel.status === "needs review" && (
          <Alert variant="light" color="yellow" title="Chapter count mismatch">
            Parsed {chapter_count} chapters but the novel declares {novel.total_chapters}. Reconcile
            the chapter files on R2 under novels/{novel.slug}/chapters/ - the app does not re-parse
            automatically.
          </Alert>
        )}

        {novel.status === "failed" && (
          <Alert variant="light" color="red" title="Parsing failed">
            {novel.last_error ?? "Parsing failed for an unknown reason."}
          </Alert>
        )}

        {startParsingMutation.error && (
          <Alert variant="light" color="red" title="Could not start parsing">
            {getErrorMessage(startParsingMutation.error)}
          </Alert>
        )}
      </Stack>
    );
  },
});
