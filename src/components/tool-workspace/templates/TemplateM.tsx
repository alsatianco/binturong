import { useState, useCallback, useRef } from "react";
import type { TemplateProps } from "./types";

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";
const btnDisabled =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white opacity-50 cursor-not-allowed";

function buildImageUri(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  try {
    const bytes = atob(trimmed);
    const header = bytes.slice(0, 8);
    let mime = "image/png";
    if (header.charCodeAt(0) === 0xff && header.charCodeAt(1) === 0xd8) {
      mime = "image/jpeg";
    } else if (header.startsWith("GIF")) {
      mime = "image/gif";
    } else if (header.includes("WEBP")) {
      mime = "image/webp";
    } else if (bytes.includes("<svg")) {
      mime = "image/svg+xml";
    }
    return `data:${mime};base64,${trimmed}`;
  } catch {
    return null;
  }
}

/**
 * Template M -- Base64 Image Encode/Decode.
 *
 * Encode: drag/drop or select image → display preview → output base64 (Raw or Data URI).
 * Decode: paste base64 into output area → click Decode → show decoded image in input area.
 */
export function TemplateM({
  input,
  onInputChange,
  output,
  outputState,
  outputError,
  onRun,
  onCopy,
  onClear,
  onFileDrop,
}: TemplateProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"datauri" | "raw">("datauri");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [decodeInput, setDecodeInput] = useState("");
  const [decodedImageUri, setDecodedImageUri] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageDataUri = (() => {
    if (input.startsWith("IMAGE_BASE64:")) {
      const payload = input.slice("IMAGE_BASE64:".length);
      return `data:${payload}`;
    }
    if (input.startsWith("data:image/")) {
      return input;
    }
    return null;
  })();

  const handleFile = useCallback(
    (file: File) => {
      if (onFileDrop) onFileDrop(file);
    },
    [onFileDrop],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  const handleEncode = useCallback(() => {
    // Rust "format" returns data:image/...;base64,...
    // We always call format, then strip in JS for raw display
    onRun({ mode: "format" });
  }, [onRun]);

  const handleDecode = useCallback(() => {
    const uri = buildImageUri(decodeInput);
    if (uri) {
      setDecodedImageUri(uri);
      setDecodeError("");
    } else {
      setDecodedImageUri(null);
      setDecodeError("Invalid Base64 image data");
    }
  }, [decodeInput]);

  const displayedOutput = (() => {
    if (outputState === "loading") return "Encoding...";
    if (outputState === "error") return outputError;
    if (outputState !== "success" || !output) return "";
    if (outputFormat === "datauri") return output;
    const match = output.match(/^data:[^;]+;base64,(.+)$/s);
    return match ? match[1] : output;
  })();

  const inputArea =
    mode === "encode" ? (
      <div>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !imageDataUri && fileInputRef.current?.click()}
          className={`relative flex min-h-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition ${
            isDragOver
              ? "border-cyan-400 bg-cyan-500/10"
              : imageDataUri
                ? "border-slate-700 bg-slate-900"
                : "border-slate-600 bg-slate-900/50 hover:border-slate-500"
          }`}
        >
          {imageDataUri ? (
            <div className="flex w-full flex-col items-center gap-3 p-4">
              <img
                src={imageDataUri}
                alt="Selected image"
                className="max-h-[50vh] max-w-full rounded object-contain"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInputChange("");
                  onClear();
                  fileInputRef.current?.click();
                }}
                className={btnBase}
              >
                Choose different image
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <p className="text-sm text-slate-400">
                Drag & drop an image here, or click to select
              </p>
              <p className="text-xs text-slate-500">
                PNG, JPEG, GIF, SVG, WebP
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    ) : (
      <div>
        {decodedImageUri ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-700 bg-slate-900 p-4">
            <img
              src={decodedImageUri}
              alt="Decoded image"
              className="max-h-[50vh] max-w-full rounded object-contain"
            />
            <button
              type="button"
              onClick={() => {
                setDecodedImageUri(null);
                setDecodeInput("");
              }}
              className={btnBase}
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/50 p-8">
            <p className="text-sm text-slate-500">
              {decodeError || "Decoded image will appear here"}
            </p>
          </div>
        )}
      </div>
    );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-slate-700">
        <button
          type="button"
          onClick={() => setMode("encode")}
          className={`px-3 py-1.5 text-sm transition ${
            mode === "encode"
              ? "bg-cyan-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          } rounded-l-md`}
        >
          Encode
        </button>
        <button
          type="button"
          onClick={() => setMode("decode")}
          className={`px-3 py-1.5 text-sm transition ${
            mode === "decode"
              ? "bg-cyan-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          } rounded-r-md`}
        >
          Decode
        </button>
      </div>

      {mode === "encode" && (
        <>
          <button
            type="button"
            className={imageDataUri ? btnPrimary : btnDisabled}
            onClick={handleEncode}
            disabled={!imageDataUri}
          >
            Encode to Base64
          </button>
          <div className="flex items-center rounded-md border border-slate-700">
            <button
              type="button"
              onClick={() => setOutputFormat("datauri")}
              className={`px-2 py-1 text-xs transition ${
                outputFormat === "datauri"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              } rounded-l-md`}
            >
              Data URI
            </button>
            <button
              type="button"
              onClick={() => setOutputFormat("raw")}
              className={`px-2 py-1 text-xs transition ${
                outputFormat === "raw"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              } rounded-r-md`}
            >
              Raw Base64
            </button>
          </div>
        </>
      )}

      {mode === "decode" && (
        <button
          type="button"
          className={decodeInput.trim() ? btnPrimary : btnDisabled}
          onClick={handleDecode}
          disabled={!decodeInput.trim()}
        >
          Decode to Image
        </button>
      )}
    </div>
  );

  const outputArea =
    mode === "encode" ? (
      <div className="space-y-2">
        <textarea
          className={`w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm placeholder-slate-500 focus:outline-none ${
            outputState === "error" ? "text-red-400" : "text-slate-200"
          }`}
          rows={8}
          value={displayedOutput}
          readOnly
          placeholder="Base64 output will appear here..."
          spellCheck={false}
        />
        <div className="flex gap-2">
          <button className={btnBase} onClick={onCopy}>
            Copy
          </button>
          <button className={btnBase} onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
    ) : (
      <div className="space-y-2">
        <textarea
          className="w-full resize-y rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
          rows={8}
          value={decodeInput}
          onChange={(e) => setDecodeInput(e.target.value)}
          placeholder="Paste Base64 or Data URI here to decode..."
          spellCheck={false}
        />
      </div>
    );

  return { inputArea, actionButtons, outputArea };
}
