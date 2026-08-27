import { describe, expect, it } from "vitest";
import { GREETING_MESSAGES, type GreetingMessage } from "./greeting-messages";

const isGeneric = (m: GreetingMessage) => m.time === undefined && m.days === undefined;
const hasTime = (m: GreetingMessage, bucket: string) => m.time?.includes(bucket as never) ?? false;
const hasDay = (m: GreetingMessage, day: string) => m.days?.includes(day as never) ?? false;

describe("GREETING_MESSAGES", () => {
  it("covers all 27 name-free messages with no duplicates", () => {
    expect(GREETING_MESSAGES).toHaveLength(27);
    const texts = GREETING_MESSAGES.map((m) => m.message);
    expect(new Set(texts).size).toBe(27);
  });

  it("contains no name-requiring messages", () => {
    for (const m of GREETING_MESSAGES) {
      expect(m.message).not.toContain("{name}");
    }
  });

  it("has the expected scope counts", () => {
    const generic = GREETING_MESSAGES.filter(isGeneric);
    const morning = GREETING_MESSAGES.filter((m) => hasTime(m, "morning"));
    const afternoon = GREETING_MESSAGES.filter((m) => hasTime(m, "afternoon"));
    const evening = GREETING_MESSAGES.filter((m) => hasTime(m, "evening"));
    const night = GREETING_MESSAGES.filter((m) => hasTime(m, "night"));
    const perDay = GREETING_MESSAGES.filter((m) => m.days !== undefined);

    expect(generic).toHaveLength(10);
    expect(morning).toHaveLength(1);
    expect(afternoon).toHaveLength(1);
    expect(evening).toHaveLength(3);
    expect(night).toHaveLength(2);
    expect(perDay).toHaveLength(10);
  });

  it("assigns the expected per-day messages", () => {
    const byDay = (day: string) =>
      GREETING_MESSAGES.filter((m) => hasDay(m, day)).map((m) => m.message);

    expect(byDay("mon")).toEqual(["Happy Monday"]);
    expect(byDay("tue")).toEqual(["Happy Tuesday"]);
    expect(byDay("wed")).toEqual(["Happy Wednesday"]);
    expect(byDay("thu")).toEqual(["Happy Thursday"]);
    expect(byDay("fri")).toEqual(["Happy Friday", "That Friday feeling"]);
    expect(byDay("sat")).toEqual(["Happy Saturday!", "Welcome to the weekend"]);
    expect(byDay("sun")).toEqual(["Happy Sunday", "Sunday session?", "Welcome to the weekend"]);
  });
});
