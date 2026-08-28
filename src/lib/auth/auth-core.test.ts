import { describe, expect, it } from "vitest";
import {
  evaluateLogin,
  GENERIC_LOGIN_ERROR,
  sealSession,
  sessionIsAuthenticated,
  unsealSession,
} from "./auth-core";

const SECRET = "test-secret-0123456789abcdef";
const now = () => new Date("2025-01-01T00:00:00Z").getTime();

describe("evaluateLogin", () => {
  it("returns ok for a correct password", async () => {
    const result = await evaluateLogin("hunter2", "$hash", (_p, _h) => Promise.resolve(true));
    expect(result).toEqual({ ok: true });
  });

  it("returns the generic error for an incorrect password", async () => {
    const result = await evaluateLogin("wrong", "$hash", (_p, _h) => Promise.resolve(false));
    expect(result).toEqual({ ok: false, error: GENERIC_LOGIN_ERROR });
  });

  it("fails closed when no stored hash is configured", async () => {
    const result = await evaluateLogin("anything", undefined, (_p, _h) => Promise.resolve(true));
    expect(result).toEqual({ ok: false, error: GENERIC_LOGIN_ERROR });
  });

  it("forwards the verifier result without leaking the hash", async () => {
    let seenPassword = "";
    let seenHash = "";
    const result = await evaluateLogin("pw", "the-hash", async (p, h) => {
      seenPassword = p;
      seenHash = h;
      return true;
    });
    expect(result.ok).toBe(true);
    expect(seenPassword).toBe("pw");
    expect(seenHash).toBe("the-hash");
  });
});

describe("sealSession / unsealSession", () => {
  it("round-trips an authenticated session", async () => {
    const sealed = await sealSession({ secret: SECRET, ttlSeconds: 60, now: now() });
    const outcome = await unsealSession({ secret: SECRET, sealed, now: now() });
    expect(outcome).toEqual({ ok: true });
  });

  it("expires a session per its max age", async () => {
    const sealed = await sealSession({ secret: SECRET, ttlSeconds: 60, now: now() });
    // after the ttl has elapsed, the token is no longer valid
    const expired = await unsealSession({ secret: SECRET, sealed, now: now() + 61 * 1000 });
    expect(expired).toEqual({ ok: false });
  });

  it("rejects a token sealed with a different secret (forged/tampered)", async () => {
    const sealed = await sealSession({ secret: SECRET, ttlSeconds: 60, now: now() });
    const outcome = await unsealSession({
      secret: "other-secret-0987654321zyxw",
      sealed,
      now: now(),
    });
    expect(outcome).toEqual({ ok: false });
  });

  it("rejects malformed input", async () => {
    const outcome = await unsealSession({ secret: SECRET, sealed: "garbage", now: now() });
    expect(outcome).toEqual({ ok: false });
  });

  it("produces a symmetric-signed, expiring JWT using the wall clock by default", async () => {
    const sealed = await sealSession({ secret: SECRET, ttlSeconds: 60 });
    expect(sealed.split(".")).toHaveLength(3);
    const outcome = await unsealSession({ secret: SECRET, sealed });
    expect(outcome).toEqual({ ok: true });
  });
});

describe("sessionIsAuthenticated", () => {
  it("is true only for a valid session", () => {
    expect(sessionIsAuthenticated({ ok: true })).toBe(true);
    expect(sessionIsAuthenticated({ ok: false })).toBe(false);
    expect(sessionIsAuthenticated(null)).toBe(false);
    expect(sessionIsAuthenticated(undefined)).toBe(false);
  });
});
