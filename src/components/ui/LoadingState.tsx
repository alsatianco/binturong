type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300">
      <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
