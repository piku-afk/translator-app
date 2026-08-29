import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  sourceLanguageLabel,
  type Novel,
  type NovelStatus,
  type SourceLanguage,
} from "#/lib/novels/novels-core";

/** Past-tense verb describing the last action. */
const STATUS_ACTION_VERBS: Record<NovelStatus, string> = {
  draft: "created",
  parsing: "started parsing",
  "needs review": "parsed",
  ready: "reviewed",
  extracting: "started extracting",
  translating: "started translating",
  completed: "completed",
  failed: "failed",
};

export function NovelCard({ novel }: { novel: Novel }) {
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
          <Badge variant="default" size="xs">
            {novel.status}
          </Badge>
          <Text className="text-xs font-medium">{novel.total_chapters} chapters</Text>
        </Group>

        <Text c="dimmed" className="text-xs font-medium">
          {STATUS_ACTION_VERBS[novel.status as NovelStatus]}&nbsp;
          {formatDistanceToNow(novel.updated_at, { addSuffix: true })}
        </Text>
      </Stack>
    </Card>
  );
}
