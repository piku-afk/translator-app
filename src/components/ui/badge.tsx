import { cva } from "class-variance-authority";
import { cn } from "#/lib/utils";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "rounded-md flex items-center gap-2 select-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-gray-300 bg-white",
        outline: "border border-gray-300 bg-white ",
      },
      size: {
        default: "py-1.25 px-3 text-sm font-medium",
      },
      color: {
        default: "",
        destructive: "border-[#e7000b] text-[#e7000b]",
      },
    },
    defaultVariants: {
      size: "default",
      color: "default",
      variant: "default",
    },
  },
);

type BadgeColor = "default" | "destructive";

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  variant?: "default" | "outline";
  size?: "default";
  color?: BadgeColor;
}

export function Badge({
  variant = "default",
  size = "default",
  color = "default",
  className,
  children,
  ...restProps
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, color }), className)} {...restProps}>
      {children}
    </span>
  );
}
