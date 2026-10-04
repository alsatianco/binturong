import { useCallback, useEffect, useRef, useState } from "react";

type Request = {
  message: string;
  defaultValue?: string;
  resolve: (value: string | null) => void;
};

// Browser prompt/confirm dialogs are unavailable in some native webviews.
export function useAppDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const pending = useRef<Request | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const submit = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const finish = useCallback((result: string | null) => {
    pending.current?.resolve(result);
    pending.current = null;
    setRequest(null);
    previousFocus.current?.focus();
  }, []);

  useEffect(() => () => { pending.current?.resolve(null); }, []);
  useEffect(() => {
    if (!request) return;
    (request.defaultValue === undefined ? submit.current : input.current)?.focus();
    input.current?.select();
  }, [request]);

  const ask = useCallback((message: string, defaultValue?: string) => {
    pending.current?.resolve(null);
    previousFocus.current = document.activeElement as HTMLElement | null;
    setValue(defaultValue ?? "");
    return new Promise<string | null>((resolve) => {
      const next = { message, defaultValue, resolve };
      pending.current = next;
      setRequest(next);
    });
  }, []);
  const prompt = useCallback((message: string, initial = "") => ask(message, initial), [ask]);
  const confirm = useCallback(async (message: string) => (await ask(message)) !== null, [ask]);

  const dialog = request ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-6"
      onClick={() => finish(null)}>
      <form role="dialog" aria-modal="true" aria-label={request.message}
        className="theme-surface-elevated theme-border w-full max-w-md rounded-xl border p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); finish(value); }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") { event.preventDefault(); finish(null); }
          if (event.key === "Tab") {
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input, button"));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }}>
        <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{request.message}</p>
        {request.defaultValue !== undefined && (
          <input ref={input} aria-label={request.message} value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--app-bg)] p-2 text-[var(--text-primary)]" />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => finish(null)}
            className="rounded border border-[var(--border)] px-3 py-1 text-[var(--text-primary)]">Cancel</button>
          <button ref={submit} type="submit"
            className="rounded border border-[var(--accent)] px-3 py-1 text-[var(--accent)]">Confirm</button>
        </div>
      </form>
    </div>
  ) : null;

  return { prompt, confirm, dialog };
}
