import type { Selectable } from "kysely";
import { z } from "zod";
import type { Novels } from "../database/database-types.gen";

const SOURCE_LANGUAGES = ["ko", "zh"] as const;
export type SourceLanguage = (typeof SOURCE_LANGUAGES)[number];

const SOURCE_LANGUAGE_LABELS: Record<SourceLanguage, string> = {
  ko: "Korean",
  zh: "Chinese",
};

export function sourceLanguageLabel(language: SourceLanguage): string {
  return SOURCE_LANGUAGE_LABELS[language];
}

/** Options for the source-language selector, derived from the canonical labels. */
export const SOURCE_LANGUAGE_OPTIONS: Array<{ value: SourceLanguage; label: string }> =
  SOURCE_LANGUAGES.map((language) => ({
    value: language,
    label: SOURCE_LANGUAGE_LABELS[language],
  }));

const NOVEL_STATUSES = [
  "draft",
  "parsing",
  "ready",
  "needs review",
  "parsing failed",
  "extracting",
  "names extracted",
  "extraction failed",
  "translating",
  "completed",
] as const;
export type NovelStatus = (typeof NOVEL_STATUSES)[number];

/** A novel as stored: the D1 row shape, untouched by any translation. */
export type Novel = Selectable<Novels>;

/** Shared field schemas so the form and the server validate identically. */
export const NovelNameSchema = z.string().trim().min(1, "Novel name is required");
export const TotalChaptersSchema = z.coerce
  .number()
  .int("Total chapters must be a whole number")
  .positive("Total chapters must be greater than zero");
export const SourceLanguageSchema = z.enum(SOURCE_LANGUAGES, {
  message: "Select a source language",
});

export const CreateNovelSchema = z.object({
  name: NovelNameSchema,
  total_chapters: TotalChaptersSchema,
  source_language: SourceLanguageSchema,
  raw_text: z.string().min(1, "Raw text file is required"),
});

export type CreateNovelInput = z.infer<typeof CreateNovelSchema>;

/** Kebab-case the novel name into the storage namespace slug. */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** The R2 key for a novel's uploaded raw source text. */
export function rawFileKey(slug: string): string {
  return `novels/${slug}/raw`;
}

/** The R2 key for a parsed chapter file within the novel's namespace. */
export function chapterFileKey(slug: string, number: number): string {
  return `novels/${slug}/chapters/${number}.txt`;
}

export const DUPLICATE_NOVEL_ERROR = "A novel with this name already exists";

/**
 * The committed novel-level lifecycle actions recorded as Activity rows. Only
 * these eight are recorded; translation-stage actions are reserved for when
 * translation is wired up.
 */
const ACTIVITY_ACTIONS = [
  "novel created",
  "parsing started",
  "parsing ready",
  "needs review",
  "parsing failed",
  "extraction started",
  "names extracted",
  "extraction failed",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
