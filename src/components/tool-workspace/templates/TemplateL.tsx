import { useState, useCallback, useEffect, useRef } from "react";
import type { TemplateProps } from "./types";

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";

/**
 * Render a visual color swatch with hex/rgb/hsl labels.
 * Used when the tool output contains color data.
 */
function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      className="h-16 w-16 shrink-0 rounded border border-slate-600"
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

/**
 * Attempt to detect if the output is a color-related JSON response.
 */
function tryParseColorOutput(
  output: string,
): Record<string, string> | null {
  try {
    const parsed = JSON.parse(output);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed.hex || parsed.rgb || parsed.hsl)
    ) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Not JSON
  }
  return null;
}

/**
 * Template L -- Visual Interactive (2 tools).
 *
 * Provides a "custom widget + text fallback" layout. The input area
 * combines a text input with an interactive visual widget (e.g., a
 * color picker preview, a visual slider, or an interactive canvas).
 * The output adapts to show visual results (color swatches, visual
 * previews) alongside a text representation.
 *
 * This template auto-detects color-related tools and renders an
 * inline color picker widget. For other visual tools, it falls back
 * to an interactive text input with a visual preview pane.
 */
export function TemplateL({
  input,
  onInputChange,
  output,
  outputState,
  outputError,
  onRun,
  onCopy,
  onClear,
  onDownload,
  buttons,
  placeholder,
  mono,
  onPaste,
}: TemplateProps) {
  const [showWidget, setShowWidget] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Detect if input looks like a color value
  const isColorInput =
    /^#([0-9a-fA-F]{3,8})$/.test(input.trim()) ||
    /^rgb/i.test(input.trim()) ||
    /^hsl/i.test(input.trim());

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (onPaste) {
        const text = e.clipboardData.getData("text/plain");
        if (text) onPaste(text);
      }
    },
    [onPaste],
  );

  // Draw a basic color spectrum on the canvas for the color picker widget
  useEffect(() => {
    if (!showWidget || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw hue gradient
    const hueGradient = ctx.createLinearGradient(0, 0, width, 0);
    hueGradient.addColorStop(0, "#ff0000");
    hueGradient.addColorStop(1 / 6, "#ffff00");
    hueGradient.addColorStop(2 / 6, "#00ff00");
    hueGradient.addColorStop(3 / 6, "#00ffff");
    hueGradient.addColorStop(4 / 6, "#0000ff");
    hueGradient.addColorStop(5 / 6, "#ff00ff");
    hueGradient.addColorStop(1, "#ff0000");
    ctx.fillStyle = hueGradient;
    ctx.fillRect(0, 0, width, height);

    // Overlay white-to-transparent gradient (saturation)
    const whiteGradient = ctx.createLinearGradient(0, 0, 0, height);
    whiteGradient.addColorStop(0, "rgba(255,255,255,1)");
    whiteGradient.addColorStop(0.5, "rgba(255,255,255,0)");
    whiteGradient.addColorStop(0.5, "rgba(0,0,0,0)");
    whiteGradient.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = whiteGradient;
    ctx.fillRect(0, 0, width, height);
  }, [showWidget]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Scale to canvas coordinates
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const pixel = ctx.getImageData(x * scaleX, y * scaleY, 1, 1).data;

      const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
      onInputChange(hex);
    },
    [onInputChange],
  );

  const colorOutput = output ? tryParseColorOutput(output) : null;

  const fontClass = mono ? "font-mono" : "font-sans";

  const outputDisplay =
    outputState === "loading"
      ? "Running..."
      : outputState === "error"
        ? outputError
        : outputState === "success"
          ? output
          : "";

  const inputArea = (
    <div className="space-y-3">
      {/* Toggle between widget and text-only mode */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`rounded px-2 py-0.5 text-xs transition ${
            showWidget
              ? "bg-cyan-600/20 text-cyan-300 border border-cyan-600"
              : "border border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
          onClick={() => setShowWidget(true)}
        >
          Visual
        </button>
        <button
          type="button"
          className={`rounded px-2 py-0.5 text-xs transition ${
            !showWidget
              ? "bg-cyan-600/20 text-cyan-300 border border-cyan-600"
              : "border border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
          onClick={() => setShowWidget(false)}
        >
          Text
        </button>
      </div>

      {/* Visual widget area */}
      {showWidget && (
        <div className="flex items-start gap-4 rounded border border-slate-700 bg-slate-900/50 p-4">
          {/* Color picker canvas */}
          <canvas
            ref={canvasRef}
            width={240}
            height={160}
            className="shrink-0 cursor-crosshair rounded border border-slate-600"
            style={{ width: 240, height: 160 }}
            onClick={handleCanvasClick}
          />

          {/* Current color preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-20 w-20 rounded border border-slate-600"
              style={{
                backgroundColor: isColorInput ? input.trim() : "#000000",
              }}
            />
            <span className="font-mono text-xs text-slate-400">
              {input.trim() || "No color"}
            </span>

            {/* Native color input as an additional picker */}
            <input
              type="color"
              value={isColorInput ? input.trim() : "#000000"}
              onChange={(e) => onInputChange(e.target.value)}
              className="h-8 w-20 cursor-pointer rounded border border-slate-700 bg-transparent"
              title="Pick a color"
            />
          </div>
        </div>
      )}

      {/* Text input (always visible in text mode, or below widget in visual mode) */}
      <div>
        {showWidget ? (
          <input
            type="text"
            className={`w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 ${fontClass} text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none`}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder ?? "Enter a value (e.g. #0ea5e9, rgb(14,165,233))"}
            spellCheck={false}
          />
        ) : (
          <textarea
            className={`w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 ${fontClass} text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none`}
            rows={6}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder ?? "Enter input value..."}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          className={btn.primary ? btnPrimary : btnBase}
          onClick={() => onRun({ mode: btn.mode })}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );

  const outputArea = (
    <div className="space-y-2">
      {outputState === "loading" && (
        <div className="py-4 text-center text-sm text-slate-400">
          Running...
        </div>
      )}

      {outputState === "error" && (
        <div className="rounded border border-red-700/50 bg-red-950/30 px-3 py-2 font-mono text-sm text-red-400">
          {outputError}
        </div>
      )}

      {/* Color output: show swatches + values */}
      {outputState === "success" && colorOutput && (
        <div className="rounded border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-start gap-4">
            {/* Color swatch */}
            <ColorSwatch
              color={colorOutput.hex ?? colorOutput.rgb ?? input.trim()}
            />

            {/* Color values */}
            <div className="min-w-0 flex-1 space-y-2">
              {Object.entries(colorOutput).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded px-2 py-1 hover:bg-slate-800/50"
                >
                  <span className="min-w-[60px] shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {key}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-sm text-slate-200 break-all">
                    {value}
                  </span>
                  <button
                    className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                    onClick={() => {
                      navigator.clipboard.writeText(value).catch(() => {});
                    }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generic text output */}
      {outputState === "success" && !colorOutput && output && (
        <textarea
          className={`w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 ${fontClass} text-sm text-slate-200 focus:outline-none`}
          rows={8}
          value={outputDisplay}
          readOnly
          spellCheck={false}
        />
      )}

      {outputState === "idle" && (
        <div className="rounded border border-slate-700/50 bg-slate-950/30 py-8 text-center text-sm text-slate-500">
          Output will appear here
        </div>
      )}

      <div className="flex gap-2">
        <button
          className={btnBase}
          onClick={onCopy}
          disabled={outputState !== "success"}
        >
          Copy
        </button>
        <button
          className={btnBase}
          onClick={onDownload}
          disabled={outputState !== "success"}
        >
          Download
        </button>
        <button className={btnBase} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
