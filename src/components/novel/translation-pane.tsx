import { Button, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { Clipboard, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TranslationPaneProps {
  /** The chapters-list row currently shown; null when nothing is selected. */
  chapterNumber: number | null;
  /** The selected chapter's markdown; null while none is loaded. */
  markdown: string | null;
  /** True while the markdown query for the selected chapter is in flight. */
  loading: boolean;
}

/**
 * Row 1 right column of the details page: the read-only translation output
 * pane for the currently-selected chapter (story 5), with a Copy button
 * (story 6). A minimum height keeps the two row-1 columns level, and the
 * markdown fills the remaining pane height with its own scroll.
 */
export function TranslationPane({ chapterNumber, markdown, loading }: TranslationPaneProps) {
  const [copied, setCopied] = useState(false);
  // Reset "Copied" whenever the viewed chapter changes so the feedback never
  // lingers over a different chapter's text.
  useEffect(() => setCopied(false), [chapterNumber]);

  // The feedback timer is ambient: clearing it on unmount avoids setting state
  // on a spurious later tick.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      return; // clipboard unavailable (permissions): stay silent, don't mislead
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = chapterNumber !== null && markdown !== null;

  return (
    <Paper withBorder p="md" radius="md" className="flex flex-col">
      <Title order={3} mb="xs">
        Translation
      </Title>
      <div className="flex min-h-0 flex-1 flex-col">
        <Paper
          withBorder
          radius="md"
          bg="gray.0"
          className="min-h-0 flex-1 overflow-auto p-4"
          style={{ minHeight: 240 }}
        >
          {loading ? (
            <Stack className="h-full items-center justify-center">
              <Loader size="sm" />
            </Stack>
          ) : hasContent ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{markdown}</pre>
          ) : (
            <Stack className="h-full items-center justify-center">
              <Text c="dimmed" className="text-sm">
                No translation yet — translate a chapter to see it here.
              </Text>
            </Stack>
          )}
        </Paper>
        <Group justify="space-between" align="center" mt="xs">
          <Text size="sm" c="dimmed">
            {chapterNumber === null ? "No chapter selected" : `Chapter ${chapterNumber}`}
          </Text>
          <Button
            size="xs"
            variant="default"
            disabled={!hasContent || loading}
            leftSection={
              copied ? <Clipboard className="size-3.5" /> : <Copy className="size-3.5" />
            }
            onClick={copy}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </Group>
      </div>
    </Paper>
  );
}
