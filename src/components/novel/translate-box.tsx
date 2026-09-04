import { Alert, Button, Paper, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Languages } from "lucide-react";

interface TranslateBoxProps {
  chapterNumber: string;
  onChapterNumberChange: (value: string) => void;
  numberError?: string;
  pastedText: string;
  onPastedTextChange: (value: string) => void;
  textError?: string;
  /** The mutation's thrown message, surfaced inline next to the action. */
  actionError: string | null;
  /** True while the translate request is in flight (story 4). */
  pending: boolean;
  onTranslate: () => void;
}

/**
 * Row 1 left column of the details page: the chapter-number field plus the
 * paste textarea (stories 2, 7). The textarea flexes to fill the remaining
 * pane height; the Translate button sits below it with a loading state and
 * inline validation/action errors (stories 3, 4, 9).
 */
export function TranslateBox({
  chapterNumber,
  onChapterNumberChange,
  numberError,
  pastedText,
  onPastedTextChange,
  textError,
  actionError,
  pending,
  onTranslate,
}: TranslateBoxProps) {
  return (
    <Paper withBorder p="md" radius="md" className="flex flex-col">
      <Title order={3} mb="xs">
        Translate a chapter
      </Title>
      <Stack gap="sm" className="flex h-full flex-col">
        <TextInput
          label="Chapter number"
          placeholder="e.g. 13"
          className="w-32"
          inputMode="numeric"
          error={numberError}
          value={chapterNumber}
          onChange={(event) => onChapterNumberChange(event.currentTarget.value)}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <Text component="label" size="sm" className="mb-1 block font-medium">
            Paste Korean source text
          </Text>
          <Textarea
            placeholder="Paste the chapter's Korean/Chinese text here…"
            className="flex-1 [&>div]:h-full [&_.mantine-Textarea-wrapper]:h-full"
            classNames={{ input: "resize-y" }}
            error={textError}
            value={pastedText}
            onChange={(event) => onPastedTextChange(event.currentTarget.value)}
          />
        </div>
        {actionError && (
          <Alert variant="light" color="red" title="Translation failed" className="p-2">
            <Text size="sm">{actionError}</Text>
          </Alert>
        )}
        <Button
          onClick={onTranslate}
          loading={pending}
          disabled={pending}
          leftSection={<Languages className="size-4" />}
        >
          Translate
        </Button>
      </Stack>
    </Paper>
  );
}
