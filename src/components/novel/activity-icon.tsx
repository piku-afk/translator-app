import {
  BookCheck,
  CircleDot,
  FileCheck,
  FileCheck2,
  FileSearchIcon,
  FileScan,
  FileXIcon,
  Languages,
  type LucideIcon,
} from "lucide-react";
import type { ActivityAction } from "#/lib/novels/novels-core";

const ACTIVITY_ICONS: Record<ActivityAction, LucideIcon> = {
  "novel created": BookCheck,
  "parsing started": FileSearchIcon,
  "parsing ready": FileCheck,
  "needs review": CircleDot,
  "parsing failed": FileXIcon,
  "extraction started": FileScan,
  "names extracted": FileCheck,
  "extraction failed": FileXIcon,
  "translation started": Languages,
  "translation completed": FileCheck2,
  "translation failed": FileXIcon,
};

export function ActivityIcon({
  action,
  className,
}: {
  action: ActivityAction;
  className?: string;
}) {
  const Icon = ACTIVITY_ICONS[action];
  return <Icon className={className} aria-hidden />;
}
