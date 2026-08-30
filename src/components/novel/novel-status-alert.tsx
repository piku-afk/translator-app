import { Alert } from "@mantine/core";
import { STATUS_BADGE_COLORS } from "#/lib/novels/status-metadata";
import type { NovelStatus } from "#/lib/novels/novels-core";

export function NovelStatusAlert({
  status,
  chapterCount,
  totalChapters,
  lastError,
  slug,
  isParsing,
}: {
  status: NovelStatus;
  chapterCount: number;
  totalChapters: number;
  lastError: string | null;
  slug: string;
  isParsing: boolean;
}) {
  const color = STATUS_BADGE_COLORS[isParsing ? "parsing" : status];
  if (isParsing) {
    return (
      <Alert variant="light" color={color} title="Parsing in progress">
        Chapters will appear here when the job completes.
      </Alert>
    );
  }
  switch (status) {
    case "draft":
      return (
        <Alert variant="light" color={color} title="Not parsed yet">
          Start parsing to split the raw file into chapters.
        </Alert>
      );
    case "needs review":
      return (
        <Alert variant="light" color={color} title="Count mismatch">
          Extracted {chapterCount} chapters; declared total is {totalChapters}. Edit the chapters on
          R2 (novels/{slug}/chapters/) to reconcile, then re-trigger parsing.
        </Alert>
      );
    case "failed":
      return (
        <Alert variant="light" color={color} title="Parsing failed">
          {lastError ?? "Parsing failed for an unknown reason"}. Fix the raw file and re-trigger
          parsing.
        </Alert>
      );
    case "ready":
      return (
        <Alert variant="light" color={color} title="Parsing Complete">
          The novel is ready for translation.
        </Alert>
      );
    default:
      return (
        <Alert variant="light" color={color} title="Nothing to do">
          {status === "completed"
            ? "All chapters are translated."
            : "No action is available for this state yet."}
        </Alert>
      );
  }
}
