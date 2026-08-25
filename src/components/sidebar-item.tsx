import { cn } from "#/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function SidebarItem({
  label,
  href,
  selected,
  icon: Icon,
}: {
  label: string;
  href: string;
  selected?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <li
      className={cn(
        "w-full py-2 px-3 border-none bg-transparent text-gray-500 font-normal text-sm rounded-md hover:text-black hover:bg-white hover:font-medium flex items-center gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        selected && "text-black bg-white font-medium",
      )}
    >
      {Icon ? <Icon /> : null}
      <Link to={href}> {label}</Link>
    </li>
  );
}
