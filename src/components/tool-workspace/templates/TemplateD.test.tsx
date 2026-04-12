import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateD } from "./TemplateD";
import type { TemplateProps } from "./types";

function renderTemplate(overrides: Partial<TemplateProps> = {}) {
  const props: TemplateProps = {
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
    buttons: [{ label: "Run", primary: true }],
    placeholder: "Paste text",
    mono: false,
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateD(props);
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

describe("TemplateD structured output rendering", () => {
  it("renders unix-time JSON as readable fields", () => {
    const output = JSON.stringify({
      seconds: 1700000000,
      milliseconds: 1700000000000,
      utcIso: "2023-11-14T22:13:20+00:00",
      localIso: "2023-11-15T05:13:20+07:00",
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("Unix seconds")).toBeInTheDocument();
    expect(screen.getByText("1700000000")).toBeInTheDocument();
    expect(screen.getByText("UTC")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });

  it("renders duplicate-word-finder JSON as a table", () => {
    const output = JSON.stringify({
      duplicates: [
        { word: "hello", count: 3 },
        { word: "world", count: 2 },
      ],
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("Duplicate words: 2")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Word" })).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });
});
