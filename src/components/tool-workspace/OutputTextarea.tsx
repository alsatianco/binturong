import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

const MAX_AUTO_LINES = 45;

type OutputTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "defaultValue" | "children"
> & { value: string };

/** Fit rendered lines, including wrapping, without limiting manual vertical resizing. */
export function OutputTextarea({ value, rows = 1, className, style, ...props }: OutputTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const manuallyResized = useRef(false);
  const lastSize = useRef<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const fitContent = () => {
      if (manuallyResized.current) return;
      const previousHeight = element.style.height;
      const previousOverflow = element.style.overflowY;
      const computed = getComputedStyle(element);
      const px = (property: string) => parseFloat(computed.getPropertyValue(property)) || 0;
      const lineHeight = px("line-height") || px("font-size") * 1.5;
      const padding = px("padding-top") + px("padding-bottom");
      const border = px("border-top-width") + px("border-bottom-width");

      // Collapse before measuring so shorter results shrink too. scrollHeight
      // includes padding and reflects soft-wrapped lines at the existing width.
      element.style.overflowY = "hidden";
      element.style.height = "0px";
      if (element.scrollHeight > 0 && lineHeight > 0) {
        const height = Math.min(element.scrollHeight + border, MAX_AUTO_LINES * lineHeight + padding + border);
        const inset = computed.boxSizing === "border-box" ? 0 : padding + border;
        element.style.height = `${Math.max(lineHeight, height - inset)}px`;
      } else {
        // Keep native rows sizing when layout is unavailable (e.g. a hidden pane).
        element.style.height = previousHeight;
      }
      element.style.overflowY = previousOverflow;
      const { width, height } = element.getBoundingClientRect();
      lastSize.current = { width, height };
    };

    fitContent();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      const previous = lastSize.current;
      if (!previous || width !== previous.width) {
        // Reflow wrapped text when the workspace width changes.
        fitContent();
      } else if (Math.abs(height - previous.height) > 1) {
        // Native resize changes height without changing width. Preserve the
        // user's chosen height across subsequent results while this box is open.
        manuallyResized.current = true;
      }
      lastSize.current = { width, height: element.getBoundingClientRect().height };
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, rows, className]);

  return (
    <textarea
      {...props}
      ref={ref}
      className={className}
      value={value}
      rows={Math.min(MAX_AUTO_LINES, value ? value.split(/\r\n|\r|\n/).length : rows)}
      readOnly
      style={{ ...style, resize: "vertical", overflowY: "auto" }}
    />
  );
}
