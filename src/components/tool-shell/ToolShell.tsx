import { ReactNode } from "react";

export type ToolOutputState = "idle" | "loading" | "success" | "error";

export type ToolAction = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick?: () => void;
};

type ToolShellProps = {
  title: string;
  controls: ReactNode;
  className?: string;
};

export function ToolShell({
  title,
  controls,
  className,
}: ToolShellProps) {
  return (
    <section
      className={`theme-surface-elevated theme-border rounded-2xl border p-6 transition-colors duration-300 ${className ?? ""}`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </h2>

      <div className="theme-surface theme-border mt-3 rounded-md border p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Controls
        </p>
        <div className="mt-2">{controls}</div>
      </div>
    </section>
  );
}
