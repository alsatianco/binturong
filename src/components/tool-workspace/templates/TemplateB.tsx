import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { TemplateProps } from "./types";

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";

function parseUuidUlidOutput(output: string): Array<{ key: string; value: string }> | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const looksLikeGenerateOutput =
      typeof obj.uuidV4 === "string" && typeof obj.ulid === "string";
    const looksLikeDecodeOutput =
      typeof obj.type === "string" && typeof obj.value === "string";
    if (!looksLikeGenerateOutput && !looksLikeDecodeOutput) {
      return null;
    }

    return Object.entries(obj).map(([key, value]) => ({
      key,
      value:
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value),
    }));
  } catch {
    return null;
  }
}

/** Try to parse persisted JSON-wrapped input back into { text, ...extraFields }. */
function parseJsonWrappedInput(
  input: string,
  extraKeys: string[],
): { text: string; fields: Record<string, string> } | null {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) && "text" in parsed) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.text !== "string") return null;
      const fields: Record<string, string> = {};
      for (const key of extraKeys) {
        fields[key] = typeof obj[key] === "string" ? (obj[key] as string) : "";
      }
      return { text: obj.text, fields };
    }
  } catch { /* not JSON */ }
  return null;
}

/**
 * Template B -- Bidirectional Encode/Decode (15 tools).
 *
 * Two direction buttons whose labels come from `directionLabels`.
 * Extra input fields (sliders, text inputs) are driven by the `extras` config
 * rather than hardcoded tool ID checks.
 */
