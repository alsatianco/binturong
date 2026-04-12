import { useState, useCallback } from "react";
import type { TemplateProps } from "./types";
import type { MultiField } from "../toolConfigs";

export type TemplateKProps = TemplateProps & {
  multiFields?: MultiField[];
};

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";

type RegexMatchView = {
  matched: string;
  start: number;
  end: number;
  groups: Array<string | null>;
};

type RegexOutputView = {
  matches: RegexMatchView[];
  replacedText: string | null;
};

function buildInitialValues(
  fields: MultiField[],
): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const field of fields) {
    if (field.type === "checkboxes") {
      values[field.key] = [];
    } else {
      values[field.key] = "";
    }
  }
  return values;
}

function normalizeCheckboxValue(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .split("")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function parseRegexMatch(rawMatch: unknown): RegexMatchView | null {
  const parsed = asObject(rawMatch);
  if (!parsed) return null;

  const matched = [
    parsed.matched,
    parsed.value,
    parsed.text,
  ].find((value): value is string => typeof value === "string");
  if (!matched) return null;

  const start = asFiniteNumber(parsed.start) ?? asFiniteNumber(parsed.index);
  const end =
    asFiniteNumber(parsed.end) ??
    (start !== null ? start + matched.length : null);
  if (start === null || end === null) return null;

  const groups = Array.isArray(parsed.groups)
    ? parsed.groups.map((group) =>
        typeof group === "string" || group === null ? group : String(group),
      )
    : [];

  return {
    matched,
    start: Math.max(0, start),
    end: Math.max(Math.max(0, start), end),
    groups,
  };
}

function parseRegexOutput(rawOutput: string): RegexOutputView | null {
  try {
    const parsed = asObject(JSON.parse(rawOutput));
    if (!parsed) return null;

    const matches = Array.isArray(parsed.matches)
      ? parsed.matches
          .map(parseRegexMatch)
          .filter((value): value is RegexMatchView => value !== null)
      : [];
    const replacedText =
      typeof parsed.replacedText === "string"
        ? parsed.replacedText
        : typeof parsed.replaced === "string"
          ? parsed.replaced
          : parsed.replacedText === null
            ? null
            : null;

    return { matches, replacedText };
  } catch {
    return null;
  }
}

function buildHighlightRanges(
  text: string,
  matches: RegexMatchView[],
): Array<{ start: number; end: number }> {
  const sortedRanges = matches
    .map((match) => ({
      start: Math.min(Math.max(match.start, 0), text.length),
      end: Math.min(Math.max(match.end, 0), text.length),
    }))
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: Array<{ start: number; end: number }> = [];
  for (const range of sortedRanges) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push(range);
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

/**
 * Template K -- Multi-Field Input (2 tools: regex-tester, utm-generator).
 *
 * Renders multiple labeled input fields (text inputs, textareas, checkbox
 * groups) defined by the `multiFields` config. All field values are
 * serialized as JSON into the `input` prop before calling `onRun`.
 */
export function TemplateK({
  input,
  output,
  outputState,
  outputError,
  onRun,
  onCopy,
  onClear,
  onDownload,
  buttons,
  multiFields,
  onPaste,
}: TemplateKProps) {
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | string[]>
  >(() => {
    // Try to hydrate from existing input (if already JSON)
    if (input) {
      try {
        const parsed = JSON.parse(input);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed as Record<string, string | string[]>;
        }
      } catch {
        // Not JSON -- start fresh
      }
    }
    return buildInitialValues(multiFields ?? []);
  });

  const handleFieldChange = useCallback(
    (key: string, value: string | string[]) => {
      setFieldValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleCheckboxToggle = useCallback(
    (key: string, option: string, checked: boolean) => {
      setFieldValues((prev) => {
        const current = normalizeCheckboxValue(prev[key]);
        const next = checked
          ? [...current, option]
          : current.filter((v) => v !== option);
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const handleRun = useCallback(() => {
    const payload: Record<string, string | string[]> = { ...fieldValues };
    for (const field of multiFields ?? []) {
      if (field.type !== "checkboxes") continue;
      const selectedValues = normalizeCheckboxValue(payload[field.key]);
      payload[field.key] =
        field.key === "flags" ? selectedValues.join("") : selectedValues;
    }

    const json = JSON.stringify(payload);
    // Pass payload directly via inputOverride to avoid stale state race condition
    onRun({ inputOverride: json });
  }, [fieldValues, multiFields, onRun]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (onPaste) {
        const text = e.clipboardData.getData("text/plain");
        if (text) onPaste(text);
      }
    },
    [onPaste],
  );

  // ---------- Render individual fields ----------
  const renderField = (field: MultiField) => {
    const value = fieldValues[field.key];

    switch (field.type) {
      case "text":
        return (
          <div key={field.key} className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {field.label}
            </label>
            <input
              type="text"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
              value={(value as string) ?? ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              onPaste={handlePaste}
              placeholder={field.placeholder ?? ""}
              spellCheck={false}
            />
          </div>
        );

      case "textarea":
        return (
          <div key={field.key} className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {field.label}
            </label>
            <textarea
              className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
              rows={8}
              value={(value as string) ?? ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              onPaste={handlePaste}
              placeholder={field.placeholder ?? ""}
              spellCheck={false}
            />
          </div>
        );

      case "checkboxes":
        return (
          <div key={field.key} className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {field.label}
            </label>
            <div className="flex flex-wrap gap-3">
              {field.options?.map((option) => {
                const selectedValues = normalizeCheckboxValue(value);
                const checked = selectedValues.includes(option);
                return (
                  <label
                    key={option}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-600"
                      checked={checked}
                      onChange={(e) =>
                        handleCheckboxToggle(field.key, option, e.target.checked)
                      }
                    />
                    <span className="font-mono text-sm text-slate-300">
                      {option}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ---------- Detect regex-tester for match highlighting ----------
  const isRegexTester = multiFields?.some((f) => f.key === "pattern");

  const regexOutput =
    outputState === "success" && isRegexTester && output
      ? parseRegexOutput(output)
      : null;
  const regexInputText =
    typeof fieldValues.text === "string" ? fieldValues.text : "";
  const regexHighlightRanges = buildHighlightRanges(
    regexInputText,
    regexOutput?.matches ?? [],
  );

  const outputDisplay =
    outputState === "loading"
      ? "Running..."
      : outputState === "error"
        ? outputError
        : outputState === "success"
          ? output
          : "";

  const inputArea = (
    <div className="space-y-4 rounded border border-slate-700 bg-slate-900/50 p-4">
      {multiFields?.map(renderField)}
    </div>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btnPrimary} onClick={handleRun}>
        {buttons[0]?.label ?? "Run"}
      </button>
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

      {outputState === "success" && isRegexTester && regexOutput && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cyan-600/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
              {regexOutput.matches.length}{" "}
              {regexOutput.matches.length === 1 ? "match" : "matches"}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Test Text
            </label>
            <div className="rounded border border-slate-700 bg-slate-950 p-3 font-mono text-sm text-slate-200">
              {regexInputText ? (
                <div className="whitespace-pre-wrap break-words">
                  {regexHighlightRanges.length === 0 ? (
                    regexInputText
                  ) : (
                    (() => {
                      const segments: Array<{
                        text: string;
                        highlight: boolean;
                      }> = [];
                      let cursor = 0;
                      regexHighlightRanges.forEach((range) => {
                        if (range.start > cursor) {
                          segments.push({
                            text: regexInputText.slice(cursor, range.start),
                            highlight: false,
                          });
                        }
                        segments.push({
                          text: regexInputText.slice(range.start, range.end),
                          highlight: true,
                        });
                        cursor = range.end;
                      });
                      if (cursor < regexInputText.length) {
                        segments.push({
                          text: regexInputText.slice(cursor),
                          highlight: false,
                        });
                      }
                      return segments.map((segment, index) =>
                        segment.highlight ? (
                          <span
                            key={index}
                            className="rounded bg-amber-500/25 px-0.5 text-amber-100"
                          >
                            {segment.text}
                          </span>
                        ) : (
                          <span key={index}>{segment.text}</span>
                        ),
                      );
                    })()
                  )}
                </div>
              ) : (
                <span className="text-slate-500">No test text provided.</span>
              )}
            </div>
          </div>

          <div className="max-h-[300px] overflow-auto rounded border border-slate-700 bg-slate-950 p-3">
            {regexOutput.matches.length > 0 ? (
              <div className="space-y-2">
                {regexOutput.matches.map((match, index) => (
                  <div
                    key={`${match.start}-${match.end}-${index}`}
                    className="space-y-1 rounded border border-slate-800 px-2 py-1.5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="min-w-[2rem] shrink-0 text-right font-mono text-xs text-slate-500">
                        {index + 1}.
                      </span>
                      <span className="font-mono text-sm text-cyan-300 break-all">
                        {match.matched}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        [{match.start}, {match.end})
                      </span>
                    </div>
                    {match.groups.length > 0 && (
                      <div className="ml-11 flex flex-wrap gap-2">
                        {match.groups.map((group, groupIndex) => (
                          <span
                            key={groupIndex}
                            className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-green-300"
                          >
                            ${groupIndex + 1}: {group ?? "<none>"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No matches found.</div>
            )}
          </div>

          {typeof regexOutput.replacedText === "string" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Replace Result
              </label>
              <textarea
                className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none"
                rows={4}
                value={regexOutput.replacedText}
                readOnly
                spellCheck={false}
              />
            </div>
          )}
        </div>
      )}

      {outputState === "success" && !(isRegexTester && regexOutput) && output && (
        <textarea
          className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none"
          rows={6}
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
        <button
          className={btnBase}
          onClick={onCopy}
          disabled={outputState !== "success"}
        >
          Copy
        </button>
        <button
          className={btnBase}
          onClick={onDownload}
          disabled={outputState !== "success"}
        >
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
