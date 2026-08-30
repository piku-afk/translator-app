import { Output, generateText } from "ai";
import { z } from "zod";
import type {
  ModelNamePair,
  ModelNotesDiff,
  ModelNotesEntry,
  ModelPort,
} from "./ports";
import type { GlossaryCategory } from "./glossary";
import namesInstructions from "./instructions/NAMES INSTRUCTIONS.md?raw";
import notesInstructions from "./instructions/NOTES INSTRUCTIONS.md?raw";

/**
 * Production `model` port: the AI gateway (Vercel AI Gateway) model
 * `tencent/hy3` at temperature 0.3, using the POC's two-call protocol and
 * structured-output schemas. The instruction files live alongside this module
 * and were copied from the POC, edited only for the `;` variation separator
 * and numeric entry ids.
 */

/** The gateway model id, pinned by the POC. */
const MODEL_ID = "tencent/hy3";

/** The gateway's structured-output temperature, pinned by the POC. */
const MODEL_TEMPERATURE = 0.3;

const CategorySchema = z.enum(["characters", "places", "misc"]);

const ModelNamePairSchema = z.object({
  sourceName: z.string().describe("name exactly as it appears in the source text"),
  englishName: z.string().describe("english rendering chosen during translation"),
});

const NewNamesResponseSchema = z.object({
  newNames: z.array(ModelNamePairSchema).default([]),
});

const ModelNotesEntrySchema = z.object({
  category: CategorySchema,
  id: z.number().describe("opaque integer entry id assigned by the application"),
  description: z.string().describe("one-line description of the entry"),
  englishName: z.string().describe("english rendering; `;`-separated variations"),
  sourceName: z.string().describe("source-name variations; `;`-separated"),
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
 * The production model port, wired to the AI gateway. Reads the two copied
 * instruction files once at module load.
 */
export const gatewayModel: ModelPort = {
  async getNewNames({ sourceText, filteredNames }): Promise<{ newNames: ModelNamePair[] }> {
    const { output } = await generateText({
      model: MODEL_ID,
      instructions: namesInstructions,
      temperature: MODEL_TEMPERATURE,
      output: Output.object({ schema: NewNamesResponseSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `<names>\n${JSON.stringify(filteredNames)}\n</names>\n\n` },
            { type: "text", text: `<source>\n${sourceText}\n</source>` },
          ],
        },
      ],
    });

    return output;
  },

  async getNotesDiff({ sourceText, filteredNotes, newNames }): Promise<{
    notesChanges: ModelNotesDiff;
  }> {
    const { output } = await generateText({
      model: MODEL_ID,
      instructions: notesInstructions,
      temperature: MODEL_TEMPERATURE,
      output: Output.object({ schema: NotesDiffResponseSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `<notes>\n${JSON.stringify(filteredNotes)}\n</notes>\n\n` },
            { type: "text", text: `<new-names>\n${JSON.stringify(newNames)}\n</new-names>\n\n` },
            { type: "text", text: `<source>\n${sourceText}\n</source>` },
          ],
        },
      ],
    });

    return output;
  },
};

// Re-exported for tests that want to type against the model-facing shapes.
export type { ModelNamePair, ModelNotesDiff, ModelNotesEntry, GlossaryCategory };
