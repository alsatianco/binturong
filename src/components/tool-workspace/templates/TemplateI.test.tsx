import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateI } from "./TemplateI";
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
    buttons: [],
    placeholder: "Type or paste HTML here...",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateI(props);
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

describe("TemplateI Live Preview", () => {
  it("renders textarea input", () => {
    renderTemplate({ placeholder: "Type or paste HTML here..." });

    expect(screen.getByPlaceholderText("Type or paste HTML here...")).toBeInTheDocument();
  });

  it("renders preview output area", () => {
    renderTemplate();

    expect(screen.getByTitle("Live preview")).toBeInTheDocument();
  });
});
