import { useState, useCallback } from "react";
import type { TemplateProps } from "./types";
import type { GeneratorField } from "../toolConfigs";

export type TemplateFProps = TemplateProps & {
  generatorFields?: GeneratorField[];
};

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";

type WordFrequencyItemView = {
  word: string;
  count: number;
};

type WordFrequencyOutputView = {
  totalWords: number;
  uniqueWords: number;
  items: WordFrequencyItemView[];
};

type SentenceCounterOutputView = {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  minutesAt200Wpm: number;
  secondsAt200Wpm: number;
};

function buildInitialValues(
  fields: GeneratorField[],
): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    values[field.key] =
      field.defaultValue !== undefined ? field.defaultValue : "";
  }
  return values;
}

function parseWordFrequencyOutput(output: string): WordFrequencyOutputView | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.totalWords !== "number" ||
      !Number.isFinite(obj.totalWords) ||
      typeof obj.uniqueWords !== "number" ||
      !Number.isFinite(obj.uniqueWords) ||
      !Array.isArray(obj.items)
    ) {
      return null;
    }

    const items = obj.items
      .map((item) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          return null;
        }
        const row = item as Record<string, unknown>;
        if (
          typeof row.word !== "string" ||
          typeof row.count !== "number" ||
          !Number.isFinite(row.count)
        ) {
          return null;
        }
        return {
          word: row.word,
          count: Math.max(0, Math.trunc(row.count)),
        };
      })
      .filter((item): item is WordFrequencyItemView => item !== null);

    return {
      totalWords: Math.max(0, Math.trunc(obj.totalWords)),
      uniqueWords: Math.max(0, Math.trunc(obj.uniqueWords)),
      items,
    };
  } catch {
    return null;
  }
}

function parseSentenceCounterOutput(output: string): SentenceCounterOutputView | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const readingTime =
      typeof obj.readingTime === "object" &&
      obj.readingTime !== null &&
      !Array.isArray(obj.readingTime)
        ? (obj.readingTime as Record<string, unknown>)
        : null;
    if (
      typeof obj.characters !== "number" ||
      typeof obj.charactersNoSpaces !== "number" ||
      typeof obj.words !== "number" ||
      typeof obj.sentences !== "number" ||
      typeof obj.paragraphs !== "number" ||
      !readingTime ||
      typeof readingTime.minutesAt200Wpm !== "number" ||
      typeof readingTime.secondsAt200Wpm !== "number"
    ) {
      return null;
    }

    return {
      characters: Math.max(0, Math.trunc(obj.characters)),
      charactersNoSpaces: Math.max(0, Math.trunc(obj.charactersNoSpaces)),
      words: Math.max(0, Math.trunc(obj.words)),
      sentences: Math.max(0, Math.trunc(obj.sentences)),
      paragraphs: Math.max(0, Math.trunc(obj.paragraphs)),
      minutesAt200Wpm: Math.max(0, readingTime.minutesAt200Wpm),
      secondsAt200Wpm: Math.max(0, Math.trunc(readingTime.secondsAt200Wpm)),
    };
  } catch {
    return null;
  }
}

