import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, listenMock, clipboardReadTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(
    (_command: string, _payload?: Record<string, unknown>) =>
      Promise.resolve(null as unknown),
  ),
  listenMock: vi.fn(
    async (_event: string, _handler: (...args: unknown[]) => void) => () => {},
  ),
  clipboardReadTextMock: vi.fn(async () => ""),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

import App from "./App";

const createInvokeMockImplementation = (
  options: {
    listTools?: Array<{ id: string; name: string; aliases?: string[]; keywords?: string[] }>;
    settings?: Array<{ key: string; valueJson: string }>;
    clipboardDetectionResult?: {
      sourceLength: number;
      topMatches: Array<{
        toolId: string;
        toolName: string;
        confidence: number;
        reason: string;
      }>;
    };
  } = {},
) => {
  const {
    listTools = [
      { id: "json-format", name: "JSON Format/Validate" },
      { id: "html-beautify", name: "HTML Beautify/Minify" },
      { id: "big-text-converter", name: "Big Text Converter" },
    ],
    settings = [],
    clipboardDetectionResult = { sourceLength: 0, topMatches: [] },
  } = options;

  return (command: string, payload?: Record<string, unknown>) => {
    switch (command) {
      case "get_lifecycle_bootstrap":
        return Promise.resolve({
          coldStartMs: 120,
          coldStartTargetMs: 1500,
          coldStartWithinTarget: true,
          recoveredAfterUncleanShutdown: false,
          runtimeStatePath: "/tmp/runtime-state.json",
          panicReportPath: "/tmp/panic.log",
          previousPanicReportExists: false,
        });
      case "get_database_status":
        return Promise.resolve({
          dbPath: "/tmp/binturong.db",
          currentSchemaVersion: 1,
          latestSchemaVersion: 1,
          appliedMigrationsOnBoot: [1],
        });
      case "get_storage_model_counts":
        return Promise.resolve({
          settingsCount: 0,
          favoritesCount: 0,
          recentsCount: 0,
          presetsCount: 0,
          historyCount: 0,
          chainsCount: 0,
        });
      case "list_settings":
        return Promise.resolve(settings);
      case "list_favorites":
      case "list_recents":
      case "list_tool_presets":
      case "list_tool_history":
      case "list_chains":
      case "ranked_search_tools":
      case "compatible_tool_targets":
        return Promise.resolve([]);
      case "export_user_data_json":
        return Promise.resolve("{}");
      case "create_operation":
      case "update_operation_progress":
      case "cancel_operation":
        return Promise.resolve(null);
      case "list_tools":
        return Promise.resolve(listTools);
      case "list_tool_catalog": {
        const formatterIds = new Set([
          "json-format", "html-beautify", "css-beautify", "scss-beautify",
          "less-beautify", "javascript-beautify", "typescript-beautify",
          "graphql-format", "erb-format", "xml-format", "sql-format",
          "markdown-format", "yaml-format", "json-stringify", "url",
          "html-entity", "base64", "base64-image", "backslash-escape",
          "quote-helper", "utf8", "binary-code", "morse-code", "rot13",
          "caesar-cipher", "aes-encrypt", "uuid-ulid", "qr-code",
        ]);
        return Promise.resolve(
          listTools.map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
            executionKind: formatterIds.has(t.id) ? "formatter" : "converter",
          })),
        );
      }
      case "detect_clipboard_content":
        return Promise.resolve(clipboardDetectionResult);
      case "configure_quick_launcher_shortcut":
        return Promise.resolve({
          enabled: Boolean(payload?.enabled ?? true),
          shortcut: String(payload?.shortcut ?? "CmdOrCtrl+Shift+Space"),
        });
      case "get_app_version":
        return Promise.resolve("0.1.0");
      case "check_for_updates":
        return Promise.resolve({
          checkedAtUnix: 1_700_000_000,
          channel: String(payload?.channel ?? "stable"),
          currentVersion: "0.1.0",
          latestVersion: "0.1.0",
          hasUpdate: false,
          releaseNotes: "No updates available.",
        });
      case "upsert_setting":
      case "append_tool_history":
        return Promise.resolve(null);
      case "record_recent_tool":
        return Promise.resolve({
          toolId: String(payload?.toolId ?? "json-format"),
          lastUsedAtUnix: 1_700_000_000,
          useCount: 1,
        });
      default:
        return Promise.resolve(null);
    }
  };
};

