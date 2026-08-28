import { type SourceLanguage } from "../novels/novels-core";

/** One chapter split from a novel's raw source text. */
export interface ExtractedChapter {
  /** The chapter's declared number, e.g. 12 for "12화." / "第12章". */
  number: number;
  /** The chapter's full text, including its marker line, trimmed. */
  content: string;
}

/**
 * Korean raw text places a marker like "12화." at the head of each chapter.
 * Mirrors the PoC splitter (`poc/src/chapters.ts`), which is the only
 * real-world source format seen so far.
 */
const KO_SPLIT = /(?=\d+화\.)/;
const KO_CHAPTER_NUMBER = /^(\d+)화\./;

/**
 * Chinese raw text places a marker like "第12章" (Arabic numerals) at the
 * head of each chapter, usually followed by a chapter title.
 */
const ZH_SPLIT = /(?=第\d+章)/;
const ZH_CHAPTER_NUMBER = /^第(\d+)章/;

const EXTRACTORS: Record<SourceLanguage, { split: RegExp; chapterNumber: RegExp }> = {
  ko: { split: KO_SPLIT, chapterNumber: KO_CHAPTER_NUMBER },
  zh: { split: ZH_SPLIT, chapterNumber: ZH_CHAPTER_NUMBER },
};

/**
 * Split a novel's raw source text into its chapters using the source
 * language's chapter markers.
 *
 * Text before the first marker (front matter, a title page) carries no
 * chapter number and is ignored, mirroring the PoC. A repeated chapter
 * number would silently overwrite files and rows, so it is rejected as a
 * malformed raw file instead.
 */
export function extractChapters(rawText: string, language: SourceLanguage): ExtractedChapter[] {
  const { split, chapterNumber } = EXTRACTORS[language];

  const chapters: ExtractedChapter[] = [];
  const seenNumbers = new Set<number>();

  for (const chunk of rawText.split(split)) {
    const content = chunk.trim();
    if (content.length === 0) continue;

    const match = content.match(chapterNumber);
    if (match === null) continue; // text before the first marker

    const number = Number.parseInt(match[1], 10);
    if (seenNumbers.has(number)) {
      throw new Error(`Duplicate chapter number ${number} in raw text`);
    }
    seenNumbers.add(number);

    chapters.push({ number, content });
  }

  return chapters;
}
