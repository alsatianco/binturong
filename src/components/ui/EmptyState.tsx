import { type ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-slate-700 px-4 py-6 text-center">
      {icon ? <div className="mx-auto mb-2 flex h-6 w-6 items-center justify-center text-slate-400">{icon}</div> : null}
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
