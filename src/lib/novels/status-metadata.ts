import type { NovelStatus } from "./novels-core";

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
