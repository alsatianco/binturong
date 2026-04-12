import { useMemo, useCallback, type DragEvent } from "react";
import { useState } from "react";
import type { TemplateProps } from "./types";

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";
const btnSmall =
  "rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200";

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    /* noop */
  });
}

function renderValue(
  key: string,
  value: unknown,
): { display: React.ReactNode; copyText: string } {
  // Special rendering for isExpired field
  if (key === "isExpired" && typeof value === "boolean") {
    return {
      display: value ? (
        <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs font-medium text-red-400">
          Expired
        </span>
      ) : (
        <span className="rounded-full bg-green-600/20 px-2 py-0.5 text-xs font-medium text-green-400">
          Valid
        </span>
      ),
      copyText: String(value),
    };
  }

  // Arrays: render as numbered list
  if (Array.isArray(value)) {
    const objectItems = value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
    const allObjects =
      objectItems.length === value.length && value.length > 0;
    if (allObjects) {
      const columns = Array.from(
        new Set(objectItems.flatMap((item) => Object.keys(item))),
      );
      return {
        display: (
          <div className="max-h-52 overflow-auto rounded border border-slate-800 bg-slate-950">
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                  {columns.map((column) => (
                    <th key={column} className="px-2 py-1 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {objectItems.map((item, index) => (
                  <tr key={index} className="border-b border-slate-900/80 text-xs text-slate-200">
                    {columns.map((column) => (
                      <td key={column} className="px-2 py-1 font-mono">
                        {typeof item[column] === "object" && item[column] !== null
                          ? JSON.stringify(item[column])
                          : String(item[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
        copyText: JSON.stringify(value, null, 2),
      };
    }

    return {
      display: (
        <ol className="list-inside list-decimal space-y-0.5 text-sm text-slate-200">
          {value.map((item, i) => (
            <li key={i} className="font-mono text-xs">
              {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </li>
          ))}
        </ol>
      ),
      copyText: JSON.stringify(value, null, 2),
    };
  }

  // Nested objects: show as pretty-printed JSON code block
  if (typeof value === "object" && value !== null) {
    const json = JSON.stringify(value, null, 2);
    return {
      display: (
        <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 font-mono text-xs text-slate-300">
          {json}
        </pre>
      ),
      copyText: json,
    };
  }

  // Booleans
  if (typeof value === "boolean") {
    return {
      display: (
        <span className="font-mono text-sm text-slate-200">
          {value ? "true" : "false"}
        </span>
      ),
      copyText: String(value),
    };
  }

  // Primitives (string, number)
  return {
    display: (
      <span className="font-mono text-sm text-slate-200 break-all">
        {String(value)}
      </span>
    ),
    copyText: String(value),
  };
}

function formatKey(key: string): string {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function TemplateG({
  input,
  onInputChange,
  output,
  outputState,
  outputError,
  onRun,
  onCopy,
  onClear,
  buttons,
  placeholder,
  onPaste,
  onFileDrop,
  acceptedFiles,
}: TemplateProps) {
  const [dragging, setDragging] = useState(false);

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
        if (!exts.some((ext) => fileName.endsWith(ext))) return;
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

  const parsedOutput = useMemo(() => {
    if (outputState !== "success" || !output) return null;
    try {
      const parsed = JSON.parse(output);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }, [output, outputState]);

  const outputDisplay =
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
      rows={6}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      placeholder={placeholder ?? "Paste input here..."}
      spellCheck={false}
    />
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          className={btn.primary ? btnPrimary : btnBase}
          onClick={() => onRun({ mode: btn.mode })}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );

  const outputArea = (
    <div className="space-y-2">
      {outputState === "loading" && (
        <div className="py-4 text-center text-sm text-slate-400">
          Running...
        </div>
      )}

      {outputState === "error" && (
        <div className="rounded border border-red-700/50 bg-red-950/30 px-3 py-2 font-mono text-sm text-red-400">
          {outputError}
        </div>
      )}

      {outputState === "success" && parsedOutput && (
        <div className="space-y-1 rounded border border-slate-700 bg-slate-900/50 p-3">
          {Object.entries(parsedOutput).map(([key, value]) => {
            const { display, copyText } = renderValue(key, value);
            return (
              <div
                key={key}
                className="flex items-start gap-3 rounded px-2 py-1.5 hover:bg-slate-800/50"
              >
                <span className="min-w-[140px] shrink-0 text-sm font-medium text-slate-400">
                  {formatKey(key)}
                </span>
                <div className="min-w-0 flex-1">{display}</div>
                <button
                  className={btnSmall}
                  onClick={() => copyToClipboard(copyText)}
                  title={`Copy ${formatKey(key)}`}
                >
                  Copy
                </button>
              </div>
            );
          })}
        </div>
      )}

      {outputState === "success" && !parsedOutput && output && (
        <textarea
          className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none"
          rows={10}
          value={outputDisplay}
          readOnly
          spellCheck={false}
        />
      )}

      {outputState === "idle" && (
        <div className="rounded border border-slate-700/50 bg-slate-950/30 py-8 text-center text-sm text-slate-500">
          Output will appear here
        </div>
      )}

      <div className="flex gap-2">
        <button className={btnBase} onClick={onCopy}>
          Copy All
        </button>
        <button className={btnBase} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