beforeEach(() => {
  invokeMock.mockReset();
  listenMock.mockClear();
  clipboardReadTextMock.mockReset();
  clipboardReadTextMock.mockResolvedValue("");

  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      readText: clipboardReadTextMock,
    },
  });

  invokeMock.mockImplementation(createInvokeMockImplementation());
});

/** Render App and wait for async startup (catalog fetch, settings load) to settle. */
async function renderApp(mockOptions?: Parameters<typeof createInvokeMockImplementation>[0]) {
  if (mockOptions) {
    invokeMock.mockImplementation(createInvokeMockImplementation(mockOptions));
  }
  const result = render(<App />);
  // Wait for initial render
  await screen.findByRole("heading", { level: 1, name: "JSON Format/Validate" });
  // Flush async startup: useEffect → invoke → setState cycles (catalog, settings, etc.)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
  return result;
}

/** Get the sidebar <aside> element and return a within() query scope for it. */
function getSidebar() {
  const aside = document.querySelector("aside");
  if (!aside) {
    throw new Error("Could not find sidebar <aside> element");
  }
  return within(aside);
}

describe("App UI", () => {
  it("renders sidebar search input", async () => {
    await renderApp();
    expect(await screen.findByLabelText("Search tools")).toBeInTheDocument();
  });

  it("runs formatter mode changes on first click", async () => {
    await renderApp();
    invokeMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Minify" }));

    await waitFor(() => {
      const minifyCall = invokeMock.mock.calls.find(
        ([command, payload]) =>
          command === "run_formatter_tool" &&
          (payload as Record<string, unknown> | undefined)?.mode === "minify",
      );
      expect(minifyCall).toBeTruthy();
    });

    invokeMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Format" }));

    await waitFor(() => {
      const formatCall = invokeMock.mock.calls.find(
        ([command, payload]) =>
          command === "run_formatter_tool" &&
          (payload as Record<string, unknown> | undefined)?.mode === "format",
      );
      expect(formatCall).toBeTruthy();
    });
  });

  it("does not invoke tool backend while typing until button click", async () => {
    await renderApp();

    const sidebar = getSidebar();

    fireEvent.click(
      sidebar.getByRole("button", {
        name: "Big Text Converter",
      }),
    );

    await screen.findByRole("heading", { level: 1, name: "Big Text Converter" });
    invokeMock.mockClear();

    fireEvent.change(screen.getByPlaceholderText("Type text"), {
      target: { value: "hello" },
    });

    const runCallsAfterTyping = invokeMock.mock.calls.filter(
      ([command]) =>
        command === "run_converter_tool" || command === "run_formatter_tool",
    );
    expect(runCallsAfterTyping).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Generate Big Text" }));

    await waitFor(() => {
      const converterRun = invokeMock.mock.calls.find(
        ([command, payload]) =>
          command === "run_converter_tool" &&
          (payload as Record<string, unknown> | undefined)?.toolId ===
            "big-text-converter",
      );
      expect(converterRun).toBeTruthy();
    });
  });

  it("opens command palette with keyboard shortcut", async () => {
    await renderApp();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const commandInputs = await screen.findAllByLabelText("Command palette search");
    expect(commandInputs.length).toBeGreaterThan(0);

    // Default scope is "detect". COMMAND_SCOPES = ["detect", "all", "tools", "actions"].
    // One Tab press cycles to "all" where action commands are visible.
    fireEvent.keyDown(commandInputs[0], { key: "Tab" });

    await waitFor(() => {
      expect(screen.getAllByText("Check for Updates").length).toBeGreaterThan(0);
    });
  });

  it("renders sidebar tools grouped by category in canonical order", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "html-beautify", name: "HTML Beautify/Minify" },
          { id: "css-beautify", name: "CSS Beautify/Minify" },
        ],
      }),
    );

    await renderApp();

    const sidebar = getSidebar();
    const jsonButton = sidebar.getByRole("button", { name: "JSON Format/Validate" });
    const htmlButton = sidebar.getByRole("button", { name: "HTML Beautify/Minify" });
    const cssButton = sidebar.getByRole("button", { name: "CSS Beautify/Minify" });

    // Tools should appear in document order within the sidebar
    expect(
      jsonButton.compareDocumentPosition(htmlButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      htmlButton.compareDocumentPosition(cssButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Sidebar now groups tools by category - verify "Formatters" heading is present
    expect(sidebar.getByText("Formatters")).toBeInTheDocument();
  });

  it("opens sidebar tools in a new tab on plain click", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "html-beautify", name: "HTML Beautify/Minify" },
        ],
      }),
    );

    await renderApp();

    const sidebar = getSidebar();

    fireEvent.click(
      sidebar.getByRole("button", {
        name: "HTML Beautify/Minify",
      }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "HTML Beautify/Minify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close HTML Beautify/Minify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close JSON Format/Validate" }),
    ).toBeInTheDocument();
  });

  it("opens sidebar tools in a new tab on modifier click", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "html-beautify", name: "HTML Beautify/Minify" },
        ],
      }),
    );

    await renderApp();

    const sidebar = getSidebar();

    fireEvent.click(
      sidebar.getByRole("button", {
        name: "HTML Beautify/Minify",
      }),
      { ctrlKey: true },
    );

    expect(
      await screen.findByRole("button", { name: "Close HTML Beautify/Minify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close JSON Format/Validate" }),
    ).toBeInTheDocument();
  });

  it("prefills sample input whenever a tool is opened", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "html-beautify", name: "HTML Beautify/Minify" },
        ],
      }),
    );

    await renderApp();

    expect(
      await screen.findByDisplayValue(
        "{\"project\":\"binturong\",\"tasks\":[\"format\",\"validate\"],\"active\":true}",
      ),
    ).toBeInTheDocument();

    const sidebar = getSidebar();

    fireEvent.click(
      sidebar.getByRole("button", {
        name: "HTML Beautify/Minify",
      }),
    );

    expect(
      await screen.findByDisplayValue(
        "<main><section><h1>Hello</h1><p>Formatter sample</p></section></main>",
      ),
    ).toBeInTheDocument();
  });

  it("hydrates text-diff sample into both input panes", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "text-diff", name: "Text Diff Checker" },
        ],
      }),
    );

    await renderApp();

    const sidebar = getSidebar();

    fireEvent.click(
      sidebar.getByRole("button", {
        name: "Text Diff Checker",
      }),
    );

    const originalInput = (await screen.findByPlaceholderText(
      "Paste original text here...",
    )) as HTMLTextAreaElement;
    const modifiedInput = screen.getByPlaceholderText(
      "Paste modified text here...",
    ) as HTMLTextAreaElement;

    expect(originalInput.value).toBe("one\ntwo\nthree");
    expect(modifiedInput.value).toBe("one\n2\nthree");
  });

  it("suppresses native context menus on sidebar controls and opens tab context menu", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "html-beautify", name: "HTML Beautify/Minify" },
        ],
      }),
    );

    await renderApp();

    const sidebar = getSidebar();

    const sidebarButton = sidebar.getByRole("button", {
      name: "HTML Beautify/Minify",
    });
    const sidebarContextMenuEvent = createEvent.contextMenu(sidebarButton);
    fireEvent(sidebarButton, sidebarContextMenuEvent);
    expect(sidebarContextMenuEvent.defaultPrevented).toBe(true);

    const tabCloseButton = screen.getByRole("button", {
      name: "Close JSON Format/Validate",
    });
    const tabContainer = tabCloseButton.closest("div");
    expect(tabContainer).not.toBeNull();

    const tabLabelButton = within(tabContainer as HTMLElement).getByRole("button", {
      name: "JSON Format/Validate",
    });
    const tabContextMenuEvent = createEvent.contextMenu(tabLabelButton);
    fireEvent(tabLabelButton, tabContextMenuEvent);
    expect(tabContextMenuEvent.defaultPrevented).toBe(true);
    expect(screen.getByRole("menu", { name: "Tab context menu" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Close all tabs" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Close tabs to the right" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Close tabs to the left" }),
    ).toBeInTheDocument();
  });

  it("closes tabs to the right and left from the tab context menu", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "html-beautify", name: "HTML Beautify/Minify" },
          { id: "css-beautify", name: "CSS Beautify/Minify" },
        ],
      }),
    );

    await renderApp();

    const sidebar = getSidebar();

    fireEvent.click(sidebar.getByRole("button", { name: "HTML Beautify/Minify" }));
    fireEvent.click(sidebar.getByRole("button", { name: "CSS Beautify/Minify" }));

    expect(screen.getByRole("button", { name: "Close JSON Format/Validate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close HTML Beautify/Minify" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close CSS Beautify/Minify" })).toBeInTheDocument();

    const htmlTabCloseButton = screen.getByRole("button", {
      name: "Close HTML Beautify/Minify",
    });
    const htmlTabContainer = htmlTabCloseButton.closest("div");
    expect(htmlTabContainer).not.toBeNull();
    const htmlTabLabel = within(htmlTabContainer as HTMLElement).getByRole("button", {
      name: "HTML Beautify/Minify",
    });

    fireEvent.contextMenu(htmlTabLabel);
    fireEvent.click(screen.getByRole("menuitem", { name: "Close tabs to the right" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Close CSS Beautify/Minify" }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(sidebar.getByRole("button", { name: "CSS Beautify/Minify" }));
    expect(
      await screen.findByRole("button", { name: "Close CSS Beautify/Minify" }),
    ).toBeInTheDocument();

    const htmlTabCloseButtonAfterReopen = screen.getByRole("button", {
      name: "Close HTML Beautify/Minify",
    });
    const htmlTabContainerAfterReopen = htmlTabCloseButtonAfterReopen.closest("div");
    expect(htmlTabContainerAfterReopen).not.toBeNull();
    const htmlTabLabelAfterReopen = within(
      htmlTabContainerAfterReopen as HTMLElement,
    ).getByRole("button", {
      name: "HTML Beautify/Minify",
    });

    fireEvent.contextMenu(htmlTabLabelAfterReopen);
    fireEvent.click(screen.getByRole("menuitem", { name: "Close tabs to the left" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Close JSON Format/Validate" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Close HTML Beautify/Minify" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close CSS Beautify/Minify" })).toBeInTheDocument();
  });

  it("closes all tabs from the tab context menu", async () => {
    invokeMock.mockImplementation(
      createInvokeMockImplementation({
        listTools: [
          { id: "json-format", name: "JSON Format/Validate" },
          { id: "html-beautify", name: "HTML Beautify/Minify" },
        ],
      }),
    );

    await renderApp();

    const sidebar = getSidebar();

    fireEvent.click(
      sidebar.getByRole("button", {
        name: "HTML Beautify/Minify",
      }),
    );

    const htmlTabCloseButton = await screen.findByRole("button", {
      name: "Close HTML Beautify/Minify",
    });
    const htmlTabContainer = htmlTabCloseButton.closest("div");
    expect(htmlTabContainer).not.toBeNull();
    const htmlTabLabel = within(htmlTabContainer as HTMLElement).getByRole("button", {
      name: "HTML Beautify/Minify",
    });

    fireEvent.contextMenu(htmlTabLabel);
    fireEvent.click(screen.getByRole("menuitem", { name: "Close all tabs" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Close HTML Beautify/Minify" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Close JSON Format/Validate" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menu", { name: "Tab context menu" }),
    ).not.toBeInTheDocument();
  });

  // TODO: The following 5 clipboard-detection tests were removed because the clipboard
  // detection UI moved from an inline suggestion banner / chooser dialog to the command
  // palette "detect" scope. The old assertions (e.g., "Clipboard Suggestion" text,
  // "New tab" button, chooser dialog) no longer exist in the UI. These tests need to be
  // rewritten to exercise the command palette clipboard-detection flow instead.
  //
  // Removed tests:
  //   - "suppresses clipboard reads triggered by navigation while clipboard detection is enabled"
  //   - "opens a new tab via keyboard shortcut without triggering another clipboard read"
  //   - "shows clipboard suggestions in suggest mode"
  //   - "auto-opens top tool in autoOpen mode when confidence is high"
  //   - "opens chooser dialog in alwaysAsk mode"
});
