import { describe, expect, it } from "vitest";
import {
  FALLBACK_GREETING,
  getDayInTimezone,
  getHourInTimezone,
  getSubtext,
  getTimeBucket,
  selectGreeting,
  type GreetingMessage,
} from "./greetings-core";

describe("getHourInTimezone", () => {
  it("reads the local hour in the given timezone", () => {
    // 2025-01-01T13:30:00Z = 5:30pm in UTC+4, 5:30am in America/Los_Angeles (PST)
    const at = new Date("2025-01-01T13:30:00Z");
    expect(getHourInTimezone("UTC", at)).toBe(13);
    expect(getHourInTimezone("Etc/GMT-4", at)).toBe(17);
    expect(getHourInTimezone("America/Los_Angeles", at)).toBe(5);
  });

  it("is always in the spec 0-23 range including at midnight", () => {
    const midnight = new Date("2025-01-01T00:30:00Z");
    expect(getHourInTimezone("Etc/GMT+1", midnight)).toBe(23);
    expect(getHourInTimezone("UTC", midnight)).toBe(0);
  });
});

describe("getSubtext", () => {
  it("returns the static subtext", () => {
    expect(getSubtext()).toBe("Continue where you left off");
  });
});

describe("getTimeBucket", () => {
  it.each([
    [0, "night"],
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [21, "evening"],
    [22, "night"],
    [23, "night"],
  ])("maps hour %i to %s", (hour, expected) => {
    expect(getTimeBucket(hour)).toBe(expected);
  });

  it("rejects hours outside the 0-23 clock", () => {
    expect(() => getTimeBucket(-1)).toThrow(RangeError);
    expect(() => getTimeBucket(24)).toThrow(RangeError);
    expect(() => getTimeBucket(1.5)).toThrow(RangeError);
  });
});

describe("getDayInTimezone", () => {
  it("returns lowercase mon..sun in the given timezone", () => {
    // 2025-01-01 is a Wednesday.
    const at = new Date("2025-01-01T12:00:00Z");
    expect(getDayInTimezone("UTC", at)).toBe("wed");
  });

  it("follows the client timezone across the day boundary", () => {
    // 2025-01-01T23:30Z is Wednesday in UTC but Thursday in UTC+14.
    const late = new Date("2025-01-01T23:30:00Z");
    expect(getDayInTimezone("UTC", late)).toBe("wed");
    expect(getDayInTimezone("Pacific/Kiritimati", late)).toBe("thu");

    // 2025-01-01T00:30Z is Wednesday in UTC but Tuesday in UTC-12.
    const early = new Date("2025-01-01T00:30:00Z");
    expect(getDayInTimezone("UTC", early)).toBe("wed");
    expect(getDayInTimezone("Etc/GMT+12", early)).toBe("tue");
  });
});

