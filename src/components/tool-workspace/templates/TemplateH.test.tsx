import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateH } from "./TemplateH";
import type { TemplateHProps } from "./TemplateH";

function renderTemplate(overrides: Partial<TemplateHProps> = {}) {
  const props: TemplateHProps = {
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
    buttons: [{ label: "Extract Text", primary: true }],
    outputIsText: true,
    ...overrides,
  };

  function Harness() {
    const slots = TemplateH(props);
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

describe("TemplateH OCR output rendering", () => {
  it("renders OCR JSON output with metadata and extracted text", () => {
    const output = JSON.stringify({
      language: "eng",
      downloadedLanguages: ["vie"],
      text: "Hello OCR",
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("Language: eng")).toBeInTheDocument();
    expect(screen.getByText("Downloaded: vie")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hello OCR")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });
});
