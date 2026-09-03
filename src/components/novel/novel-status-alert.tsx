import { Alert } from "@mantine/core";
import { STATUS_BADGE_COLORS } from "#/lib/novels/status-metadata";
import type { NovelStatus } from "#/lib/novels/novels-core";

function NovelStatusAlertOld({
  status,
  chapterCount,
  totalChapters,
  lastError,
  slug,
  isParsing,
  isExtracting,
  isTranslating,
}: {
  status: NovelStatus;
  chapterCount: number;
  totalChapters: number;
  lastError: string | null;
  slug: string;
  isParsing: boolean;
  isExtracting: boolean;
  isTranslating: boolean;
}) {
  const color =
    STATUS_BADGE_COLORS[
      isParsing ? "parsing" : isExtracting ? "extracting" : isTranslating ? "translating" : status
    ];

  switch (status) {
    case "needs review":
      return (
        <Alert variant="light" color={color} title="Count mismatch">
          Extracted {chapterCount} chapters; declared total is {totalChapters}. Edit the chapters on
          R2 (novels/{slug}/chapters/) to reconcile, then re-trigger parsing.
        </Alert>
      );
    case "parsing failed":
      return (
        <Alert variant="light" color={color} title="Parsing failed">
          {lastError ?? "Parsing failed for an unknown reason"}. Fix the raw file and re-trigger
          parsing.
        </Alert>
      );
    case "extraction failed":
      return (
        <Alert variant="light" color={color} title="Extraction failed">
          {lastError ?? "Extraction failed for an unknown reason"}. Re-trigger extraction to resume
          from the last completed chapter.
        </Alert>
      );
    case "translation failed":
      return (
        <Alert variant="light" color={color} title="">
          {lastError ?? "Translation failed for an unknown reason"}. Re-trigger translation to
          resume from the last translated chapter.
        </Alert>
      );
  }
}

const STATUS_ALERT_TITLE: Partial<Record<NovelStatus, string>> = {
  draft: "Not parsed yet",
  ready: "Parsing Complete",
  completed: "Nothing to do",
  "parsing failed": "Parsing failed",
  extracting: "Extraction in progress",
  translating: "Translation in progress",
  "translation failed": "Translation failed",
  "names extracted": "Names extracted",
};

const STATUS_ALERT_DESCRIPTION: Partial<Record<NovelStatus, string>> = {
  draft: "Start parsing to split the raw file into chapters.",
  ready: "The novel is ready for translation.",
  completed: "All chapters are translated.",
  parsing: "Chapters will appear here when the job completes.",
  translating: "Each chapter is being translated in parallel.",
  extracting: "The glossary is being built chapter by chapter.",
  "names extracted": "The glossary is complete. The novel is ready for translation.",
};

export function NovelStatusAlert({
  status,
  lastError,
}: {
  status: NovelStatus;
  lastError?: string | null;
}) {
  const title = STATUS_ALERT_TITLE[status];
  const color = STATUS_BADGE_COLORS[status];
  const description = lastError ?? STATUS_ALERT_DESCRIPTION[status];

  return (
    <Alert variant="light" color={color} title={title}>
      {description}
    </Alert>
  );
}
