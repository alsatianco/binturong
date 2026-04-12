import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateK, type TemplateKProps } from "./TemplateK";

const regexFields: NonNullable<TemplateKProps["multiFields"]> = [
  { key: "pattern", label: "Pattern", type: "text" },
  { key: "text", label: "Test Text", type: "textarea" },
  { key: "flags", label: "Flags", type: "checkboxes", options: ["g", "i", "m"] },
  { key: "replace", label: "Replace With", type: "text" },
];

function renderTemplate(overrides: Partial<TemplateKProps> = {}) {
  const props: TemplateKProps = {
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
    buttons: [{ label: "Test", primary: true }],
    multiFields: regexFields,
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateK(props);
    return (
      <div>
        {slots.inputArea}
        {slots.actionButtons}
        {slots.outputArea}
      </div>
    );
  }

  const rendered = render(<Harness />);
  return { ...rendered, props };
}

describe("TemplateK regex renderer", () => {
  it("renders regex match objects using Rust response keys and highlights matched text", () => {
    const output = JSON.stringify(
      {
        matches: [
          { matched: "42", start: 3, end: 5, groups: [] },
          { matched: "77", start: 11, end: 13, groups: [] },
        ],
        replacedText: "id=# code=#",
      },
      null,
      2,
    );

    const { container } = renderTemplate({
      input: JSON.stringify({
        pattern: "\\d+",
        text: "id=42 code=77",
        flags: "g",
        replace: "#",
      }),
      outputState: "success",
      output,
    });

    expect(screen.getByText("2 matches")).toBeInTheDocument();
    expect(screen.getByText("[3, 5)")).toBeInTheDocument();
    expect(screen.getByText("[11, 13)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("id=# code=#")).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();

    const highlights = container.querySelectorAll(".bg-amber-500\\/25");
    expect(highlights.length).toBe(2);
    expect(highlights[0].textContent).toBe("42");
    expect(highlights[1].textContent).toBe("77");
  });

  it("keeps flags checkbox state in sync and serializes flags as a string", async () => {
    const onInputChange = vi.fn();
    const onRun = vi.fn();

    renderTemplate({
      input: JSON.stringify({
        pattern: "\\d+",
        text: "id=42 code=77",
        flags: "g",
      }),
      onInputChange,
      onRun,
    });

    const globalFlag = screen.getByRole("checkbox", { name: "g" });
    const caseInsensitiveFlag = screen.getByRole("checkbox", { name: "i" });
    expect(globalFlag).toBeChecked();
    expect(caseInsensitiveFlag).not.toBeChecked();

    fireEvent.click(caseInsensitiveFlag);
    fireEvent.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(onRun).toHaveBeenCalled();
    });

    // The payload is now passed via inputOverride, not onInputChange
    const lastRunCall = onRun.mock.calls[onRun.mock.calls.length - 1];
    const runOptions = lastRunCall?.[0] as { inputOverride?: string } | undefined;
    expect(runOptions?.inputOverride).toBeDefined();
    const parsed = JSON.parse(runOptions!.inputOverride!) as {
      flags?: string;
    };
    expect(parsed.flags).toBe("gi");
  });
});
