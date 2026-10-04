import { render, screen, within } from "@testing-library/react";
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

  it("omits backend headers and numbers real content from one", () => {
    renderTemplate({
      outputState: "success",
      output: "--- left\n+++ right\n  first\n- --- left\n+ +++ right\n  last",
    });
    const original = screen.getByRole("region", { name: "Original diff" });
    const modified = screen.getByRole("region", { name: "Modified diff" });
    expect(within(original).queryByText("-- left")).not.toBeInTheDocument();
    expect(within(modified).queryByText("++ right")).not.toBeInTheDocument();
    expect(within(original).getByText("first").previousSibling).toHaveTextContent("1");
    expect(within(modified).getByText("first").previousSibling).toHaveTextContent("1");
    expect(within(original).getByText("first")).toHaveTextContent(/^first$/);
    // Header-like text in the actual inputs must still be displayed.
    expect(original).toHaveTextContent("--- left");
    expect(modified).toHaveTextContent("+++ right");
    expect(within(original).getByText("last").previousSibling).toHaveTextContent("3");
  });

  it("renders two highlight levels and leaves shared words light", () => {
    renderTemplate({
      outputState: "success",
      output: '--- left\n+++ right\n- Instead of new math like a "Paxos for Capitalism," his fix is better-designed regulation.\n+ His fix isn\'t new math, a "Paxos for Capitalism," or deregulation, but better-designed regulation.',
    });
    const original = screen.getByRole("region", { name: "Original diff" });
    const modified = screen.getByRole("region", { name: "Modified diff" });
    expect(within(original).getByText("Instead of")).toHaveClass("bg-red-900/80");
    expect(within(original).getByText("his fix is")).toHaveClass("bg-red-900/80");
    expect(within(modified).getByText("His fix isn't")).toHaveClass("bg-green-900/80");
    expect(within(modified).getByText("or deregulation, but")).toHaveClass("bg-green-900/80");
    expect(within(original).getByText("new math")).not.toHaveClass("bg-red-900/80");
    expect(within(original).getByText("Instead of").parentElement?.parentElement)
      .toHaveClass("bg-red-950/40");
    expect(within(modified).getByText("His fix isn't").parentElement?.parentElement)
      .toHaveClass("bg-green-950/40");
  });

  it("preserves spacing in structured diffs and handles unpaired changes", () => {
    renderTemplate({
      outputState: "success",
      output: JSON.stringify([
        { type: "removed", text: "  before" },
        { type: "added", text: "  after" },
        { type: "added", text: "extra" },
      ]),
    });
    const original = screen.getByRole("region", { name: "Original diff" });
    const modified = screen.getByRole("region", { name: "Modified diff" });
    expect(within(original).getByText("before").parentElement?.textContent).toBe("  before");
    expect(within(modified).getByText("extra").previousSibling).toHaveTextContent("2");
    expect(within(original).queryByText("extra")).not.toBeInTheDocument();
  });
});
