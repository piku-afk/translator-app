import type { NovelStatus } from "./novels-core";

/** Mantine color for each status badge. */
export const STATUS_BADGE_COLORS: Record<NovelStatus, string> = {
  draft: "gray",
  parsing: "blue",
  "needs review": "yellow",
  extracting: "blue",
  translating: "blue",
  ready: "green",
  completed: "green",
  failed: "red",
};

/** Verb phrase describing the most recent action, used in status lines. */
export const STATUS_ACTION_VERBS: Record<NovelStatus, string> = {
  draft: "Created",
  parsing: "Started parsing",
  "needs review": "Parsed",
  extracting: "Started extracting",
  translating: "Started translating",
  ready: "Reviewed",
  completed: "Completed",
  failed: "Failed",
};
