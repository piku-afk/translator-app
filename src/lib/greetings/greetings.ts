import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireAuth } from "#/lib/auth/session.server";
import { getSubtext, selectGreeting } from "./greetings-core";
import { GREETING_MESSAGES } from "./greeting-messages";

export interface GreetingData {
  greeting: string;
  subtext: string;
}

/**
 * IANA timezone of the calling client, sourced from Cloudflare's automatic
 * `cf.timezone` (threaded through as `x-timezone` in `src/server.ts`).
 * Falls back to UTC when absent (e.g. local development, unknown geo).
 */
function getClientTimezone(): string {
  return getRequest().headers.get("x-timezone") ?? "UTC";
}

const getGreetingData = createServerFn()
  .validator((data: { currentTime: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();
    const greeting = selectGreeting(
      GREETING_MESSAGES,
      getClientTimezone(),
      new Date(data.currentTime),
    );

    return {
      subtext: getSubtext(),
      greeting,
    } satisfies GreetingData;
  });

export const greetingsQueryKey = () => ["greetings"] as const;

export function getGreetingDataQueryOptions() {
  return {
    queryKey: greetingsQueryKey(),
    queryFn: () =>
      getGreetingData({
        data: {
          currentTime: new Date().toISOString(),
        },
      }),
  };
}
