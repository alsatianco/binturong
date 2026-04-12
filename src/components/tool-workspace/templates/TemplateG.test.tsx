import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateG } from "./TemplateG";
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
    buttons: [{ label: "Inspect", primary: true }],
    placeholder: "Paste text",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateG(props);
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

describe("TemplateG structured array rendering", () => {
  it("renders arrays of objects as a table", () => {
    const output = JSON.stringify({
      codePoints: [
        { index: 0, char: "A", codePoint: "U+0041", utf8Hex: "41" },
        { index: 1, char: "B", codePoint: "U+0042", utf8Hex: "42" },
      ],
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("Code Points")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "index" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "char" })).toBeInTheDocument();
  });
});
