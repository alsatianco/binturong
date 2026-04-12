import { Icon } from "./Icon";

export type ToastMessage = {
  id: string;
  kind: "success" | "warning";
  text: string;
};

type ToastHostProps = {
  toasts: ToastMessage[];
};

export function ToastHost({ toasts }: ToastHostProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex min-w-52 items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-xl ${
            toast.kind === "success"
              ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-100"
              : "border-amber-500/60 bg-amber-500/15 text-amber-100"
          }`}
        >
          <Icon name={toast.kind === "success" ? "check" : "warning"} />
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
