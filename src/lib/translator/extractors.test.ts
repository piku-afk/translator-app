import { describe, expect, it } from "vitest";
import { extractChapters } from "./extractors";

describe("extractChapters", () => {
  it("splits Korean raw text on 'NN화.' markers", () => {
    const rawText = "1화.\n첫 문장입니다.\n\n2화.\n두 번째 문장입니다.";

    const chapters = extractChapters(rawText, "ko");

    expect(chapters).toEqual([
      { number: 1, content: "1화.\n첫 문장입니다." },
      { number: 2, content: "2화.\n두 번째 문장입니다." },
    ]);
  });

  it("splits Chinese raw text on '第NN章' markers", () => {
    const rawText = "第1章 大雨\n雨下了整夜。\n\n第2章 出发\n他们离开了小岛。";

    const chapters = extractChapters(rawText, "zh");

    expect(chapters).toEqual([
      { number: 1, content: "第1章 大雨\n雨下了整夜。" },
      { number: 2, content: "第2章 出发\n他们离开了小岛。" },
    ]);
  });

  it("ignores text before the first chapter marker", () => {
    const rawText = "제목: 바다의 시작\n\n3화.\n본문입니다.";

    const chapters = extractChapters(rawText, "ko");

    expect(chapters).toEqual([{ number: 3, content: "3화.\n본문입니다." }]);
  });

  it("trims the content around each chapter", () => {
    const rawText = "1화.\n\n\n\n본문입니다.\n\n\n\n2화.\n본문입니다.";

    const chapters = extractChapters(rawText, "ko");

    expect(chapters.map((c) => c.content)).toEqual([
      "1화.\n\n\n\n본문입니다.",
      "2화.\n본문입니다.",
    ]);
  });

  it("allows gaps in chapter numbering", () => {
    const rawText = "1화.\n본문입니다.\n\n5화.\n본문입니다.";

    const chapters = extractChapters(rawText, "ko");

    expect(chapters.map((c) => c.number)).toEqual([1, 5]);
  });

  it("returns no chapters when the raw text has no markers", () => {
    expect(extractChapters("이야기가 마커 없이 이어집니다.", "ko")).toEqual([]);
    expect(extractChapters("", "zh")).toEqual([]);
  });

  it("rejects duplicate chapter numbers", () => {
    const rawText = "1화.\n본문입니다.\n\n1화.\n다시 본문입니다.";

    expect(() => extractChapters(rawText, "ko")).toThrow("Duplicate chapter number 1");
  });

  it("rejects a duplicate across the whole novel, not just neighbours", () => {
    const rawText = "1화.\n본문\n\n2화.\n본문\n\n1화.\n다시 본문";

    expect(() => extractChapters(rawText, "ko")).toThrow("Duplicate chapter number 1");
  });
});
