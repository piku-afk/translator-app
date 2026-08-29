// @vitest-environment happy-dom
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNovel } from "#/lib/novels/novels";
import { type Novel } from "#/lib/novels/novels-core";
import { NewNovelModal } from "./new-novel-modal";

const { show } = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock("@mantine/notifications", () => ({
  notifications: { show },
}));

vi.mock("#/lib/novels/novels", () => ({
  createNovel: vi.fn(),
  novelsQueryKey: ["novels"],
}));

function renderModal() {
  const onClose = vi.fn();
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <NewNovelModal onClose={onClose} />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return { onClose };
}

async function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Novel name"), {
    target: { value: "The Beginning" },
  });
  fireEvent.change(screen.getByLabelText("Total chapters"), {
    target: { value: "12" },
  });

  // Select "Korean" from the source-language dropdown.
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "Korean" }));

  // Mantine's FileInput renders the real <input type="file"> as a hidden
  // sibling of the labelled button, so it has no accessible name of its own.
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).toBeTruthy();
  fireEvent.change(fileInput!, {
    target: { files: [new File(["1화.\n첫 문장입니다."], "raw.txt", { type: "text/plain" })] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("NewNovelModal", () => {
  it("renders all form fields and the modal title", () => {
    renderModal();

    expect(screen.getByText("New Novel")).toBeTruthy();
    expect(screen.getByLabelText("Novel name")).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByLabelText("Total chapters")).toBeTruthy();
    expect(screen.getByLabelText("Raw text file")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create novel" })).toBeTruthy();
  });

  it("submits the raw text and shows a top-center toast on success", async () => {
    const novel: Novel = {
      id: 1,
      name: "The Beginning",
      slug: "the-beginning",
      status: "draft",
      source_language: "ko",
      total_chapters: 12,
      created_at: "2026-08-29T00:00:00.000Z",
      updated_at: "2026-08-29T00:00:00.000Z",
      last_error: null,
    };
    vi.mocked(createNovel).mockResolvedValue(novel);
    const { onClose } = renderModal();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create novel" }));

    await waitFor(() => {
      expect(vi.mocked(createNovel).mock.calls[0][0]).toEqual(
        expect.objectContaining({
          data: {
            name: "The Beginning",
            total_chapters: 12,
            source_language: "ko",
            raw_text: "1화.\n첫 문장입니다.",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Novel created",
          message: '"The Beginning" is ready',
          position: "top-center",
        }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks submission and shows validation errors when fields are empty", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Create novel" }));

    expect(await screen.findByText("Novel name is required")).toBeTruthy();
    expect(screen.getByText("Select a source language")).toBeTruthy();
    expect(screen.getByText("Raw text file is required")).toBeTruthy();
    expect(createNovel).not.toHaveBeenCalled();
  });

  it("shows an alert and keeps the modal open when creation fails", async () => {
    vi.mocked(createNovel).mockRejectedValue(new Error("Network down"));
    const { onClose } = renderModal();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create novel" }));

    expect(await screen.findByText("Could not create novel")).toBeTruthy();
    expect(screen.getByText("Network down")).toBeTruthy();
    expect(screen.getByText("New Novel")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes the modal when Cancel is clicked", () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
