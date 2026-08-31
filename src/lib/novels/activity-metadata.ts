import type { ActivityAction } from "./novels-core";

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

export const ACTIVITY_COLORS: Record<ActivityAction, string> = {
  "novel created": "black",
  "parsing started": "blue",
  "parsing ready": "green",
  "needs review": "yellow",
  "parsing failed": "red",
  "extraction started": "blue",
  "names extracted": "green",
  "extraction failed": "red",
};
