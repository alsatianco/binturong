import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type ToolOutputState } from "../components/tool-shell/ToolShell";

// ── Types re-declared locally so the hook is self-contained ────────────

type FormatMode = "format" | "minify";
type CaseConverterMode =
  | "sentence"
  | "lower"
  | "upper"
  | "capitalized"
  | "alternating"
  | "title"
  | "inverse"
  | "camel"
  | "snake"
  | "kebab"
  | "pascal"
  | "constant"
  | "dot"
  | "path";

type BatchDelimiterMode = "newline" | "tab" | "comma" | "custom";

export type ToolRunOverrides = {
  formatterMode?: FormatMode;
  caseConverterMode?: CaseConverterMode;
  /** Generic mode for converter tools that need a mode passed via JSON wrapping. */
  converterMode?: string;
  indentSize?: number;
  inputOverride?: string;
};

type BatchItemResult = {
  index: number;
  input: string;
  output: string;
  error: string;
};

type ToolExecutionKind = "formatter" | "converter" | "demo";

type ToolHistoryRecord = {
  id: number;
  toolId: string;
  inputSnapshot: string;
  outputSnapshot: string;
  createdAtUnix: number;
};

type TabWorkspaceState = {
  name: string;
  greetMsg: string;
  notes: string;
  formatMode: FormatMode;
  caseConverterMode: CaseConverterMode;
  indentSize: number;
  batchModeEnabled: boolean;
  batchDelimiterMode: BatchDelimiterMode;
  batchCustomDelimiter: string;
  batchResults: BatchItemResult[];
  outputState: ToolOutputState;
  outputError: string;
};

type WorkspaceTab = {
  id: string;
  toolId: string;
  title: string;
};

/** Minimal interface for the cancelable-progress task used by the demo path. */
type GreetTask = {
  run: (input: { operationId: string; name: string }) => Promise<string>;
};

// ── Helpers (pure functions, duplicated from App.tsx) ───────────────────

function createDefaultTabWorkspaceState(): TabWorkspaceState {
  return {
    name: "",
    greetMsg: "",
    notes: "",
    formatMode: "format",
    caseConverterMode: "sentence",
    indentSize: 2,
    batchModeEnabled: false,
    batchDelimiterMode: "newline",
    batchCustomDelimiter: "",
    batchResults: [],
    outputState: "idle",
    outputError: "",
  };
}

function resolveBatchDelimiter(
  mode: BatchDelimiterMode,
  customDelimiter: string,
): string {
  switch (mode) {
    case "tab":
      return "\t";
    case "comma":
      return ",";
    case "custom":
      if (!customDelimiter) {
        throw new Error("Custom delimiter cannot be empty in batch mode");
      }
      return customDelimiter;
    case "newline":
    default:
      return "\n";
  }
}

function splitBatchInput(
  input: string,
  mode: BatchDelimiterMode,
  customDelimiter: string,
): string[] {
  const delimiter = resolveBatchDelimiter(mode, customDelimiter);
  const parts =
    delimiter === "\n" ? input.split(/\r?\n/) : input.split(delimiter);
  return parts.filter((part) => part.trim().length > 0);
}

function formatBatchResultsAsText(results: BatchItemResult[]): string {
  return results
    .map((result) =>
      result.error
        ? `[${result.index}] ERROR: ${result.error}`
        : `[${result.index}] ${result.output}`,
    )
    .join("\n");
}

function extractBackendErrorText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error !== null && error !== undefined) {
    if (typeof error === "object" && "message" in error) {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string") {
        return message;
      }
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // ignore JSON serialization failures
    }
  }

  return "";
}

function parseStructuredBackendError(raw: string): {
  message?: string;
  code?: string;
  context?: string;
  suggestion?: string;
  technicalDetails?: string;
} | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      return parsed as {
        message?: string;
        code?: string;
        context?: string;
        suggestion?: string;
        technicalDetails?: string;
      };
    }
  } catch {
    // Not JSON - return null so the caller uses the raw string.
  }
  return null;
}

function formatRustBackendError(error: unknown, fallbackMessage: string): string {
  const raw = extractBackendErrorText(error);
  const parsed = raw ? parseStructuredBackendError(raw) : null;

  if (parsed) {
    const summary = parsed.message?.trim() || fallbackMessage;
    const lines = [
      summary,
      parsed.code ? `Code: ${parsed.code}` : null,
      parsed.context ? `Context: ${parsed.context}` : null,
      parsed.suggestion ? `Suggestion: ${parsed.suggestion}` : null,
      parsed.technicalDetails ? `Details: ${parsed.technicalDetails}` : null,
    ].filter((value): value is string => Boolean(value));
    return lines.join("\n");
  }

  return raw || fallbackMessage;
}

