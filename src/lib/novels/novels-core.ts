import { z } from "zod";

/**
 * Pure, framework- and Cloudflare-agnostic Novel domain vocabulary.
 *
 * Types, the create-novel validation schema, and the storage-namespace helpers
 * (kebab slug + R2 key layout) live here so both the service seam and the
 * framework shell share one source of truth. No I/O, no bindings.
 */

export const SOURCE_LANGUAGES = ["ko", "zh"] as const;
export type SourceLanguage = (typeof SOURCE_LANGUAGES)[number];

export const SOURCE_LANGUAGE_LABELS: Record<SourceLanguage, string> = {
  ko: "Korean",
  zh: "Chinese",
};

export function sourceLanguageLabel(language: SourceLanguage): string {
  return SOURCE_LANGUAGE_LABELS[language];
}

export const NOVEL_STATUSES = [
  "draft",
  "parsing",
  "ready",
  "needs review",
  "extracting",
  "translating",
  "completed",
] as const;
export type NovelStatus = (typeof NOVEL_STATUSES)[number];

/** A novel as handed to the store port, before the store assigns an id. */
export interface NewNovelRecord {
  name: string;
  slug: string;
  sourceLanguage: SourceLanguage;
  totalChapters: number;
  status: NovelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Novel extends NewNovelRecord {
  id: number;
}

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
  totalChapters: TotalChaptersSchema,
  sourceLanguage: SourceLanguageSchema,
  rawText: z.string().min(1, "Raw text file is required"),
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

export const INVALID_NOVEL_INPUT_ERROR = "Invalid novel input";
export const DUPLICATE_NOVEL_ERROR = "A novel with this name already exists";
