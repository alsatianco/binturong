import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";
import {
  PREVIEW_BYTES,
  previewPrefix,
  fileMatches,
  type Match,
} from "./homeModel";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  native: false,
  drop: null as
    null | ((event: { payload: { type: string; paths?: string[] } }) => void),
  off: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: () => mocks.native,
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (callback: typeof mocks.drop) => {
      mocks.drop = callback;
      return mocks.off;
    },
  }),
}));
const tools = [
  { id: "json-format", name: "JSON Format/Validate" },
  { id: "jwt-debugger", name: "JWT Debugger" },
  { id: "html-preview", name: "HTML Preview" },
  { id: "base64", name: "Base64 String Encode/Decode" },
  { id: "png-to-jpg-converter", name: "PNG to JPG Converter" },
  { id: "image-to-text-converter", name: "Image to Text Converter (OCR)" },
  { id: "qr-code", name: "QR Code Reader/Generator" },
  { id: "word-to-markdown", name: "Word to Markdown Converter" },
];
const kinds = new Map(
  tools.map((tool) => [
    tool.id,
    ["json-format", "base64"].includes(tool.id) ? "formatter" : "converter",
  ]),
);
const match = (id: string): Match => ({
  toolId: id,
  toolName: tools.find((t) => t.id === id)!.name,
  confidence: 90,
  reason: "Readable explanation.",
});
function show(overrides: Partial<Parameters<typeof Home>[0]> = {}) {
  const props = {
    active: true,
    shortcutsEnabled: true,
    tools,
    executionKinds: kinds,
    recents: [],
    onOpen: vi.fn(),
    onGroup: vi.fn(),
    ...overrides,
  };
  return { ...render(<Home {...props} />), props };
}
async function type(value: string) {
  fireEvent.change(screen.getByLabelText("Paste text, or type a tool name"), {
    target: { value },
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 280));
  });
}
beforeEach(() => {
  mocks.native = false;
  mocks.drop = null;
  mocks.off.mockReset();
  mocks.invoke.mockReset();
  mocks.invoke.mockImplementation(async (cmd: string) =>
    cmd === "detect_clipboard_content"
      ? { topMatches: [match("json-format")] }
      : '{"ok":true}',
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Home", () => {
  it("debounces detection and ignores older responses", async () => {
    const pending: Array<(value: { topMatches: Match[] }) => void> = [];
    mocks.invoke.mockImplementation((cmd: string) =>
      cmd === "detect_clipboard_content"
        ? new Promise((resolve) => pending.push(resolve))
        : Promise.resolve("{}"),
    );
    show();
    fireEvent.change(screen.getByLabelText("Paste text, or type a tool name"), {
      target: { value: "first value" },
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 280));
    });
    await type("second value");
    await act(async () => pending[1]({ topMatches: [match("json-format")] }));
    expect(screen.getByText("This looks like JSON")).toBeInTheDocument();
    await act(async () => pending[0]({ topMatches: [match("jwt-debugger")] }));
    expect(
      screen.queryByText("This looks like a JWT token"),
    ).not.toBeInTheDocument();
  });

  it("bounds multibyte previews but hands off every byte", async () => {
    const { props } = show();
    const input = '"' + "猫".repeat(50_000) + '"';
    await type(input);
    const detected = mocks.invoke.mock.calls.find(
      ([cmd]) => cmd === "detect_clipboard_content",
    )![1].content;
    expect(new TextEncoder().encode(detected).length).toBeLessThanOrEqual(
      PREVIEW_BYTES,
    );
    expect(detected).not.toContain("�");
    expect(
      screen.getByText(/Preview uses the first 64 KB/),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(props.onOpen).toHaveBeenCalledWith("json-format", input, "format");
    expect(mocks.invoke).toHaveBeenCalledWith(
      "run_formatter_tool",
      expect.objectContaining({ input: detected }),
    );
  });

  it("sandboxes HTML and blocks external resource loading", async () => {
    const markup =
      '<img src="https://example.com/track"><script>parent.alert(1)</script><h1>Hello</h1>';
    mocks.invoke.mockImplementation(async (cmd: string) =>
      cmd === "detect_clipboard_content"
        ? { topMatches: [match("html-preview")] }
        : markup,
    );
    show();
    await type(markup);
    const frame = screen.getByTitle("HTML live preview");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame.getAttribute("srcdoc")).toContain("default-src 'none'");
  });

  it("shows the decoded JWT header, payload, and expiry", async () => {
    mocks.invoke.mockImplementation(async (cmd: string) =>
      cmd === "detect_clipboard_content"
        ? { topMatches: [match("jwt-debugger")] }
        : JSON.stringify({
            header: { alg: "HS256" },
            payload: { sub: "ada", exp: 1822000000 },
            isExpired: false,
          }),
    );
    show();
    await type("eyJ.eyJ.signature");
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Payload")).toBeInTheDocument();
    expect(screen.getByText(/^Expires /)).toBeInTheDocument();
  });

  it("treats tool names as navigation rather than input data", async () => {
    const { props } = show();
    await type("JWT Debugger");
    expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(props.onOpen).toHaveBeenCalledWith(
      "jwt-debugger",
      undefined,
      "format",
    );
  });

  it("shows up to six recents with relative times", () => {
    show({
      recents: tools.map((tool) => ({
        toolId: tool.id,
        lastUsedAtUnix: Math.floor(Date.now() / 1000) - 120,
        useCount: 2,
      })),
    });
    expect(screen.getByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.getAllByText("2 min ago")).toHaveLength(6);
    expect(
      screen.queryByRole("heading", { name: "Popular tools" }),
    ).not.toBeInTheDocument();
  });

  it("handles a native file path and transfers encoded file content", async () => {
    mocks.native = true;
    mocks.invoke.mockResolvedValue({
      name: "picture.png",
      kind: "image",
      extension: "png",
      input: "IMAGE_BASE64:image/png;base64,cG5n",
    });
    const { props, unmount } = show();
    await waitFor(() => expect(mocks.drop).toBeTruthy());
    await act(async () =>
      mocks.drop!({ payload: { type: "drop", paths: ["/tmp/picture.png"] } }),
    );
    expect(mocks.invoke).toHaveBeenCalledWith("read_home_file", {
      path: "/tmp/picture.png",
    });
    expect(screen.getByText("picture.png")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(props.onOpen).toHaveBeenCalledWith(
      "png-to-jpg-converter",
      "IMAGE_BASE64:image/png;base64,cG5n",
      "format",
    );
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "run_converter_tool",
      expect.anything(),
    );
    unmount();
    expect(mocks.off).toHaveBeenCalled();
  });

  it("routes Word files to Word to Markdown", () => {
    expect(
      fileMatches(
        {
          name: "a.docx",
          extension: "docx",
          kind: "document",
          input: "DOCX_BASE64:eA==",
        },
        tools,
      ).map((m) => m.toolId),
    ).toEqual(["word-to-markdown"]);
  });

  it("reports detection failures without showing a stale match", async () => {
    mocks.invoke.mockRejectedValue("offline");
    show();
    await type("some content");
    expect(
      screen.getByText(/Could not detect this content/),
    ).toBeInTheDocument();
  });

  it("leaves small complete strings intact", () => {
    expect(previewPrefix("hello 猫\n")).toBe("hello 猫\n");
  });
});
