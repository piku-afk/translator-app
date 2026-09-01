import { Alert, Button, Progress, Stack, Stepper, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { getNovelActivityQueryOptions } from "#/lib/novels/novels";
import { stepperStateFromStatus } from "#/lib/novels/status-metadata";
import type { ActivityAction, NovelStatus } from "#/lib/novels/novels-core";
import type { ActivityRow } from "#/lib/translator/service";
import { formatRelativeDateTime } from "#/lib/utils";
import { NovelStatusAlert } from "./novel-status-alert";

interface LifecycleStepperProps {
  slug: string;
  status: NovelStatus;
  /** Novel's updated_at, the last-action proxy fallback for step times. */
  updatedAt: string;
  /** Parsed chapter count from the novel detail. */
  chapterCount: number;
  totalChapters: number;
  /** Glossary entry count; the extraction step's result at a glance. */
  glossarySize: number;
  /** Chapters whose per-chapter status is "names extracted" (extraction progress). */
  namesExtractedChapterCount: number;
  /** Chapters whose per-chapter status is "translated" (translation progress). */
  translatedChapterCount: number;
  lastError: string | null;
  /** True while a parse job runs or the start-parse mutation is pending. */
  isParsing: boolean;
  isExtracting: boolean;
  isTranslating: boolean;
  startParsingError: string | null;
  startExtractionError: string | null;
  startTranslationError: string | null;
  onStartParsing: () => void;
  onStartExtraction: () => void;
  onStartTranslation: () => void;
}

/** The most recent timestamp of an activity matching a step's terminal event,
 * or null when the novel has none. Activity rows arrive chronological asc. */
function mostRecentTerminalTime(activities: ActivityRow[], action: ActivityAction): string | null {
  for (let index = activities.length - 1; index >= 0; index--) {
    if (activities[index].action === action) {
      return activities[index].created_at;
    }
  }
  return null;
}

function progressPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.round((numerator / denominator) * 100));
}

/**
 * The coarse 4-step lifecycle (Parse → Extract names → Translate → Complete)
 * rendered as a read-only vertical stepper. The stepper is a status indicator,
 * not a wizard: `allowNextStepsSelect` is false and no onStepClick is wired,
 * so the Operator sees position, not navigation. The current step carries the
 * available action; failure and review states surface as alerts on that step.
 * Only the active step's children render (Mantine renders its content below
 * the steps list); the other steps show their detail line in `description`.
 */
