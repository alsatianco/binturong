import { useState, useEffect, useCallback } from "react";
import type { TemplateProps } from "./types";

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";

export function TemplateI({
  input,
  onInputChange,
  output,
  outputState,
  outputError,
  onRun,
  onCopy,
  onClear,
  placeholder,
  onPaste,
}: TemplateProps) {
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string>("");

  // Reset preview when input is cleared.
  useEffect(() => {
    if (!input.trim()) {
      setIframeSrcDoc("");
    }
  }, [input]);

  // Update iframe content when output changes
  useEffect(() => {
    if (outputState === "success" && output) {
      setIframeSrcDoc(output);
    }
  }, [output, outputState]);

  const handleManualRefresh = useCallback(() => {
    if (input.trim()) {
      onRun();
    }
  }, [input, onRun]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (onPaste) {
        const text = e.clipboardData.getData("text/plain");
        if (text) onPaste(text);
      }
    },
    [onPaste],
  );

  const inputArea = (
    <textarea
      className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
      rows={12}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onPaste={handlePaste}
      placeholder={placeholder ?? "Type or paste content here..."}
      spellCheck={false}
    />
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className={btnBase}
        onClick={handleManualRefresh}
        title="Refresh preview"
      >
        Generate Preview
      </button>
      {outputState === "loading" && (
        <span className="text-xs text-slate-500">Updating...</span>
      )}
    </div>
  );

  const outputArea = (
    <div className="space-y-2">
      {outputState === "error" && (
        <div className="rounded border border-red-700/50 bg-red-950/30 px-3 py-2 font-mono text-sm text-red-400">
          {outputError}
        </div>
      )}

      <div className="overflow-hidden rounded border border-slate-700">
        <iframe
          title="Live preview"
          srcDoc={iframeSrcDoc}
          sandbox=""
          className="w-full border-0 bg-white"
          style={{ minHeight: "300px", height: "400px" }}
        />
      </div>

      <div className="flex gap-2">
        <button className={btnBase} onClick={onCopy}>
          Copy Source HTML
        </button>
        <button className={btnBase} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
