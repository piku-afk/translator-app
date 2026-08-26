import { createServerFn } from "@tanstack/react-start";
import { isAuthenticated, startSession, endSession } from "./session.server";
import { GENERIC_LOGIN_ERROR, type LoginResult } from "./auth-core";
import z from "zod";

export type { LoginResult, UnsealOutcome } from "./auth-core";

/**
 * Server function so loaders (which also run on the client) can check auth.
 * Runs on the server: clears any stale session cookie while it's at it.
 */
export const getAuthState = createServerFn().handler(async () => {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    await endSession();
  }
  return { authenticated };
});

export const LoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export type LoginSchema = z.infer<typeof LoginSchema>;

/**
 * Log the operator in with the shared password. On success, seals a session
 * and writes the HttpOnly cookie; on failure it throws a generic error so the
 * login page shows the message. Business logic lives in the pure core.
 */
export const login = createServerFn({ method: "POST" })
  .validator(LoginSchema)
  .handler(async ({ data }): Promise<LoginResult> => {
    const result = await startSession(data.password);
    if (!result.ok) {
      throw new Error(result.error || GENERIC_LOGIN_ERROR);
    }
    return result;
  });

export const logout = createServerFn().handler(async () => {
  await endSession();
  return { ok: true as const };
});