export function TemplateF({
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
  generatorFields,
  onPaste,
}: TemplateFProps) {
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | number | boolean>
  >(() => buildInitialValues(generatorFields ?? []));

  const hasGeneratorFields =
    generatorFields !== undefined && generatorFields.length > 0;

  // Tools like sentence-counter and word-frequency-counter have no generatorFields
  // and take text input instead.
  const isTextInputMode = !hasGeneratorFields;

  // random-choice has both generatorFields AND needs a textarea for items.
  const needsTextarea = hasGeneratorFields && !!placeholder;

  const handleFieldChange = useCallback(
    (key: string, value: string | number | boolean) => {
      setFieldValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleGenerate = useCallback(() => {
    if (isTextInputMode) {
      // Text input tools: input is already set via textarea
      onRun();
      return;
    }

    // Build config JSON from field values, including textarea input for random-choice
    const config: Record<string, string | number | boolean> = {
      ...fieldValues,
    };
    if (needsTextarea) {
      config._items = input as string;
    }

    const jsonString = JSON.stringify(config);
    // Pass payload directly via inputOverride to avoid stale state race condition
    onRun({ inputOverride: jsonString });
  }, [
    isTextInputMode,
    fieldValues,
    needsTextarea,
    input,
    onRun,
  ]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (onPaste) {
        const text = e.clipboardData.getData("text/plain");
        if (text) onPaste(text);
      }
    },
    [onPaste],
  );

  const outputValue =
    outputState === "loading"
      ? "Generating..."
      : outputState === "error"
        ? outputError
        : outputState === "success"
          ? output
          : "";
  const wordFrequencyOutput =
    outputState === "success" && output
      ? parseWordFrequencyOutput(output)
      : null;
  const sentenceCounterOutput =
    outputState === "success" && output
      ? parseSentenceCounterOutput(output)
      : null;

  const renderField = (field: GeneratorField) => {
    const value = fieldValues[field.key];

    switch (field.type) {
      case "number":
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="min-w-[120px] text-sm text-slate-300">
              {field.label}
            </label>
            <input
              type="number"
              className="w-32 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-600 focus:outline-none"
              value={value as number}
              min={field.min}
              max={field.max}
              onChange={(e) =>
                handleFieldChange(
                  field.key,
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
            />
          </div>
        );

      case "text":
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="min-w-[120px] text-sm text-slate-300">
              {field.label}
            </label>
            <input
              type="text"
              className="w-64 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-600 focus:outline-none"
              value={value as string}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            />
          </div>
        );

      case "select":
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="min-w-[120px] text-sm text-slate-300">
              {field.label}
            </label>
            <select
              className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-600 focus:outline-none"
              value={value as string}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            >
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );

      case "checkbox":
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="min-w-[120px] text-sm text-slate-300">
              {field.label}
            </label>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-600"
              checked={value as boolean}
              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const inputArea = isTextInputMode ? (
    <textarea
      className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
      rows={10}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onPaste={handlePaste}
      placeholder={placeholder ?? "Paste text here..."}
      spellCheck={false}
    />
  ) : (
    <div className="space-y-3 rounded border border-slate-700 bg-slate-900/50 p-4">
      {needsTextarea && (
        <div className="mb-3">
          <textarea
            className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
            rows={6}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder ?? "Enter items (one per line)"}
            spellCheck={false}
          />
        </div>
      )}
      {generatorFields?.map(renderField)}
    </div>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btnPrimary} onClick={handleGenerate}>
        {buttons[0]?.label ?? "Generate"}
      </button>
    </div>
  );

  const outputArea = (
    <div className="space-y-2">
      {wordFrequencyOutput ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-600/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
              Total words: {wordFrequencyOutput.totalWords}
            </span>
            <span className="rounded-full bg-slate-700/80 px-2.5 py-0.5 text-xs font-medium text-slate-200">
              Unique words: {wordFrequencyOutput.uniqueWords}
            </span>
            <span className="rounded-full bg-slate-700/80 px-2.5 py-0.5 text-xs font-medium text-slate-200">
              Showing: {wordFrequencyOutput.items.length}
            </span>
          </div>

          <div className="max-h-[420px] overflow-auto rounded border border-slate-700 bg-slate-950">
            <table className="w-full min-w-[460px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Word</th>
                  <th className="px-3 py-2 font-semibold">Count</th>
                  <th className="px-3 py-2 font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {wordFrequencyOutput.items.length > 0 ? (
                  wordFrequencyOutput.items.map((item, index) => {
                    const share =
                      wordFrequencyOutput.totalWords > 0
                        ? (item.count / wordFrequencyOutput.totalWords) * 100
                        : 0;
                    return (
                      <tr key={`${item.word}-${index}`} className="border-b border-slate-900/80 text-sm text-slate-200">
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 font-mono break-all text-cyan-300">
                          {item.word}
                        </td>
                        <td className="px-3 py-2 font-mono">{item.count}</td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {share.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-slate-400">
                      No words found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : sentenceCounterOutput ? (
        <div className="space-y-3 rounded border border-slate-700 bg-slate-950 p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Characters</div>
              <div className="font-mono text-lg text-cyan-300">{sentenceCounterOutput.characters}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">No spaces</div>
              <div className="font-mono text-lg text-cyan-300">{sentenceCounterOutput.charactersNoSpaces}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Words</div>
              <div className="font-mono text-lg text-cyan-300">{sentenceCounterOutput.words}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Sentences</div>
              <div className="font-mono text-lg text-cyan-300">{sentenceCounterOutput.sentences}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Paragraphs</div>
              <div className="font-mono text-lg text-cyan-300">{sentenceCounterOutput.paragraphs}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Reading time</div>
              <div className="font-mono text-lg text-cyan-300">
                {sentenceCounterOutput.minutesAt200Wpm.toFixed(2)} min
              </div>
              <div className="text-xs text-slate-400">
                {sentenceCounterOutput.secondsAt200Wpm}s @ 200 WPM
              </div>
            </div>
          </div>
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
        <button className={btnBase} onClick={onClear}>
          Clear
        </button>
        <button
          className={btnBase}
          onClick={handleGenerate}
          disabled={outputState === "loading"}
        >
          Generate Another
        </button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
