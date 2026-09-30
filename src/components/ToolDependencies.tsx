import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { DEPENDENCY_HELP_URL, type DependencyStatus } from "../lib/dependencies/dependencies";

const button = "rounded border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40";

export function ToolDependencies() {
  const [rows, setRows] = useState<DependencyStatus[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);
  const refreshing = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async (force = false) => {
    if (refreshing.current) {
      await refreshing.current;
      if (!force || !mounted.current) return;
    }
    const request = (async () => {
      try {
        const result = await invoke<DependencyStatus[]>("list_tool_dependencies");
        if (mounted.current) { setRows(result); setError(""); }
      } catch (e) {
        if (mounted.current) setError(String(e));
      } finally {
        if (mounted.current) setLoaded(true);
      }
    })();
    refreshing.current = request;
    await request;
    if (refreshing.current === request) refreshing.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [refresh]);

  return <div className="space-y-4">
    <h3 className="font-semibold">Tool dependencies</h3>
    <p className="text-sm text-[var(--text-muted)]">Some tools need extra software installed on your computer. Install it here or set the path to an existing executable. Your files stay on your computer.</p>
    <p className="text-xs text-[var(--text-muted)]">Installation uses your system package manager and may ask for administrator authentication. You can close Settings while it runs; keep Binturong open. Once available, return to the tool and run it again.</p>
    <div className="flex gap-2">
      <button className={button} onClick={() => void refresh()}>Refresh status</button>
      <button className={button} onClick={() => void openUrl(DEPENDENCY_HELP_URL).catch(e => setError(String(e)))}>Installation instructions</button>
    </div>
    {!loaded && <p role="status">Checking dependencies…</p>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {rows.map(row => <DependencyRow key={row.id} row={row} refresh={() => refresh(true)} />)}
  </div>;
}

function DependencyRow({ row, refresh }: { row: DependencyStatus; refresh: () => Promise<void> }) {
  const [path, setPath] = useState(row.configuredPath || row.path);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!dirty) setPath(row.configuredPath || row.path); }, [row.configuredPath, row.path, dirty]);
  const act = async (command: string, args: Record<string, string>) => {
    setBusy(true); setError("");
    try {
      await invoke(command, args);
      // Refresh before clearing the draft so the previous saved value cannot overwrite it.
      await refresh();
      setDirty(false);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const disabled = busy || row.installing;
  return <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-medium">{row.name}</h4>
      <span role="status" className="text-xs text-[var(--accent)]">{row.installing ? "Installing…" : row.available ? "Available" : "Not available"}</span>
    </div>
    <p className="text-xs text-[var(--text-muted)]">{row.description} {row.estimatedSize}</p>
    <label className="block text-xs" htmlFor={`dependency-${row.id}`}>Executable path</label>
    <div className="flex flex-wrap gap-2">
      <input id={`dependency-${row.id}`} value={path} disabled={disabled} placeholder="Not found — enter an absolute path" onChange={e => { setPath(e.target.value); setDirty(true); }} className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 font-mono text-xs" />
      <button className={button} disabled={disabled || !dirty} onClick={() => void act("configure_tool_dependency", { id: row.id, path })}>Save path</button>
      <button className={button} disabled={disabled || !row.configuredPath} onClick={() => void act("configure_tool_dependency", { id: row.id, path: "" })}>Auto-detect</button>
    </div>
    {row.detail && !row.available && <p className="text-xs text-[var(--text-muted)]">{row.detail}</p>}
    <button className={button} disabled={disabled || !row.installer || row.available} onClick={() => void act("install_tool_dependency", { id: row.id })}>{row.installing ? "Installing in background…" : "Download & configure"}</button>
    <p className="text-xs text-[var(--text-muted)]">{row.installer ? `Uses ${row.installer}.` : "No supported package manager found. Follow the installation instructions, then enter the executable path above."}</p>
    {(error || row.installError) && <p role="alert" className="break-words text-xs text-red-400">{error || row.installError}</p>}
    {row.configPath && <p className="break-all text-xs text-[var(--text-muted)]">Configuration: {row.configPath}</p>}
    <p className="text-xs text-[var(--text-muted)]">OCR language data is downloaded when you run OCR with a new language (roughly 2–50 MB per language) and reused offline.</p>
    <p className="break-all text-xs text-[var(--text-muted)]">Language data: {row.languageDataPath}</p>
  </div>;
}

export function MissingDependencyDialog({ onClose, onManage }: { onClose: () => void; onManage: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="dependency-title" aria-describedby="dependency-description" className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text-primary)] shadow-xl" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab") {
        const controls = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <h2 id="dependency-title" className="font-semibold">Tesseract OCR is needed</h2>
      <p id="dependency-description" className="text-sm">To extract text from images, install Tesseract or connect an existing installation. Open Tool dependencies to download and configure it in the background, or follow the manual instructions.</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={onManage}>Open Tool dependencies</button>
        <button className={button} onClick={() => void openUrl(DEPENDENCY_HELP_URL).then(onClose).catch(e => setError(String(e)))}>Install manually</button>
        <button ref={closeButton} className={button} onClick={onClose}>Not now</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  </div>;
}
