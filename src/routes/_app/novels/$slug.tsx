import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { noop, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Languages } from "lucide-react";
import { ChaptersList } from "#/components/novel/chapters-list";
import { GlossaryPanel } from "#/components/novel/glossary-panel";
import { NovelHeader, NovelHeaderSkeleton } from "#/components/novel/novel-header";
import { TranslateBox } from "#/components/novel/translate-box";
import { TranslationPane } from "#/components/novel/translation-pane";
import { getErrorMessage } from "#/lib/utils";
import {
  chaptersQueryKey,
  chapterMarkdownQueryKey,
  getChapterMarkdownQueryOptions,
  getChaptersQueryOptions,
  getNovelDetailQueryOptions,
  glossaryQueryKey,
  translateChapter,
} from "#/lib/novels/novels";
import { NOVEL_NOT_FOUND_ERROR } from "#/lib/translator/service";

/** The "Re-translate & merge" confirmation (spec stories 11, 12, 13, 26). */
function ConfirmReTranslateDialog({
  chapterNumber,
  onCancel,
  onConfirm,
}: {
  chapterNumber: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      opened={chapterNumber !== null}
      onClose={onCancel}
      title={`Chapter ${chapterNumber ?? ""} already exists`}
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          Re-translating will overwrite the existing English text for Chapter {chapterNumber}. New
          or changed names will be merged into the glossary.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} leftSection={<Languages className="size-4" />}>
            Re-translate &amp; merge
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Parse the chapter-number field: a positive integer, or null when invalid. */
function parseChapterNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  },
  component: function NovelDetailPage() {
    const { slug } = Route.useParams();
    const queryClient = useQueryClient();

    // Translate-box state.
    const [chapterNumber, setChapterNumber] = useState("");
    const [pastedText, setPastedText] = useState("");
    const [numberError, setNumberError] = useState<string | undefined>();
    const [textError, setTextError] = useState<string | undefined>();
    const [confirmNumber, setConfirmNumber] = useState<number | null>(null);

    // Which chapter's markdown is shown in the output pane (Row 1 right).
    const [activeChapter, setActiveChapter] = useState<number | null>(null);

    const { data: chapters } = useQuery(getChaptersQueryOptions(slug));
    const translatedNumbers = (chapters ?? [])
      .filter((chapter) => chapter.status === "translated")
      .map((chapter) => chapter.number);

    // Default the output pane to the most recently translated chapter once the
    // list loads, so the page opens with something to read.
    useEffect(() => {
      if (activeChapter === null && translatedNumbers.length > 0) {
        setActiveChapter(Math.max(...translatedNumbers));
      }
    }, [activeChapter, translatedNumbers]);

    const { data: markdown, isFetching: markdownLoading } = useQuery({
      ...getChapterMarkdownQueryOptions(slug, activeChapter ?? 1),
      enabled: activeChapter !== null,
    });

    const mutation = useMutation({
      mutationFn: (input: { slug: string; chapterNumber: number; pastedText: string }) =>
        translateChapter({ data: input }),
      onSuccess: async ({ chapterNumber: translatedNumber }) => {
        // The DO wrote glossary + markdown + chapter row; refresh both panels
        // and point the output pane at the freshly translated chapter (#44).
        await queryClient.invalidateQueries({ queryKey: glossaryQueryKey(slug) });
        await queryClient.invalidateQueries({ queryKey: chaptersQueryKey(slug) });
        await queryClient.invalidateQueries({
          queryKey: chapterMarkdownQueryKey(slug, translatedNumber),
        });
        setActiveChapter(translatedNumber);
        notifications.show({
          title: "Chapter translated",
          message: `Chapter ${translatedNumber} is ready.`,
          color: "green",
        });
      },
    });

    const actionError = mutation.isError ? getErrorMessage(mutation.error) : null;

    /** Validate and either translate immediately or ask for confirmation. */
    function handleTranslate() {
      const parsed = parseChapterNumber(chapterNumber);
      if (parsed === null) {
        setNumberError("Enter a valid chapter number.");
        return;
      }
      setNumberError(undefined);
      if (pastedText.trim().length === 0) {
        setTextError("Paste the chapter's text to translate.");
        return;
      }
      setTextError(undefined);

      // Re-translating an existing chapter asks for confirmation first
      // (stories 11-13, 26).
      if (translatedNumbers.includes(parsed)) {
        setConfirmNumber(parsed);
        return;
      }
      mutation.mutate({ slug, chapterNumber: parsed, pastedText });
    }

    function confirmReTranslate() {
      if (confirmNumber === null) return;
      const target = confirmNumber;
      setConfirmNumber(null);
      mutation.mutate({ slug, chapterNumber: target, pastedText });
    }

    return (
      <Stack className="gap-4">
        <Suspense fallback={<NovelHeaderSkeleton />}>
          <NovelHeader slug={slug} />
        </Suspense>

        {/* Row 1: translate box | translation output */}
        <div className="grid gap-4 md:grid-cols-2">
          <TranslateBox
            chapterNumber={chapterNumber}
            onChapterNumberChange={setChapterNumber}
            numberError={numberError}
            pastedText={pastedText}
            onPastedTextChange={setPastedText}
            textError={textError}
            actionError={actionError}
            pending={mutation.isPending}
            onTranslate={handleTranslate}
          />
          <TranslationPane
            chapterNumber={activeChapter}
            markdown={markdown ?? null}
            loading={markdownLoading}
          />
        </div>

        {/* Row 2: chapters list | glossary */}
        <div className="grid gap-4 md:grid-cols-2">
          <ChaptersList
            chapters={chapters ?? []}
            activeChapter={activeChapter}
            onSelect={setActiveChapter}
          />
          <GlossaryPanel slug={slug} />
        </div>

        <ConfirmReTranslateDialog
          chapterNumber={confirmNumber}
          onCancel={() => setConfirmNumber(null)}
          onConfirm={confirmReTranslate}
        />
      </Stack>
    );
  },
});
