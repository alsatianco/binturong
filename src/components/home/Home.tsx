import { useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getToolConfig } from "../tool-workspace/toolConfigs";
import { TOOL_GROUPS, getToolGlyph } from "../tool-workspace/toolGroups";
import {
  EXAMPLES,
  POPULAR,
  previewPrefix,
  relativeTime,
  fileMatches,
  previewMode,
  contentLabel,
  readBrowserFile,
  type HomeFile,
  type HomeTool,
  type Match,
  type Recent,
} from "./homeModel";
import "./home.css";

type Props = {
  active: boolean;
  shortcutsEnabled: boolean;
  tools: HomeTool[];
  executionKinds: Map<string, string>;
  recents: Recent[];
  onOpen: (toolId: string, input?: string, mode?: "format" | "minify") => void;
  onGroup: (group: string) => void;
};

type Result = {
  source: string;
  matches: Match[];
  output: string;
  error: string;
  search: boolean;
};
const NO_PREVIEW = new Set([
  "aes-encrypt",
  "regex-tester",
  "text-diff",
  "utm-generator",
  "text-replace",
  "word-to-markdown",
  "image-to-text-converter",
  "base64-image",
  "qr-code",
  "svg-to-png-converter",
]);

function Preview({ toolId, output }: { toolId: string; output: string }) {
  if (["html-preview", "markdown-preview", "html-beautify"].includes(toolId)) {
    // Sandbox disables scripts, forms, popups, and same-origin access. CSP also
    // prevents pasted markup from fetching remote resources or navigating itself.
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">`;
    return (
      <iframe
        title="HTML live preview"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={policy + output}
      />
    );
  }
  if (toolId === "jwt-debugger") {
    try {
      const jwt = JSON.parse(output);
      const exp = jwt.payload?.exp;
      return (
        <>
          <p className="home-preview-label">Header</p>
          <pre>{JSON.stringify(jwt.header, null, 2)}</pre>
          <p className="home-preview-label">Payload</p>
          <pre>{JSON.stringify(jwt.payload, null, 2)}</pre>
          <p className="home-preview-label">Expiry</p>
          <p>
            {typeof exp === "number" &&
            Number.isFinite(new Date(exp * 1000).getTime())
              ? `${jwt.isExpired ? "Expired" : "Expires"} ${new Date(exp * 1000).toLocaleString()}`
              : "No expiry claim"}
          </p>
          <p className="home-muted">Decoded only; signature not verified.</p>
        </>
      );
    } catch {
      /* Display the backend output if it is not a decoded JWT. */
    }
  }
  return <pre>{output}</pre>;
}

