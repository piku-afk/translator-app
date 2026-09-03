import type { NovelStatus } from "./novels-core";

/** The four coarse lifecycle steps shown on the novel detail page's stepper. */
export const LIFECYCLE_STEPS = ["parse", "extract", "translate", "complete"] as const;
export type LifecycleStep = (typeof LIFECYCLE_STEPS)[number];

/** The failure/review states that collapse onto a step and surface as an alert. */
export type LifecycleStepAlert =
  | "needs review"
  | "parsing failed"
  | "extraction failed"
  | "translation failed";

/** Where a novel sits in the coarse lifecycle, per the stepper mapping. */
export interface LifecycleStepperState {
  /** 0-based index of the step the novel is currently on. */
  activeStep: number;
  /** Per-step completion along the happy-path spine. Failure and review
   * detours never mark a step completed. */
  completed: readonly boolean[];
  /** The failure/review notice rendered on the active step, or null. */
  alert: LifecycleStepAlert | null;
}

/**
 * Maps a granular NovelStatus onto the coarse 4-step stepper: which step is
 * active and which are completed. Only the happy-path spine is represented as
 * steps; `needs review` and the failure states collapse onto their affected
 * step (which stays active) and surface as an alert instead of a separate row.
 */
export function stepperStateFromStatus(status: NovelStatus): LifecycleStepperState {
  switch (status) {
    case "draft":
    case "parsing":
    case "parsing failed":
    case "needs review":
      return { activeStep: 0, completed: [false, false, false, false], alert: alertFor(status) };
    case "ready":
    case "extracting":
    case "extraction failed":
      return { activeStep: 1, completed: [true, false, false, false], alert: alertFor(status) };
    case "names extracted":
    case "translating":
    case "translation failed":
      return { activeStep: 2, completed: [true, true, false, false], alert: alertFor(status) };
    case "completed":
      return { activeStep: 3, completed: [true, true, true, false], alert: null };
  }
}

export function stepperStepFromStatus(status: NovelStatus): number {
  switch (status) {
    case "draft":
    case "parsing":
    case "parsing failed":
    case "needs review":
      return 0;
    case "ready":
    case "extracting":
    case "extraction failed":
      return 1;
    case "names extracted":
    case "translating":
    case "translation failed":
      return 2;
    case "completed":
      return 3;
  }
}

/** The alert variant for failure/review statuses, or null for the happy path. */
function alertFor(status: NovelStatus): LifecycleStepAlert | null {
  switch (status) {
    case "needs review":
    case "parsing failed":
    case "extraction failed":
    case "translation failed":
      return status;
    default:
      return null;
  }
}

/** A chapter's stage state within the translation pipeline. */
export type ChapterStatus = "queued" | "names extracted" | "translating" | "translated" | "failed";

/** Mantine color for each chapter status badge. */
export const CHAPTER_STATUS_COLORS: Record<ChapterStatus, string> = {
  queued: "gray",
  "names extracted": "cyan",
  translating: "blue",
  translated: "green",
  failed: "red",
};

/** Mantine color for each status badge. */
export const STATUS_BADGE_COLORS: Record<NovelStatus, string> = {
  draft: "gray",
  parsing: "blue",
  "needs review": "yellow",
  "parsing failed": "red",
  extracting: "blue",
  "names extracted": "green",
  "extraction failed": "red",
  translating: "blue",
  "translation failed": "red",
  ready: "green",
  completed: "green",
};

/** Verb phrase describing the most recent action, used in status lines. */
export const STATUS_ACTION_VERBS: Record<NovelStatus, string> = {
  draft: "Created",
  parsing: "Started parsing",
  "needs review": "Parsed",
  "parsing failed": "Failed",
  extracting: "Started extracting",
  "names extracted": "Extracted",
  "extraction failed": "Failed",
  translating: "Started translating",
  "translation failed": "Failed",
  ready: "Reviewed",
  completed: "Completed",
};
