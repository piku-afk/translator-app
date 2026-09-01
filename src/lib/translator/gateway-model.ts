import { Output, generateText } from "ai";
import { z } from "zod";
import type { ModelNotesDiff, ModelPort } from "./ports";
import type { NamePair } from "./glossary";
import notesInstructions from "./instructions/NOTES INSTRUCTIONS.md?raw";
import translationInstructions from "./instructions/TRANSLATION INSTRUCTIONS.md?raw";

/**
 * Production `model` port: the AI gateway (Vercel AI Gateway), running the
 * glossary-extraction exchange (one call per chapter) and the translation
 * exchange (one call per chapter). The instruction files live alongside this module:
 * the notes instructions were copied from the POC and edited for the `;`
 * variation separator, numeric entry ids, and the folded single exchange; the
 * translation instructions were copied from the POC's translation instructions.
 *
 * This is the edge/adapter side of the `model` port seam (wired to an external
 * gateway); it does I/O and is deliberately not part of the framework-agnostic
 * domain logic in `glossary.ts` and `service.ts`.
 */

/** The gateway's temperature, pinned by the POC. */
const MODEL_TEMPERATURE = 0.3;

const CategorySchema = z.enum(["characters", "places", "misc"]);

// Field names match the D1 `glossary_entries` columns (`source_names`,
// `english_names`) so the model's structured output lines up with storage.
const ModelNotesEntrySchema = z.object({
  category: CategorySchema,
  id: z.number().describe("opaque integer entry id assigned by the application"),
  description: z.string().describe("one-line description of the entry"),
  english_names: z.string().describe("english rendering; `;`-separated variations"),
  source_names: z.string().describe("source-name variations; `;`-separated"),
});

const ModelNotesAdditionSchema = ModelNotesEntrySchema.omit({ id: true });

const ModelNotesDeletionSchema = z.object({
  category: CategorySchema,
  id: z.number().describe("opaque integer entry id assigned by the application"),
});

const NotesDiffSchema = z.object({
  updates: z.array(ModelNotesEntrySchema).default([]),
  additions: z.array(ModelNotesAdditionSchema).default([]),
  deletions: z.array(ModelNotesDeletionSchema).default([]),
});

const NotesDiffResponseSchema = z.object({
  notesChanges: NotesDiffSchema,
});

/**
 * Build the production model port for the given gateway model ids. The ids are
 * supplied by the caller so the edge wiring (`translator.server.ts`, from
 * `env.EXTRACTION_MODEL_ID` / `env.TRANSLATION_MODEL_ID`) owns them, letting
 * extraction and translation be tuned independently.
 */
export function createGatewayModel(options: {
  extractionModelId: string;
  translationModelId: string;
}): ModelPort {
  const { extractionModelId, translationModelId } = options;
  return {
    async getNotesDiff({ sourceText, filteredNotes }): Promise<{
      notesChanges: ModelNotesDiff;
    }> {
      const { output } = await generateText({
        model: extractionModelId,
        instructions: notesInstructions,
        temperature: MODEL_TEMPERATURE,
        output: Output.object({ schema: NotesDiffResponseSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `<notes>\n${JSON.stringify(filteredNotes)}\n</notes>\n\n` },
              { type: "text", text: `<source>\n${sourceText}\n</source>` },
            ],
          },
        ],
      });

      return output;
    },

    async translate({ sourceText, namePairs }): Promise<{ markdown: string }> {
      const { text } = await generateText({
        model: translationModelId,
        instructions: translationInstructions,
        temperature: MODEL_TEMPERATURE,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `<names>\n${JSON.stringify(namePairs satisfies NamePair[])}\n</names>\n\n` },
              { type: "text", text: `<source>\n${sourceText}\n</source>` },
            ],
          },
        ],
      });

      return { markdown: text };
    },
  };
}
