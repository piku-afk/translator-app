// @vitest-environment happy-dom
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NovelStatus } from "#/lib/novels/novels-core";
import { LifecycleStepper } from "./lifecycle-stepper";

vi.mock("#/lib/novels/novels", () => ({
  getNovelActivityQueryOptions: (slug: string) => ({
    queryKey: ["novels", slug, "activity"],
    queryFn: async () => [],
  }),
}));

function renderStepper({ status }: { status: NovelStatus }) {
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <LifecycleStepper
          slug="the-midnight-archive"
          status={status}
          updatedAt="2026-09-01T15:00:00.000Z"
          chapterCount={30}
          totalChapters={30}
          glossarySize={15}
          namesExtractedChapterCount={30}
          translatedChapterCount={12}
          lastError="Rate limited; retries exhausted."
          isParsing={false}
          isExtracting={false}
          isTranslating={false}
          startParsingError={null}
          startExtractionError={null}
          startTranslationError={null}
          onStartParsing={() => {}}
          onStartExtraction={() => {}}
          onStartTranslation={() => {}}
        />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("LifecycleStepper", () => {
  it("renders the four coarse steps as a status indicator", () => {
    renderStepper({ status: "draft" });

    expect(screen.getByText("Parse chapters")).toBeTruthy();
    expect(screen.getByText("Extract names")).toBeTruthy();
    expect(screen.getByText("Translate")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("places the start action on the current step and shows detail lines", () => {
    renderStepper({ status: "names extracted" });

    // The Translate step is current, so its action lives here.
    expect(screen.getByRole("button", { name: "Start translation" })).toBeTruthy();

    // Per-step detail counts from existing queries.
    expect(screen.getByText("30 chapters found")).toBeTruthy();
    expect(screen.getByText("15 names extracted")).toBeTruthy();
    expect(screen.getByText("12 / 30 chapters")).toBeTruthy();
  });

  it("suppresses the action and shows progress while a job runs", () => {
    renderStepper({ status: "translating" });

    expect(screen.getByText("Translation is in progress.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start translation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Re-run translation" })).toBeNull();
  });

  it("renders a failure alert on the affected step with its re-run action", () => {
    renderStepper({ status: "extraction failed" });

    expect(screen.getByText("Extraction failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Re-run extraction" })).toBeTruthy();
  });
});