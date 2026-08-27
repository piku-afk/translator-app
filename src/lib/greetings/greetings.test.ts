import { describe, expect, it } from "vitest";
import {
  getDayInTimezone,
  getGreeting,
  getHourInTimezone,
  getSubtext,
  getTimeBucket,
  selectGreeting,
} from "./greetings-core";
import { GREETING_MESSAGES, type GreetingMessage } from "./greeting-messages";

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
    // Monday morning in UTC.
    const mondayMorning = selectGreeting(
      GREETING_MESSAGES,
      "UTC",
      new Date("2025-01-06T09:00:00Z"),
    );
    const mondayMorningPool = [
      "Back at it!",
      "Greetings, whoever you are",
      "Hey there",
      "Hi, how are you?",
      "How’s it going?",
      "Let’s chat incognito",
      "Welcome",
      "What’s new?",
      "What’s on your mind?",
      "You’re incognito",
      "Good morning",
      "Happy Monday",
    ];
    expect(mondayMorningPool).toContain(mondayMorning);

    // Friday evening in UTC.
    const fridayEvening = selectGreeting(
      GREETING_MESSAGES,
      "UTC",
      new Date("2025-01-10T19:00:00Z"),
    );
    const fridayEveningPool = [
      "Back at it!",
      "Greetings, whoever you are",
      "Hey there",
      "Hi, how are you?",
      "How’s it going?",
      "Let’s chat incognito",
      "Welcome",
      "What’s new?",
      "What’s on your mind?",
      "You’re incognito",
      "Evening",
      "Good evening",
      "How was your day?",
      "Happy Friday",
      "That Friday feeling",
    ];
    expect(fridayEveningPool).toContain(fridayEvening);

    // Saturday night in UTC.
    const saturdayNight = selectGreeting(
      GREETING_MESSAGES,
      "UTC",
      new Date("2025-01-11T23:30:00Z"),
    );
    const saturdayNightPool = [
      "Back at it!",
      "Greetings, whoever you are",
      "Hey there",
      "Hi, how are you?",
      "How’s it going?",
      "Let’s chat incognito",
      "Welcome",
      "What’s new?",
      "What’s on your mind?",
      "You’re incognito",
      "Hello, night owl",
      "What’s on your mind tonight?",
      "Happy Saturday!",
      "Welcome to the weekend",
    ];
    expect(saturdayNightPool).toContain(saturdayNight);

    // Sunday daytime in UTC.
    const sunday = selectGreeting(GREETING_MESSAGES, "UTC", new Date("2025-01-12T10:00:00Z"));
    const sundayPool = [
      "Back at it!",
      "Greetings, whoever you are",
      "Hey there",
      "Hi, how are you?",
      "How’s it going?",
      "Let’s chat incognito",
      "Welcome",
      "What’s new?",
      "What’s on your mind?",
      "You’re incognito",
      "Happy Sunday",
      "Sunday session?",
      "Welcome to the weekend",
    ];
    expect(sundayPool).toContain(sunday);
  });

  it("respects bucket boundaries", () => {
    const timeOnly: GreetingMessage[] = [
      { message: "night", time: ["night"] },
      { message: "morning", time: ["morning"] },
      { message: "afternoon", time: ["afternoon"] },
      { message: "evening", time: ["evening"] },
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
    const messages = [{ message: "A" }, { message: "B" }, { message: "C" }];
    const at = new Date("2025-01-06T09:00:00Z");
    expect(selectGreeting(messages, "UTC", at, () => 0)).toBe("A");
    expect(selectGreeting(messages, "UTC", at, () => 0.5)).toBe("B");
    expect(selectGreeting(messages, "UTC", at, () => 0.999)).toBe("C");
  });

  it("guarantees a non-empty candidate pool for every hour and day", () => {
    // 2025-01-06 is a Monday; walk a full week in UTC.
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      for (let hour = 0; hour < 24; hour++) {
        const at = new Date(Date.UTC(2025, 0, 6 + dayOffset, hour));
        const greeting = selectGreeting(GREETING_MESSAGES, "UTC", at, () => 0);
        expect(greeting).toBeTruthy();
        expect(GREETING_MESSAGES.some((m) => m.message === greeting)).toBe(true);
      }
    }
  });
});
