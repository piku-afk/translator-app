import { Check, CircleDot, Plus, RotateCw, X, type LucideIcon } from "lucide-react";
import type { ActivityAction } from "#/lib/novels/novels-core";

/** Icon per activity action, matching the screens.md map:
 * `+` created, `↻` started, `✓` ready/extracted, `◎` needs review, `✕` failed. */
const ACTIVITY_ICONS: Record<ActivityAction, LucideIcon> = {
  "novel created": Plus,
  "parsing started": RotateCw,
  "parsing ready": Check,
  "needs review": CircleDot,
  "parsing failed": X,
  "extraction started": RotateCw,
  "names extracted": Check,
  "extraction failed": X,
};

export function ActivityIcon({ action, className }: { action: ActivityAction; className?: string }) {
  const Icon = ACTIVITY_ICONS[action];
  return <Icon className={className} aria-hidden />;
}