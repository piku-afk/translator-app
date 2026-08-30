import { describe, expect, it } from "vitest";
import {
  VARIATION_SEPARATOR,
  applyGlossaryDiff,
  filterNamesBySourceText,
  filterNotesBySourceText,
  joinVariations,
  splitVariations,
  type Glossary,
  type GlossaryDiff,
} from "./glossary";

describe("splitVariations / joinVariations", () => {
  it("splits on the separator, trimming and dropping empties", () => {
    expect(splitVariations(" 강민수 ; 민수 형사 ;; 선생님 ")).toEqual([
      "강민수",
      "민수 형사",
      "선생님",
    ]);
  });

  it("joins variations with the separator, trimming and dropping empties", () => {
    expect(joinVariations(["강민수", " 민수 형사 ", "", "선생님"])).toBe(
      "강민수;민수 형사;선생님",
    );
  });

  it("round-trips losslessly", () => {
    const variations = ["강민수", "민수 형사", "선생님"];
    expect(splitVariations(joinVariations(variations))).toEqual(variations);
  });

  it("returns an empty array for an empty or blank string", () => {
    expect(splitVariations("")).toEqual([]);
    expect(splitVariations("  ;  ")).toEqual([]);
  });

  it("uses the single canonical separator", () => {
    expect(VARIATION_SEPARATOR).toBe(";");
  });
});

describe("filterNotesBySourceText", () => {
  const glossary: Glossary = [
    {
      id: 1,
      category: "characters",
      sourceNames: ["강민수", "민수 형사"],
      englishNames: ["Kang Minsu", "Detective Minsu"],
      description: "Male; police officer",
    },
    {
      id: 2,
      category: "places",
      sourceNames: ["서울중앙병원"],
      englishNames: ["Seoul Central Hospital"],
      description: "Abandoned hospital",
    },
    {
      id: 3,
      category: "misc",
      sourceNames: ["권총"],
      englishNames: ["revolver"],
      description: "Carried by Minsu",
    },
  ];

  it("keeps only entries whose variations appear in the chapter text", () => {
    const sourceText = "강민수는 경찰관이다. 그는 민수 형사로 불린다.";

    const filtered = filterNotesBySourceText(sourceText, glossary);

    expect(filtered.map((entry) => entry.id)).toEqual([1]);
  });

  it("matches on any single variation", () => {
    const sourceText = "그는 서울중앙병원으로 향했다.";

    const filtered = filterNotesBySourceText(sourceText, glossary);

    expect(filtered.map((entry) => entry.id)).toEqual([2]);
  });

  it("returns an empty list when nothing is present", () => {
    const sourceText = "아무것도 없는 텍스트입니다.";

    expect(filterNotesBySourceText(sourceText, glossary)).toEqual([]);
  });
});

describe("filterNamesBySourceText", () => {
  const glossary: Glossary = [
    {
      id: 1,
      category: "characters",
      sourceNames: ["강민수", "민수 형사"],
      englishNames: ["Kang Minsu", "Detective Minsu"],
      description: "Male; police officer",
    },
    {
      id: 2,
      category: "places",
      sourceNames: ["서울중앙병원"],
      englishNames: ["Seoul Central Hospital"],
      description: "Abandoned hospital",
    },
  ];

  it("returns `;`-joined name pairs for the relevant entries", () => {
    const sourceText = "강민수는 서울중앙병원으로 향했다.";

    const names = filterNamesBySourceText(sourceText, glossary);

    expect(names).toEqual([
      { source_names: "강민수;민수 형사", english_names: "Kang Minsu;Detective Minsu" },
      { source_names: "서울중앙병원", english_names: "Seoul Central Hospital" },
    ]);
  });

  it("returns no pairs when nothing is present", () => {
    expect(filterNamesBySourceText("관련 없는 텍스트", glossary)).toEqual([]);
  });
});

