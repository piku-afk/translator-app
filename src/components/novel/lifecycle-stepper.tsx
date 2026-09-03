import {
  Alert,
  Button,
  Collapse,
  Progress,
  Stack,
  Stepper,
  Text,
  type MantineLoaderComponent,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  getNovelActivityQueryOptions,
  getNovelDetailQueryOptions,
  novelDetailQueryKey,
  novelsQueryKey,
  startParsing,
} from "#/lib/novels/novels";
import {
  STATUS_BADGE_COLORS,
  stepperStateFromStatus,
  stepperStepFromStatus,
} from "#/lib/novels/status-metadata";
import type { ActivityAction, NovelStatus } from "#/lib/novels/novels-core";
import type { ActivityRow } from "#/lib/translator/service";
import { formatRelativeDateTime, getErrorMessage } from "#/lib/utils";
import { NovelStatusAlert } from "./novel-status-alert";
import {
  Check,
  FileSearch2Icon,
  FileSearchIcon,
  Languages,
  Loader,
  ScanText,
  Search,
} from "lucide-react";
import { LoaderButton } from "../ui/loader-button";

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

export function LifecycleStepper({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const {
    data: { novel, chapter_count: chapterCount },
  } = useSuspenseQuery(getNovelDetailQueryOptions(slug));
  const totalChapters = novel.total_chapters;
  const status = novel.status as NovelStatus;

  const startParsingMutation = useMutation({
    mutationFn: () => startParsing({ data: { slug } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: novelDetailQueryKey(slug) });
    },
  });

  const canStartParsing =
    status === "draft" || status === "parsing failed" || status === "needs review";

  // Vertical on small screens (≤ Mantine sm breakpoint, 48em), horizontal otherwise.
  const isMobile = useMediaQuery("(max-width: 48em)", false, { getInitialValueInEffect: true });
  // const isActive = isParsing || isExtracting || isTranslating;

  // const { data } = useQuery({
  //   ...getNovelActivityQueryOptions(slug),
  //   refetchInterval: isActive ? 3000 : false,
  // });
  // const activities = data ?? [];

  const activeStep = stepperStepFromStatus(status);

  // Completed-step timestamps come from the most recent activity matching that
  // step's terminal event, falling back to the novel's updated_at proxy.
  // const parseCompletedAt =
  //   mostRecentTerminalTime(activities, "parsing ready") ?? (state.completed[0] ? updatedAt : null);
  // const extractCompletedAt =
  //   mostRecentTerminalTime(activities, "names extracted") ??
  //   (state.completed[1] ? updatedAt : null);
  // const translateCompletedAt =
  //   mostRecentTerminalTime(activities, "translation completed") ??
  //   (state.completed[2] ? updatedAt : null);

  // const hasChapters = chapterCount > 0;
  // const parseDetail = hasChapters ? `${chapterCount} chapters found` : null;
  // const extractDetail = glossarySize > 0 ? `${glossarySize} names extracted` : null;
  // const translateDetail = hasChapters
  //   ? `${translatedChapterCount} / ${totalChapters} chapters`
  //   : null;
  // const completeDetail =
  //   status === "completed"
  //     ? hasChapters
  //       ? `All ${totalChapters} chapters translated`
  //       : "Translation complete"
  //     : "Available when translation finishes";

  const stepDescription = (detail: string | null, completedAt: string | null) => (
    <>
      {detail && <span className="block">{detail}</span>}
      {completedAt && (
        <span className="block text-xs">Completed {formatRelativeDateTime(completedAt)}</span>
      )}
    </>
  );

  // Data-driven panel for whichever step is active. Only the active step's
  // children render (Mantine shows its content below the steps list), so the
  // panel for the current lifecycle position is built once and reused.
  // const activeStepPanel = (() => {
  //   type PanelConfig = {
  //     running: boolean;
  //     runningText: string;
  //     progress: number;
  //     label: string;
  //     loading: boolean;
  //     onClick: () => void;
  //     error: string | null;
  //     errorTitle: string;
  //   };
  // const panels: Record<0 | 1 | 2, PanelConfig> = {
  // 0: {

  // },
  // 1: {
  //   running: status === "extracting",
  //   runningText: "Extraction is in progress.",
  //   progress: progressPercent(namesExtractedChapterCount, totalChapters),
  //   label: status === "ready" ? "Start extraction" : "Re-run extraction",
  //   loading: isExtracting,
  //   onClick: onStartExtraction,
  //   error: startExtractionError,
  //   errorTitle: "Could not start extraction",
  // },
  // 2: {
  //   running: status === "translating",
  //   runningText: "Translation is in progress.",
  //   progress: progressPercent(translatedChapterCount, totalChapters),
  //   label: status === "names extracted" ? "Start translation" : "Re-run translation",
  //   loading: isTranslating,
  //   onClick: onStartTranslation,
  //   error: startTranslationError,
  //   errorTitle: "Could not start translation",
  // },
  // };

  // Step 3 (Complete) has no action; completion is the end of the spine.
  // if (state.activeStep === 3) return null;

  // const config = panels[state.activeStep as 0 | 1 | 2];
  // return (
  //   <Stack className="gap-3">
  {
    /* {state.alert && (
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
  })();*/
  }

  return (
    <Stepper
      size="sm"
      active={activeStep}
      completedIcon={<Check />}
      allowNextStepsSelect={false}
      orientation={isMobile ? "vertical" : "horizontal"}
      classNames={{
        content: "pt-8",
        stepIcon: "border-none",
        stepLabel: "text-base font-medium",
        stepIconContent: "[&_svg]:size-4.5",
        stepCompletedIcon: "[&_svg]:size-4.5",
      }}
    >
      <Stepper.Step
        label="Parse Chapters"
        icon={<Search />}
        description="Split the novel into chapters"
      >
        {/* {state.activeStep === 0 && activeStepPanel} */}
        {/*
            running: status === "parsing",
            runningText: "Parsing is in progress.",
            progress: progressPercent(chapterCount, totalChapters),
            label: status === "draft" ? "Start parsing" : "Re-trigger parsing",
            loading: isParsing,
            onClick: onStartParsing,
            error: startParsingError,
            errorTitle: "Could not start parsing", 
        */}

        <Stack className="gap-6">
          <NovelStatusAlert status={status} lastError={novel.last_error} />

          {canStartParsing && (
            <LoaderButton
              size="xs"
              className="w-fit"
              variant="default"
              loading={startParsingMutation.isPending}
              onClick={() => startParsingMutation.mutate()}
            >
              {status === "draft" ? "Start Parsing" : "Re-trigger Parsing"}
            </LoaderButton>
          )}
        </Stack>
      </Stepper.Step>
      <Stepper.Step
        label="Extract names"
        icon={<ScanText />}
        description="Identify names and terms for the glossary"
      ></Stepper.Step>
      <Stepper.Step
        label="Translate"
        icon={<Languages />}
        description="Translate the chapters"
      ></Stepper.Step>
    </Stepper>
  );
}
