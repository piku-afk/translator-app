import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { requireAuth } from "#/lib/auth/session.server";

export interface GreetingData {
  greeting: string;
  subtext: string;
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getSubtext(): string {
  return "Continue where you left off";
}

const getGreetingData = createServerFn()
  .validator((data: { currentTime: string; timezone?: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour12: false,
        hour: "numeric",
        timeZone: data.timezone ?? getCookie("tz") ?? "UTC",
      }).format(new Date(data.currentTime)),
    );

    return {
      subtext: getSubtext(),
      greeting: getGreeting(hour),
    } satisfies GreetingData;
  });

export const greetingsQueryKey = (timezone?: string) => [timezone ?? "greetings"] as const;

export function getGreetingDataQueryOptions(timezone?: string) {
  return {
    queryKey: greetingsQueryKey(timezone),
    queryFn: () =>
      getGreetingData({
        data: {
          currentTime: new Date().toISOString(),
          timezone,
        },
      }),
  };
}
