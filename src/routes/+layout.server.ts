import { createGateway } from "ai";
import { AI_GATEWAY_API_KEY } from "$env/static/private";
import type { LayoutServerLoad } from "./$types";

export const load = async function () {
  const gateway = createGateway({ apiKey: AI_GATEWAY_API_KEY });
  const credits = gateway.getCredits();

  return { credits };
} satisfies LayoutServerLoad;