export function LifecycleStepper({
  slug,
  status,
  updatedAt,
  chapterCount,
  totalChapters,
  glossarySize,
  namesExtractedChapterCount,
  translatedChapterCount,
  lastError,
  isParsing,
  isExtracting,
  isTranslating,
  startParsingError,
  startExtractionError,
  startTranslationError,
  onStartParsing,
  onStartExtraction,
  onStartTranslation,
}: LifecycleStepperProps) {
  const isActive = isParsing || isExtracting || isTranslating;

  const { data } = useQuery({
    ...getNovelActivityQueryOptions(slug),
    refetchInterval: isActive ? 3000 : false,
  });
  const activities = data ?? [];

  const state = stepperStateFromStatus(status);

  // Completed-step timestamps come from the most recent activity matching that
  // step's terminal event, falling back to the novel's updated_at proxy.
  const parseCompletedAt =
    mostRecentTerminalTime(activities, "parsing ready") ??
    (state.completed[0] ? updatedAt : null);
  const extractCompletedAt =
    mostRecentTerminalTime(activities, "names extracted") ??
    (state.completed[1] ? updatedAt : null);
  const translateCompletedAt =
    mostRecentTerminalTime(activities, "translation completed") ??
    (state.completed[2] ? updatedAt : null);

  const hasChapters = chapterCount > 0;
  const parseDetail = hasChapters ? `${chapterCount} chapters found` : null;
  const extractDetail = glossarySize > 0 ? `${glossarySize} names extracted` : null;
  const translateDetail =
    hasChapters ? `${translatedChapterCount} / ${totalChapters} chapters` : null;
  const completeDetail =
    status === "completed"
      ? hasChapters
        ? `All ${totalChapters} chapters translated`
        : "Translation complete"
      : "Available when translation finishes";

  const stepDescription = (detail: string | null, completedAt: string | null) => (
    <>
      {detail && <span className="block">{detail}</span>}
      {completedAt && (
        <span className="block text-xs">
          Completed {formatRelativeDateTime(completedAt)}
        </span>
      )}
    </>
  );

  // Data-driven panel for whichever step is active. Only the active step's
  // children render (Mantine shows its content below the steps list), so the
  // panel for the current lifecycle position is built once and reused.
  const activeStepPanel = (() => {
    type PanelConfig = {
      running: boolean;
      runningText: string;
      progress: number;
      label: string;
      loading: boolean;
      onClick: () => void;
      error: string | null;
      errorTitle: string;
    };
    const panels: Record<0 | 1 | 2, PanelConfig> = {
      0: {
        running: status === "parsing",
        runningText: "Parsing is in progress.",
        progress: progressPercent(chapterCount, totalChapters),
        label: status === "draft" ? "Start parsing" : "Re-trigger parsing",
        loading: isParsing,
        onClick: onStartParsing,
        error: startParsingError,
        errorTitle: "Could not start parsing",
      },
      1: {
        running: status === "extracting",
        runningText: "Extraction is in progress.",
        progress: progressPercent(namesExtractedChapterCount, totalChapters),
        label: status === "ready" ? "Start extraction" : "Re-run extraction",
        loading: isExtracting,
        onClick: onStartExtraction,
        error: startExtractionError,
        errorTitle: "Could not start extraction",
      },
      2: {
        running: status === "translating",
        runningText: "Translation is in progress.",
        progress: progressPercent(translatedChapterCount, totalChapters),
        label: status === "names extracted" ? "Start translation" : "Re-run translation",
        loading: isTranslating,
        onClick: onStartTranslation,
        error: startTranslationError,
        errorTitle: "Could not start translation",
      },
    };

    // Step 3 (Complete) has no action; completion is the end of the spine.
    if (state.activeStep === 3) return null;
    const config = panels[state.activeStep as 0 | 1 | 2];
    return (
      <Stack className="gap-3">
        {state.alert && (
          <NovelStatusAlert
            status={status}
            chapterCount={chapterCount}
            totalChapters={totalChapters}
            lastError={lastError}
            slug={slug}
            isParsing={isParsing}
            isExtracting={isExtracting}
            isTranslating={isTranslating}
          />
        )}
        {config.running && (
          <>
            <Text>{config.runningText}</Text>
            <Progress value={config.progress} />
          </>
        )}
        {!config.running && (
          <Button variant="default" loading={config.loading} onClick={config.onClick}>
            {config.label}
          </Button>
        )}
        {config.error && (
          <Alert variant="light" color="red" title={config.errorTitle}>
            {config.error}
          </Alert>
        )}
      </Stack>
    );
  })();

  return (
    <Stepper
      orientation="vertical"
      active={state.activeStep}
      allowNextStepsSelect={false}
    >
      <Stepper.Step
        label="Parse chapters"
        description={stepDescription(parseDetail, parseCompletedAt)}
      >
        {state.activeStep === 0 && activeStepPanel}
      </Stepper.Step>
      <Stepper.Step
        label="Extract names"
        description={stepDescription(extractDetail, extractCompletedAt)}
      >
        {state.activeStep === 1 && activeStepPanel}
      </Stepper.Step>
      <Stepper.Step
        label="Translate"
        description={stepDescription(translateDetail, translateCompletedAt)}
      >
        {state.activeStep === 2 && activeStepPanel}
      </Stepper.Step>
      <Stepper.Step label="Complete" description={stepDescription(completeDetail, null)}>
        {state.activeStep === 3 && activeStepPanel}
      </Stepper.Step>
    </Stepper>
  );
}