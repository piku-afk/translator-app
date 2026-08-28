import { sourceLanguageLabel, type Novel, type SourceLanguage } from "#/lib/novels/novels-core";
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";

export function NovelCard({ novel }: { novel: Novel }) {
  return (
    <Card
      withBorder
      className="p-4 bg-transparent hover:bg-white hover:border-black transition-colors cursor-pointer focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
      renderRoot={(props) => (
        <Link to="/novels/$slug" params={{ slug: novel.slug }} {...props} />
      )}
    >
      <Stack className="gap-4">
        <Stack className="gap-1">
          <Title order={3} className="text-base font-medium text-foreground line-clamp-2">
            {novel.name}
          </Title>
          <Text c="dimmed" className="text-xs">
            {sourceLanguageLabel(novel.source_language as SourceLanguage)} -&gt; English
          </Text>
        </Stack>
        <Group className="items-center justify-between">
          <Badge variant="default" size="xs">
            {novel.status}
          </Badge>
          <Text className="text-xs font-medium">{novel.total_chapters} chapters</Text>
        </Group>
      </Stack>
    </Card>
  );
}