export function Home({
  active,
  shortcutsEnabled,
  tools,
  executionKinds,
  recents,
  onOpen,
  onGroup,
}: Props) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState<HomeFile | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const loadRevision = useRef(0);
  const snippet = useMemo(() => previewPrefix(input), [input]);
  const binaryFile = file && file.kind !== "text" ? file : null;
  const currentResult = result?.source === input ? result : null;
  const matches = binaryFile
    ? fileMatches(binaryFile, tools)
    : (currentResult?.matches ?? []);
  const top = matches[0];
  const isSearch = currentResult?.search ?? false;

  function changeInput(value: string) {
    loadRevision.current++;
    setInput(value);
    setFile(null);
    setNotice("");
    setResult(null);
  }
  async function loadFile(reader: () => Promise<HomeFile>) {
    const revision = ++loadRevision.current;
    setNotice("Reading file…");
    try {
      const next = await reader();
      if (loadRevision.current !== revision) return;
      setFile(next);
      setInput(next.input);
      setResult(null);
      setNotice("");
    } catch (error) {
      if (loadRevision.current === revision)
        setNotice(error instanceof Error ? error.message : String(error));
    }
  }
  function openMatch(match: Match) {
    onOpen(
      match.toolId,
      isSearch ? undefined : input,
      previewMode(match.toolId),
    );
  }

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active || binaryFile || !snippet.trim()) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      const next: Result = {
        source: input,
        matches: [],
        output: "",
        error: "",
        search: false,
      };
      try {
        // Tool names are navigation requests; data still uses the backend detector.
        const query = snippet.trim().toLowerCase();
        const named =
          query.length >= 2 && query.length < 80 && !query.includes("\n")
            ? tools
                .filter((tool) =>
                  [tool.name, tool.id, ...(tool.aliases ?? [])].some((name) =>
                    name.toLowerCase().includes(query),
                  ),
                )
                .slice(0, 6)
            : [];
        if (named.length) {
          next.search = true;
          next.matches = named.map((tool) => ({
            toolId: tool.id,
            toolName: tool.name,
            confidence: 100,
            reason: "Matches the tool name you typed.",
          }));
        } else {
          const detected = await invoke<{ topMatches: Match[] }>(
            "detect_clipboard_content",
            { content: snippet },
          );
          if (cancelled) return;
          next.matches = detected.topMatches.filter((match) =>
            tools.some((tool) => tool.id === match.toolId),
          );
          const first = next.matches[0];
          const kind = first && executionKinds.get(first.toolId);
          const config = first && getToolConfig(first.toolId);
          if (
            first &&
            kind &&
            !NO_PREVIEW.has(first.toolId) &&
            config?.template !== "H" &&
            config?.template !== "F"
          ) {
            try {
              next.output = previewPrefix(
                await invoke<string>(
                  kind === "formatter"
                    ? "run_formatter_tool"
                    : "run_converter_tool",
                  {
                    toolId: first.toolId,
                    input: snippet,
                    ...(kind === "formatter"
                      ? { mode: previewMode(first.toolId), indentSize: 2 }
                      : {}),
                  },
                ),
              );
            } catch (error) {
              next.error =
                typeof error === "string"
                  ? error
                  : "Could not preview this input. Open the tool for more options.";
            }
          }
        }
      } catch {
        next.error =
          "Could not detect this content. Try again or choose a tool below.";
      }
      if (!cancelled) {
        setResult(next);
        setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input, snippet, binaryFile, active, tools, executionKinds]);

  useEffect(() => {
    if (!active || !shortcutsEnabled || !top) return;
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        openMatch(top);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, shortcutsEnabled, top, input, isSearch, onOpen]);

  useEffect(() => {
    if (!active || !shortcutsEnabled || !isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview")
      .then(async ({ getCurrentWebview }) => {
        const off = await getCurrentWebview().onDragDropEvent((event) => {
          if (disposed) return;
          const payload = event.payload;
          setDragging(payload.type === "enter" || payload.type === "over");
          if (payload.type === "drop" && payload.paths[0]) {
            void loadFile(() =>
              invoke<HomeFile>("read_home_file", { path: payload.paths[0] }),
            );
          }
        });
        if (disposed) off();
        else unlisten = off;
      })
      .catch(() => {
        if (!disposed)
          setNotice("File drop is unavailable. Use Open file instead.");
      });
    return () => {
      disposed = true;
      unlisten?.();
      loadRevision.current++;
    };
  }, [active, shortcutsEnabled]);

  async function chooseFile() {
    if (!isTauri()) {
      fileInput.current?.click();
      return;
    }
    try {
      const path = await openDialog({ multiple: false, directory: false });
      if (typeof path === "string")
        await loadFile(() => invoke<HomeFile>("read_home_file", { path }));
    } catch (error) {
      setNotice(String(error));
    }
  }
  const recentTools = recents
    .flatMap((recent) => {
      const tool = tools.find((tool) => tool.id === recent.toolId);
      return tool
        ? [{ ...tool, when: relativeTime(recent.lastUsedAtUnix, now) }]
        : [];
    })
    .slice(0, 6);
  const quickTools = recentTools.length
    ? recentTools
    : POPULAR.flatMap((id) => {
        const tool = tools.find((tool) => tool.id === id);
        return tool ? [{ ...tool, when: "" }] : [];
      });
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

  return (
    <div className="home" hidden={!active}>
      <div className="home-intro">
        <img src="/home-mascot.png" alt="" width="52" height="52" />
        <div>
          <h1>What do you have?</h1>
          <p>
            Paste text, drop a file, or type a tool name. Binturong suggests the
            right tool from all {tools.length}. Nothing leaves this computer.
          </p>
        </div>
      </div>
      <div
        className={`home-drop ${dragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) void loadFile(() => readBrowserFile(dropped));
        }}
      >
        <label className="sr-only" htmlFor="home-input">
          Paste text, or type a tool name
        </label>
        <textarea
          ref={textarea}
          id="home-input"
          spellCheck={false}
          autoComplete="off"
          placeholder="Paste JSON, a JWT, a timestamp, a URL, a color, SQL…"
          value={binaryFile ? "" : input}
          onChange={(event) => changeInput(event.target.value)}
        />
        <div className="home-drop-bar">
          <span className="home-muted">
            {file ? file.name : "Paste, type, or drop a file here"}
          </span>
          {(input || file) && (
            <button
              type="button"
              onClick={() => {
                changeInput("");
                textarea.current?.focus();
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                changeInput(await navigator.clipboard.readText());
                textarea.current?.focus();
              } catch {
                setNotice(`Use ${modifier}+V to paste into the box.`);
              }
            }}
          >
            Paste from clipboard
          </button>
          <button type="button" onClick={() => void chooseFile()}>
            Open file…
          </button>
          <input
            ref={fileInput}
            type="file"
            aria-label="Choose a file"
            hidden
            onChange={(event) => {
              const selected = event.target.files?.[0];
              event.target.value = "";
              if (selected) void loadFile(() => readBrowserFile(selected));
            }}
          />
        </div>
        {dragging && (
          <div className="home-drop-overlay">
            Drop the file to find a tool for it
          </div>
        )}
      </div>
      {!input && (
        <div className="home-examples">
          <span>Try an example:</span>
          {EXAMPLES.map(([label, value]) => (
            <button
              type="button"
              key={label}
              onClick={() => changeInput(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {notice && (
        <p className="home-notice" role="status">
          {notice}
        </p>
      )}
      {input && !binaryFile && snippet.length < input.length && (
        <p className="home-notice">
          Preview uses the first 64 KB. The tool will receive your complete
          input.
        </p>
      )}
      <section className="home-results" aria-live="polite" aria-busy={busy}>
        {busy && !top && <p className="home-muted">Finding tools…</p>}
        {top && (
          <>
            <h2>
              {binaryFile
                ? `This looks like ${binaryFile.kind === "document" ? "a Word document" : "an image"}`
                : isSearch
                  ? "Tools matching your search"
                  : `This looks like ${contentLabel(top.toolId)}`}
            </h2>
            <p className="home-muted">{top.reason}</p>
            <ul className="home-matches">
              {matches.map((match, index) => (
                <li
                  key={match.toolId}
                  className={index === 0 ? "home-match-top" : ""}
                >
                  <button
                    type="button"
                    className="home-match-row"
                    onClick={() => openMatch(match)}
                  >
                    <span className="home-glyph" aria-hidden="true">
                      {getToolGlyph(match.toolId)}
                    </span>
                    <span>
                      <strong>{match.toolName}</strong>
                      <small>{getToolConfig(match.toolId)?.description}</small>
                    </span>
                    <span className="home-match-action">
                      Open {index === 0 && <kbd>{modifier}↵</kbd>} →
                    </span>
                  </button>
                  {index === 0 && !isSearch && (
                    <div className="home-preview">
                      <div className="home-preview-body">
                        {binaryFile ? (
                          <p>
                            {binaryFile.kind === "document"
                              ? "Ready to convert to Markdown."
                              : "Choose a tool to convert the image, extract text, or read a QR code."}
                          </p>
                        ) : currentResult?.error ? (
                          <p>{currentResult.error}</p>
                        ) : currentResult?.output ? (
                          <Preview
                            toolId={top.toolId}
                            output={currentResult.output}
                          />
                        ) : (
                          <p>
                            Open the tool to choose options and see the result.
                          </p>
                        )}
                      </div>
                      <div className="home-preview-foot">
                        {binaryFile ? "File ready" : "Live preview"} · Processed
                        locally · Your input comes with you
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {!busy && input && !top && (
          <p className="home-notice">
            {currentResult?.error ||
              "No clear match yet. Try a tool name, an example, or choose a group below."}
          </p>
        )}
      </section>
      <section className="home-section">
        <div className="home-section-head">
          <h2>{recentTools.length ? "Recent" : "Popular tools"}</h2>
          <p>
            {recentTools.length
              ? "Pick up where you left off."
              : "A good place to start."}
          </p>
        </div>
        <ul className="home-tool-grid">
          {quickTools.map((tool) => (
            <li key={tool.id}>
              <button type="button" onClick={() => onOpen(tool.id)}>
                <span className="home-glyph" aria-hidden="true">
                  {getToolGlyph(tool.id)}
                </span>
                <span>
                  <strong>{tool.name}</strong>
                  <small>{getToolConfig(tool.id)?.description}</small>
                </span>
                {tool.when && <time>{tool.when}</time>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="home-section">
        <div className="home-section-head">
          <h2>All {tools.length} tools</h2>
          <p>Pick a group to show it in the sidebar.</p>
        </div>
        <ul className="home-groups">
          {TOOL_GROUPS.map((group) => {
            const count = tools.filter((tool) =>
              group.ids.includes(tool.id),
            ).length;
            return count ? (
              <li key={group.name}>
                <button type="button" onClick={() => onGroup(group.name)}>
                  <strong>
                    {group.name} <span>{count}</span>
                  </strong>
                  <small>{group.examples}</small>
                </button>
              </li>
            ) : null;
          })}
        </ul>
      </section>
      <div className="home-tips">
        <span>
          <kbd>{modifier} K</kbd> Search tools and actions
        </span>
        <span>
          <kbd>{modifier} T</kbd> New tab
        </span>
        <span>
          <kbd>{modifier} ↵</kbd> Open the top tool
        </span>
      </div>
    </div>
  );
}
