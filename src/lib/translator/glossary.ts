import Fuse from "fuse.js";

/** The three glossary entity categories, mirroring the POC's note taxonomy. */
export type GlossaryCategory = "characters" | "places" | "misc";

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = ["characters", "places", "misc"];

/**
 * Separator for name variations, used consistently in storage (`source_names` /
 * `english_names` columns) and in the extraction instruction files. A small,
 * deliberate deviation from the POC's `|` (see the spec's Implementation
 * Decisions).
 */
export const VARIATION_SEPARATOR = ";";

/**
 * One glossary entity: every source-name variation for the entity, its English
 * rendering variations, its category, and a one-line description. The DB
 * integer id is the opaque handle the model addresses in updates/deletions.
 */
export interface GlossaryEntry {
  id: number;
  category: GlossaryCategory;
  sourceNames: string[];
  englishNames: string[];
  description: string;
}

export type Glossary = GlossaryEntry[];

/** A source-name → English-rendering pair; the only glossary material handed
 * to the translation model (ADR-0002). */
export interface NamePair {
  sourceName: string;
  englishName: string;
}

/** A model-proposed new entry (no id yet - the application assigns it). */
export interface GlossaryAddition {
  category: GlossaryCategory;
  sourceNames: string[];
  englishNames: string[];
  description: string;
}

/** A model-proposed change to an existing entry, addressed by its id. */
export interface GlossaryUpdate {
  id: number;
  category: GlossaryCategory;
  sourceNames: string[];
  englishNames: string[];
  description: string;
}

/** A model-proposed removal of an existing entry, addressed by its id. */
export interface GlossaryDeletion {
  id: number;
  category: GlossaryCategory;
}

/** The model's per-chapter notes diff: additions / updates / deletions. */
export interface GlossaryDiff {
  additions: GlossaryAddition[];
  updates: GlossaryUpdate[];
  deletions: GlossaryDeletion[];
}

/** Split a `;`-separated variation string losslessly: trimmed, empties dropped. */
export function splitVariations(value: string): string[] {
  return value
    .split(VARIATION_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Join variations with `;`, trimming and dropping empties. */
export function joinVariations(values: string[]): string {
  return values
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(VARIATION_SEPARATOR);
}

/** Trim and dedupe aliases, preserving first-seen order. */
function dedupeAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalize(text: string): string {
  return text.normalize("NFC").trim();
}

/** A Fuse.js relevance matcher over a chapter's text, ported from the POC
 * (threshold 0.3, ignoreLocation). */
function createTextMatcher(sourceText: string): Fuse<{ text: string }> {
  return new Fuse([{ text: normalize(sourceText) }], {
    keys: ["text"],
    threshold: 0.3,
    ignoreLocation: true,
  });
}

/** True when any of `aliases` appears in `sourceText` per Fuse relevance. */
function isPresent(sourceText: string, aliases: string[]): boolean {
  const fuse = createTextMatcher(sourceText);
  return aliases.some((alias) => fuse.search(alias).length > 0);
}

/** The entries whose source-name variations appear in the chapter's text. */
export function filterNotesBySourceText(sourceText: string, entries: Glossary): Glossary {
  return entries.filter((entry) => isPresent(sourceText, entry.sourceNames));
}

/** Name pairs (sourceName/englishName, `;`-joined) for the entries relevant to
 * the chapter's text - the input to getNewNames. */
export function filterNamesBySourceText(sourceText: string, entries: Glossary): NamePair[] {
  return filterNotesBySourceText(sourceText, entries).map((entry) => ({
    sourceName: joinVariations(entry.sourceNames),
    englishName: joinVariations(entry.englishNames),
  }));
}

/** The largest id in the glossary, or 0 when empty. */
function maxId(entries: Glossary): number {
  return entries.reduce((max, entry) => Math.max(max, entry.id), 0);
}

/**
 * Apply a model diff to a glossary without ever duplicating an entity - the
 * "no duplicate entities" guarantee across re-runs.
 *
 * - Deletions remove entries by id.
 * - Updates replace an entry's fields; aliases are trimmed and deduped.
 * - An addition whose alias set collides with an existing entry (same category,
 *   shared source alias) is merged into it rather than inserted; otherwise it
 *   is inserted with the next free id.
 */
export function applyGlossaryDiff(glossary: Glossary, diff: GlossaryDiff): Glossary {
  let entries = glossary.map((entry) => ({
    ...entry,
    sourceNames: [...entry.sourceNames],
    englishNames: [...entry.englishNames],
  }));

  const deletedIds = new Set(diff.deletions.map((deletion) => deletion.id));
  entries = entries.filter((entry) => !deletedIds.has(entry.id));

  for (const update of diff.updates) {
    const index = entries.findIndex((entry) => entry.id === update.id);
    if (index === -1) continue; // unknown id: nothing to update
    entries[index] = {
      ...entries[index],
      category: update.category,
      sourceNames: dedupeAliases(update.sourceNames),
      englishNames: dedupeAliases(update.englishNames),
      description: update.description,
    };
  }

  let nextId = maxId(entries) + 1;
  for (const addition of diff.additions) {
    const collision = entries.find(
      (entry) =>
        entry.category === addition.category &&
        entry.sourceNames.some((alias) => addition.sourceNames.includes(alias)),
    );
    if (collision) {
      collision.sourceNames = dedupeAliases([...collision.sourceNames, ...addition.sourceNames]);
      collision.englishNames = dedupeAliases([...collision.englishNames, ...addition.englishNames]);
    } else {
      entries.push({
        id: nextId++,
        category: addition.category,
        sourceNames: dedupeAliases(addition.sourceNames),
        englishNames: dedupeAliases(addition.englishNames),
        description: addition.description,
      });
    }
  }

  return entries;
}
