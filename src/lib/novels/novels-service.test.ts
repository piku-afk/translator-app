import { describe, expect, it } from "vitest";
import {
  createTranslatorService,
  type NovelStore,
  type ObjectStore,
  type TranslatorService,
} from "./novels-service";
import {
  DUPLICATE_NOVEL_ERROR,
  INVALID_NOVEL_INPUT_ERROR,
  rawFileKey,
  toSlug,
  type NewNovelRecord,
  type Novel,
} from "./novels-core";

class InMemoryNovelStore implements NovelStore {
  novels: Novel[] = [];
  private nextId = 1;

  async insert(record: NewNovelRecord): Promise<Novel> {
    const novel: Novel = { ...record, id: this.nextId++ };
    this.novels.push(novel);
    return novel;
  }

  async findBySlug(slug: string): Promise<Novel | null> {
    return this.novels.find((n) => n.slug === slug) ?? null;
  }

  async list(): Promise<Novel[]> {
    return [...this.novels];
  }
}

class InMemoryObjectStore implements ObjectStore {
  objects = new Map<string, string>();

  async put(key: string, content: string): Promise<void> {
    this.objects.set(key, content);
  }
}

const FIXED_NOW = "2025-01-01T00:00:00.000Z";

function setup() {
  const novels = new InMemoryNovelStore();
  const objects = new InMemoryObjectStore();
  const service: TranslatorService = createTranslatorService(
    { novels, objects },
    { now: () => FIXED_NOW },
  );
  return { novels, objects, service };
}

const validInput = {
  name: "The Beginning",
  totalChapters: 12,
  sourceLanguage: "ko",
  rawText: "1화.\n첫 문장입니다.",
} as const;

describe("createNovel", () => {
  it("persists a novel at draft status with slug and timestamps", async () => {
    const { novels, service } = setup();
    const novel = await service.createNovel(validInput);

    expect(novel).toMatchObject({
      id: 1,
      name: "The Beginning",
      slug: "the-beginning",
      sourceLanguage: "ko",
      totalChapters: 12,
      status: "draft",
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    expect(novels.novels).toHaveLength(1);
  });

  it("uploads the raw file to R2 under the novel's storage namespace", async () => {
    const { objects, service } = setup();
    await service.createNovel(validInput);

    expect(objects.objects.get("novels/the-beginning/raw")).toBe(validInput.rawText);
  });

  it("returns the created novel", async () => {
    const { service } = setup();
    const novel = await service.createNovel(validInput);
    expect(novel.id).toBe(1);
    expect(novel.status).toBe("draft");
  });

  it("rejects invalid input before persisting or uploading", async () => {
    const { novels, objects, service } = setup();
    const invalidCases: Array<Record<string, unknown>> = [
      { ...validInput, name: "" },
      { ...validInput, name: "   " },
      { ...validInput, totalChapters: 0 },
      { ...validInput, totalChapters: -3 },
      { ...validInput, totalChapters: 1.5 },
      { ...validInput, sourceLanguage: "en" },
      { ...validInput, rawText: "" },
    ];

    for (const input of invalidCases) {
      await expect(service.createNovel(input as never)).rejects.toThrow(INVALID_NOVEL_INPUT_ERROR);
    }
    expect(novels.novels).toHaveLength(0);
    expect(objects.objects.size).toBe(0);
  });

  it("rejects a duplicate name (same slug)", async () => {
    const { novels, objects, service } = setup();
    await service.createNovel(validInput);
    await expect(service.createNovel(validInput)).rejects.toThrow(DUPLICATE_NOVEL_ERROR);
    expect(novels.novels).toHaveLength(1);
    expect(objects.objects.size).toBe(1);
  });
});

describe("listNovels", () => {
  it("returns the novels from the store", async () => {
    const { service } = setup();
    await service.createNovel(validInput);
    await service.createNovel({ ...validInput, name: "Another World" });

    const novels = await service.listNovels();
    expect(novels).toHaveLength(2);
    expect(novels.map((n) => n.name)).toEqual(["The Beginning", "Another World"]);
  });

  it("returns an empty list when no novels exist", async () => {
    const { service } = setup();
    expect(await service.listNovels()).toEqual([]);
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
