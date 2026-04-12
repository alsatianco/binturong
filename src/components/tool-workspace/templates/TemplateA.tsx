import { useState, useCallback, type DragEvent } from "react";
import type { TemplateProps } from "./types";

const INDENT_OPTIONS = [2, 4, 8] as const;

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";

export function TemplateA({
  input,
  onInputChange,
  output,
  outputState,
  outputError,
  onRun,
  onCopy,
  onClear,
  onDownload,
  formatMode,
  indentSize,
  buttons,
  placeholder,
  onPaste,
  onFileDrop,
  acceptedFiles,
}: TemplateProps) {
  const [dragging, setDragging] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState<number>(indentSize);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (onFileDrop) setDragging(true);
    },
    [onFileDrop],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      if (!onFileDrop) return;

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (acceptedFiles) {
        const exts = acceptedFiles.split(",").map((s) => s.trim().toLowerCase());
        const fileName = file.name.toLowerCase();
        const matches = exts.some((ext) => fileName.endsWith(ext));
        if (!matches) return;
      }

      onFileDrop(file);
    },
    [onFileDrop, acceptedFiles],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (onPaste) {
        const text = e.clipboardData.getData("text/plain");
        if (text) onPaste(text);
      }
    },
    [onPaste],
  );

  const handleIndentChange = (size: number) => {
    setSelectedIndent(size);
    onRun({ mode: formatMode, indentSize: size });
  };

  const outputValue =
    outputState === "loading"
      ? "Running..."
      : outputState === "error"
        ? outputError
        : outputState === "success"
          ? output
          : "";

  const inputArea = (
    <textarea
      className={`w-full resize-y rounded border bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none ${
        dragging ? "border-cyan-500" : "border-slate-700"
      }`}
      rows={10}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      placeholder={
        placeholder ??
        (onFileDrop ? "Paste text or drop a file here..." : "Paste text here...")
      }
      spellCheck={false}
    />
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          className={btn.primary ? btnPrimary : btnBase}
          onClick={() => onRun({ mode: btn.mode, indentSize: selectedIndent })}
        >
          {btn.label}
        </button>
      ))}

      {/* Indent size selector */}
      <span className="ml-2 text-xs text-slate-400">Indent:</span>
      {INDENT_OPTIONS.map((size) => (
        <button
          key={size}
          className={`rounded border px-2 py-1 text-xs transition ${
            selectedIndent === size
              ? "border-cyan-600 bg-cyan-600/20 text-cyan-300"
              : "border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
          onClick={() => handleIndentChange(size)}
        >
          {size}
        </button>
      ))}
    </div>
  );

  const outputArea = (
    <div className="space-y-2">
      <textarea
        className={`w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm placeholder-slate-500 focus:outline-none ${
          outputState === "error" ? "text-red-400" : "text-slate-200"
        }`}
        rows={10}
        value={outputValue}
        readOnly
        spellCheck={false}
      />
      <div className="flex gap-2">
        <button className={btnBase} onClick={onCopy}>
          Copy
        </button>
        <button className={btnBase} onClick={onDownload}>
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
