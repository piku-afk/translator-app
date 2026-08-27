import { describe, expect, it } from "vitest";
import { getGreeting, getHourInTimezone, getSubtext } from "./greetings-core";

describe("getGreeting", () => {
  it.each([
    [0, "Good morning"],
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good evening"],
  ])("returns %s for hour %i", (hour, expected) => {
    expect(getGreeting(hour)).toBe(expected);
  });

  it("rejects hours outside the 0-23 clock", () => {
    expect(() => getGreeting(-1)).toThrow(RangeError);
    expect(() => getGreeting(24)).toThrow(RangeError);
    expect(() => getGreeting(1.5)).toThrow(RangeError);
  });
});

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
