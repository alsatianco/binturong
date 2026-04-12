import { type ReactNode } from "react";

type StandardToolLayoutProps = {
  toolName: string;
  description: string;
  inputArea: ReactNode;
  actionButtons: ReactNode;
  outputArea: ReactNode;
  extras?: ReactNode;
};

export function StandardToolLayout({
  toolName,
  description,
  inputArea,
  actionButtons,
  outputArea,
  extras,
}: StandardToolLayoutProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">{toolName}</h1>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Input
        </p>
        {inputArea}
      </div>

      <div className="flex flex-wrap gap-2">{actionButtons}</div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Output
        </p>
        {outputArea}
      </div>

      {extras && <div>{extras}</div>}
    </div>
  );
}
