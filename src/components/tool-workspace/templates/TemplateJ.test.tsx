import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateJ } from "./TemplateJ";
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
    buttons: [{ label: "Compare", primary: true }],
    placeholder: "Paste original text here...",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateJ(props);
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

describe("TemplateJ Dual-Input Comparison", () => {
  it("renders two textareas", () => {
    renderTemplate();

    expect(screen.getByPlaceholderText("Paste original text here...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste modified text here...")).toBeInTheDocument();
  });

  it("renders compare button", () => {
    renderTemplate();

    expect(screen.getByText("Compare")).toBeInTheDocument();
  });
});
