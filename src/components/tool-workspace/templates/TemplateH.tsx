import { OutputTextarea } from "../OutputTextarea";
import { useState, useCallback, useRef, useEffect, type DragEvent } from "react";
import { readBrowserFile } from "../../home/homeModel";
import type { TemplateProps } from "./types";

export type TemplateHProps = TemplateProps & {
  outputIsText?: boolean;
  ocrLanguageSelect?: boolean;
};

const btnBase =
  "rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500";
const btnPrimary =
  "rounded border bg-cyan-600 border-cyan-600 px-3 py-1.5 text-sm text-white transition hover:bg-cyan-700";

type OcrOutputView = {
  language: string;
  downloadedLanguages: string[];
  text: string;
};

const OCR_LANGUAGES: { code: string; name: string }[] = [
  { code: "eng", name: "English" },
  { code: "fra", name: "French" },
  { code: "deu", name: "German" },
  { code: "spa", name: "Spanish" },
  { code: "ita", name: "Italian" },
  { code: "por", name: "Portuguese" },
  { code: "nld", name: "Dutch" },
  { code: "rus", name: "Russian" },
  { code: "ukr", name: "Ukrainian" },
  { code: "pol", name: "Polish" },
  { code: "ces", name: "Czech" },
  { code: "slk", name: "Slovak" },
  { code: "ron", name: "Romanian" },
  { code: "bul", name: "Bulgarian" },
  { code: "hrv", name: "Croatian" },
  { code: "srp", name: "Serbian" },
  { code: "slv", name: "Slovenian" },
  { code: "hun", name: "Hungarian" },
  { code: "tur", name: "Turkish" },
  { code: "ell", name: "Greek" },
  { code: "ara", name: "Arabic" },
  { code: "heb", name: "Hebrew" },
  { code: "hin", name: "Hindi" },
  { code: "ben", name: "Bengali" },
  { code: "tha", name: "Thai" },
  { code: "vie", name: "Vietnamese" },
  { code: "ind", name: "Indonesian" },
  { code: "msa", name: "Malay" },
  { code: "fil", name: "Filipino" },
  { code: "chi_sim", name: "Chinese (Simplified)" },
  { code: "chi_tra", name: "Chinese (Traditional)" },
  { code: "jpn", name: "Japanese" },
  { code: "kor", name: "Korean" },
  { code: "swe", name: "Swedish" },
  { code: "nor", name: "Norwegian" },
  { code: "dan", name: "Danish" },
  { code: "fin", name: "Finnish" },
];

function isBase64Image(data: string): boolean {
  return (
    data.startsWith("data:image/") ||
    data.startsWith("IMAGE_BASE64:image/")
  );
}

function toDataUri(data: string): string {
  if (data.startsWith("IMAGE_BASE64:")) {
    return data.replace(/^IMAGE_BASE64:/, "data:");
  }
  return data;
}

function getInputPreviewSrc(input: string): string | null {
  if (!input) return null;
  if (input.startsWith("IMAGE_BASE64:")) {
    return input.replace(/^IMAGE_BASE64:/, "data:");
  }
  if (input.startsWith("data:image/")) {
    return input;
  }
  // Handle JSON-wrapped OCR input
  if (input.startsWith("{")) {
    try {
      const parsed = JSON.parse(input) as Record<string, unknown>;
      if (typeof parsed.image === "string") {
        return getInputPreviewSrc(parsed.image);
      }
    } catch {
      // Not valid JSON, ignore
    }
  }
  return null;
}

function parseOcrOutput(output: string): OcrOutputView | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.language !== "string" ||
      typeof obj.text !== "string" ||
      !Array.isArray(obj.downloadedLanguages)
    ) {
      return null;
    }
    const downloadedLanguages = obj.downloadedLanguages.filter(
      (value): value is string => typeof value === "string",
    );
    return {
      language: obj.language,
      downloadedLanguages,
      text: obj.text,
    };
  } catch {
    return null;
  }
}

