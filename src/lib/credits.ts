import { createServerFn } from '@tanstack/react-start';
import { createGateway } from 'ai';

const API_KEY =
  process.env.AI_GATEWAY_API_KEY ??
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.AI_GATEWAY_API_KEY ??
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_AI_GATEWAY_API_KEY;

export const getCredits = createServerFn({ method: 'GET' }).handler(async () => {
  const gateway = createGateway({ apiKey: API_KEY });
  const credits = await gateway.getCredits();
  return credits.balance;
});