export function TemplateB({
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
  directionLabels,
  indentSize,
  extras,
}: TemplateProps) {
  // Determine if any extras use JSON wrapping (e.g. AES passphrase)
  const jsonWrapExtras = useMemo(
    () => (extras ?? []).filter((e) => e.jsonWrap),
    [extras],
  );
  const hasJsonWrap = jsonWrapExtras.length > 0;

  // Parse persisted JSON input on mount (for JSON-wrapped tools)
  const jsonWrapKeys = useMemo(
    () => jsonWrapExtras.map((e) => e.key),
    [jsonWrapExtras],
  );
  const initialParsed = useMemo(
    () => (hasJsonWrap ? parseJsonWrappedInput(input, jsonWrapKeys) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
    [],
  );

  // Extra field values (sliders and text inputs)
  const [extraValues, setExtraValues] = useState<Record<string, string | number>>(() => {
    const defaults: Record<string, string | number> = {};
    for (const extra of extras ?? []) {
      if (extra.jsonWrap && initialParsed?.fields[extra.key] !== undefined) {
        defaults[extra.key] = initialParsed.fields[extra.key];
      } else if (extra.type === "slider") {
        defaults[extra.key] = (extra.defaultValue as number) ?? indentSize;
      } else {
        defaults[extra.key] = (extra.defaultValue as string) ?? "";
      }
    }
    return defaults;
  });

  // For JSON-wrapped tools, the textarea shows only the text portion
  const [jsonWrapText, setJsonWrapText] = useState<string>(
    initialParsed?.text ?? (hasJsonWrap ? input : ""),
  );

  // Sync state when input prop changes externally (e.g., history restore)
  const prevInputRef = useRef(input);
  useEffect(() => {
    if (input === prevInputRef.current) return;
    prevInputRef.current = input;
    if (!hasJsonWrap) return;
    const parsed = parseJsonWrappedInput(input, jsonWrapKeys);
    if (parsed) {
      setJsonWrapText(parsed.text);
      setExtraValues((prev) => {
        const next = { ...prev };
        for (const key of jsonWrapKeys) {
          if (parsed.fields[key] !== undefined) {
            next[key] = parsed.fields[key];
          }
        }
        return next;
      });
    } else {
      setJsonWrapText(input);
    }
  }, [input, hasJsonWrap, jsonWrapKeys]);

  const updateExtra = useCallback((key: string, value: string | number) => {
    setExtraValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (onPaste) {
        const text = e.clipboardData.getData("text/plain");
        if (text) onPaste(text);
      }
    },
    [onPaste],
  );

  const handleSwap = () => {
    if (hasJsonWrap) {
      setJsonWrapText(output);
    } else {
      onInputChange(output);
    }
  };

  /** Build run options, handling JSON wrapping and slider extras. */
  const handleRun = useCallback(
    (mode: string) => {
      if (hasJsonWrap) {
        const payload: Record<string, string> = { text: jsonWrapText };
        for (const extra of jsonWrapExtras) {
          payload[extra.key] = String(extraValues[extra.key] ?? "");
        }
        onRun({ mode, inputOverride: JSON.stringify(payload) });
      } else {
        // Find slider extras to pass via indentSize (caesar-cipher pattern)
        const sliderExtra = (extras ?? []).find((e) => e.type === "slider");
        onRun({
          mode,
          ...(sliderExtra ? { indentSize: Number(extraValues[sliderExtra.key]) } : {}),
        });
      }
    },
    [extras, extraValues, hasJsonWrap, jsonWrapExtras, jsonWrapText, onRun],
  );

  const label1 = directionLabels?.[0] ?? buttons[0]?.label ?? "Encode";
  const label2 = directionLabels?.[1] ?? buttons[1]?.label ?? "Decode";

  const outputValue =
    outputState === "loading"
      ? "Running..."
      : outputState === "error"
        ? outputError
        : outputState === "success"
          ? output
          : "";
  const uuidUlidOutput =
    outputState === "success" && output ? parseUuidUlidOutput(output) : null;

  // --- Input area ---
  const mainTextarea = (
    <textarea
      className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
      rows={10}
      value={hasJsonWrap ? jsonWrapText : input}
      onChange={(e) =>
        hasJsonWrap ? setJsonWrapText(e.target.value) : onInputChange(e.target.value)
      }
      onPaste={handlePaste}
      placeholder={placeholder ?? "Paste text here..."}
      spellCheck={false}
    />
  );

  const extraFields = (extras ?? []).map((extra) => {
    if (extra.type === "text") {
      return (
        <div key={extra.key} className="flex items-center gap-2">
          <label
            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400"
            htmlFor={`extra-${extra.key}`}
          >
            {extra.label}
          </label>
          <input
            id={`extra-${extra.key}`}
            type="text"
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
            value={String(extraValues[extra.key] ?? "")}
            onChange={(e) => updateExtra(extra.key, e.target.value)}
            placeholder={extra.placeholder ?? ""}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      );
    }
    // slider - rendered inline with action buttons
    return null;
  });

  const hasTextExtras = extraFields.some((f) => f !== null);

  const inputArea = hasTextExtras ? (
    <div className="space-y-3">
      {mainTextarea}
      {extraFields}
    </div>
  ) : (
    mainTextarea
  );

  // --- Action buttons + inline sliders ---
  const sliderExtras = (extras ?? []).filter((e) => e.type === "slider");

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btnPrimary} onClick={() => handleRun("format")}>
        {label1}
      </button>

      {label1 !== label2 && (
        <button className={btnBase} onClick={() => handleRun("minify")}>
          {label2}
        </button>
      )}

      {sliderExtras.map((extra) => (
        <div key={extra.key} className="ml-3 flex items-center gap-2">
          <label className="text-xs text-slate-400" htmlFor={`slider-${extra.key}`}>
            {extra.label}:
          </label>
          <input
            id={`slider-${extra.key}`}
            type="range"
            min={extra.min ?? 1}
            max={extra.max ?? 25}
            value={Number(extraValues[extra.key])}
            onChange={(e) => updateExtra(extra.key, Number(e.target.value))}
            className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-500"
          />
          <span className="min-w-[1.5rem] text-center text-xs font-medium text-cyan-300">
            {extraValues[extra.key]}
          </span>
        </div>
      ))}
    </div>
  );

  // --- Output area ---
  const outputArea = (
    <div className="space-y-2">
      {uuidUlidOutput ? (
        <div className="space-y-1 rounded border border-slate-700 bg-slate-950 p-3">
          {uuidUlidOutput.map((item) => (
            <div key={item.key} className="grid grid-cols-[120px,1fr] gap-3 rounded px-2 py-1.5 hover:bg-slate-800/50">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {item.key}
              </span>
              <span className="font-mono text-sm text-slate-200 break-all">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <textarea
          className={`w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm placeholder-slate-500 focus:outline-none ${
            outputState === "error" ? "text-red-400" : "text-slate-200"
          }`}
          rows={10}
          value={outputValue}
          readOnly
          spellCheck={false}
        />
      )}
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
        <button className={btnBase} onClick={handleSwap}>
          Swap
        </button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
