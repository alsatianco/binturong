import type { TemplateProps } from "./types";

type UnicodeTextOutputView = {
  text: string;
  codePoints: string[];
  hexScalars: string;
  jsonEscaped: string;
  rustEscaped: string;
};

function parseUnicodeTextOutput(output: string): UnicodeTextOutputView | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.text !== "string" ||
      !Array.isArray(obj.codePoints) ||
      typeof obj.hexScalars !== "string" ||
      typeof obj.jsonEscaped !== "string" ||
      typeof obj.rustEscaped !== "string"
    ) {
      return null;
    }
    const codePoints = obj.codePoints.filter(
      (value): value is string => typeof value === "string",
    );
    return {
      text: obj.text,
      codePoints,
      hexScalars: obj.hexScalars,
      jsonEscaped: obj.jsonEscaped,
      rustEscaped: obj.rustEscaped,
    };
  } catch {
    return null;
  }
}

/**
 * Template E -- Unicode Style Generator (27+ tools)
 *
 * Layout:
 *  - Input textarea (proportional font)
 *  - Single action button for explicit execution
 *  - Output textarea with larger font for Unicode preview
 *  - Prominent Copy button (primary) + Clear button
 */
export function TemplateE({
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
  // ---------- derived output display ----------
  const displayedOutput =
    outputState === "loading"
      ? "Running..."
      : outputState === "error"
        ? outputError
        : outputState === "success"
          ? output
          : "";
  const unicodeOutput =
    outputState === "success" && output
      ? parseUnicodeTextOutput(output)
      : null;

  const outputTextColor =
    outputState === "error" ? "text-red-400" : "text-slate-200";

  const inputFontClass = mono ? "font-mono" : "font-sans";
  const outputFontClass = mono ? "font-mono" : "font-sans";

  // ---------- handlers ----------
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (onPaste) {
      const text = e.clipboardData.getData("text/plain");
      if (text) onPaste(text);
    }
  }

  const primaryButton = buttons[0];

  const inputArea = (
    <textarea
      className={`w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm ${inputFontClass} text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none`}
      rows={4}
      placeholder={placeholder ?? "Type text here"}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onPaste={handlePaste}
      spellCheck={false}
    />
  );

  const actionButtons = primaryButton ? (
    <button
      type="button"
      onClick={() => onRun()}
      className="rounded border border-cyan-600 bg-cyan-600 px-3 py-1.5 text-sm text-white hover:bg-cyan-700 transition-colors"
    >
      {primaryButton.label}
    </button>
  ) : null;

  const outputArea = (
    <div className="space-y-2">
      {unicodeOutput ? (
        <div className="space-y-2 rounded border border-slate-700 bg-slate-950 p-3">
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Text</div>
            <div className={`break-all text-lg ${outputFontClass} text-slate-100`}>
              {unicodeOutput.text}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Code points</div>
            <div className="font-mono text-sm text-cyan-300 break-all">
              {unicodeOutput.codePoints.join(" ")}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Hex scalars</div>
            <div className="font-mono text-sm text-slate-200 break-all">
              {unicodeOutput.hexScalars}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">JSON escaped</div>
            <div className="font-mono text-sm text-slate-200 break-all">
              {unicodeOutput.jsonEscaped}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Rust escaped</div>
            <div className="font-mono text-sm text-slate-200 break-all">
              {unicodeOutput.rustEscaped}
            </div>
          </div>
        </div>
      ) : (
        <textarea
          className={`w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 text-lg ${outputFontClass} ${outputTextColor} placeholder-slate-500 focus:outline-none`}
          rows={4}
          readOnly
          value={displayedOutput}
          placeholder="Styled text will appear here"
        />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCopy} disabled={!output} className="rounded border border-cyan-600 bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-cyan-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Copy</button>
        <button type="button" onClick={onDownload} disabled={!output} className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Download</button>
        <button type="button" onClick={onClear} disabled={!input && !output} className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Clear</button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
