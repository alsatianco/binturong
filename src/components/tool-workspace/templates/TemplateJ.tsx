import { OutputTextarea } from "../OutputTextarea";
import { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import type { TemplateProps } from "./types";
import { computeInlineSpans, type InlineSpan } from "./textDiff";

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";

type DiffLine = { type: "added" | "removed" | "unchanged"; text: string };
type SideBySideRow = {
  left: DiffLine | null;
  right: DiffLine | null;
  leftSpans?: InlineSpan[];
  rightSpans?: InlineSpan[];
};

function buildSideBySideRows(diffLines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let i = 0;
  while (i < diffLines.length) {
    const line = diffLines[i];
    if (line.type === "unchanged") {
      rows.push({ left: line, right: line });
      i++;
    } else if (line.type === "removed") {
      // Collect consecutive removed lines, then pair with consecutive added lines
      const removed: DiffLine[] = [];
      while (i < diffLines.length && diffLines[i].type === "removed") {
        removed.push(diffLines[i]);
        i++;
      }
      const added: DiffLine[] = [];
      while (i < diffLines.length && diffLines[i].type === "added") {
        added.push(diffLines[i]);
        i++;
      }
      const maxLen = Math.max(removed.length, added.length);
      for (let j = 0; j < maxLen; j++) {
        const leftLine = j < removed.length ? removed[j] : null;
        const rightLine = j < added.length ? added[j] : null;

        // Compute inline word/punctuation diff for paired lines
        let leftSpans: InlineSpan[] | undefined;
        let rightSpans: InlineSpan[] | undefined;
        if (leftLine && rightLine) {
          const { oldSpans, newSpans } = computeInlineSpans(leftLine.text, rightLine.text);
          leftSpans = oldSpans;
          rightSpans = newSpans;
        }

        rows.push({ left: leftLine, right: rightLine, leftSpans, rightSpans });
      }
    } else {
      // added without preceding removed
      rows.push({ left: null, right: line });
      i++;
    }
  }
  return rows;
}

/** Render changed phrases with a stronger background. */
function renderInlineSpans(
  spans: InlineSpan[],
  highlightClass: string,
): ReactNode {
  return spans.map((span, i) =>
    span.highlight ? (
      <span key={i} className={highlightClass}>
        {span.text}
      </span>
    ) : (
      <span key={i}>{span.text}</span>
    ),
  );
}

/**
 * Template J -- Dual-Input (1 tool: text-diff).
 *
 * Two side-by-side textareas for "Original" and "Modified" text.
 * A single "Compare" button triggers `onRun` with both texts serialized
 * as JSON in the input field. The output displays a side-by-side diff view
 * with scroll-locked left/right panels and word/punctuation inline highlighting.
 */
export function TemplateJ({
  input,
  onInputChange,
  output,
  outputState,
  outputError,
  onRun,
  onCopy,
  onClear,
  onDownload,
  buttons,
  placeholder,
  onPaste,
}: TemplateProps) {
  // Parse initial state from input if it's already JSON
  const parseInitialTexts = (): [string, string] => {
    if (!input) return ["", ""];
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed.left === "string" && typeof parsed.right === "string") {
        return [parsed.left, parsed.right];
      }
      if (parsed && typeof parsed.original === "string" && typeof parsed.modified === "string") {
        return [parsed.original, parsed.modified];
      }
    } catch {
      // Not JSON -- put the raw input in the original pane
      return [input, ""];
    }
    return ["", ""];
  };

  const [initialOriginal, initialModified] = parseInitialTexts();
  const [original, setOriginal] = useState(initialOriginal);
  const [modified, setModified] = useState(initialModified);

  // Refs for scroll-locked output panels
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<"left" | "right" | null>(null);

  const handleScroll = useCallback((source: "left" | "right") => {
    if (scrollingRef.current && scrollingRef.current !== source) return;
    scrollingRef.current = source;

    const sourceEl = source === "left" ? leftPanelRef.current : rightPanelRef.current;
    const targetEl = source === "left" ? rightPanelRef.current : leftPanelRef.current;
    if (sourceEl && targetEl) {
      targetEl.scrollTop = sourceEl.scrollTop;
      targetEl.scrollLeft = sourceEl.scrollLeft;
    }

    requestAnimationFrame(() => {
      scrollingRef.current = null;
    });
  }, []);

  const syncInput = useCallback(
    (orig: string, mod: string) => {
      const json = JSON.stringify({ left: orig, right: mod });
      onInputChange(json);
    },
    [onInputChange],
  );

  const handleOriginalChange = useCallback(
    (value: string) => {
      setOriginal(value);
      syncInput(value, modified);
    },
    [modified, syncInput],
  );

  const handleModifiedChange = useCallback(
    (value: string) => {
      setModified(value);
      syncInput(original, value);
    },
    [original, syncInput],
  );

  const handlePasteOriginal = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (onPaste) {
        const text = e.clipboardData.getData("text/plain");
        if (text) onPaste(text);
      }
    },
    [onPaste],
  );

  const handleSwap = useCallback(() => {
    const newOriginal = modified;
    const newModified = original;
    setOriginal(newOriginal);
    setModified(newModified);
    syncInput(newOriginal, newModified);
  }, [original, modified, syncInput]);

  const handleCompare = useCallback(() => {
    const json = JSON.stringify({ left: original, right: modified });
    onRun({ inputOverride: json });
  }, [original, modified, onRun]);

  // Parse and compute only when the comparison result changes.
  const sideBySideRows = useMemo(() => {
    if (outputState !== "success" || !output) return null;

    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return buildSideBySideRows(parsed as DiffLine[]);
      }
    } catch {
      // Plain text output uses +/- prefixes instead of structured diff JSON.
    }

    const lines = output.split("\n");
    // File labels belong to the exported diff, not to the numbered text panes.
    const hasFileHeaders = lines[0] === "--- left" && lines[1] === "+++ right";
    const contentLines = hasFileHeaders ? lines.slice(2) : lines;
    const diffLines = contentLines.map((line): DiffLine => {
      // The backend adds a separator space; retain any input indentation after it.
      const text = line.slice(hasFileHeaders && line[1] === " " ? 2 : 1);
      if (line.startsWith("+")) return { type: "added", text };
      if (line.startsWith("-")) return { type: "removed", text };
      if (line.startsWith(" ")) return { type: "unchanged", text };
      return { type: "unchanged", text: line };
    });
    return buildSideBySideRows(diffLines);
  }, [output, outputState]);

  // Compute line numbers for each side
  const leftLineNumbers: (number | null)[] = [];
  const rightLineNumbers: (number | null)[] = [];
  if (sideBySideRows) {
    let leftNum = 0;
    let rightNum = 0;
    for (const row of sideBySideRows) {
      if (row.left) {
        leftNum++;
        leftLineNumbers.push(leftNum);
      } else {
        leftLineNumbers.push(null);
      }
      if (row.right) {
        rightNum++;
        rightLineNumbers.push(rightNum);
      } else {
        rightLineNumbers.push(null);
      }
    }
  }

  const inputArea = (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Original text */}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Original
        </label>
        <textarea
          aria-label="Original text"
          className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
          rows={12}
          value={original}
          onChange={(e) => handleOriginalChange(e.target.value)}
          onPaste={handlePasteOriginal}
          placeholder={placeholder ?? "Paste original text here..."}
          spellCheck={false}
        />
      </div>

      {/* Modified text */}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Modified
        </label>
        <textarea
          aria-label="Modified text"
          className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
          rows={12}
          value={modified}
          onChange={(e) => handleModifiedChange(e.target.value)}
          placeholder="Paste modified text here..."
          spellCheck={false}
        />
      </div>
    </div>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btnPrimary} onClick={handleCompare}>
        {buttons[0]?.label ?? "Compare"}
      </button>
      <button className={btnBase} onClick={handleSwap} title="Swap original and modified">
        Swap
      </button>
    </div>
  );

  const renderDiffPanel = (
    side: "left" | "right",
    rows: SideBySideRow[],
    lineNums: (number | null)[],
    ref: React.RefObject<HTMLDivElement | null>,
  ) => (
    <div
      ref={ref}
      role="region"
      aria-label={side === "left" ? "Original diff" : "Modified diff"}
      className="max-h-[500px] overflow-auto rounded border border-slate-700 bg-slate-950"
      onScroll={() => handleScroll(side)}
    >
      <div className="min-w-0">
        {rows.map((row, i) => {
          const cell = side === "left" ? row.left : row.right;
          const spans = side === "left" ? row.leftSpans : row.rightSpans;
          const lineNum = lineNums[i];

          let bgClass = "";
          let textClass = "text-slate-300";
          let inlineHighlightClass = "";

          if (!cell) {
            bgClass = "bg-slate-900/50";
          } else if (cell.type === "removed") {
            bgClass = "bg-red-950/40";
            textClass = "text-red-300";
            inlineHighlightClass = "bg-red-900/80 rounded-sm";
          } else if (cell.type === "added") {
            bgClass = "bg-green-950/40";
            textClass = "text-green-300";
            inlineHighlightClass = "bg-green-900/80 rounded-sm";
          }

          return (
            <div
              key={i}
              className={`flex border-b border-slate-800/50 ${bgClass}`}
            >
              <span className="w-10 shrink-0 select-none border-r border-slate-800/50 px-2 py-0.5 text-right font-mono text-xs text-slate-600">
                {lineNum ?? ""}
              </span>
              <span
                className={`min-w-0 flex-1 whitespace-pre-wrap break-all px-2 py-0.5 font-mono text-xs ${textClass}`}
              >
                {cell
                  ? spans
                    ? renderInlineSpans(spans, inlineHighlightClass)
                    : cell.text
                  : "\u00A0"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const outputArea = (
    <div className="space-y-2">
      {outputState === "loading" && (
        <div className="py-4 text-center text-sm text-slate-400">
          Comparing...
        </div>
      )}

      {outputState === "error" && (
        <div className="rounded border border-red-700/50 bg-red-950/30 px-3 py-2 font-mono text-sm text-red-400">
          {outputError}
        </div>
      )}

      {outputState === "success" && sideBySideRows && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-red-400/80">
              Original
            </label>
            {renderDiffPanel("left", sideBySideRows, leftLineNumbers, leftPanelRef)}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-green-400/80">
              Modified
            </label>
            {renderDiffPanel("right", sideBySideRows, rightLineNumbers, rightPanelRef)}
          </div>
        </div>
      )}

      {outputState === "success" && !sideBySideRows && output && (
        <OutputTextarea
          aria-label="Diff output"
          className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none"
          rows={12}
          value={output}
          spellCheck={false}
        />
      )}

      {outputState === "idle" && (
        <div className="rounded border border-slate-700/50 bg-slate-950/30 py-8 text-center text-sm text-slate-500">
          Diff output will appear here
        </div>
      )}

      <div className="flex gap-2">
        <button className={btnBase} onClick={onCopy} disabled={outputState !== "success"}>
          Copy
        </button>
        <button className={btnBase} onClick={onDownload} disabled={outputState !== "success"}>
          Download
        </button>
        <button className={btnBase} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