export function TemplateH({
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
  acceptedFiles,
  outputIsText,
  ocrLanguageSelect,
}: TemplateHProps) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrLanguage, setOcrLanguage] = useState("eng");
  // Keep raw image data separate so we can rebuild the JSON payload when language changes
  const rawImageRef = useRef<string | null>(null);

  const buildOcrInput = useCallback(
    (imageData: string, language: string) => {
      onInputChange(
        JSON.stringify({
          image: imageData,
          language,
          downloadMissingLanguage: true,
        }),
      );
    },
    [onInputChange],
  );

  const processFile = useCallback(
    async (file: File) => {
      setFileError("");
      try {
        if (acceptedFiles && !acceptedFiles.split(",").some(ext => file.name.toLowerCase().endsWith(ext.trim().toLowerCase()))) {
          throw new Error(`Choose a supported file: ${acceptedFiles}`);
        }
        const { input: base64 } = await readBrowserFile(file);
        setFileName(file.name);
        if (ocrLanguageSelect) {
          rawImageRef.current = base64;
          buildOcrInput(base64, ocrLanguage);
        } else {
          onInputChange(base64);
        }
      } catch (error) {
        setFileError(error instanceof Error ? error.message : "Could not read this file.");
      }
    },
    [onInputChange, ocrLanguageSelect, ocrLanguage, buildOcrInput, acceptedFiles],
  );

  // When the language changes, rebuild the JSON payload with the new language
  const handleLanguageChange = useCallback(
    (newLanguage: string) => {
      setOcrLanguage(newLanguage);
      if (rawImageRef.current) {
        buildOcrInput(rawImageRef.current, newLanguage);
      }
    },
    [buildOcrInput],
  );

  // Sync rawImageRef when input is cleared externally (e.g. Clear button)
  useEffect(() => {
    if (!input) {
      rawImageRef.current = null;
      setFileName("");
      setFileError("");
    } else if (ocrLanguageSelect) {
      // Native desktop drops and restored inputs bypass the browser file picker.
      try {
        const payload = JSON.parse(input) as { image?: string; language?: string };
        rawImageRef.current = payload.image ?? null;
        if (payload.language) setOcrLanguage(payload.language);
      } catch {
        rawImageRef.current = input;
      }
    }
  }, [input, ocrLanguageSelect]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      processFile(file);
    },
    [acceptedFiles, processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const previewSrc = getInputPreviewSrc(input);

  const inputArea = (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose input file"
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition ${
          dragging
            ? "border-cyan-500 bg-cyan-600/10"
            : "border-slate-600 bg-slate-900/50 hover:border-slate-500"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleBrowseClick();
          }
        }}
      >
        {previewSrc ? (
          <div className="flex flex-col items-center gap-2 p-4">
            <img
              src={previewSrc}
              alt="Input preview"
              className="max-h-32 max-w-full rounded border border-slate-700 object-contain"
            />
            <span className="text-xs text-slate-400">
              {fileName || "Loaded file"}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <svg
              className="h-10 w-10 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-slate-400">
              {input.startsWith("DOCX_BASE64:") ? (fileName || "Word document loaded") : "Drop a file here or click to browse"}
            </p>
            {acceptedFiles && (
              <p className="text-xs text-slate-500">
                Accepted: {acceptedFiles}
              </p>
            )}
          </div>
        )}
      </div>

      {fileError && <p role="alert" className="text-sm text-red-400">{fileError}</p>}
      {ocrLanguageSelect && <p className="text-xs text-slate-400">New OCR languages download automatically when you run this tool (about 2–50 MB each), then work offline.</p>}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        aria-label="Input file"
        type="file"
        accept={acceptedFiles}
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {ocrLanguageSelect && (
        <select
          aria-label="OCR language"
          value={ocrLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
        >
          {OCR_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      )}
      {buttons.map((btn) => (
        <button
          key={btn.label}
          className={btn.primary ? btnPrimary : btnBase}
          onClick={() => onRun({
            mode: btn.mode,
            ...(ocrLanguageSelect && !input.trimStart().startsWith("{") ? {
              inputOverride: JSON.stringify({ image: input, language: ocrLanguage, downloadMissingLanguage: true }),
            } : {}),
          })}
          disabled={!input || outputState === "loading"}
        >
          {btn.label}
        </button>
      ))}
      <button className={btnBase} onClick={handleBrowseClick}>
        Choose File
      </button>
    </div>
  );

  const renderOutput = () => {
    if (outputState === "loading") {
      return (
        <div className="flex min-h-[120px] items-center justify-center rounded border border-slate-700 bg-slate-950">
          <span className="text-sm text-slate-400">Processing...</span>
        </div>
      );
    }

    if (outputState === "error") {
      return (
        <div className="rounded border border-red-700/50 bg-red-950/30 px-3 py-2 font-mono text-sm text-red-400">
          {outputError}
        </div>
      );
    }

    if (outputState !== "success" || !output) {
      return (
        <div className="flex min-h-[120px] items-center justify-center rounded border border-slate-700/50 bg-slate-950/30">
          <span className="text-sm text-slate-500">
            Output will appear here
          </span>
        </div>
      );
    }

    // Text output (OCR, ASCII art)
    if (outputIsText) {
      const ocrOutput = parseOcrOutput(output);
      if (ocrOutput) {
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-cyan-600/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                Language: {ocrOutput.language}
              </span>
              {ocrOutput.downloadedLanguages.length > 0 && (
                <span className="rounded-full bg-slate-700/80 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                  Downloaded: {ocrOutput.downloadedLanguages.join(", ")}
                </span>
              )}
            </div>
            <OutputTextarea
              aria-label="Recognized text"
              className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none"
              rows={12}
              value={ocrOutput.text}
              spellCheck={false}
            />
          </div>
        );
      }
      return (
        <OutputTextarea
          aria-label="Output text"
          className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none"
          rows={12}
          value={output}
          spellCheck={false}
        />
      );
    }

    // Image output (base64)
    if (isBase64Image(output)) {
      const src = toDataUri(output);
      return (
        <div className="flex flex-col items-center gap-3 rounded border border-slate-700 bg-slate-950 p-4">
          <img
            src={src}
            alt="Output"
            className="max-h-64 max-w-full rounded border border-slate-700 object-contain"
          />
        </div>
      );
    }

    // Fallback: plain text
    return (
      <OutputTextarea
        aria-label="Output text"
        className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none"
        rows={10}
        value={output}
        spellCheck={false}
      />
    );
  };

  const outputArea = (
    <div className="space-y-2">
      {renderOutput()}
      <div className="flex gap-2">
        {outputIsText ? (
          <button
            className={btnBase}
            onClick={onCopy}
            disabled={outputState !== "success"}
          >
            Copy
          </button>
        ) : (
          <button
            className={btnBase}
            onClick={onDownload}
            disabled={outputState !== "success"}
          >
            Download
          </button>
        )}
        <button className={btnBase} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );

  return { inputArea, actionButtons, outputArea };
}
