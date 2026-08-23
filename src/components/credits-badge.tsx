import { Badge, Skeleton, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { getCreditsQueryOptions } from "#/lib/credits";
import { getErrorMessage } from "#/lib/utils";

const badgeId = "remaining-credits";
const badgeErrorMessage = "Failed to load credits";

export function CreditsBadge() {
  const credits = useQuery(getCreditsQueryOptions());

  return (
    <>
      <Badge
        size="xl"
        id={badgeId}
        variant={credits.error ? "outline" : "default"}
        color={credits.error ? "red" : undefined}
        leftSection={<Coins className="size-4" />}
        className="rounded-md font-medium text-sm normal-case gap-2 select-none"
      >
        {credits.isPending ? (
          <Skeleton className="w-16 h-5" />
        ) : credits.error ? (
          badgeErrorMessage
        ) : (
          `${Number(credits?.data?.balance ?? "0").toFixed(2)} credits`
        )}
      </Badge>
      {credits.error && (
        <Tooltip
          multiline
          withArrow
          interactive
          className="w-60"
          target={`#${badgeId}`}
          label={getErrorMessage(credits.error)}
        />
      )}
    </>
  );
}
