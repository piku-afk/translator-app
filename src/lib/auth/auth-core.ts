import jwt from "jsonwebtoken";

/**
 * Pure, framework-free auth logic - the seam.
 *
 * Framework-independent auth behavior: password verification, the login
 * decision, and the signed session cookie (JWT issuance + verification +
 * expiry). The framework shell (`session.ts`) delegates to it, so tests
 * exercise the full login/logout/expiry path with no framework and no network
 * coupling.
 *
 * A session token is either valid or not; every failure (bad password, forged
 * token, expired cookie) just means "not authenticated".
 */

export interface UnsealOutcome {
  ok: boolean;
}

export interface SealSessionInput {
  secret: string;
  ttlSeconds: number;
  now?: number;
}

/**
 * Sign an authenticated session token, expiring `ttlSeconds` from now.
 * `now` (ms) is the `iat`/`exp` clock, so tests stay deterministic; production
 * omits it and falls back to the wall clock.
 */
export async function sealSession({
  secret,
  ttlSeconds,
  now = Date.now(),
}: SealSessionInput): Promise<string> {
  return jwt.sign({ authenticated: true, iat: Math.floor(now / 1000) }, secret, {
    algorithm: "HS256",
    expiresIn: ttlSeconds,
    noTimestamp: true,
  });
}

export interface UnsealSessionInput {
  secret: string;
  sealed: string;
  now?: number;
}

/**
 * Verify a session token. Forged, stale, malformed, or expired input is all
 * rejected as `{ ok: false }`. `now` (ms) drives the verification clock so
 * expiry tests stay deterministic.
 */
export async function unsealSession({
  secret,
  sealed,
  now = Date.now(),
}: UnsealSessionInput): Promise<UnsealOutcome> {
  try {
    const payload = jwt.verify(sealed, secret, {
      algorithms: ["HS256"],
      clockTimestamp: Math.floor(now / 1000),
    });
    return {
      ok:
        typeof payload === "object" &&
        payload !== null &&
        !Array.isArray(payload) &&
        "authenticated" in payload &&
        payload.authenticated === true,
    };
  } catch {
    return { ok: false };
  }
}

/** Whether an unseal outcome represents a live, authenticated session. */
export function sessionIsAuthenticated(outcome: UnsealOutcome | null | undefined): boolean {
  return outcome?.ok === true;
}

export type PasswordVerifier = (password: string, storedHash: string) => Promise<boolean>;

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Deliberately generic so it never reveals whether a shared password is set. */
export const GENERIC_LOGIN_ERROR = "Incorrect password. Please try again.";

/**
 * Decide whether a login attempt succeeds, delegating the actual bcrypt
 * comparison to the injected verifier (kept out of this module so tests can
 * pass a fake and avoid crypto/network overhead).
 */
export async function evaluateLogin(
  password: string,
  storedHash: string | undefined,
  verify: PasswordVerifier,
): Promise<LoginResult> {
  // No shared password configured -> fail closed.
  if (!storedHash) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const valid = await verify(password, storedHash);

  return valid ? { ok: true } : { ok: false, error: GENERIC_LOGIN_ERROR };
}
