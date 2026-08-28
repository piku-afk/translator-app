import { createServerFn } from "@tanstack/react-start";
import { createGateway } from "ai";
import { env } from "cloudflare:workers";
import { requireAuth } from "#/lib/auth/session.server";

const creditsQueryKey = ["credits"] as const;

const getCredits = createServerFn().handler(async () => {
  await requireAuth();
  const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });
  const credits = await gateway.getCredits();
  return credits;
});

export function getCreditsQueryOptions() {
  return { queryFn: () => getCredits(), queryKey: creditsQueryKey };
}
