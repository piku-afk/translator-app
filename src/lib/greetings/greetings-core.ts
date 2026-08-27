/**
 * Pure, framework-free greeting helpers.
 *
 * Kept free of any Cloudflare / TanStack imports so this module can be unit
 * tested under plain Node, mirroring the `auth-core` split. `greetings.ts`
 * wires these into the server function and applies auth.
 */

import type { DayBucket, GreetingMessage, TimeBucket } from "./greeting-messages";

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

/**
 * Time-of-day bucket for an hour on the 24-hour clock (0-23).
 *
 * Buckets: night 0-4, morning 5-11, afternoon 12-17, evening 18-21, night
 * 22-23. Night is split across two disjoint ranges, so it is the fallthrough
 * for hours that are not morning, afternoon, or evening.
 */
export function getTimeBucket(hour: number): TimeBucket {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`getTimeBucket expects an hour in 0..23, got ${hour}`);
  }
  if (hour <= 4) return "night";
  if (hour <= 11) return "morning";
  if (hour <= 17) return "afternoon";
  if (hour <= 21) return "evening";
  return "night"; // hours 22-23
}

const DAY_BUCKETS: readonly DayBucket[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function isDayBucket(day: string): day is DayBucket {
  return DAY_BUCKETS.some((d) => d === day);
}

/**
 * Local day-of-week (lowercase `mon`..`sun`) of `at` in `timeZone`, computed
 * with `Intl.DateTimeFormat` so the day follows the client's calendar.
 */
export function getDayInTimezone(timeZone: string, at: Date): DayBucket {
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone,
  }).format(at);
  const day = formatted.toLowerCase();

  if (!isDayBucket(day)) {
    throw new RangeError(`getDayInTimezone produced unexpected day "${day}"`);
  }

  return day;
}

/**
 * Picks one greeting from `messages` that is valid at the local time-of-day
 * bucket and day-of-week of `at` in `timeZone`, chosen by `random`.
 *
 * A message is a candidate when its declared time buckets include the current
 * time bucket AND its declared day buckets include the current day. Messages
 * with no tags (generic greetings) are always candidates, so the pool is never
 * empty for the canonical list.
 */
export function selectGreeting(
  messages: readonly GreetingMessage[],
  timeZone: string,
  at: Date,
  random: () => number = Math.random,
): string {
  const bucket = getTimeBucket(getHourInTimezone(timeZone, at));
  const day = getDayInTimezone(timeZone, at);
  const candidates = messages.filter(
    (m) =>
      (m.time === undefined || m.time.includes(bucket)) &&
      (m.days === undefined || m.days.includes(day)),
  );
  const index = Math.floor(random() * candidates.length);
  return candidates[index].message;
}