// ── Hook params ────────────────────────────────────────────────────────

export type UseToolExecutionParams = {
  activeTab: WorkspaceTab | null;
  tabWorkspaceById: Record<string, TabWorkspaceState>;
  setTabWorkspaceById: Dispatch<SetStateAction<Record<string, TabWorkspaceState>>>;
  executionKind: ToolExecutionKind;
  greetTask: GreetTask;
  autoCopyByToolId: Record<string, boolean>;
  activeToolSupportsBatch: boolean;
  activeToolIdRef: MutableRefObject<string | null>;
  setActiveToolHistory: Dispatch<SetStateAction<ToolHistoryRecord[]>>;
  setDatabaseError: Dispatch<SetStateAction<string | null>>;
};

// ── Hook ───────────────────────────────────────────────────────────────

export function useToolExecution({
  activeTab,
  tabWorkspaceById,
  setTabWorkspaceById,
  executionKind,
  greetTask,
  autoCopyByToolId,
  activeToolSupportsBatch,
  activeToolIdRef,
  setActiveToolHistory,
  setDatabaseError,
}: UseToolExecutionParams) {
  const greetInActiveTab = useCallback(
    async (options?: ToolRunOverrides) => {
      if (!activeTab) {
        return;
      }

      const currentTabId = activeTab.id;
      const currentToolId = activeTab.toolId;
      const operationId = `greet-${currentTabId}`;
      const currentWorkspace =
        tabWorkspaceById[currentTabId] ?? createDefaultTabWorkspaceState();

      // Build a single resolved execution context - all downstream code
      // reads from `ctx` rather than mixing overrides with raw workspace state.
      const ctx = {
        input: (options?.inputOverride ?? currentWorkspace.name).trim(),
        formatterMode: options?.formatterMode ?? currentWorkspace.formatMode,
        caseConverterMode: options?.caseConverterMode ?? currentWorkspace.caseConverterMode,
        converterMode: options?.converterMode,
        indentSize: options?.indentSize ?? currentWorkspace.indentSize,
        batchModeEnabled: currentWorkspace.batchModeEnabled,
        batchDelimiterMode: currentWorkspace.batchDelimiterMode,
        batchCustomDelimiter: currentWorkspace.batchCustomDelimiter,
      };

      const greetTarget = ctx.input || "Developer";

      // Sanitize input for history: strip sensitive fields (e.g. AES passphrase)
      let snapshotName = ctx.input;
      if (currentToolId === "aes-encrypt") {
        try {
          const parsed = JSON.parse(ctx.input);
          if (parsed && typeof parsed === "object" && "text" in parsed) {
            snapshotName = JSON.stringify({ text: parsed.text, key: "***" });
          }
        } catch { /* not JSON, use as-is */ }
      }
      const inputSnapshot = JSON.stringify({
        name: snapshotName,
        notes: currentWorkspace.notes,
        formatMode: ctx.formatterMode,
        caseConverterMode: ctx.caseConverterMode,
        indentSize: ctx.indentSize,
        batchModeEnabled: ctx.batchModeEnabled,
        batchDelimiterMode: ctx.batchDelimiterMode,
        batchCustomDelimiter: ctx.batchCustomDelimiter,
      });

      setTabWorkspaceById((current) => ({
        ...current,
        [currentTabId]: {
          ...(current[currentTabId] ?? createDefaultTabWorkspaceState()),
          outputState: "loading",
          outputError: "",
        },
      }));

      try {
        const runSingleTransform = async (
          singleInput: string,
          itemIndex: number,
        ): Promise<string> => {
          if (executionKind === "formatter") {
            return invoke<string>("run_formatter_tool", {
              toolId: currentToolId,
              input: singleInput,
              mode: ctx.formatterMode,
              indentSize: ctx.indentSize,
            });
          }

          if (executionKind === "converter") {
            // Wrap input as JSON { text, mode } when a mode needs to be passed.
            // case-converter uses its own mode state; other tools use generic converterMode.
            let converterInput = singleInput;
            if (currentToolId === "case-converter") {
              converterInput = JSON.stringify({ text: singleInput, mode: ctx.caseConverterMode });
            } else if (ctx.converterMode) {
              converterInput = JSON.stringify({ text: singleInput, mode: ctx.converterMode });
            }
            return invoke<string>("run_converter_tool", {
              toolId: currentToolId,
              input: converterInput,
            });
          }

          return greetTask.run({
            operationId: `${operationId}-${itemIndex}`,
            name: singleInput.trim() || greetTarget,
          });
        };

        let response = "";
        let batchResults: BatchItemResult[] = [];
        let nextOutputState: ToolOutputState = "success";
        let nextOutputError = "";

        if (activeToolSupportsBatch && ctx.batchModeEnabled) {
          if (executionKind === "demo") {
            throw new Error("Batch mode is unavailable for this tool");
          }

          const batchInputs = splitBatchInput(
            ctx.input,
            ctx.batchDelimiterMode,
            ctx.batchCustomDelimiter,
          );

          if (batchInputs.length === 0) {
            throw new Error("Batch mode requires at least one non-empty item");
          }

          for (let index = 0; index < batchInputs.length; index += 1) {
            const itemInput = batchInputs[index];
            try {
              const itemOutput = await runSingleTransform(itemInput, index + 1);
              batchResults.push({
                index: index + 1,
                input: itemInput,
                output: itemOutput,
                error: "",
              });
            } catch (itemError) {
              batchResults.push({
                index: index + 1,
                input: itemInput,
                output: "",
                error:
                  itemError instanceof Error
                    ? itemError.message
                    : "failed to process batch item",
              });
            }
          }

          response = formatBatchResultsAsText(batchResults);
          const failedCount = batchResults.filter((result) => Boolean(result.error)).length;
          const successCount = batchResults.length - failedCount;
          nextOutputState = successCount > 0 ? "success" : "error";
          nextOutputError =
            failedCount > 0
              ? `${failedCount} of ${batchResults.length} items failed.`
              : "";
        } else {
          response = await runSingleTransform(ctx.input, 0);
        }

        setTabWorkspaceById((current) => ({
          ...current,
          [currentTabId]: {
            ...(current[currentTabId] ?? createDefaultTabWorkspaceState()),
            greetMsg: response,
            caseConverterMode: ctx.caseConverterMode,
            batchResults,
            outputState: nextOutputState,
            outputError: nextOutputError,
          },
        }));

        if (autoCopyByToolId[currentToolId] && response) {
          void navigator.clipboard.writeText(response).catch(() => undefined);
        }

        void invoke<ToolHistoryRecord>("append_tool_history", {
          toolId: currentToolId,
          inputSnapshot,
          outputSnapshot: response,
        })
          .then((record) => {
            if (activeToolIdRef.current !== record.toolId) {
              return;
            }

            setActiveToolHistory((current) => [
              record,
              ...current.filter((entry) => entry.id !== record.id),
            ].slice(0, 20));
          })
          .catch((historyError) =>
            setDatabaseError(
              historyError instanceof Error
                ? historyError.message
                : "failed to record tool history",
            ),
          );
      } catch (error) {
        console.error(`[greetInActiveTab] ERROR tool="${currentToolId}" execKind="${executionKind}":`, error);
        const wasCanceled =
          error instanceof Error &&
          error.message.toLowerCase().includes("canceled");
        const errorOutput = formatRustBackendError(
          error,
          "Tool execution failed in Rust backend",
        );
        setTabWorkspaceById((current) => ({
          ...current,
          [currentTabId]: {
            ...(current[currentTabId] ?? createDefaultTabWorkspaceState()),
            greetMsg: "",
            caseConverterMode: ctx.caseConverterMode,
            batchResults: [],
            outputState: wasCanceled ? "idle" : "error",
            outputError: wasCanceled ? "" : errorOutput,
          },
        }));

        if (!wasCanceled) {
          void invoke<ToolHistoryRecord>("append_tool_history", {
            toolId: currentToolId,
            inputSnapshot,
            outputSnapshot: errorOutput,
          })
            .then((record) => {
              if (activeToolIdRef.current !== record.toolId) {
                return;
              }

              setActiveToolHistory((current) => [
                record,
                ...current.filter((entry) => entry.id !== record.id),
              ].slice(0, 20));
            })
            .catch((historyError) =>
              setDatabaseError(
                historyError instanceof Error
                  ? historyError.message
                  : "failed to record tool history",
              ),
            );
        }
      }
    },
    [
      activeTab,
      activeToolSupportsBatch,
      autoCopyByToolId,
      executionKind,
      greetTask,
      tabWorkspaceById,
      activeToolIdRef,
      setActiveToolHistory,
      setDatabaseError,
      setTabWorkspaceById,
    ],
  );

  return { greetInActiveTab };
}
