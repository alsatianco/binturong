import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateF, type TemplateFProps } from "./TemplateF";

function renderTemplate(overrides: Partial<TemplateFProps> = {}) {
  const props: TemplateFProps = {
    input: "",
    onInputChange: vi.fn(),
    output: "",
    outputState: "idle",
    outputError: "",
    onRun: vi.fn(),
    onCopy: vi.fn(),
    onClear: vi.fn(),
    onDownload: vi.fn(),
    formatMode: "format",
    indentSize: 2,
    buttons: [{ label: "Count", primary: true }],
    placeholder: "Paste text to analyze",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateF(props);
    return (
      <div>
        {slots.inputArea}
        {slots.actionButtons}
        {slots.outputArea}
      </div>
    );
  }

  return render(<Harness />);
}

describe("TemplateF word-frequency rendering", () => {
  it("renders structured word-frequency output as a user-friendly table", () => {
    const output = JSON.stringify(
      {
        totalWords: 8,
        uniqueWords: 3,
        items: [
          { word: "hello", count: 4 },
          { word: "world", count: 3 },
          { word: "test", count: 1 },
        ],
      },
      null,
      2,
    );

    renderTemplate({
      outputState: "success",
      output,
    });

    expect(screen.getByText("Total words: 8")).toBeInTheDocument();
    expect(screen.getByText("Unique words: 3")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Word" })).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });

  it("falls back to raw textarea for non-word-frequency output", () => {
    const output = "{\"characters\":12,\"words\":2}";

    renderTemplate({
      outputState: "success",
      output,
    });

    expect(screen.getByDisplayValue(output)).toBeInTheDocument();
  });

  it("renders sentence-counter output as readable metric cards", () => {
    const output = JSON.stringify(
      {
        characters: 120,
        charactersNoSpaces: 99,
        words: 20,
        sentences: 3,
        paragraphs: 2,
        readingTime: {
          minutesAt200Wpm: 0.1,
          secondsAt200Wpm: 6,
        },
      },
      null,
      2,
    );

    renderTemplate({
      outputState: "success",
      output,
    });

    expect(screen.getByText("Characters")).toBeInTheDocument();
    expect(screen.getByText("No spaces")).toBeInTheDocument();
    expect(screen.getByText("Reading time")).toBeInTheDocument();
    expect(screen.getByText("0.10 min")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });
});
