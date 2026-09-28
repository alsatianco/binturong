import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useToolExecution } from "./useToolExecution";
import type { TabWorkspaceState } from "./useTabManager";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const workspace: TabWorkspaceState = {
  name: "  original  ", greetMsg: "", notes: "", formatMode: "format",
  caseConverterMode: "sentence", indentSize: 2, batchModeEnabled: false,
  batchDelimiterMode: "newline", batchCustomDelimiter: "", batchResults: [],
  outputState: "idle", outputError: "",
};

function setup() {
  return renderHook(() => {
    const [tabs, setTabs] = useState<Record<string, TabWorkspaceState>>({ first: workspace });
    const [, setHistory] = useState<Array<{
      id: number; toolId: string; inputSnapshot: string;
      outputSnapshot: string; createdAtUnix: number;
    }>>([]);
    const [, setError] = useState<string | null>(null);
    const execution = useToolExecution({
      activeTab: { id: "first", toolId: "base64", title: "Base64" },
      tabWorkspaceById: tabs,
      setTabWorkspaceById: setTabs,
      executionKind: "formatter",
      greetTask: { run: vi.fn() },
      autoCopyByToolId: {},
      activeToolSupportsBatch: false,
      activeToolIdRef: { current: "base64" },
      setActiveToolHistory: setHistory,
      setDatabaseError: setError,
    });
    return { ...execution, tabs, setTabs };
  });
}

describe("tool execution", () => {
  it("passes text unchanged and ignores a result after Clear", async () => {
    const pending = deferred<string>();
    invokeMock.mockReset().mockImplementation((command: string) =>
      command === "run_formatter_tool" ? pending.promise : Promise.resolve(null));
    const { result } = setup();
    let run!: Promise<void>;

    act(() => { run = result.current.greetInActiveTab(); });
    expect(invokeMock).toHaveBeenCalledWith("run_formatter_tool", expect.objectContaining({ input: "  original  " }));

    act(() => {
      result.current.invalidateRun("first");
      result.current.setTabs((current) => ({ first: { ...current.first, outputState: "idle", greetMsg: "" } }));
    });
    await act(async () => { pending.resolve("late output"); await run; });

    expect(result.current.tabs.first.greetMsg).toBe("");
    expect(result.current.tabs.first.outputState).toBe("idle");
    expect(invokeMock.mock.calls.some(([command]) => command === "append_tool_history")).toBe(false);
  });

  it("keeps the newer result when runs finish out of order", async () => {
    const older = deferred<string>();
    const newer = deferred<string>();
    let count = 0;
    invokeMock.mockReset().mockImplementation((command: string) =>
      command === "run_formatter_tool" ? (++count === 1 ? older.promise : newer.promise) : Promise.resolve(null));
    const { result } = setup();
    let first!: Promise<void>;
    let second!: Promise<void>;

    act(() => { first = result.current.greetInActiveTab(); second = result.current.greetInActiveTab(); });
    await act(async () => { newer.resolve("new result"); await second; });
    await act(async () => { older.resolve("old result"); await first; });

    await waitFor(() => expect(result.current.tabs.first.greetMsg).toBe("new result"));
  });
});
