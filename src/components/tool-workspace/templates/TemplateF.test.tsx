import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  const statsOutput = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    totalWords: 201,
    uniqueWords: 1,
    items: [{ word: "word", count: 201 }],
    stats: {
      words: 201,
      characters: 1004,
      sentences: 3,
      paragraphs: 2,
      spaces: 200,
      readingLevel: { method: "ARI", grade: 3.9 },
      readingTime: { wordsPerMinute: 200, seconds: 61 },
      speakingTime: { wordsPerMinute: 130, seconds: 93 },
      ...overrides,
    },
  });

  it("groups all eight full-text metrics above the frequency table", async () => {
    renderTemplate({
      toolId: "word-frequency-counter",
      input: "Edited input has not been counted yet",
      outputState: "success",
      output: statsOutput(),
    });
    const overview = screen.getByRole("region", { name: "Text overview" });
    for (const [label, value] of [
      ["Words", "201"], ["Characters", (1004).toLocaleString()],
      ["Sentences", "3"], ["Paragraphs", "2"], ["Spaces", "200"],
      ["Reading level", "Grade 3.9"], ["Reading time", "1 min 1 sec"],
      ["Speaking time", "1 min 33 sec"],
    ]) {
      expect(within(overview).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(within(overview).getByText("Estimated at 200 words/min")).toBeInTheDocument();
    expect(within(overview).getByText("Estimated at 130 words/min")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Word frequencies" })).toBeInTheDocument();
    expect(screen.getByText("Showing: 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count again" })).toBeInTheDocument();
    const summary = within(overview).getByText("How these stats are calculated");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
  });

  it("shows zero durations and an unavailable level without inventing a grade", () => {
    renderTemplate({
      outputState: "success",
      output: statsOutput({
        words: 0,
        readingLevel: { method: "ARI", grade: null },
        readingTime: { wordsPerMinute: 200, seconds: 0 },
        speakingTime: { wordsPerMinute: 130, seconds: 0 },
      }),
    });
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("0 sec")).toHaveLength(2);
  });

  it("retains the frequency table when stored stats are malformed", () => {
    renderTemplate({ outputState: "success", output: statsOutput({ spaces: "invalid" }) });
    expect(screen.queryByRole("region", { name: "Text overview" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Word frequencies" })).toBeInTheDocument();
    expect(screen.getByText("Total words: 201")).toBeInTheDocument();
  });

  it.each(["loading", "error", "idle"] as const)("hides previous metrics while output is %s", (outputState) => {
    renderTemplate({ outputState, output: statsOutput() });
    expect(screen.queryByRole("region", { name: "Text overview" })).not.toBeInTheDocument();
  });

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
