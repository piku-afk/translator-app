import { Badge, Paper, Stack, Text, Title } from "@mantine/core";
import type { ChapterSummary } from "#/lib/translator/service";
import { cn } from "#/lib/utils";

interface ChaptersListProps {
  chapters: ChapterSummary[];
  /** The chapter whose translation is shown in the output pane. */
  activeChapter: number | null;
  onSelect: (number: number) => void;
}

/**
 * Row 2 left column of the details page: the translated chapters list, rows
 * keyed by chapter number (story 14). The currently-selected chapter is
 * highlighted (story 16); clicking a row swaps that chapter's markdown into
 * the row-1 output pane inline (story 15). A fresh chapter appears here after
 * translating because the chapters query is invalidated on success (story 17).
 */
export function ChaptersList({ chapters, activeChapter, onSelect }: ChaptersListProps) {
  const translated = chapters.filter((chapter) => chapter.status === "translated");

  return (
    <Paper withBorder p="md" radius="md">
      <Title order={3} mb="xs">
        Translated chapters
      </Title>
      {translated.length === 0 ? (
        <Text c="dimmed" className="text-sm">
          No chapters yet — translate one to see it here.
        </Text>
      ) : (
        <Stack gap="xs">
          {translated.map((chapter) => {
            const selected = activeChapter === chapter.number;
            return (
              <Paper
                key={chapter.number}
                withBorder
                radius="md"
                className={cn(
                  "flex cursor-pointer items-center justify-between px-3 py-2 transition",
                  selected && "ring-2 ring-myColor",
                )}
                onClick={() => onSelect(chapter.number)}
              >
                <Text className="w-8 text-sm font-medium">#{chapter.number}</Text>
                <Badge variant="light" color="green" size="sm">
                  translated
                </Badge>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
