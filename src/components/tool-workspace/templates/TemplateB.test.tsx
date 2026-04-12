import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateB } from "./TemplateB";
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
      { label: "Generate", mode: "format", primary: true },
      { label: "Decode", mode: "minify" },
    ],
    directionLabels: ["Generate", "Decode"],
    placeholder: "Paste UUID or ULID",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateB(props);
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

describe("TemplateB UUID/ULID output rendering", () => {
  it("renders UUID decode JSON as key-value rows", () => {
    const output = JSON.stringify({
      type: "uuid",
      value: "550e8400-e29b-41d4-a716-446655440000",
      version: 4,
      variant: "RFC4122",
      simple: "550e8400e29b41d4a716446655440000",
      bytesHex: "550E8400E29B41D4A716446655440000",
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("type")).toBeInTheDocument();
    expect(screen.getByText("uuid")).toBeInTheDocument();
    expect(screen.getByText("bytesHex")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });
});
