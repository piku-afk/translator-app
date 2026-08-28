import { describe, expect, it } from "vitest";
import { CreateNovelSchema, rawFileKey, toSlug, type CreateNovelInput } from "./novels-core";

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
