import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Group, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { ArrowRight, NotebookText, Search } from "lucide-react";
import { getGlossaryQueryOptions } from "#/lib/novels/novels";
import type { Glossary, GlossaryCategory, GlossaryEntry } from "#/lib/translator/glossary";

const CATEGORY_ORDER: GlossaryCategory[] = ["characters", "places", "misc"];

const CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  characters: "Characters",
  places: "Places",
  misc: "Misc",
};

export const FUSE_THRESHOLD = 0.3;

interface GlossarySectionProps {
  slug: string;
  /** True while extraction runs; drives the live-polling cadence. */
  isExtracting: boolean;
  /** Whether the operator can start (or re-run) extraction right now. */
  canStartExtraction?: boolean;
  /** Label for the start-extraction action, mirroring the Actions section. */
  startExtractionLabel?: string;
  /** Invoked when the operator clicks the start-extraction action. */
  onStartExtraction?: () => void;
}

function EntryCard({ entry }: { entry: GlossaryEntry }) {
  return (
    <Stack className="gap-1.5 rounded-lg border border-border bg-card p-4">
      <Group justify="space-between" align="center" wrap="nowrap" className="gap-4">
        <Text className="truncate font-mono text-sm">{entry.sourceNames.join(" · ")}</Text>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Text className="shrink-0 font-medium">{entry.englishNames.join(" · ")}</Text>
      </Group>
      {entry.description && (
        <Text c="dimmed" className="text-sm">
          {entry.description}
        </Text>
      )}
    </Stack>
  );
}

/** A per-category entry with a flattened searchable text field for Fuse.js. */
interface SearchableEntry extends GlossaryEntry {
  _search: string;
}

export function GlossarySection({
  slug,
  isExtracting,
  canStartExtraction = false,
  startExtractionLabel = "Start extraction",
  onStartExtraction,
}: GlossarySectionProps) {
  const { data } = useQuery({
    ...getGlossaryQueryOptions(slug),
    // Grow in place while extraction runs, mirroring the detail query's cadence.
    refetchInterval: isExtracting ? 3000 : false,
  });

  const entries = data ?? ([] as Glossary);

  const byCategory = useMemo(() => {
    const grouped: Record<GlossaryCategory, GlossaryEntry[]> = {
      characters: [],
      places: [],
      misc: [],
    };
    for (const entry of entries) {
      grouped[entry.category].push(entry);
    }
    return grouped;
  }, [entries]);

  const tabs = CATEGORY_ORDER.filter((category) => byCategory[category].length > 0);

  const [activeTab, setActiveTab] = useState<GlossaryCategory>("characters");
  const [query, setQuery] = useState("");

  // Clamp the active tab to a category that has entries once data arrives (the
  // initial value is a placeholder before the query resolves).
  useEffect(() => {
    if (byCategory[activeTab].length === 0 && tabs.length > 0) {
      setActiveTab(tabs[0]);
    }
  }, [byCategory, activeTab, tabs]);

  const activeEntries = byCategory[activeTab];

  const searchable: SearchableEntry[] = useMemo(
    () =>
      activeEntries.map((entry) => ({
        ...entry,
        _search: [...entry.sourceNames, ...entry.englishNames].join(" "),
      })),
    [activeEntries],
  );

  // Client-side filter over the active category, using the same Fuse relevance
  // settings as the glossary filtering in the extraction pipeline (threshold
  // 0.3, ignoreLocation) so the display search matches how names are merged.
  const fuse = useMemo(
    () =>
      new Fuse<SearchableEntry>(searchable, {
        keys: ["_search"],
        threshold: FUSE_THRESHOLD,
        ignoreLocation: true,
      }),
    [searchable],
  );

  const trimmedQuery = query.trim();
  const visible = trimmedQuery
    ? fuse.search(trimmedQuery).map((result) => result.item as GlossaryEntry)
    : activeEntries;

  if (entries.length === 0) {
    return (
      <EmptyState
        classNames={{ title: "text-base font-medium" }}
        icon={<NotebookText className="size-8" aria-hidden />}
        title="No glossary yet"
        description="The glossary for this novel is empty. Run extraction to build it from its chapters."
      >
        {canStartExtraction && (
          <EmptyState.Actions>
            <Button variant="default" loading={isExtracting} onClick={onStartExtraction}>
              {startExtractionLabel}
            </Button>
          </EmptyState.Actions>
        )}
      </EmptyState>
    );
  }

  return (
    <Stack className="gap-3">
      <TextInput
        aria-label="Search glossary names"
        placeholder="Search names…"
        leftSection={<Search className="size-4" aria-hidden />}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      <Tabs
        value={activeTab}
        onChange={(value) => value !== null && setActiveTab(value as GlossaryCategory)}
      >
        <Tabs.List>
          {tabs.map((category) => (
            <Tabs.Tab key={category} value={category}>
              {CATEGORY_LABELS[category]}{" "}
              <Text component="span" c="dimmed">
                · {byCategory[category].length}
              </Text>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {trimmedQuery && (
        <Text c="dimmed" className="text-sm">
          {visible.length} result{visible.length === 1 ? "" : "s"} for “{trimmedQuery}”
        </Text>
      )}
      {visible.length === 0 ? (
        <EmptyState
          classNames={{ title: "text-base font-medium" }}
          icon={<Search className="size-6" aria-hidden />}
          title="No matching names"
          description={
            trimmedQuery
              ? `No glossary names match “${trimmedQuery}”. Try a different search.`
              : "This category has no glossary entries yet."
          }
        />
      ) : (
        visible.map((entry) => <EntryCard key={entry.id} entry={entry} />)
      )}
    </Stack>
  );
}
