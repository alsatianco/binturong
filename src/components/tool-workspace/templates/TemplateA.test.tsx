import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateA } from "./TemplateA";
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
    buttons: [
      { label: "Format", mode: "format", primary: true },
      { label: "Minify", mode: "minify" },
    ],
    placeholder: "Paste JSON here...",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateA(props);
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

describe("TemplateA Format/Minify", () => {
  it("renders textarea with placeholder", () => {
    renderTemplate({ placeholder: "Paste JSON here..." });

    expect(screen.getByPlaceholderText("Paste JSON here...")).toBeInTheDocument();
  });

  it("renders Format and Minify buttons", () => {
    renderTemplate();

    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByText("Minify")).toBeInTheDocument();
  });
});
