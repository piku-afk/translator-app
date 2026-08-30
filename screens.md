# Screens / ASCII mockups

Working notes for UI design. ASCII-only.

> **Status:** the glossary section below is *implemented* (`src/components/novel/glossary-section.tsx`, wired into `$slug.tsx`, backed by a new `listGlossary` service method + `getGlossary` server fn + `glossaryQueryKey`).

---

## Novel detail — glossary section (draft proposal)

The glossary sits on the novel details page as its own section (`/app/novels/<slug>`),
below **Overview** and **Actions**. It lists every entity in the per-novel glossary,
grouped by category via tabs.

Data facts: each entry has `category` (characters | places | misc), `sourceNames[]`
(`;`-joined `source_names`), `englishNames[]` (`;`-joined `english_names`), and a
one-line `description`. The glossary is empty until extraction runs.

```
┌─ novel: Tower of God ...............................................
│   ← Home
│
│   Tower of God                              [ Korean → English ]
│   ⋅ 150 declared chapters ⋅ Added 12 Mar 2026
│
├──────────────────────────────────────────────────────────────────────
│   Overview                                   Status  [ names extracted ]
│                                             Chapters  150 / 150
│                                             Last action  Names extracted ...
│                                             Source file novels/tower-of-god/raw.txt
│                                             Size 2.5 MB
│
├──────────────────────────────────────────────────────────────────────
│   Actions                     [ Start extraction ]  [ Download raw file (disabled) ]
│
├──────────────────────────────────────────────────────────────────────
│   Glossary               150 entries · [1?]
│
│   ╭──────────────╥───────────────────────────────╮
│   │ [ Characters ] │ ( Places )  ( Misc )        │  ← category tabs, counts in parens
│   ╰──────────────╨───────────────────────────────╯
│
│   Characters · 98                                    ← section count
│
│   ┌─────────────────────────────────────────────────────────┐
│   │ 강민수 · 민수 형사          Kang Minsu · Detective Minsu │
│   │                                                          │
│   │ Male; police officer; protects the survivors; revolver   │
│   └─────────────────────────────────────────────────────────┘
│   ┌─────────────────────────────────────────────────────────┐
│   │ 권총                        Revolver                     │
│   │                                                          │
│   │ Firearm; carries a revolver; backup sidearm              │
│   └─────────────────────────────────────────────────────────┘
│   …                                                          │
│
│  ────────────────────────────────────────────────────────────
│   ▲ ▼                                                       │
└─────────────────────────────────────────────────────────────
```

### Alternative look (single flat list, no tabs)

```
│   Glossary                                         98 entries
│   ┌─────────────────────────────────────────────────────────┐
│   │ [C] 강민수 · 민수 형사     Kang Minsu · Detective Minsu │
│   │     Male; police officer; protects the survivors        │
│   └─────────────────────────────────────────────────────────┘
│   ┌─────────────────────────────────────────────────────────┐
│   │ [P] 서울중앙병원           Seoul Central Hospital        │
│   │     Abandoned hospital; used as shelter                  │
│   └─────────────────────────────────────────────────────────┘
```

### Empty / pre-extraction state

Uses Mantine's `EmptyState` (icon `NotebookText`), with an actionable
**Start extraction** button in `EmptyState.Actions` when `ready` / `extraction failed`.

```
│   Glossary
│      ◇ NotebookText                              ← EmptyState indicator
│   No glossary yet
│   The glossary for this novel is empty. Run extraction to build it
│   from its chapters.
│   [ 📓 Start extraction ]                        ← only when canStartExtraction
```

### No search results

Uses Mantine's `EmptyState` (icon `Search`).

```
│   [ 🔍 Search names…  ||                   ]
│   ( Characters · 98 )  [ Places · 42 ]  ( Misc · 10 )
│   0 results for "권총"
│      ◇ Search
│   No matching names
│   No glossary names match "권총". Try a different search.
```
