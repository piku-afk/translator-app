import type { ActivityAction } from "./novels-core";

/** Title-case label per activity action, shown in the feed and timeline. */
export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  "novel created": "Novel created",
  "parsing started": "Parsing started",
  "parsing ready": "Parsing ready",
  "needs review": "Needs review",
  "parsing failed": "Parsing failed",
  "extraction started": "Extraction started",
  "names extracted": "Names extracted",
  "extraction failed": "Extraction failed",
};

/** Semantic color per action (muted / accent / success / warning / danger),
 * as Mantine color names so badges, bullets, and icons can share them. */
export const ACTIVITY_COLORS: Record<ActivityAction, string> = {
  "novel created": "gray",
  "parsing started": "blue",
  "parsing ready": "green",
  "needs review": "yellow",
  "parsing failed": "red",
  "extraction started": "blue",
  "names extracted": "green",
  "extraction failed": "red",
};