describe("selectGreeting", () => {
  it("returns a message from the correct filtered pool for a timezone and instant", () => {
    // A small fixture: the logic must not depend on the full seeded dataset.
    const messages: GreetingMessage[] = [
      { message: "generic" },
      { message: "Good morning", time: "morning" },
      { message: "Happy Monday", days: "mon" },
      { message: "Hello, night owl", time: "night" },
      { message: "Happy Saturday!", days: "sat" },
    ];

    // Monday morning in UTC: generic + morning + monday.
    const mondayMorning = selectGreeting(messages, "UTC", new Date("2025-01-06T09:00:00Z"));
    expect(["generic", "Good morning", "Happy Monday"]).toContain(mondayMorning);

    // Saturday night in UTC: generic + night + saturday.
    const saturdayNight = selectGreeting(messages, "UTC", new Date("2025-01-11T23:30:00Z"));
    expect(["generic", "Hello, night owl", "Happy Saturday!"]).toContain(saturdayNight);
  });

  it("matches comma-separated bucket lists directly", () => {
    const at = new Date("2025-01-11T23:30:00Z"); // Saturday night UTC.
    const multi: GreetingMessage[] = [
      { message: "weekend nights", days: "sat,sun", time: "night" },
      { message: "not here", days: "mon", time: "morning" },
    ];
    expect(selectGreeting(multi, "UTC", at, () => 0)).toBe("weekend nights");

    // A typo'd bucket never matches, degrading to the fallback instead of crashing.
    const typo: GreetingMessage[] = [{ message: "mornign", time: "mornign" }];
    expect(selectGreeting(typo, "UTC", at)).toBe(FALLBACK_GREETING);
  });

  it("treats NULL and empty bucket strings as any time / any day", () => {
    const at = new Date("2025-01-06T09:00:00Z"); // Monday morning UTC.
    const nulls: GreetingMessage[] = [{ message: "A", time: null, days: null }];
    const empty: GreetingMessage[] = [{ message: "B", time: "", days: "" }];
    const blanks: GreetingMessage[] = [{ message: "C", time: "   ", days: "   " }];

    expect(selectGreeting(nulls, "UTC", at, () => 0)).toBe("A");
    expect(selectGreeting(empty, "UTC", at, () => 0)).toBe("B");
    expect(selectGreeting(blanks, "UTC", at, () => 0)).toBe("C");
  });

  it("tolerates whitespace around comma-separated buckets (dashboard hand-edits)", () => {
    const at = new Date("2025-01-06T09:00:00Z"); // Monday morning UTC.
    const ragged: GreetingMessage[] = [
      { message: "mon tue", days: " mon , tue " },
      { message: "morning", time: " morning " },
    ];
    expect(selectGreeting(ragged, "UTC", at, () => 0)).toBe("mon tue");
  });

  it("respects bucket boundaries", () => {
    const timeOnly: GreetingMessage[] = [
      { message: "night", time: "night" },
      { message: "morning", time: "morning" },
      { message: "afternoon", time: "afternoon" },
      { message: "evening", time: "evening" },
    ];
    const pick = (hour: number) =>
      selectGreeting(timeOnly, "UTC", new Date(Date.UTC(2025, 0, 6, hour)), () => 0);

    expect(pick(4)).toBe("night");
    expect(pick(5)).toBe("morning");
    expect(pick(11)).toBe("morning");
    expect(pick(12)).toBe("afternoon");
    expect(pick(17)).toBe("afternoon");
    expect(pick(18)).toBe("evening");
    expect(pick(21)).toBe("evening");
    expect(pick(22)).toBe("night");
    expect(pick(23)).toBe("night");
    expect(pick(0)).toBe("night");
  });

  it("picks a candidate by the injected random source", () => {
    const messages: GreetingMessage[] = [{ message: "A" }, { message: "B" }, { message: "C" }];
    const at = new Date("2025-01-06T09:00:00Z");
    expect(selectGreeting(messages, "UTC", at, () => 0)).toBe("A");
    expect(selectGreeting(messages, "UTC", at, () => 0.5)).toBe("B");
    expect(selectGreeting(messages, "UTC", at, () => 0.999)).toBe("C");
  });

  it("keeps the pool non-empty at every hour and day when a generic is present", () => {
    // A single generic greeting (no buckets) is valid at any time on any day,
    // so the pool never empties. Full-dataset coverage is the seed's job (the
    // source of truth is the db), not a unit-test concern.
    const messages: GreetingMessage[] = [{ message: "generic" }];
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      for (let hour = 0; hour < 24; hour++) {
        const at = new Date(Date.UTC(2025, 0, 6 + dayOffset, hour));
        expect(selectGreeting(messages, "UTC", at, () => 0)).toBe("generic");
      }
    }
  });

  it("returns the fallback when the candidate pool is empty", () => {
    const at = new Date("2025-01-06T09:00:00Z"); // Monday morning UTC.

    // No messages at all.
    expect(selectGreeting([], "UTC", at)).toBe(FALLBACK_GREETING);

    // Only messages scoped away from the current moment.
    const scopedAway: GreetingMessage[] = [
      { message: "night only", time: "night" },
      { message: "saturday only", days: "sat" },
    ];
    expect(selectGreeting(scopedAway, "UTC", at)).toBe(FALLBACK_GREETING);
  });
});