describe("applyGlossaryDiff", () => {
  it("adds new entries with generated ids", () => {
    const diff: GlossaryDiff = {
      additions: [
        {
          category: "characters",
          sourceNames: ["김도현"],
          englishNames: ["Kim Dohyeon"],
          description: "High school teacher",
        },
      ],
      updates: [],
      deletions: [],
    };

    const result = applyGlossaryDiff([], diff);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      category: "characters",
      sourceNames: ["김도현"],
      englishNames: ["Kim Dohyeon"],
      description: "High school teacher",
    });
  });

  it("merges a colliding addition into the existing entry instead of inserting", () => {
    const glossary: Glossary = [
      {
        id: 7,
        category: "characters",
        sourceNames: ["강민수"],
        englishNames: ["Kang Minsu"],
        description: "Male; police officer",
      },
    ];
    const diff: GlossaryDiff = {
      additions: [
        {
          category: "characters",
          sourceNames: ["강민수", "민수 형사"],
          englishNames: ["Kang Minsu", "Detective Minsu"],
          description: "Male; detective",
        },
      ],
      updates: [],
      deletions: [],
    };

    const result = applyGlossaryDiff(glossary, diff);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(7); // same entry, not a new one
    expect(result[0].sourceNames).toEqual(["강민수", "민수 형사"]);
    expect(result[0].englishNames).toEqual(["Kang Minsu", "Detective Minsu"]);
  });

  it("does not merge across categories", () => {
    const glossary: Glossary = [
      {
        id: 7,
        category: "characters",
        sourceNames: ["강민수"],
        englishNames: ["Kang Minsu"],
        description: "Male; police officer",
      },
    ];
    const diff: GlossaryDiff = {
      additions: [
        {
          category: "places",
          sourceNames: ["강민수"],
          englishNames: ["Kang Minsu"],
          description: "A place",
        },
      ],
      updates: [],
      deletions: [],
    };

    const result = applyGlossaryDiff(glossary, diff);

    expect(result).toHaveLength(2);
  });

  it("updates an existing entry and dedupes its aliases", () => {
    const glossary: Glossary = [
      {
        id: 3,
        category: "characters",
        sourceNames: ["강민수", "강민수", " 민수 형사 "],
        englishNames: ["Kang Minsu", "Kang Minsu", "Detective Minsu"],
        description: "Male; police officer",
      },
    ];
    const diff: GlossaryDiff = {
      additions: [],
      updates: [
        {
          id: 3,
          category: "characters",
          sourceNames: ["강민수", "민수 형사", "민수 형사", "선생님"],
          englishNames: ["Kang Minsu", "Detective Minsu", "Detective Minsu", "Teacher"],
          description: "Male; police officer; teacher",
        },
      ],
      deletions: [],
    };

    const result = applyGlossaryDiff(glossary, diff);

    expect(result).toHaveLength(1);
    expect(result[0].sourceNames).toEqual(["강민수", "민수 형사", "선생님"]);
    expect(result[0].englishNames).toEqual(["Kang Minsu", "Detective Minsu", "Teacher"]);
    expect(result[0].description).toBe("Male; police officer; teacher");
  });

  it("skips updates for unknown ids", () => {
    const glossary: Glossary = [
      {
        id: 1,
        category: "characters",
        sourceNames: ["강민수"],
        englishNames: ["Kang Minsu"],
        description: "Male",
      },
    ];
    const diff: GlossaryDiff = {
      additions: [],
      updates: [
        {
          id: 99,
          category: "characters",
          sourceNames: ["김도현"],
          englishNames: ["Kim Dohyeon"],
          description: "Teacher",
        },
      ],
      deletions: [],
    };

    const result = applyGlossaryDiff(glossary, diff);

    expect(result).toEqual(glossary);
  });

  it("deletes entries by id", () => {
    const glossary: Glossary = [
      {
        id: 1,
        category: "characters",
        sourceNames: ["강민수"],
        englishNames: ["Kang Minsu"],
        description: "Male",
      },
      {
        id: 2,
        category: "places",
        sourceNames: ["서울중앙병원"],
        englishNames: ["Seoul Central Hospital"],
        description: "Hospital",
      },
    ];
    const diff: GlossaryDiff = {
      additions: [],
      updates: [],
      deletions: [{ id: 1, category: "characters" }],
    };

    const result = applyGlossaryDiff(glossary, diff);

    expect(result.map((entry) => entry.id)).toEqual([2]);
  });

  it("re-running the same diff produces no duplicate entities", () => {
    const diff: GlossaryDiff = {
      additions: [
        {
          category: "characters",
          sourceNames: ["강민수", "민수 형사"],
          englishNames: ["Kang Minsu", "Detective Minsu"],
          description: "Male; police officer",
        },
      ],
      updates: [],
      deletions: [],
    };

    const once = applyGlossaryDiff([], diff);
    const twice = applyGlossaryDiff(once, diff);

    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(twice[0].id).toBe(once[0].id);
    expect(twice[0].sourceNames).toEqual(["강민수", "민수 형사"]);
  });

  it("applies a full diff (deletions, updates, additions) in one pass", () => {
    const glossary: Glossary = [
      {
        id: 1,
        category: "characters",
        sourceNames: ["강민수"],
        englishNames: ["Kang Minsu"],
        description: "Male; police officer",
      },
      {
        id: 2,
        category: "characters",
        sourceNames: ["김도현"],
        englishNames: ["Kim Dohyeon"],
        description: "Teacher",
      },
    ];
    const diff: GlossaryDiff = {
      additions: [
        {
          category: "places",
          sourceNames: ["서울중앙병원"],
          englishNames: ["Seoul Central Hospital"],
          description: "Abandoned hospital",
        },
      ],
      updates: [
        {
          id: 1,
          category: "characters",
          sourceNames: ["강민수", "민수 형사"],
          englishNames: ["Kang Minsu", "Detective Minsu"],
          description: "Male; police officer; detective",
        },
      ],
      deletions: [{ id: 2, category: "characters" }],
    };

    const result = applyGlossaryDiff(glossary, diff);

    expect(result.map((entry) => entry.id)).toEqual([1, 3]);
    expect(result[0].sourceNames).toEqual(["강민수", "민수 형사"]);
    expect(result[1].category).toBe("places");
  });
});
