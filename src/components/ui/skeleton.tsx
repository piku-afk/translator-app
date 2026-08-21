import type { HTMLAttributes } from "react";
import { cn } from "#/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md bg-gray-300 animate-pulse", className)}
      {...props}
    />
  );
}
