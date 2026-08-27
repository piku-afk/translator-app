import {
  CreateNovelSchema,
  DUPLICATE_NOVEL_ERROR,
  INVALID_NOVEL_INPUT_ERROR,
  rawFileKey,
  toSlug,
  type CreateNovelInput,
  type NewNovelRecord,
  type Novel,
} from "./novels-core";

/**
 * The translator service seam.
 *
 * One framework- and Cloudflare-agnostic module owns the Novel create/list
 * domain logic. All I/O goes through injected ports (`NovelStore` for D1,
 * `ObjectStore` for R2), so tests supply in-memory doubles and never touch
 * real bindings. Framework routes and server functions are thin adapters that
 * call this service; they hold no domain logic.
 */

export interface NovelStore {
  insert(record: NewNovelRecord): Promise<Novel>;
  findBySlug(slug: string): Promise<Novel | null>;
  list(): Promise<Novel[]>;
}

export interface ObjectStore {
  put(key: string, content: string): Promise<void>;
}

export interface TranslatorServicePorts {
  novels: NovelStore;
  objects: ObjectStore;
}

export interface TranslatorService {
  createNovel(input: CreateNovelInput): Promise<Novel>;
  listNovels(): Promise<Novel[]>;
}

export interface TranslatorServiceOptions {
  /** Clock for deterministic timestamps in tests; defaults to the wall clock. */
  now?: () => string;
}

export function createTranslatorService(
  ports: TranslatorServicePorts,
  options: TranslatorServiceOptions = {},
): TranslatorService {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async createNovel(input) {
      const parsed = CreateNovelSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(INVALID_NOVEL_INPUT_ERROR);
      }

      const { name, totalChapters, sourceLanguage, rawText } = parsed.data;
      const slug = toSlug(name);

      const existing = await ports.novels.findBySlug(slug);
      if (existing) {
        throw new Error(DUPLICATE_NOVEL_ERROR);
      }

      const timestamp = now();
      const record: NewNovelRecord = {
        name,
        slug,
        sourceLanguage,
        totalChapters,
        status: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // Upload the raw file before persisting: a failed insert must never leave
      // a DB record pointing at a missing file. An orphaned object (insert
      // failed after upload) is harmless - nothing references it.
      await ports.objects.put(rawFileKey(slug), rawText);

      return ports.novels.insert(record);
    },

    async listNovels() {
      return ports.novels.list();
    },
  };
}
