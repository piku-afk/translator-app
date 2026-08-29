import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import type { NovelSummary } from "#/lib/translator/service";
import {
  sourceLanguageLabel,
  type NovelStatus,
  type SourceLanguage,
} from "#/lib/novels/novels-core";

/** Past-tense verb describing the last action. */
const STATUS_ACTION_VERBS: Record<NovelStatus, string> = {
  draft: "Created",
  parsing: "Started parsing",
  "needs review": "Parsed",
  ready: "Reviewed",
  extracting: "Started extracting",
  translating: "Started translating",
  completed: "Completed",
  failed: "Failed",
};

/** Mantine color for each status badge; absent = the default (draft) style. */
const STATUS_BADGE_COLORS: Partial<Record<NovelStatus, string>> = {
  parsing: "blue",
  extracting: "blue",
  translating: "blue",
  "needs review": "yellow",
  failed: "red",
  ready: "green",
  completed: "green",
};

export function NovelCard({ novel }: { novel: NovelSummary }) {
  const badgeColor = STATUS_BADGE_COLORS[novel.status as NovelStatus];
  const parsedAt = formatDistanceToNow(novel.updated_at, { addSuffix: true });

  return (
    <Card
      withBorder
      className="p-4 bg-transparent hover:bg-white hover:border-black transition-colors cursor-pointer focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
      renderRoot={(props) => <Link to="/novels/$slug" params={{ slug: novel.slug }} {...props} />}
    >
      <Stack className="gap-4">
        <Stack className="gap-1">
          <Title order={3} className="text-base font-medium line-clamp-2">
            {novel.name}
          </Title>
          <Text className="text-xs">
            {sourceLanguageLabel(novel.source_language as SourceLanguage)} -&gt; English
          </Text>
        </Stack>
        <Group className="items-center justify-between">
          <Badge variant={badgeColor ? "light" : "default"} color={badgeColor} size="xs">
            {novel.status}
          </Badge>
          <Text className="text-xs font-medium">
            {novel.status === "needs review"
              ? `${novel.parsed_chapters}/${novel.total_chapters} chapters`
              : `${novel.total_chapters} chapters`}
          </Text>
        </Group>

        <Text c="dimmed" className="text-xs font-medium line-clamp-1">
          {novel.status === "failed"
            ? (novel.last_error ?? `Failed ${parsedAt}`)
            : `${STATUS_ACTION_VERBS[novel.status as NovelStatus]} ${parsedAt}`}
        </Text>
      </Stack>
    </Card>
  );
}
