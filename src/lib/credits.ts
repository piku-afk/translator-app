import { createServerFn } from "@tanstack/react-start";
import { createGateway } from "ai";

export const creditsQueryKey = ["credits"] as const;

const getCredits = createServerFn().handler(async () => {
  const gateway = createGateway();
  const credits = await gateway.getCredits();
  return credits.balance;
});

export function getCreditsQueryOptions() {
  return { queryFn: getCredits, queryKey: creditsQueryKey };
}
