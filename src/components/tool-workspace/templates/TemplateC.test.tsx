import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateC } from "./TemplateC";
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
    placeholder: "Paste text to convert...",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateC(props);
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

describe("TemplateC One-Way Converter", () => {
  it("renders textarea with placeholder", () => {
    renderTemplate({ placeholder: "Paste text to convert..." });

    expect(screen.getByPlaceholderText("Paste text to convert...")).toBeInTheDocument();
  });

  it("renders single convert button from buttons config", () => {
    renderTemplate({ buttons: [{ label: "Convert to Markdown", primary: true }] });

    expect(screen.getByText("Convert to Markdown")).toBeInTheDocument();
  });
});
