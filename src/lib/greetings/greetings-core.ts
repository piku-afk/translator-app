/**
 * Pure, framework-free greeting helpers.
 *
 * Kept free of any Cloudflare / TanStack imports so this module can be unit
 * tested under plain Node, mirroring the `auth-core` split. `greetings.ts`
 * wires these into the server function and applies auth.
 */

/**
 * Time-of-day greeting for an hour on the 24-hour clock (0-23).
 */
export function getGreeting(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`getGreeting expects an hour in 0..23, got ${hour}`);
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Static subtext shown beneath the greeting.
 */
export function getSubtext(): string {
  return "Continue where you left off";
}

/**
 * Local hour (0-23) of `at` in `timeZone`, computed with `hourCycle: "h23"`.
 * Unlike `hour12: false` (which some engines format as "24" at midnight),
 * `h23` guarantees the spec-defined 0-23 range.
 */
export function getHourInTimezone(timeZone: string, at: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  }).format(at);
  return Number(formatted);
}
