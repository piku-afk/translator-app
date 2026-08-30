import { describe, expect, it } from "vitest";
import {
  CreateNovelSchema,
  activityText,
  rawFileKey,
  toSlug,
  type CreateNovelInput,
} from "./novels-core";

const validInput: CreateNovelInput = {
  name: "The Beginning",
  total_chapters: 12,
  source_language: "ko",
  raw_text: "1화.\n첫 문장입니다.",
};

describe("CreateNovelSchema", () => {
  it("accepts a valid novel input", () => {
    expect(CreateNovelSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a blank or whitespace-only name", () => {
    for (const name of ["", "   "]) {
      expect(CreateNovelSchema.safeParse({ ...validInput, name }).success).toBe(false);
    }
  });

  it("rejects non-positive or fractional total chapters", () => {
    for (const total_chapters of [0, -3, 1.5]) {
      expect(CreateNovelSchema.safeParse({ ...validInput, total_chapters }).success).toBe(false);
    }
  });

  it("rejects an unsupported source language", () => {
    expect(CreateNovelSchema.safeParse({ ...validInput, source_language: "en" }).success).toBe(
      false,
    );
  });

  it("rejects an empty raw text", () => {
    expect(CreateNovelSchema.safeParse({ ...validInput, raw_text: "" }).success).toBe(false);
  });
});

describe("toSlug", () => {
  it("kebab-cases a novel name", () => {
    expect(toSlug("The Beginning")).toBe("the-beginning");
    expect(toSlug("My Novel 1")).toBe("my-novel-1");
    expect(toSlug("  Leading and trailing  ")).toBe("leading-and-trailing");
    expect(toSlug("소설")).toBe("소설");
  });
});

describe("rawFileKey", () => {
  it("namespaces the raw file under the novel's folder", () => {
    expect(rawFileKey("the-beginning")).toBe("novels/the-beginning/raw");
  });
});

describe("activityText", () => {
  const ago = "2 minutes ago";

  it("renders novel created", () => {
    expect(activityText("novel created", "The Beginning", ago)).toBe(
      'Created "The Beginning" 2 minutes ago',
    );
  });

  it("renders parsing started", () => {
    expect(activityText("parsing started", "The Beginning", ago)).toBe(
      '"The Beginning" parsing started 2 minutes ago',
    );
  });

  it("renders parsing ready", () => {
    expect(activityText("parsing ready", "The Beginning", ago)).toBe(
      '"The Beginning" is ready for extraction 2 minutes ago',
    );
  });

  it("renders needs review with the chapter-count mismatch from detail", () => {
    expect(activityText("needs review", "The Beginning", ago, "4 ≠ 5")).toBe(
      '"The Beginning" needs review — chapter count mismatch (4 ≠ 5) 2 minutes ago',
    );
  });

  it("renders needs review without detail when none is recorded", () => {
    expect(activityText("needs review", "The Beginning", ago, null)).toBe(
      '"The Beginning" needs review — chapter count mismatch () 2 minutes ago',
    );
  });

  it("renders parsing failed", () => {
    expect(activityText("parsing failed", "The Beginning", ago)).toBe(
      '"The Beginning" parsing failed 2 minutes ago',
    );
  });

  it("renders extraction started", () => {
    expect(activityText("extraction started", "The Beginning", ago)).toBe(
      '"The Beginning" name extraction started 2 minutes ago',
    );
  });

  it("renders names extracted", () => {
    expect(activityText("names extracted", "The Beginning", ago)).toBe(
      '"The Beginning" names extracted 2 minutes ago',
    );
  });

  it("renders extraction failed", () => {
    expect(activityText("extraction failed", "The Beginning", ago)).toBe(
      '"The Beginning" extraction failed 2 minutes ago',
    );
  });
});
