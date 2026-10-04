import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutputTextarea } from "./OutputTextarea";

const lines = (count: number) => Array.from({ length: count }, (_, i) => `Line ${i + 1}`).join("\n");
const style = {
  boxSizing: "border-box" as const,
  lineHeight: "20px",
  fontSize: "14px",
  padding: "8px 12px",
  border: "1px solid black",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockLayout(initialLines: number) {
  let renderedLines = initialLines;
  let width = 300;
  let notifyResize = () => {};
  const disconnect = vi.fn();
  vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(() => renderedLines * 20 + 16);
  vi.spyOn(HTMLTextAreaElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLTextAreaElement) {
    return { width, height: parseFloat(this.style.height) || 0 } as DOMRect;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { notifyResize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  return {
    setRenderedLines: (count: number) => { renderedLines = count; },
    setWidth: (next: number) => { width = next; },
    notifyResize: () => act(() => notifyResize()),
    disconnect,
  };
}

describe("OutputTextarea", () => {
  it("fits explicit lines and caps native rows at 45 when layout is unavailable", () => {
    const { rerender } = render(<OutputTextarea aria-label="Output" value={lines(20)} />);
    const output = screen.getByRole("textbox");
    expect(output).toHaveAttribute("rows", "20");
    expect(output).toHaveAttribute("readonly");
    expect(output).toHaveStyle({ resize: "vertical", overflowY: "auto" });

    rerender(<OutputTextarea aria-label="Output" value={lines(46)} />);
    expect(output).toHaveAttribute("rows", "45");
    expect(output).toHaveValue(lines(46));
  });

  it("fits soft-wrapped lines and shrinks again for a shorter result", () => {
    const layout = mockLayout(12);
    const { rerender } = render(<OutputTextarea value="A single long line that wraps" style={style} />);
    const output = screen.getByRole("textbox");
    expect(output).toHaveStyle({ height: "258px" });

    layout.setRenderedLines(2);
    rerender(<OutputTextarea value="Shorter output" style={style} />);
    expect(output).toHaveStyle({ height: "58px" });
    expect(output.style.width).toBe("");
  });

  it("allows exactly 45 visible lines and scrolls longer results without imposing a manual maximum", () => {
    const layout = mockLayout(45);
    const { rerender } = render(<OutputTextarea value={lines(45)} style={style} />);
    const output = screen.getByRole("textbox");
    expect(output).toHaveStyle({ height: "918px" });

    layout.setRenderedLines(100);
    rerender(<OutputTextarea value={lines(100)} style={style} />);
    expect(output).toHaveStyle({ height: "918px", overflowY: "auto" });
    expect(output.style.maxHeight).toBe("");
  });

  it("remeasures wrapping when the workspace width changes", () => {
    const layout = mockLayout(10);
    render(<OutputTextarea value="Wrapped output" style={style} />);
    const output = screen.getByRole("textbox");
    expect(output).toHaveStyle({ height: "218px" });

    layout.setWidth(200);
    layout.setRenderedLines(20);
    layout.notifyResize();
    expect(output).toHaveStyle({ height: "418px" });
    layout.notifyResize(); // Its own height change must not become a manual preference.
    layout.setWidth(300);
    layout.setRenderedLines(10);
    layout.notifyResize();
    expect(output).toHaveStyle({ height: "218px" });
  });

  it.each(["100px", "1200px"])("preserves a manually chosen height of %s across results", (height) => {
    const layout = mockLayout(50);
    const { rerender, unmount } = render(<OutputTextarea value={lines(50)} style={style} />);
    const output = screen.getByRole("textbox");
    output.style.height = height;
    layout.notifyResize();

    layout.setRenderedLines(2);
    rerender(<OutputTextarea value="New result" style={style} />);
    expect(output).toHaveStyle({ height });
    expect(output.style.width).toBe("");
    unmount();
    expect(layout.disconnect).toHaveBeenCalled();
  });
});
