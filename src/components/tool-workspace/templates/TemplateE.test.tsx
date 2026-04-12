import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateE } from "./TemplateE";
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
    buttons: [{ label: "Convert", primary: true }],
    placeholder: "Type text",
    mono: false,
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateE(props);
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

describe("TemplateE unicode output rendering", () => {
  it("renders unicode-text-converter JSON in a readable layout", () => {
    const output = JSON.stringify({
      text: "A🙂",
      codePoints: ["U+0041", "U+1F642"],
      hexScalars: "41 1F642",
      jsonEscaped: "\"A🙂\"",
      rustEscaped: "\\u{41}\\u{1F642}",
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("Code points")).toBeInTheDocument();
    expect(screen.getByText("U+0041 U+1F642")).toBeInTheDocument();
    expect(screen.getByText("Rust escaped")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });
});
