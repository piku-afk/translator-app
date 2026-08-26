import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import {
  evaluateLogin,
  sealSession,
  sessionIsAuthenticated,
  unsealSession,
  type LoginResult,
} from "./auth-core";
import { verifyPassword } from "./password";

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

/** The configured session lifetime, falling back to one day. */
export function maxAgeSeconds(): number {
  const raw = env.SESSION_MAX_AGE_SECONDS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_SECONDS;
}

export function sessionSecret(): string {
  return env.AUTH_SESSION_SECRET;
}

// `__Host-` is only valid over https (it requires Secure + Path=/ and forbids
// Domain), so it is used only on secure deployments; http uses a plain name.
export function cookieName(): string {
  return getRequest().url.startsWith("https:") ? "__Host-tss-session" : "tss-session";
}

function readSealed(): string | null {
  return getCookie(cookieName()) ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const sealed = readSealed();

  if (!sealed) {
    return false;
  }

  const outcome = await unsealSession({ secret: sessionSecret(), sealed });
  return sessionIsAuthenticated(outcome);
}

/**
 * Guard for server functions / API handlers that access private data.
 * Throws a generic error when the current request has no valid session.
 */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

/**
 * Start a session for the shared password. Runs server-side only.
 * On success, seals the session and writes the HttpOnly cookie. On failure,
 * returns a generic error and leaves the request without a session. Delegates
 * all logic to the pure core.
 */
export async function startSession(password: string): Promise<LoginResult> {
  const result = await evaluateLogin(password, env.AUTH_PASSWORD_HASH, verifyPassword);

  if (result.ok) {
    const name = cookieName();
    const maxAge = maxAgeSeconds();
    const secure = getRequest().url.startsWith("https:");
    const sealed = await sealSession({ secret: sessionSecret(), ttlSeconds: maxAge });
    setCookie(name, sealed, {
      maxAge,
      secure,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return result;
}

/** Clear the session cookie, invalidating the session. */
export async function endSession(): Promise<void> {
  const name = cookieName();
  const secure = getRequest().url.startsWith("https:");
  deleteCookie(name, { path: "/", secure });
}
