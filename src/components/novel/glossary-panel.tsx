import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, NotebookText } from "lucide-react";
import { getGlossaryQueryOptions } from "#/lib/novels/novels";
import type { GlossaryEntry } from "#/lib/translator/glossary";

/**
 * Row 2 right column of the details page: the novel's glossary as a read-only
 * display (spec #45, story 20). The app maintains it automatically on each
 * Translate (story 21), so there is no start-extraction action here. Read-only
 * scroll is the v1 decision — search/tabs are explicitly out of scope.
 */
export function GlossaryPanel({ slug }: { slug: string }) {
  const { data } = useQuery(getGlossaryQueryOptions(slug));
  const entries = data ?? [];

  return (
    <Paper withBorder p="md" radius="md" className="flex flex-col">
      <Group justify="space-between" mb="xs">
        <Title order={3}>Glossary</Title>
        <Badge size="sm" variant="light">
          {entries.length} {entries.length === 1 ? "name" : "names"}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="xs">
        Maintained automatically as you translate — read-only.
      </Text>

      {entries.length === 0 ? (
        <Stack className="items-center justify-center gap-2 py-8">
          <NotebookText className="size-6 text-muted-foreground" aria-hidden />
          <Text c="dimmed" className="text-sm">
            No glossary yet — translate a chapter to build it.
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm" className="max-h-72 overflow-auto pr-1">
          {entries.map((entry: GlossaryEntry) => (
            <Paper key={entry.id} withBorder className="p-3" radius="md">
              <Group justify="space-between" align="center" wrap="nowrap" gap="md">
                <Text className="truncate font-mono text-sm">{entry.sourceNames.join(" · ")}</Text>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Text className="shrink-0 text-sm font-medium">
                  {entry.englishNames.join(" · ")}
                </Text>
              </Group>
              {entry.description && (
                <Text c="dimmed" size="sm">
                  {entry.description}
                </Text>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
