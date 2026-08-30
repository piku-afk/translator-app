import { Badge, Skeleton, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { getCreditsQueryOptions } from "#/lib/credits";
import { getErrorMessage } from "#/lib/utils";

const badgeErrorMessage = "Failed to load credits";

export function CreditsBadge() {
  const credits = useQuery(getCreditsQueryOptions());

  return (
    <Tooltip
      multiline
      withArrow
      interactive
      classNames={{ tooltip: "max-w-60" }}
      label={credits.error ? getErrorMessage(credits.error) : "Remaining credits"}
    >
      <Badge
        variant={credits.error ? "outline" : "default"}
        color={credits.error ? "red" : undefined}
        leftSection={<Coins className="size-4" />}
        className="rounded-md h-7 font-medium text-sm normal-case gap-2 select-none"
      >
        {credits.isPending ? (
          <Skeleton className="w-16 h-5" />
        ) : credits.error ? (
          badgeErrorMessage
        ) : (
          `${Number(credits?.data?.balance ?? "0").toFixed(2)} credits`
        )}
      </Badge>
    </Tooltip>
  );
}
