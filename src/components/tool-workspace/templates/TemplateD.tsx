import { useMemo, useState } from "react";
import type { TemplateProps } from "./types";

type UnixTimeOutputView = {
  seconds: number;
  milliseconds: number;
  utcIso: string;
  localIso: string;
};

type DuplicateWordView = {
  word: string;
  count: number;
};

type DuplicateWordOutputView = {
  duplicates: DuplicateWordView[];
};

function parseUnixTimeOutput(output: string): UnixTimeOutputView | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.seconds !== "number" ||
      typeof obj.milliseconds !== "number" ||
      typeof obj.utcIso !== "string" ||
      typeof obj.localIso !== "string"
    ) {
      return null;
    }
    return {
      seconds: Math.trunc(obj.seconds),
      milliseconds: Math.trunc(obj.milliseconds),
      utcIso: obj.utcIso,
      localIso: obj.localIso,
    };
  } catch {
    return null;
  }
}

function parseDuplicateWordOutput(output: string): DuplicateWordOutputView | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.duplicates)) {
      return null;
    }
    const duplicates = obj.duplicates
      .map((item) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          return null;
        }
        const row = item as Record<string, unknown>;
        if (typeof row.word !== "string" || typeof row.count !== "number") {
          return null;
        }
        return {
          word: row.word,
          count: Math.max(0, Math.trunc(row.count)),
        };
      })
      .filter((item): item is DuplicateWordView => item !== null);
    return { duplicates };
  } catch {
    return null;
  }
}

/**
 * Template D -- Text Manipulation (22 tools including case-converter)
 *
 * Layout:
 *  - Input textarea (proportional by default, mono when prop is set)
 *  - Action buttons in a responsive grid (for many modes) or flex row (1-2 buttons)
 *  - Read-only output textarea
 *  - Extras row: Copy / Download / Clear + character/word/line stats
 */
export function TemplateD({
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
  mono,
  onPaste,
}: TemplateProps) {
  const [activeMode, setActiveMode] = useState<string | undefined>(
    buttons.find((b) => b.primary)?.mode ?? buttons[0]?.mode,
  );

  // ---------- stats ----------
  const stats = useMemo(() => {
    const text = output || input;
    const chars = text.length;
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    const lines = text === "" ? 0 : text.split(/\r?\n/).length;
    return { chars, words, lines };
  }, [input, output]);

  // ---------- derived output display ----------
  const displayedOutput =
    outputState === "loading"
      ? "Running..."
      : outputState === "error"
        ? outputError
        : outputState === "success"
          ? output
          : "";
  const unixTimeOutput =
    outputState === "success" && output ? parseUnixTimeOutput(output) : null;
  const duplicateWordOutput =
    outputState === "success" && output
      ? parseDuplicateWordOutput(output)
      : null;

  const outputTextColor =
    outputState === "error" ? "text-red-400" : "text-slate-200";

  // Determine whether we should use a grid layout (many buttons) or a simple flex row.
  const useGrid = buttons.length > 3;

  const fontClass = mono ? "font-mono" : "font-sans";

  // ---------- handlers ----------
  function handleButtonClick(mode?: string) {
    setActiveMode(mode);
    onRun({ mode });
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (onPaste) {
      const text = e.clipboardData.getData("text/plain");
      if (text) onPaste(text);
    }
  }

  const inputArea = (
    <textarea
      className={`w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm ${fontClass} text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none`}
      rows={6}
      placeholder={placeholder ?? "Paste your text here"}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onPaste={handlePaste}
      spellCheck={false}
    />
  );

  const actionButtons = useGrid ? (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {buttons.map((btn) => {
        const isActive = activeMode === btn.mode;
        return (
          <button
            key={btn.mode ?? btn.label}
            type="button"
            onClick={() => handleButtonClick(btn.mode)}
            className={`rounded border px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                : "border-slate-700 text-slate-200 hover:bg-slate-800"
            }`}
          >
            {btn.label}
          </button>
        );
      })}
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.mode ?? btn.label}
          type="button"
          onClick={() => handleButtonClick(btn.mode)}
          className={
            btn.primary
              ? "rounded border border-cyan-600 bg-cyan-600 px-3 py-1.5 text-sm text-white hover:bg-cyan-700 transition-colors"
              : "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          }
        >
          {btn.label}
        </button>
      ))}
    </div>
  );

  const outputArea = (
    <div className="space-y-2">
      {unixTimeOutput ? (
        <div className="grid gap-2 rounded border border-slate-700 bg-slate-950 p-3 sm:grid-cols-2">
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Unix seconds</div>
            <div className="font-mono text-sm text-cyan-300">{unixTimeOutput.seconds}</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Unix milliseconds</div>
            <div className="font-mono text-sm text-cyan-300">{unixTimeOutput.milliseconds}</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2 sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">UTC</div>
            <div className="font-mono text-sm text-slate-200 break-all">{unixTimeOutput.utcIso}</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2 sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Local</div>
            <div className="font-mono text-sm text-slate-200 break-all">{unixTimeOutput.localIso}</div>
          </div>
        </div>
      ) : duplicateWordOutput ? (
        <div className="rounded border border-slate-700 bg-slate-950 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            Duplicate words: {duplicateWordOutput.duplicates.length}
          </div>
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Word</th>
                  <th className="px-2 py-1.5">Count</th>
                </tr>
              </thead>
              <tbody>
                {duplicateWordOutput.duplicates.length > 0 ? (
                  duplicateWordOutput.duplicates.map((item, index) => (
                    <tr key={`${item.word}-${index}`} className="border-b border-slate-900/80 text-sm text-slate-200">
                      <td className="px-2 py-1.5 font-mono text-xs text-slate-500">{index + 1}</td>
                      <td className="px-2 py-1.5 font-mono text-cyan-300 break-all">{item.word}</td>
                      <td className="px-2 py-1.5 font-mono">{item.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-2 py-2 text-sm text-slate-400">
                      No duplicate words found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <textarea
          className={`w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm ${fontClass} ${outputTextColor} placeholder-slate-500 focus:outline-none`}
          rows={6}
          readOnly
          value={displayedOutput}
          placeholder="Output will appear here"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button type="button" onClick={onCopy} disabled={!output} className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Copy</button>
          <button type="button" onClick={onDownload} disabled={!output} className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Download</button>
          <button type="button" onClick={onClear} disabled={!input && !output} className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Clear</button>
        </div>
        <div className="flex gap-4 text-xs text-slate-400">
          <span>{stats.chars} characters</span>
          <span>{stats.words} words</span>
          <span>{stats.lines} lines</span>
        </div>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
