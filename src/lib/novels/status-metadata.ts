import type { NovelStatus } from "./novels-core";

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
