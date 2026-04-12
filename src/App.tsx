import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { getSampleInput, getToolCategory, ALL_CATEGORIES } from "./components/tool-workspace/toolConfigs";
import { listen } from "@tauri-apps/api/event";
import { type ToolAction, type ToolOutputState } from "./components/tool-shell/ToolShell";
import { useDebouncedValue } from "./lib/runtime/useDebouncedValue";
import { useCancelableProgressTask } from "./lib/runtime/useCancelableProgressTask";
import {
  applyThemeTokens,
  type ThemeVariant,
} from "./lib/theme/themeTokens";
import { Icon } from "./components/ui/Icon";
import { EmptyState } from "./components/ui/EmptyState";
import { LoadingState } from "./components/ui/LoadingState";
import { ToastHost, type ToastMessage } from "./components/ui/ToastHost";
import { ToolWorkspace } from "./components/tool-workspace/ToolWorkspace";
import { useToolExecution, type ToolRunOverrides } from "./hooks/useToolExecution";
import { useTabManager } from "./hooks/useTabManager";
import { useCommandPalette } from "./hooks/useCommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { PipelineToolSelector } from "./components/PipelineToolSelector";

const FONT_SIZE_LEVELS = [
  { label: "Compact", body: "0.75rem", heading: "0.875rem", title: "1.125rem" },
  { label: "Small", body: "0.8125rem", heading: "0.9375rem", title: "1.1875rem" },
  { label: "Default", body: "0.875rem", heading: "1rem", title: "1.25rem" },
  { label: "Large", body: "1rem", heading: "1.125rem", title: "1.375rem" },
  { label: "Extra Large", body: "1.125rem", heading: "1.25rem", title: "1.5rem" },
];

type LifecycleBootstrap = {
  coldStartMs: number;
  coldStartTargetMs: number;
  coldStartWithinTarget: boolean;
  recoveredAfterUncleanShutdown: boolean;
  runtimeStatePath: string;
  panicReportPath: string;
  previousPanicReportExists: boolean;
};

type DatabaseStatus = {
  dbPath: string;
  currentSchemaVersion: number;
  latestSchemaVersion: number;
  appliedMigrationsOnBoot: number[];
};

type StorageModelCounts = {
  settingsCount: number;
  favoritesCount: number;
  recentsCount: number;
  presetsCount: number;
  historyCount: number;
  chainsCount: number;
};


type RegistryToolDefinition = {
  id: string;
  name: string;
  aliases?: string[];
  keywords?: string[];
  supports_batch?: boolean;
  supportsBatch?: boolean;
  chain_accepts?: string[];
  chainAccepts?: string[];
  chain_produces?: string;
  chainProduces?: string;
};

type FavoriteRecord = {
  toolId: string;
  position: number;
};





type ToolHistoryRecord = {
  id: number;
  toolId: string;
  inputSnapshot: string;
  outputSnapshot: string;
  createdAtUnix: number;
};

type SavedChainRecord = {
  id: string;
  name: string;
  description: string;
  chainJson: string;
};

// ClipboardDetectionMatch and ClipboardDetectionResult moved to useClipboardDetection hook

type UpdateChannel = "stable" | "beta";
type UpdateCheckInterval = "onLaunch" | "daily" | "weekly";

type CommandScope = "detect" | "all" | "tools" | "actions";

// CommandPaletteItem moved to useCommandPalette hook

type FormatMode = "format" | "minify";
type CaseConverterMode =
  | "sentence"
  | "lower"
  | "upper"
  | "capitalized"
  | "alternating"
  | "title"
  | "inverse"
  | "camel"
  | "snake"
  | "kebab"
  | "pascal"
  | "constant"
  | "dot"
  | "path";
type ToolExecutionKind = "formatter" | "converter" | "demo";
type BatchDelimiterMode = "newline" | "tab" | "comma" | "custom";
type BatchItemResult = {
  index: number;
  input: string;
  output: string;
  error: string;
};

type PipelineStep = {
  id: string;
  toolId: string;
};

type PipelineStepResult = {
  output: string;
  error: string;
  skipped: boolean;
};

type PersistedPipelinePayload = {
  schemaVersion: number;
  input: string;
  steps: Array<{
    toolId: string;
  }>;
};

type SettingRecord = {
  key: string;
  valueJson: string;
};

type QuickLauncherShortcutConfig = {
  enabled: boolean;
  shortcut: string;
};

type UpdateCheckResult = {
  checkedAtUnix: number;
  channel: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes: string;
};

type ToolDefinition = {
  id: string;
  name: string;
  aliases?: string[];
  keywords?: string[];
  supportsBatch?: boolean;
  chainAccepts?: string[];
  chainProduces?: string;
};

// WorkspaceTab moved to useTabManager hook

type ToolOpenOptions = {
  openInNewTab?: boolean;
};

// TabContextMenuState moved to useTabManager hook

type TabWorkspaceState = {
  name: string;
  greetMsg: string;
  notes: string;
  formatMode: FormatMode;
  caseConverterMode: CaseConverterMode;
  indentSize: number;
  batchModeEnabled: boolean;
  batchDelimiterMode: BatchDelimiterMode;
  batchCustomDelimiter: string;
  batchResults: BatchItemResult[];
  outputState: ToolOutputState;
  outputError: string;
};

const TOOL_CATALOG: ToolDefinition[] = [
  { id: "json-format", name: "JSON Format/Validate" },
  { id: "html-beautify", name: "HTML Beautify/Minify" },
  { id: "css-beautify", name: "CSS Beautify/Minify" },
  { id: "scss-beautify", name: "SCSS Beautify/Minify" },
  { id: "less-beautify", name: "LESS Beautify/Minify" },
  { id: "javascript-beautify", name: "JavaScript Beautify/Minify" },
  { id: "typescript-beautify", name: "TypeScript Beautify/Minify" },
  { id: "graphql-format", name: "GraphQL Format/Minify" },
  { id: "erb-format", name: "ERB Beautify/Minify" },
  { id: "xml-format", name: "XML Format/Minify" },
  { id: "sql-format", name: "SQL Format/Minify" },
  { id: "markdown-format", name: "Markdown Format/Minify" },
  { id: "yaml-format", name: "YAML Format/Minify" },
  { id: "json-to-yaml", name: "JSON to YAML Converter" },
  { id: "yaml-to-json", name: "YAML to JSON Converter" },
  { id: "json-to-csv", name: "JSON to CSV Converter" },
  { id: "csv-to-json", name: "CSV to JSON Converter" },
  { id: "json-to-php", name: "JSON to PHP Converter" },
  { id: "php-to-json", name: "PHP to JSON Converter" },
  { id: "php-serialize", name: "PHP Serializer" },
  { id: "php-unserialize", name: "PHP Unserializer" },
  { id: "json-stringify", name: "JSON Stringify/Unstringify" },
  { id: "html-to-jsx", name: "HTML to JSX Converter" },
  { id: "html-to-markdown", name: "HTML to Markdown Converter" },
  { id: "word-to-markdown", name: "Word to Markdown Converter" },
  { id: "svg-to-css", name: "SVG to CSS Converter" },
  { id: "curl-to-code", name: "cURL to Code Converter" },
  { id: "json-to-code", name: "JSON to Code Generator" },
  { id: "query-string-to-json", name: "Query String to JSON" },
  { id: "delimiter-converter", name: "List/Delimiter Converter" },
  { id: "number-base-converter", name: "Number Base Converter" },
  { id: "hex-to-ascii", name: "Hex to ASCII" },
  { id: "ascii-to-hex", name: "ASCII to Hex" },
  { id: "roman-date-converter", name: "Roman Numeral Date Converter" },
  { id: "url", name: "URL Encode/Decode" },
  { id: "url-parser", name: "URL Parser" },
  { id: "utm-generator", name: "UTM Generator" },
  { id: "slugify-url", name: "Slugify URL Generator" },
  { id: "html-entity", name: "HTML Entity Encode/Decode" },
  { id: "html-preview", name: "HTML Preview" },
  { id: "markdown-preview", name: "Markdown Preview" },
  { id: "case-converter", name: "Case Converter" },
  { id: "line-sort-dedupe", name: "Line Sort/Dedupe" },
  { id: "sort-words", name: "Sort Words Alphabetically" },
  { id: "number-sorter", name: "Number Sorter" },
  { id: "duplicate-word-finder", name: "Duplicate Word Finder" },
  { id: "text-replace", name: "Text Replacement Tool" },
  { id: "character-remover", name: "Character Remover" },
  { id: "whitespace-remover", name: "Whitespace Remover" },
  { id: "line-break-remover", name: "Remove Line Breaks" },
  { id: "text-formatting-remover", name: "Remove Text Formatting" },
  { id: "remove-underscores", name: "Remove Underscores" },
  { id: "em-dash-remover", name: "Em Dash Remover" },
  { id: "plain-text-converter", name: "Plain Text Converter" },
  { id: "repeat-text-generator", name: "Repeat Text Generator" },
  { id: "reverse-text-generator", name: "Reverse Text Generator" },
  { id: "upside-down-text-generator", name: "Upside Down Text Generator" },
  { id: "mirror-text-generator", name: "Mirror Text Generator" },
  { id: "invisible-text-generator", name: "Invisible Text Generator" },
  { id: "sentence-counter", name: "Sentence Counter" },
  { id: "word-frequency-counter", name: "Word Frequency Counter" },
  { id: "word-cloud-generator", name: "Word Cloud Generator" },
  { id: "bold-text-generator", name: "Bold Text Generator" },
  { id: "italic-text-converter", name: "Italic Text Converter" },
  { id: "underline-text-generator", name: "Underline Text Generator" },
  { id: "strikethrough-text-generator", name: "Strikethrough Text Generator" },
  { id: "small-text-generator", name: "Small Text Generator" },
  { id: "subscript-generator", name: "Subscript Generator" },
  { id: "superscript-generator", name: "Superscript Generator" },
  { id: "wide-text-generator", name: "Wide Text Generator" },
  { id: "double-struck-text-generator", name: "Double-Struck Text Generator" },
  { id: "bubble-text-generator", name: "Bubble Text Generator" },
  { id: "gothic-text-generator", name: "Gothic Text Generator" },
  { id: "cursed-text-generator", name: "Cursed Text Generator" },
  { id: "slash-text-generator", name: "Slash Text Generator" },
  { id: "stacked-text-generator", name: "Stacked Text Generator" },
  { id: "big-text-converter", name: "Big Text Converter" },
  { id: "typewriter-text-generator", name: "Typewriter Text Generator" },
  { id: "fancy-text-generator", name: "Fancy Text Generator" },
  { id: "cute-font-generator", name: "Cute Font Generator" },
  { id: "aesthetic-text-generator", name: "Aesthetic Text Generator" },
  { id: "unicode-text-converter", name: "Unicode Text Converter" },
  { id: "unicode-to-text-converter", name: "Unicode to Text Converter" },
  { id: "facebook-font-generator", name: "Facebook Font Generator" },
  { id: "instagram-font-generator", name: "Instagram Font Generator" },
  { id: "x-font-generator", name: "Twitter/X Font Generator" },
  { id: "tiktok-font-generator", name: "TikTok Font Generator" },
  { id: "discord-font-generator", name: "Discord Font Generator" },
  { id: "whatsapp-font-generator", name: "WhatsApp Font Generator" },
  { id: "nato-phonetic-converter", name: "NATO Phonetic Converter" },
  { id: "pig-latin-converter", name: "Pig Latin Converter" },
  { id: "wingdings-converter", name: "Wingdings Converter" },
  { id: "phonetic-spelling-converter", name: "Phonetic Spelling Converter" },
  { id: "jpg-to-png-converter", name: "JPG to PNG Converter" },
  { id: "png-to-jpg-converter", name: "PNG to JPG Converter" },
  { id: "jpg-to-webp-converter", name: "JPG to WebP Converter" },
  { id: "webp-to-jpg-converter", name: "WebP to JPG Converter" },
  { id: "png-to-webp-converter", name: "PNG to WebP Converter" },
  { id: "webp-to-png-converter", name: "WebP to PNG Converter" },
  { id: "svg-to-png-converter", name: "SVG to PNG Converter" },
  { id: "image-to-text-converter", name: "Image to Text Converter (OCR)" },
  { id: "ascii-art-generator", name: "ASCII Art Generator" },
  { id: "apa-format-generator", name: "APA Format Generator" },
  { id: "markdown-table-generator", name: "Markdown Table Generator" },
  { id: "base64", name: "Base64 String Encode/Decode" },
  { id: "base64-image", name: "Base64 Image Encode/Decode" },
  { id: "backslash-escape", name: "Backslash Escape/Unescape" },
  { id: "quote-helper", name: "Quote/Unquote Helper" },
  { id: "utf8", name: "UTF-8 Encoder/Decoder" },
  { id: "binary-code", name: "Binary Code Translator" },
  { id: "morse-code", name: "Morse Code Translator" },
  { id: "rot13", name: "ROT13 Encoder/Decoder" },
  { id: "caesar-cipher", name: "Caesar Cipher Tool" },
  { id: "aes-encrypt", name: "AES-256 Encrypt/Decrypt" },
  { id: "unix-time", name: "Unix Time Converter" },
  { id: "jwt-debugger", name: "JWT Debugger" },
  { id: "regex-tester", name: "RegExp Tester" },
  { id: "text-diff", name: "Text Diff Checker" },
  { id: "string-inspector", name: "String Inspector" },
  { id: "cron-parser", name: "Cron Job Parser" },
  { id: "color-converter", name: "Color Converter" },
  { id: "cert-decoder", name: "Certificate Decoder (X.509)" },
  { id: "uuid-ulid", name: "UUID/ULID Generate/Decode" },
  { id: "random-string", name: "Random String Generator" },
  { id: "password-generator", name: "Strong Password Generator" },
  { id: "lorem-ipsum", name: "Lorem Ipsum Generator" },
  { id: "qr-code", name: "QR Code Reader/Generator" },
  { id: "random-number", name: "Random Number Generator" },
  { id: "random-letter", name: "Random Letter Generator" },
  { id: "random-date", name: "Random Date Generator" },
  { id: "random-month", name: "Random Month Generator" },
  { id: "random-ip", name: "Random IP Address Generator" },
  { id: "random-choice", name: "Random Choice Generator" },
  { id: "hash-generator", name: "Hash Generator" },
];

const TOOL_BY_ID = new Map(TOOL_CATALOG.map((tool) => [tool.id, tool]));
const DEFAULT_TOOL_ID = TOOL_CATALOG[0].id;
const DEFAULT_QUICK_LAUNCHER_SHORTCUT = "CmdOrCtrl+Shift+Space";
const FAVORITE_TOOL_IDS: string[] = [];
// Placeholder - the real execution kind map lives as React state inside App.
// This constant is never used at runtime; see executionKindByToolId state in App.
const CASE_CONVERTER_MODE_SET = new Set<CaseConverterMode>([
  "sentence",
  "lower",
  "upper",
  "capitalized",
  "alternating",
  "title",
  "inverse",
  "camel",
  "snake",
  "kebab",
  "pascal",
  "constant",
  "dot",
  "path",
]);
// (CONVERTER_TOOL_IDS removed - now derived from executionKindByToolId)
const FILE_DROP_EXTENSIONS_BY_TOOL: Record<string, string[]> = {
  "json-to-yaml": [".json"],
  "yaml-to-json": [".yaml", ".yml"],
  "json-to-csv": [".json"],
  "csv-to-json": [".csv"],
  "json-to-php": [".json"],
  "php-to-json": [".php", ".txt"],
  "php-serialize": [".json"],
  "php-unserialize": [".txt"],
  "html-to-jsx": [".html"],
  "html-to-markdown": [".html"],
  "word-to-markdown": [".docx"],
  "svg-to-css": [".svg"],
  "curl-to-code": [".txt", ".sh"],
  "json-to-code": [".json"],
  "query-string-to-json": [".txt"],
  "delimiter-converter": [".txt", ".csv"],
  "number-base-converter": [".txt"],
  "hex-to-ascii": [".txt"],
  "ascii-to-hex": [".txt"],
  "roman-date-converter": [".txt"],
  "url-parser": [".txt"],
  "utm-generator": [".json", ".txt"],
  "slugify-url": [".txt"],
  "html-preview": [".html", ".txt"],
  "markdown-preview": [".md", ".markdown", ".txt"],
  "base64-image": [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"],
  "binary-code": [".txt"],
  "morse-code": [".txt"],
  "rot13": [".txt"],
  "caesar-cipher": [".txt"],
  "unix-time": [".txt"],
  "jwt-debugger": [".txt"],
  "regex-tester": [".json", ".txt"],
  "text-diff": [".json", ".txt"],
  "string-inspector": [".txt"],
  "cron-parser": [".txt"],
  "color-converter": [".txt"],
  "cert-decoder": [".pem", ".crt", ".cer", ".der", ".txt"],
  "random-string": [".json", ".txt"],
  "password-generator": [".json", ".txt"],
  "lorem-ipsum": [".json", ".txt"],
  "qr-code": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
  "random-number": [".json", ".txt"],
  "random-letter": [".json", ".txt"],
  "random-date": [".json", ".txt"],
  "random-month": [".json", ".txt"],
  "random-ip": [".json", ".txt"],
  "random-choice": [".json", ".txt"],
  "hash-generator": [".txt", ".json", ".bin", ".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip"],
  "case-converter": [".json", ".txt"],
  "line-sort-dedupe": [".json", ".txt"],
  "sort-words": [".json", ".txt"],
  "number-sorter": [".json", ".txt"],
  "duplicate-word-finder": [".json", ".txt"],
  "text-replace": [".json", ".txt"],
  "character-remover": [".json", ".txt"],
  "whitespace-remover": [".json", ".txt"],
  "line-break-remover": [".json", ".txt"],
  "text-formatting-remover": [".json", ".txt"],
  "remove-underscores": [".json", ".txt"],
  "em-dash-remover": [".json", ".txt"],
  "plain-text-converter": [".json", ".txt"],
  "repeat-text-generator": [".json", ".txt"],
  "reverse-text-generator": [".json", ".txt"],
  "upside-down-text-generator": [".json", ".txt"],
  "mirror-text-generator": [".json", ".txt"],
  "invisible-text-generator": [".json", ".txt"],
  "sentence-counter": [".json", ".txt"],
  "word-frequency-counter": [".json", ".txt"],
  "word-cloud-generator": [".json", ".txt"],
  "bold-text-generator": [".json", ".txt"],
  "italic-text-converter": [".json", ".txt"],
  "underline-text-generator": [".json", ".txt"],
  "strikethrough-text-generator": [".json", ".txt"],
  "small-text-generator": [".json", ".txt"],
  "subscript-generator": [".json", ".txt"],
  "superscript-generator": [".json", ".txt"],
  "wide-text-generator": [".json", ".txt"],
  "double-struck-text-generator": [".json", ".txt"],
  "bubble-text-generator": [".json", ".txt"],
  "gothic-text-generator": [".json", ".txt"],
  "cursed-text-generator": [".json", ".txt"],
  "slash-text-generator": [".json", ".txt"],
  "stacked-text-generator": [".json", ".txt"],
  "big-text-converter": [".json", ".txt"],
  "typewriter-text-generator": [".json", ".txt"],
  "fancy-text-generator": [".json", ".txt"],
  "cute-font-generator": [".json", ".txt"],
  "aesthetic-text-generator": [".json", ".txt"],
  "unicode-text-converter": [".json", ".txt"],
  "unicode-to-text-converter": [".json", ".txt"],
  "facebook-font-generator": [".json", ".txt"],
  "instagram-font-generator": [".json", ".txt"],
  "x-font-generator": [".json", ".txt"],
  "tiktok-font-generator": [".json", ".txt"],
  "discord-font-generator": [".json", ".txt"],
  "whatsapp-font-generator": [".json", ".txt"],
  "nato-phonetic-converter": [".json", ".txt"],
  "pig-latin-converter": [".json", ".txt"],
  "wingdings-converter": [".json", ".txt"],
  "phonetic-spelling-converter": [".json", ".txt"],
  "jpg-to-png-converter": [".jpg", ".jpeg"],
  "png-to-jpg-converter": [".png"],
  "jpg-to-webp-converter": [".jpg", ".jpeg"],
  "webp-to-jpg-converter": [".webp"],
  "png-to-webp-converter": [".png"],
  "webp-to-png-converter": [".webp"],
  "svg-to-png-converter": [".svg"],
  "image-to-text-converter": [".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp"],
  "ascii-art-generator": [".png", ".jpg", ".jpeg"],
  "apa-format-generator": [".json", ".txt"],
  "markdown-table-generator": [".json", ".txt", ".csv"],
};
const IMAGE_BINARY_FILE_TOOL_IDS = new Set([
  "base64-image",
  "qr-code",
  "jpg-to-png-converter",
  "png-to-jpg-converter",
  "jpg-to-webp-converter",
  "webp-to-jpg-converter",
  "png-to-webp-converter",
  "webp-to-png-converter",
  "svg-to-png-converter",
  "image-to-text-converter",
  "ascii-art-generator",
]);

function getTool(toolId: string): ToolDefinition {
  return TOOL_BY_ID.get(toolId) ?? TOOL_CATALOG[0];
}

function createDefaultTabWorkspaceState(): TabWorkspaceState {
  return {
    name: "",
    greetMsg: "",
    notes: "",
    formatMode: "format",
    caseConverterMode: "sentence",
    indentSize: 2,
    batchModeEnabled: false,
    batchDelimiterMode: "newline",
    batchCustomDelimiter: "",
    batchResults: [],
    outputState: "idle",
    outputError: "",
  };
}

function createSampleTabWorkspaceState(toolId: string): TabWorkspaceState {
  return {
    ...createDefaultTabWorkspaceState(),
    name: sampleInputForTool(toolId),
  };
}

// createTab moved to useTabManager hook

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSearchMatch(label: string, query: string): ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return label;
  }

  const matcher = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig");
  const segments = label.split(matcher);
  return segments.map((segment, index) => {
    if (segment.toLowerCase() === normalizedQuery.toLowerCase()) {
      return (
        <mark
          key={`${segment}-${index}`}
          className="rounded bg-cyan-400/20 px-0.5 text-cyan-200"
        >
          {segment}
        </mark>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}

function isCaseConverterMode(value: unknown): value is CaseConverterMode {
  return (
    typeof value === "string" &&
    CASE_CONVERTER_MODE_SET.has(value as CaseConverterMode)
  );
}

function normalizeFormatMode(value: unknown): FormatMode | null {
  if (value === "format" || value === "minify") {
    return value;
  }
  return null;
}

function normalizeIndentSize(value: unknown, maxValue: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(maxValue, Math.max(1, Math.round(value)));
}

function parseHistorySnapshot(inputSnapshot: string): {
  name: string;
  notes: string;
  formatMode: FormatMode;
  caseConverterMode: CaseConverterMode;
  indentSize: number;
} {
  try {
    const parsed = JSON.parse(inputSnapshot) as {
      name?: unknown;
      notes?: unknown;
      formatMode?: unknown;
      caseConverterMode?: unknown;
      indentSize?: unknown;
    };
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      formatMode: normalizeFormatMode(parsed.formatMode) ?? "format",
      caseConverterMode: isCaseConverterMode(parsed.caseConverterMode)
        ? parsed.caseConverterMode
        : "sentence",
      indentSize: normalizeIndentSize(parsed.indentSize, 8) ?? 2,
    };
  } catch {
    return {
      name: inputSnapshot,
      notes: "",
      formatMode: "format",
      caseConverterMode: "sentence",
      indentSize: 2,
    };
  }
}

function formatUnixTime(unixSeconds: number): string {
  const parsed = new Date(unixSeconds * 1000);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown time";
  }
  return parsed.toLocaleString();
}

function formatBatchResultsAsText(results: BatchItemResult[]): string {
  return results
    .map((result) =>
      result.error
        ? `[${result.index}] ERROR: ${result.error}`
        : `[${result.index}] ${result.output}`,
    )
    .join("\n");
}

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

function formatBatchResultsAsCsv(results: BatchItemResult[]): string {
  const lines = ["index,input,output,error"];
  for (const result of results) {
    lines.push(
      [
        String(result.index),
        escapeCsvCell(result.input),
        escapeCsvCell(result.output),
        escapeCsvCell(result.error),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function normalizeChainDataType(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isPipelineLinkCompatible(
  sourceTool: ToolDefinition | undefined,
  targetTool: ToolDefinition | undefined,
): boolean {
  if (!sourceTool || !targetTool) {
    return false;
  }

  const sourceOutput = normalizeChainDataType(sourceTool.chainProduces);
  if (!sourceOutput) {
    return false;
  }

  const accepts = (targetTool.chainAccepts ?? []).map(normalizeChainDataType);
  return accepts.includes(sourceOutput);
}

function parsePersistedPipelinePayload(rawJson: string): PersistedPipelinePayload | null {
  try {
    const parsed = JSON.parse(rawJson) as Partial<PersistedPipelinePayload>;
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .map((step) =>
            typeof step?.toolId === "string" && step.toolId
              ? { toolId: step.toolId }
              : null,
          )
          .filter((step): step is { toolId: string } => Boolean(step))
      : [];

    return {
      schemaVersion:
        typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 1,
      input: typeof parsed.input === "string" ? parsed.input : "",
      steps,
    };
  } catch {
    return null;
  }
}

function sampleInputForTool(toolId: string): string {
  return getSampleInput(toolId);
}

const COMMAND_SCOPES: CommandScope[] = [
  "detect",
  "all",
  "tools",
  "actions",
];

function App() {
  const [lifecycle, setLifecycle] = useState<LifecycleBootstrap | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(
    null,
  );
  const [storageCounts, setStorageCounts] = useState<StorageModelCounts | null>(
    null,
  );
  const [sidebarCatalog, setSidebarCatalog] = useState<ToolDefinition[]>(
    TOOL_CATALOG,
  );
  const [executionKindByToolId, setExecutionKindByToolId] = useState<Map<string, string>>(new Map());
  const [filteredTools, setFilteredTools] = useState<ToolDefinition[]>(
    TOOL_CATALOG,
  );
  const [favoriteToolIds, setFavoriteToolIds] =
    useState<string[]>(FAVORITE_TOOL_IDS);
  const [savedChains, setSavedChains] = useState<SavedChainRecord[]>([]);
  const [activeToolHistory, setActiveToolHistory] = useState<ToolHistoryRecord[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isQuickLauncherOpen, setIsQuickLauncherOpen] = useState(false);
  const [quickLauncherEnabled, setQuickLauncherEnabled] = useState(true);
  const [quickLauncherShortcut, setQuickLauncherShortcut] = useState(
    DEFAULT_QUICK_LAUNCHER_SHORTCUT,
  );
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [updateChannel, setUpdateChannel] = useState<UpdateChannel>("stable");
  const [updateCheckInterval, setUpdateCheckInterval] =
    useState<UpdateCheckInterval>("daily");
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [lastUpdateCheckResult, setLastUpdateCheckResult] =
    useState<UpdateCheckResult | null>(null);
  const [lastUpdateCheckUnix, setLastUpdateCheckUnix] = useState(0);
  const [currentAppVersion, setCurrentAppVersion] = useState("");
  const [lastSeenVersion, setLastSeenVersion] = useState("");
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [whatsNewNotes, setWhatsNewNotes] = useState("");
  const [isRestartPromptOpen, setIsRestartPromptOpen] = useState(false);
  const [quickLauncherQuery, setQuickLauncherQuery] = useState("");
  const [selectedQuickLauncherIndex, setSelectedQuickLauncherIndex] = useState(0);
  const [isSendToOpen, setIsSendToOpen] = useState(false);
  const [isLoadingSendToTargets, setIsLoadingSendToTargets] = useState(false);
  const [sendToTargets, setSendToTargets] = useState<ToolDefinition[]>([]);
  const [sendToQuery, setSendToQuery] = useState("");
  const [selectedSendToIndex, setSelectedSendToIndex] = useState(0);
  const [isPipelineBuilderOpen, setIsPipelineBuilderOpen] = useState(false);
  const [pipelineInput, setPipelineInput] = useState("");
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { id: "pipeline-step-1", toolId: DEFAULT_TOOL_ID },
  ]);
  const [selectedPipelineChainId, setSelectedPipelineChainId] = useState("");
  const [pipelineStepResults, setPipelineStepResults] = useState<PipelineStepResult[]>([]);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // isCommandPaletteOpen, commandScope, commandQuery, selectedCommandIndex
  // moved to useCommandPalette hook
  const [registryToolCount, setRegistryToolCount] = useState<number | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [fontSizeLevel, setFontSizeLevel] = useState(3);
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>("system");
  const [resolvedTheme, setResolvedTheme] = useState<string>("midnight");
  const [searchDebounceMs, setSearchDebounceMs] = useState(120);
  const [openToolsInNewTab, setOpenToolsInNewTab] = useState(true);
  const [rememberLastInput, setRememberLastInput] = useState(false);
  const [autoCopyByToolId, setAutoCopyByToolId] = useState<Record<string, boolean>>({});
  const [selectedSidebarToolIndex, setSelectedSidebarToolIndex] = useState(0);
  const [draggingFavoriteToolId, setDraggingFavoriteToolId] = useState<string | null>(null);
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    tabContextMenu,
    setTabContextMenu,
    draggingTabId,
    setDraggingTabId,
    canScrollTabsLeft,
    canScrollTabsRight,
    tabWorkspaceById,
    setTabWorkspaceById,
    tabScrollerRef,
    tabContextMenuRef,
    activeTab,
    activeTabWorkspace,
    addTab,
    closeTab,
    closeAllTabs,
    closeTabsToLeft,
    closeTabsToRight,
    reorderTabs,
    moveActiveTabByOffset,
    updateTabScrollState,
    scrollTabsBy,
  } = useTabManager({
    defaultToolId: DEFAULT_TOOL_ID,
    sidebarCatalog,
    getSampleInput: sampleInputForTool,
  });

  const pipelineStepCounterRef = useRef(2);
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
  // commandPaletteInputRef moved to useCommandPalette hook
  const quickLauncherInputRef = useRef<HTMLInputElement>(null);
  const sendToInputRef = useRef<HTMLInputElement>(null);
  const activeToolIdRef = useRef<string | null>(null);
  const quickLauncherConfigSyncRef = useRef<string>("");
  const launchUpdateCheckDoneRef = useRef(false);
  const mainContentRef = useRef<HTMLElement>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, searchDebounceMs);

  // activeTab is provided by useTabManager
  const tabContextMenuInfo = useMemo(() => {
    if (!tabContextMenu) {
      return null;
    }

    const tabIndex = tabs.findIndex((tab) => tab.id === tabContextMenu.tabId);
    if (tabIndex === -1) {
      return null;
    }

    return {
      ...tabContextMenu,
      hasTabsToLeft: tabIndex > 0,
      hasTabsToRight: tabIndex < tabs.length - 1,
    };
  }, [tabContextMenu, tabs]);

  // activeTabWorkspace is provided by useTabManager
  const activeToolDefinition = activeTab
    ? sidebarCatalog.find((tool) => tool.id === activeTab.toolId) ??
      getTool(activeTab.toolId)
    : null;
  const activeToolSupportsBatch = Boolean(activeToolDefinition?.supportsBatch);
  const batchModeEnabledForActiveTool =
    activeToolSupportsBatch && activeTabWorkspace.batchModeEnabled;
  const isFormatterTool = activeTab
    ? executionKindByToolId.get(activeTab.toolId) === "formatter"
    : false;
  const isConverterTool = activeTab
    ? executionKindByToolId.get(activeTab.toolId) === "converter"
    : false;
  const executionKind: ToolExecutionKind = isFormatterTool
    ? "formatter"
    : isConverterTool
      ? "converter"
      : "demo";
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return activeToolHistory;
    const q = historySearchQuery.toLowerCase();
    return activeToolHistory.filter((entry) => {
      const snapshot = parseHistorySnapshot(entry.inputSnapshot);
      const preview = snapshot.name || snapshot.notes || entry.inputSnapshot;
      return preview.toLowerCase().includes(q);
    });
  }, [activeToolHistory, historySearchQuery]);

  const activeToolFileAccept = activeTab
    ? activeTab.toolId === "hash-generator"
      ? "*/*"
      : (FILE_DROP_EXTENSIONS_BY_TOOL[activeTab.toolId] ?? []).join(",")
    : "";
  // Prevent the webview from navigating to a file when it's dropped outside
  // a designated drop zone. Without this, the WebView behaves like a browser
  // and opens the file, destroying the SPA.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    activeToolIdRef.current = activeTab?.toolId ?? null;
  }, [activeTab]);

  useEffect(() => {
    mainContentRef.current?.scrollTo(0, 0);
  }, [activeTabId, activeTab?.toolId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = tabScrollerRef.current?.querySelector(
        `[data-tab-id="${activeTabId}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
  }, [activeTabId]);

  const updateActiveTabWorkspace = useCallback(
    (updates: Partial<TabWorkspaceState>) => {
      if (!activeTab) {
        return;
      }

      setTabWorkspaceById((current) => ({
        ...current,
        [activeTab.id]: {
          ...(current[activeTab.id] ?? createDefaultTabWorkspaceState()),
          ...updates,
        },
      }));
    },
    [activeTab],
  );

  const persistSetting = useCallback(
    (key: string, value: unknown) => {
      void invoke("upsert_setting", {
        key,
        valueJson: JSON.stringify(value),
      }).catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to persist setting",
        ),
      );
    },
    [],
  );

  const pushToast = useCallback((kind: ToastMessage["kind"], text: string) => {
    const toastId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id: toastId, kind, text }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    }, 1600);
  }, []);

  const checkForUpdates = useCallback(
    (manual: boolean) => {
      setIsCheckingForUpdates(true);
      void invoke<UpdateCheckResult>("check_for_updates", {
        channel: updateChannel,
      })
        .then((result) => {
          setLastUpdateCheckResult(result);
          setLastUpdateCheckUnix(result.checkedAtUnix);
          persistSetting("app.lastUpdateCheckUnix", result.checkedAtUnix);

          if (result.hasUpdate) {
            setWhatsNewNotes(result.releaseNotes);
            setIsWhatsNewOpen(true);
            pushToast(
              "success",
              `Update available: ${result.currentVersion} → ${result.latestVersion}`,
            );
            if (autoUpdateEnabled) {
              setIsRestartPromptOpen(true);
            }
          } else if (manual) {
            pushToast("success", "No updates available for this channel.");
          }
        })
        .catch((error) =>
          setDatabaseError(
            error instanceof Error ? error.message : "failed to check for updates",
          ),
        )
        .finally(() => setIsCheckingForUpdates(false));
    },
    [autoUpdateEnabled, persistSetting, pushToast, updateChannel],
  );

  // addTab, closeTab, closeAllTabs, closeTabsToLeft, closeTabsToRight,
  // reorderTabs, moveActiveTabByOffset, updateTabScrollState, scrollTabsBy
  // are all provided by useTabManager

  const openTool = useCallback(
    (
      toolId: string,
      options?: ToolOpenOptions,
    ) => {
      let targetTabId = activeTabId;
      if (options?.openInNewTab) {
        targetTabId = addTab(toolId);
      } else {
        setTabs((current) =>
          current.map((tab) =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  toolId,
                  title:
                    sidebarCatalog.find((tool) => tool.id === toolId)?.name ??
                    getTool(toolId).name,
                }
              : tab,
          ),
        );
        setTabWorkspaceById((current) => ({
          ...current,
          [activeTabId]: createSampleTabWorkspaceState(toolId),
        }));
      }
      return targetTabId;
    },
    [
      activeTabId,
      addTab,
      sidebarCatalog,
    ],
  );

  const openToolWithPreference = useCallback(
    (toolId: string, options?: Omit<ToolOpenOptions, "openInNewTab">) =>
      openTool(toolId, {
        ...options,
        openInNewTab: openToolsInNewTab,
      }),
    [openTool, openToolsInNewTab],
  );

  const openToolInNewTab = useCallback(
    (toolId: string, options?: Omit<ToolOpenOptions, "openInNewTab">) =>
      openTool(toolId, {
        ...options,
        openInNewTab: true,
      }),
    [openTool],
  );

  const suppressNavigationContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault();
    },
    [],
  );

  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu(null);
  }, []);

  const blurActiveElement = useCallback(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur();
    }
  }, []);

  const prepareNavigationInteraction = useCallback(() => {
    blurActiveElement();
  }, [blurActiveElement]);

  const openTabContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, tabId: string) => {
      event.preventDefault();
      event.stopPropagation();
      prepareNavigationInteraction();

      const menuPadding = 8;
      const menuWidth = 220;
      const menuHeight = 132;
      const x = Math.min(
        Math.max(menuPadding, event.clientX),
        Math.max(menuPadding, window.innerWidth - menuWidth - menuPadding),
      );
      const y = Math.min(
        Math.max(menuPadding, event.clientY),
        Math.max(menuPadding, window.innerHeight - menuHeight - menuPadding),
      );

      setTabContextMenu({ tabId, x, y });
    },
    [prepareNavigationInteraction],
  );

  const handleNavigationMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      prepareNavigationInteraction();
      event.preventDefault();
    },
    [prepareNavigationInteraction],
  );

  const handleSidebarToolClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, toolId: string) => {
      prepareNavigationInteraction();
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        openToolInNewTab(toolId);
        return;
      }

      openToolWithPreference(toolId);
    },
    [openToolInNewTab, openToolWithPreference, prepareNavigationInteraction],
  );

  const handleSidebarToolAuxClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, toolId: string) => {
      if (event.button !== 1) {
        return;
      }

      prepareNavigationInteraction();
      event.preventDefault();
      openToolInNewTab(toolId);
    },
    [openToolInNewTab, prepareNavigationInteraction],
  );

  const handleAddTabAction = useCallback(() => {
    prepareNavigationInteraction();
    addTab();
  }, [addTab, prepareNavigationInteraction]);

  const openSendToPicker = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const outputText = (activeTabWorkspace.greetMsg || activeTabWorkspace.outputError).trim();
    if (!outputText) {
      pushToast("warning", "Run a transform before using Send to");
      return;
    }

    setIsLoadingSendToTargets(true);
    setSendToQuery("");
    setSelectedSendToIndex(0);
    void invoke<RegistryToolDefinition[]>("compatible_tool_targets", {
      fromToolId: activeTab.toolId,
    })
      .then((targets) => {
        const compatibleTargets = targets
          .map((target) => ({
            id: target.id,
            name: target.name,
          }))
          .filter((target) => target.id !== activeTab.toolId);

        setSendToTargets(compatibleTargets);
        setIsSendToOpen(true);

        if (compatibleTargets.length === 0) {
          pushToast("warning", "No compatible target tools");
        }
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error
            ? error.message
            : "failed to load compatible target tools",
        ),
      )
      .finally(() => {
        setIsLoadingSendToTargets(false);
      });
  }, [
    activeTab,
    activeTabWorkspace.greetMsg,
    activeTabWorkspace.outputError,
    pushToast,
  ]);

  const sendOutputToTool = useCallback(
    (target: ToolDefinition) => {
      if (!activeTab) {
        return;
      }

      const outputText = activeTabWorkspace.greetMsg || activeTabWorkspace.outputError;
      if (!outputText.trim()) {
        pushToast("warning", "No output to send");
        return;
      }

      // Always open in a new tab to preserve source tool input/output context.
      const targetTabId = addTab(target.id);
      setTabWorkspaceById((current) => ({
        ...current,
        [targetTabId]: {
          ...(current[targetTabId] ?? createDefaultTabWorkspaceState()),
          name: outputText,
          greetMsg: "",
          batchResults: [],
          outputState: "idle",
          outputError: "",
        },
      }));
      setIsSendToOpen(false);
      setSendToQuery("");
      setSelectedSendToIndex(0);
      pushToast("success", `Sent output to ${target.name}`);
    },
    [
      activeTab,
      activeTabWorkspace.greetMsg,
      activeTabWorkspace.outputError,
      addTab,
      pushToast,
    ],
  );

  const pipelineLinkCompatibility = useMemo(
    () =>
      pipelineSteps.map((step, index) => {
        if (index === 0) {
          return true;
        }

        const previousStep = pipelineSteps[index - 1];
        const previousTool = sidebarCatalog.find((tool) => tool.id === previousStep.toolId);
        const currentTool = sidebarCatalog.find((tool) => tool.id === step.toolId);
        return isPipelineLinkCompatible(previousTool, currentTool);
      }),
    [pipelineSteps, sidebarCatalog],
  );

  const addPipelineStep = useCallback(() => {
    const nextStepId = `pipeline-step-${pipelineStepCounterRef.current}`;
    pipelineStepCounterRef.current += 1;
    const defaultToolId = activeTab?.toolId ?? DEFAULT_TOOL_ID;
    setPipelineSteps((current) => [...current, { id: nextStepId, toolId: defaultToolId }]);
  }, [activeTab]);

  const updatePipelineStepTool = useCallback((stepId: string, toolId: string) => {
    setPipelineSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,
              toolId,
            }
          : step,
      ),
    );
  }, []);

  const removePipelineStep = useCallback((stepId: string) => {
    setPipelineSteps((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((step) => step.id !== stepId);
    });
  }, []);

  const movePipelineStep = useCallback(
    (stepId: string, direction: "up" | "down") => {
      setPipelineSteps((current) => {
        const index = current.findIndex((step) => step.id === stepId);
        if (index === -1) {
          return current;
        }
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= current.length) {
          return current;
        }
        const next = [...current];
        const temp = next[index];
        next[index] = next[targetIndex];
        next[targetIndex] = temp;
        return next;
      });
    },
    [],
  );

  const runPipelineBuilder = useCallback(async () => {
    if (pipelineSteps.length === 0) {
      return;
    }

    setIsRunningPipeline(true);
    const nextResults: PipelineStepResult[] = [];
    let currentValue = pipelineInput;
    let blocked = false;

    for (let index = 0; index < pipelineSteps.length; index += 1) {
      const step = pipelineSteps[index];
      const isLinkValid = pipelineLinkCompatibility[index] ?? false;
      const toolLabel =
        sidebarCatalog.find((tool) => tool.id === step.toolId)?.name ??
        getTool(step.toolId).name;

      if (blocked) {
        nextResults.push({
          output: "",
          error: "Skipped because a previous step failed",
          skipped: true,
        });
        continue;
      }

      if (index > 0 && !isLinkValid) {
        nextResults.push({
          output: "",
          error: `Invalid chain link before step ${index + 1} (${toolLabel})`,
          skipped: false,
        });
        blocked = true;
        continue;
      }

      try {
        let output = "";
        if (executionKindByToolId.get(step.toolId) === "formatter") {
          output = await invoke<string>("run_formatter_tool", {
            toolId: step.toolId,
            input: currentValue,
            mode: "format",
            indentSize: 2,
          });
        } else if (executionKindByToolId.get(step.toolId) === "converter") {
          output = await invoke<string>("run_converter_tool", {
            toolId: step.toolId,
            input: currentValue,
          });
        } else {
          throw new Error("This tool is not supported in the pipeline runner");
        }

        nextResults.push({
          output,
          error: "",
          skipped: false,
        });
        currentValue = output;
      } catch (error) {
        nextResults.push({
          output: "",
          error:
            error instanceof Error
              ? error.message
              : "failed to execute pipeline step",
          skipped: false,
        });
        blocked = true;
      }
    }

    setPipelineStepResults(nextResults);
    setIsRunningPipeline(false);
  }, [pipelineInput, pipelineLinkCompatibility, pipelineSteps, sidebarCatalog]);

  useEffect(() => {
    setPipelineStepResults([]);
  }, [pipelineInput, pipelineSteps]);

  const serializePipelinePayload = useCallback((): string => {
    const payload: PersistedPipelinePayload = {
      schemaVersion: 1,
      input: pipelineInput,
      steps: pipelineSteps.map((step) => ({ toolId: step.toolId })),
    };
    return JSON.stringify(payload);
  }, [pipelineInput, pipelineSteps]);

  const loadPipelineFromChain = useCallback(
    (chain: SavedChainRecord) => {
      try {
        const parsed = parsePersistedPipelinePayload(chain.chainJson);
        if (!parsed) {
          throw new Error("invalid chain payload");
        }
        const parsedSteps = parsed.steps.map((step) => step.toolId);
        const nextSteps =
          parsedSteps.length > 0
            ? parsedSteps.map((toolId, index) => ({
                id: `pipeline-step-${index + 1}`,
                toolId,
              }))
            : [{ id: "pipeline-step-1", toolId: DEFAULT_TOOL_ID }];

        pipelineStepCounterRef.current = nextSteps.length + 1;
        setPipelineInput(parsed.input);
        setPipelineSteps(nextSteps);
        setPipelineStepResults([]);
        setSelectedPipelineChainId(chain.id);
        pushToast("success", `Loaded chain: ${chain.name}`);
      } catch (error) {
        setDatabaseError(
          error instanceof Error ? error.message : "failed to parse saved chain",
        );
      }
    },
    [pushToast],
  );

  const savePipelineAsNew = useCallback(() => {
    const nameInput = window.prompt("Chain name");
    if (!nameInput) {
      return;
    }

    const name = nameInput.trim();
    if (!name) {
      pushToast("warning", "Chain name cannot be empty");
      return;
    }

    const description = window
      .prompt("Description (optional)", "Pipeline created from builder")
      ?.trim() ?? "";
    const id = `chain-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const chainJson = serializePipelinePayload();

    void invoke<SavedChainRecord>("save_chain", {
      id,
      name,
      description,
      chainJson,
    })
      .then((saved) => {
        setSavedChains((current) => [
          saved,
          ...current.filter((chain) => chain.id !== saved.id),
        ]);
        setSelectedPipelineChainId(saved.id);
        pushToast("success", "Pipeline chain saved");
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to save pipeline chain",
        ),
      );
  }, [pushToast, serializePipelinePayload]);

  const savePipelineEdits = useCallback(() => {
    const selected = savedChains.find((chain) => chain.id === selectedPipelineChainId);
    if (!selected) {
      pushToast("warning", "Select a saved chain first");
      return;
    }

    const chainJson = serializePipelinePayload();
    void invoke<SavedChainRecord>("save_chain", {
      id: selected.id,
      name: selected.name,
      description: selected.description,
      chainJson,
    })
      .then((saved) => {
        setSavedChains((current) =>
          current.map((chain) => (chain.id === saved.id ? saved : chain)),
        );
        pushToast("success", "Pipeline chain updated");
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to update pipeline chain",
        ),
      );
  }, [pushToast, savedChains, selectedPipelineChainId, serializePipelinePayload]);

  const renamePipelineChain = useCallback(() => {
    const selected = savedChains.find((chain) => chain.id === selectedPipelineChainId);
    if (!selected) {
      pushToast("warning", "Select a saved chain first");
      return;
    }

    const nextNameInput = window.prompt("Rename chain", selected.name);
    if (!nextNameInput) {
      return;
    }
    const nextName = nextNameInput.trim();
    if (!nextName) {
      pushToast("warning", "Chain name cannot be empty");
      return;
    }

    void invoke<SavedChainRecord>("save_chain", {
      id: selected.id,
      name: nextName,
      description: selected.description,
      chainJson: selected.chainJson,
    })
      .then((saved) => {
        setSavedChains((current) =>
          current.map((chain) => (chain.id === saved.id ? saved : chain)),
        );
        pushToast("success", "Pipeline chain renamed");
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to rename pipeline chain",
        ),
      );
  }, [pushToast, savedChains, selectedPipelineChainId]);

  const duplicatePipelineChain = useCallback(() => {
    const selected = savedChains.find((chain) => chain.id === selectedPipelineChainId);
    if (!selected) {
      pushToast("warning", "Select a saved chain first");
      return;
    }

    const duplicateNameInput = window.prompt(
      "Duplicate chain name",
      `${selected.name} Copy`,
    );
    if (!duplicateNameInput) {
      return;
    }
    const duplicateName = duplicateNameInput.trim();
    if (!duplicateName) {
      pushToast("warning", "Chain name cannot be empty");
      return;
    }

    const duplicateId = `chain-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    void invoke<SavedChainRecord>("save_chain", {
      id: duplicateId,
      name: duplicateName,
      description: selected.description,
      chainJson: selected.chainJson,
    })
      .then((saved) => {
        setSavedChains((current) => [saved, ...current]);
        setSelectedPipelineChainId(saved.id);
        pushToast("success", "Pipeline chain duplicated");
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to duplicate pipeline chain",
        ),
      );
  }, [pushToast, savedChains, selectedPipelineChainId]);

  const deletePipelineChain = useCallback(() => {
    const selected = savedChains.find((chain) => chain.id === selectedPipelineChainId);
    if (!selected) {
      pushToast("warning", "Select a saved chain first");
      return;
    }

    const confirmed = window.confirm(`Delete chain \"${selected.name}\"?`);
    if (!confirmed) {
      return;
    }

    void invoke<number>("delete_chain", { id: selected.id })
      .then(() => {
        setSavedChains((current) =>
          current.filter((chain) => chain.id !== selected.id),
        );
        setSelectedPipelineChainId("");
        pushToast("success", "Pipeline chain deleted");
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to delete pipeline chain",
        ),
      );
  }, [pushToast, savedChains, selectedPipelineChainId]);

  const persistFavoriteOrdering = useCallback((orderedFavoriteIds: string[]) => {
    void Promise.all(
      orderedFavoriteIds.map((toolId, index) =>
        invoke("upsert_favorite", { toolId, position: index }),
      ),
    ).catch((error) =>
      setDatabaseError(
        error instanceof Error ? error.message : "failed to persist favorites",
      ),
    );
  }, []);

  const toggleFavorite = useCallback(
    (toolId: string) => {
      const currentlyFavorite = favoriteToolIds.includes(toolId);
      if (currentlyFavorite) {
        setFavoriteToolIds((current) => current.filter((id) => id !== toolId));
        void invoke("remove_favorite", { toolId }).catch((error) =>
          setDatabaseError(
            error instanceof Error ? error.message : "failed to remove favorite",
          ),
        );
        pushToast("success", "Removed from favorites");
        return;
      }

      if (favoriteToolIds.length >= 20) {
        pushToast("warning", "Favorites are limited to 20 tools");
        return;
      }

      const nextFavorites = [...favoriteToolIds, toolId];
      setFavoriteToolIds(nextFavorites);
      persistFavoriteOrdering(nextFavorites);
      pushToast("success", "Added to favorites");
    },
    [favoriteToolIds, persistFavoriteOrdering, pushToast],
  );

  const toggleCategoryCollapsed = useCallback(
    (category: string) => {
      setCollapsedCategories((prev) => {
        const next = new Set(prev);
        if (next.has(category)) {
          next.delete(category);
        } else {
          next.add(category);
        }
        persistSetting("app.collapsedCategories", [...next]);
        return next;
      });
    },
    [persistSetting],
  );

  const reorderFavorites = useCallback(
    (fromToolId: string, toToolId: string) => {
      if (fromToolId === toToolId) {
        return;
      }

      setFavoriteToolIds((current) => {
        const fromIndex = current.indexOf(fromToolId);
        const toIndex = current.indexOf(toToolId);
        if (fromIndex === -1 || toIndex === -1) {
          return current;
        }

        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        persistFavoriteOrdering(next);
        return next;
      });
    },
    [persistFavoriteOrdering],
  );

  const greetTask = useCancelableProgressTask<{
    operationId: string;
    name: string;
  }, string>({
    task: async ({ operationId, name }, { signal, reportProgress }) => {
      await invoke("create_operation", { operationId }).catch(() => undefined);
      reportProgress({ percent: 10, message: "Preparing operation..." });
      await invoke("update_operation_progress", {
        operationId,
        progressPercent: 10,
        message: "Preparing operation...",
      }).catch(() => undefined);

      if (signal.aborted) {
        await invoke("cancel_operation", { operationId }).catch(() => undefined);
        throw new Error("Task canceled");
      }

      const response = await invoke<string>("greet", { name });
      reportProgress({ percent: 100, message: "Completed" });
      await invoke("update_operation_progress", {
        operationId,
        progressPercent: 100,
        message: "Completed",
      }).catch(() => undefined);

      return response;
    },
  });

  const { greetInActiveTab } = useToolExecution({
    activeTab,
    tabWorkspaceById,
    setTabWorkspaceById,
    executionKind,
    greetTask,
    autoCopyByToolId,
    activeToolSupportsBatch,
    activeToolIdRef,
    setActiveToolHistory,
    setDatabaseError,
  });

  const cancelActiveTask = useCallback(() => {
    greetTask.cancel();
    if (activeTab) {
      void invoke("cancel_operation", {
        operationId: `greet-${activeTab.id}`,
      }).catch(() => undefined);
    }

    updateActiveTabWorkspace({
      outputState: "idle",
      outputError: "",
      batchResults: [],
    });
  }, [activeTab, greetTask, updateActiveTabWorkspace]);

  const clearActiveTool = useCallback(() => {
    updateActiveTabWorkspace({
      name: "",
      greetMsg: "",
      notes: "",
      batchResults: [],
      outputState: "idle",
      outputError: "",
    });
  }, [updateActiveTabWorkspace]);

  const copyActiveOutput = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const outputText = activeTabWorkspace.greetMsg || activeTabWorkspace.outputError;
    if (!outputText) {
      pushToast("warning", "No output to copy");
      return;
    }

    void navigator.clipboard
      .writeText(outputText)
      .then(() => {
        updateActiveTabWorkspace({
          outputState: "success",
          outputError: "",
        });
        pushToast("success", "Output copied");
      })
      .catch((error) => {
        updateActiveTabWorkspace({
          outputState: "error",
          outputError:
            error instanceof Error
              ? error.message
              : "failed to copy output to clipboard",
        });
        pushToast("warning", "Copy failed");
      });
  }, [
    activeTab,
    activeTabWorkspace.greetMsg,
    activeTabWorkspace.outputError,
    pushToast,
    updateActiveTabWorkspace,
  ]);

  /* copyBatchItemResult - kept for future batch mode template integration
  const copyBatchItemResult = useCallback(
    (result: BatchItemResult) => {
      const valueToCopy = result.error ? `ERROR: ${result.error}` : result.output;
      if (!valueToCopy) { pushToast("warning", `Batch item ${result.index} is empty`); return; }
      void navigator.clipboard.writeText(valueToCopy)
        .then(() => pushToast("success", `Copied item ${result.index}`))
        .catch(() => pushToast("warning", `Copy failed for item ${result.index}`));
    },
    [pushToast],
  ); */

  const downloadActiveOutput = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const outputText = activeTabWorkspace.greetMsg || activeTabWorkspace.outputError;
    if (!outputText.trim()) {
      pushToast("warning", "No output to download");
      return;
    }

    const fileName = `${activeTab.toolId}-${Date.now()}.txt`;
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    pushToast("success", "Output downloaded");
  }, [
    activeTab,
    activeTabWorkspace.greetMsg,
    activeTabWorkspace.outputError,
    pushToast,
  ]);

  const exportBatchResults = useCallback(
    (format: "txt" | "csv") => {
      if (!activeTab) {
        return;
      }

      const results = activeTabWorkspace.batchResults;
      if (results.length === 0) {
        pushToast("warning", "No batch results to export");
        return;
      }

      const content =
        format === "csv"
          ? formatBatchResultsAsCsv(results)
          : formatBatchResultsAsText(results);
      const mimeType = format === "csv" ? "text/csv" : "text/plain";
      const fileName = `${activeTab.toolId}-batch-${Date.now()}.${format}`;
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      pushToast("success", `Exported ${results.length} batch item(s) as .${format}`);
    },
    [activeTab, activeTabWorkspace.batchResults, pushToast],
  );

  const fillDemoInput = useCallback(() => {
    const activeToolId = activeTab?.toolId ?? DEFAULT_TOOL_ID;
    if (activeToolId === "case-converter") {
      updateActiveTabWorkspace({
        name: "Got the words right but somehow offended the alphabet?",
        caseConverterMode: "sentence",
        batchResults: [],
        outputState: "idle",
        outputError: "",
      });
      return;
    }

    if (executionKindByToolId.has(activeToolId)) {
      updateActiveTabWorkspace({
        name: sampleInputForTool(activeToolId),
        batchResults: [],
        outputState: "idle",
        outputError: "",
      });
      return;
    }

    updateActiveTabWorkspace({
      name: "Binturong",
      notes: "Per-tool shell state is reusable across tools.",
      batchResults: [],
      outputState: "idle",
      outputError: "",
    });
  }, [activeTab, updateActiveTabWorkspace]);

  const isDroppedFileAccepted = useCallback(
    (fileName: string) => {
      if (!activeTab) {
        return false;
      }

      if (activeTab.toolId === "hash-generator") {
        return true;
      }

      const expectedExtensions = FILE_DROP_EXTENSIONS_BY_TOOL[activeTab.toolId];
      if (!expectedExtensions || expectedExtensions.length === 0) {
        return false;
      }

      const normalizedName = fileName.toLowerCase();
      return expectedExtensions.some((extension) =>
        normalizedName.endsWith(extension),
      );
    },
    [activeTab],
  );

  const loadToolInputFromFile = useCallback(
    (file: File) => {
      if (!activeTab || !isDroppedFileAccepted(file.name)) {
        const expectedExtensions =
          activeTab?.toolId === "hash-generator"
            ? ["any file"]
            : (FILE_DROP_EXTENSIONS_BY_TOOL[activeTab?.toolId ?? ""] ?? []);
        const expectedLabel = expectedExtensions.join(", ");
        pushToast(
          "warning",
          expectedLabel
            ? `File type is not accepted. Expected: ${expectedLabel}`
            : "This tool does not accept file input",
        );
        return;
      }

      const isDocxMarkdownTool = activeTab.toolId === "word-to-markdown";
      const isBase64ImageTool = IMAGE_BINARY_FILE_TOOL_IDS.has(activeTab.toolId);
      const isDerCertificateTool =
        activeTab.toolId === "cert-decoder" &&
        file.name.toLowerCase().endsWith(".der");
      const isHashGeneratorTool = activeTab.toolId === "hash-generator";
      const reader = isDocxMarkdownTool
        ? file.arrayBuffer().then((buffer) => {
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (const byte of bytes) {
              binary += String.fromCharCode(byte);
            }
            return `DOCX_BASE64:${btoa(binary)}`;
          })
        : isBase64ImageTool
          ? file.arrayBuffer().then((buffer) => {
              const bytes = new Uint8Array(buffer);
              let binary = "";
              for (const byte of bytes) {
                binary += String.fromCharCode(byte);
              }
              const detectedMime = file.type.startsWith("image/")
                ? file.type
                : "image/png";
              return `IMAGE_BASE64:${detectedMime};base64,${btoa(binary)}`;
            })
        : isDerCertificateTool
          ? file.arrayBuffer().then((buffer) => {
              const bytes = new Uint8Array(buffer);
              let binary = "";
              for (const byte of bytes) {
                binary += String.fromCharCode(byte);
              }
              return `DER_BASE64:${btoa(binary)}`;
            })
        : isHashGeneratorTool
          ? file.arrayBuffer().then((buffer) => {
              const bytes = new Uint8Array(buffer);
              let binary = "";
              for (const byte of bytes) {
                binary += String.fromCharCode(byte);
              }
              return `FILE_BASE64:${btoa(binary)}`;
            })
        : file.text();

      void reader
        .then((content) => {
          updateActiveTabWorkspace({
            name: content,
            batchResults: [],
            outputState: "idle",
            outputError: "",
          });
          pushToast("success", `Loaded ${file.name}`);
        })
        .catch((error) =>
          setDatabaseError(
            error instanceof Error
              ? error.message
              : "failed to read dropped file",
          ),
        );
    },
    [activeTab, isDroppedFileAccepted, pushToast, updateActiveTabWorkspace],
  );

  // Fetch all diagnostic data in parallel on mount
  useEffect(() => {
    void Promise.all([
      invoke<LifecycleBootstrap>("get_lifecycle_bootstrap"),
      invoke<DatabaseStatus>("get_database_status"),
      invoke<StorageModelCounts>("get_storage_model_counts"),
    ])
      .then(([lifecycleData, dbStatus, counts]) => {
        setLifecycle(lifecycleData);
        setDatabaseStatus(dbStatus);
        setStorageCounts(counts);
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : "unknown startup error";
        setLifecycleError(msg);
        setDatabaseError(msg);
      });
  }, []);

  useEffect(() => {
    const apply = () => {
      const resolved = applyThemeTokens(themeVariant);
      setResolvedTheme(resolved);
    };

    apply();
    if (themeVariant !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => apply();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [themeVariant]);

  useEffect(() => {
    const level = FONT_SIZE_LEVELS[fontSizeLevel - 1];
    if (!level) return;
    const root = document.documentElement.style;
    root.setProperty("--font-size-body", level.body);
    root.setProperty("--font-size-heading", level.heading);
    root.setProperty("--font-size-title", level.title);
  }, [fontSizeLevel]);

  const refreshSidebarCollections = useCallback(() => {
    void Promise.all([
      invoke<RegistryToolDefinition[]>("list_tools"),
      invoke<FavoriteRecord[]>("list_favorites"),
      invoke<Array<{ id: string; name: string; executionKind: string }>>("list_tool_catalog"),
    ])
      .then(([tools, favorites, catalog]) => {
        if (tools.length > 0) {
          setSidebarCatalog(
            tools.map((tool) => ({
              id: tool.id,
              name: tool.name,
              aliases: Array.isArray(tool.aliases) ? tool.aliases : [],
              keywords: Array.isArray(tool.keywords) ? tool.keywords : [],
              supportsBatch: Boolean(
                typeof tool.supports_batch === "boolean"
                  ? tool.supports_batch
                  : tool.supportsBatch,
              ),
              chainAccepts: Array.isArray(tool.chain_accepts)
                ? tool.chain_accepts
                : Array.isArray(tool.chainAccepts)
                  ? tool.chainAccepts
                  : [],
              chainProduces:
                typeof tool.chain_produces === "string"
                  ? tool.chain_produces
                  : typeof tool.chainProduces === "string"
                    ? tool.chainProduces
                    : undefined,
            })),
          );
        }
        setRegistryToolCount(tools.length);

        const orderedFavoriteIds = [...favorites]
          .sort((left, right) => left.position - right.position)
          .map((favorite) => favorite.toolId)
          .slice(0, 20);
        setFavoriteToolIds(orderedFavoriteIds);

        // Populate execution kind routing from catalog
        const kindMap = new Map(catalog.map((e) => [e.id, e.executionKind]));
        setExecutionKindByToolId(kindMap);
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "unknown sidebar error",
        ),
      );
  }, []);

  useEffect(() => {
    refreshSidebarCollections();
  }, [refreshSidebarCollections]);

  const refreshActiveToolCollections = useCallback(() => {
    if (!activeTab) {
      setActiveToolHistory([]);
      setHistorySearchQuery("");
      return;
    }

    const activeToolId = activeTab.toolId;
    void invoke<ToolHistoryRecord[]>("list_tool_history", { toolId: activeToolId })
      .then((history) => {
        setActiveToolHistory(history);
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error
            ? error.message
            : "failed to load active tool collections",
        ),
      );
  }, [activeTab]);

  useEffect(() => {
    refreshActiveToolCollections();
  }, [refreshActiveToolCollections]);

  const restoreHistoryEntry = useCallback(
    (entry: ToolHistoryRecord) => {
      const snapshot = parseHistorySnapshot(entry.inputSnapshot);
      updateActiveTabWorkspace({
        name: snapshot.name,
        notes: snapshot.notes,
        formatMode: snapshot.formatMode,
        caseConverterMode: snapshot.caseConverterMode,
        indentSize: snapshot.indentSize,
        greetMsg: entry.outputSnapshot,
        outputState: "success",
        outputError: "",
      });
      pushToast("success", "History entry restored");
    },
    [pushToast, updateActiveTabWorkspace],
  );

  const clearHistory = useCallback(
    (scope: "active" | "all") => {
      const isActiveScope = scope === "active";
      const toolId = isActiveScope ? activeTab?.toolId ?? null : null;

      if (isActiveScope && !toolId) {
        return;
      }

      const confirmed = window.confirm(
        isActiveScope
          ? "Clear history for this tool?"
          : "Clear history for all tools?",
      );
      if (!confirmed) {
        return;
      }

      void invoke<number>("clear_tool_history", { toolId })
        .then((clearedCount) => {
          setActiveToolHistory([]);
          pushToast(
            "success",
            isActiveScope
              ? `Cleared ${clearedCount} entries for this tool`
              : `Cleared ${clearedCount} history entries`,
          );
        })
        .catch((error) =>
          setDatabaseError(
            error instanceof Error
              ? error.message
              : "failed to clear tool history",
          ),
        );
    },
    [activeTab, pushToast],
  );

  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    commandScope,
    setCommandScope,
    commandQuery,
    setCommandQuery,
    selectedCommandIndex,
    setSelectedCommandIndex,
    commandPaletteInputRef,
    commandPaletteItems,
    isDetectingInPalette,
  } = useCommandPalette({
    sidebarCatalog,
    addTab,
    closeTab,
    activeTabId,
    openToolInNewTab,
    clearActiveTool,
    clearHistory,
    checkForUpdates,
    setShowStatusBar,
    setIsSettingsOpen,
    setIsWhatsNewOpen,
    setWhatsNewNotes,
    setIsPipelineBuilderOpen,
    setIsQuickLauncherOpen,
    currentAppVersion,
    whatsNewNotes,
    sidebarSearchInputRef,
    isSettingsOpen,
    isQuickLauncherOpen,
    isSendToOpen,
    isPipelineBuilderOpen,
  });


  useEffect(() => {
    void invoke<SettingRecord[]>("list_settings")
      .then((records) => {
        const nextAutoCopySettings: Record<string, boolean> = {};

        for (const record of records) {
          let parsedValue: unknown;
          try {
            parsedValue = JSON.parse(record.valueJson);
          } catch {
            continue;
          }

          if (
            record.key.startsWith("tool.autoCopy.") &&
            typeof parsedValue === "boolean"
          ) {
            const toolId = record.key.slice("tool.autoCopy.".length);
            if (toolId) {
              nextAutoCopySettings[toolId] = parsedValue;
            }
            continue;
          }

          switch (record.key) {
            case "app.themeVariant":
              if (typeof parsedValue === "string") {
                setThemeVariant(parsedValue as ThemeVariant);
              }
              break;
            case "app.fontSizeLevel":
              if (typeof parsedValue === "number" && parsedValue >= 1 && parsedValue <= 5) {
                setFontSizeLevel(parsedValue);
              }
              break;
            case "app.collapsedCategories":
              if (Array.isArray(parsedValue)) {
                setCollapsedCategories(new Set(parsedValue.filter((v: unknown) => typeof v === "string")));
              }
              break;
            case "app.hiddenCategories":
              if (Array.isArray(parsedValue)) {
                setHiddenCategories(new Set(parsedValue.filter((v: unknown) => typeof v === "string")));
              }
              break;
            case "app.showStatusBar":
              if (typeof parsedValue === "boolean") {
                setShowStatusBar(parsedValue);
              }
              break;
            case "app.searchDebounceMs":
              if (typeof parsedValue === "number") {
                setSearchDebounceMs(parsedValue);
              }
              break;
            case "app.openToolsInNewTab":
              if (typeof parsedValue === "boolean") {
                setOpenToolsInNewTab(parsedValue);
              }
              break;
            case "app.rememberLastInput":
              if (typeof parsedValue === "boolean") {
                setRememberLastInput(parsedValue);
              }
              break;
            case "app.quickLauncherEnabled":
              if (typeof parsedValue === "boolean") {
                setQuickLauncherEnabled(parsedValue);
              }
              break;
            case "app.quickLauncherShortcut":
              if (typeof parsedValue === "string") {
                setQuickLauncherShortcut(parsedValue);
              }
              break;
            case "app.autoUpdateEnabled":
              if (typeof parsedValue === "boolean") {
                setAutoUpdateEnabled(parsedValue);
              }
              break;
            case "app.updateChannel":
              if (parsedValue === "stable" || parsedValue === "beta") {
                setUpdateChannel(parsedValue);
              }
              break;
            case "app.updateCheckInterval":
              if (
                parsedValue === "onLaunch" ||
                parsedValue === "daily" ||
                parsedValue === "weekly"
              ) {
                setUpdateCheckInterval(parsedValue);
              }
              break;
            case "app.lastUpdateCheckUnix":
              if (typeof parsedValue === "number" && Number.isFinite(parsedValue)) {
                setLastUpdateCheckUnix(Math.max(0, Math.round(parsedValue)));
              }
              break;
            case "app.lastSeenVersion":
              if (typeof parsedValue === "string") {
                setLastSeenVersion(parsedValue);
              }
              break;
            default:
              break;
          }
        }

        if (Object.keys(nextAutoCopySettings).length > 0) {
          setAutoCopyByToolId((current) => ({
            ...current,
            ...nextAutoCopySettings,
          }));
        }
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to load settings",
        ),
      )
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    const normalizedShortcut = quickLauncherShortcut.trim() || DEFAULT_QUICK_LAUNCHER_SHORTCUT;
    if (quickLauncherEnabled && normalizedShortcut.endsWith("+")) {
      return;
    }

    const configSignature = `${quickLauncherEnabled}:${normalizedShortcut}`;
    if (quickLauncherConfigSyncRef.current === configSignature) {
      return;
    }
    quickLauncherConfigSyncRef.current = configSignature;

    void invoke<QuickLauncherShortcutConfig>("configure_quick_launcher_shortcut", {
      enabled: quickLauncherEnabled,
      shortcut: normalizedShortcut,
    })
      .then((config) => {
        const normalizedAppliedShortcut =
          config.shortcut.trim() || DEFAULT_QUICK_LAUNCHER_SHORTCUT;
        quickLauncherConfigSyncRef.current = `${config.enabled}:${normalizedAppliedShortcut}`;
        if (normalizedAppliedShortcut !== quickLauncherShortcut) {
          setQuickLauncherShortcut(normalizedAppliedShortcut);
        }
      })
      .catch((error) => {
        quickLauncherConfigSyncRef.current = "";
        setDatabaseError(
          error instanceof Error
            ? error.message
            : "failed to apply quick launcher shortcut",
        );
      });
  }, [quickLauncherEnabled, quickLauncherShortcut, settingsLoaded]);

  useEffect(() => {
    void invoke<string>("get_app_version")
      .then((version) => {
        setCurrentAppVersion(version);
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "failed to get app version",
        ),
      );
  }, []);

  useEffect(() => {
    if (!settingsLoaded || !currentAppVersion) {
      return;
    }

    if (!lastSeenVersion) {
      setLastSeenVersion(currentAppVersion);
      persistSetting("app.lastSeenVersion", currentAppVersion);
      return;
    }

    if (lastSeenVersion !== currentAppVersion) {
      setWhatsNewNotes(
        `Welcome to Binturong ${currentAppVersion}.\n\nHighlights:\n- Update channel UX and restart flow improvements.\n- Performance and stability updates across core workflows.`,
      );
      setIsWhatsNewOpen(true);
      setLastSeenVersion(currentAppVersion);
      persistSetting("app.lastSeenVersion", currentAppVersion);
    }
  }, [currentAppVersion, lastSeenVersion, persistSetting, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || !autoUpdateEnabled) {
      return;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const intervalSeconds =
      updateCheckInterval === "daily"
        ? 86_400
        : updateCheckInterval === "weekly"
          ? 604_800
          : 0;

    if (updateCheckInterval === "onLaunch") {
      if (launchUpdateCheckDoneRef.current) {
        return;
      }
      launchUpdateCheckDoneRef.current = true;
      checkForUpdates(false);
      return;
    }

    const elapsed = nowUnix - lastUpdateCheckUnix;
    if (lastUpdateCheckUnix === 0 || elapsed >= intervalSeconds) {
      checkForUpdates(false);
    }
  }, [
    autoUpdateEnabled,
    checkForUpdates,
    lastUpdateCheckUnix,
    settingsLoaded,
    updateCheckInterval,
  ]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return;
    }

    void invoke<SavedChainRecord[]>("list_chains")
      .then((chains) => {
        setSavedChains(chains);
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error
            ? error.message
            : "failed to load command palette data",
        ),
      );
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (!tabContextMenu) {
      return;
    }

    if (!tabs.some((tab) => tab.id === tabContextMenu.tabId)) {
      setTabContextMenu(null);
    }
  }, [tabContextMenu, tabs]);

  useEffect(() => {
    if (!tabContextMenuInfo) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        setTabContextMenu(null);
        return;
      }

      if (tabContextMenuRef.current?.contains(target)) {
        return;
      }

      setTabContextMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTabContextMenu(null);
      }
    };

    const handleWindowBlur = () => {
      setTabContextMenu(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [tabContextMenuInfo]);

  useEffect(() => {
    if (!isPipelineBuilderOpen) {
      return;
    }

    void invoke<SavedChainRecord[]>("list_chains")
      .then((chains) => {
        setSavedChains(chains);
        setSelectedPipelineChainId((current) => {
          if (current && chains.some((chain) => chain.id === current)) {
            return current;
          }
          return chains[0]?.id ?? "";
        });
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error
            ? error.message
            : "failed to load pipeline chains",
        ),
      );
  }, [isPipelineBuilderOpen]);

  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const minSidebarWidth = 240;
      const maxSidebarWidth = 420;
      const nextWidth = Math.max(
        minSidebarWidth,
        Math.min(maxSidebarWidth, event.clientX),
      );
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  // Command palette open/reset and clipboard detection moved to useCommandPalette hook

  useEffect(() => {
    updateTabScrollState();
  }, [tabs, updateTabScrollState]);

  useEffect(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) {
      return undefined;
    }

    scroller.addEventListener("scroll", updateTabScrollState);
    window.addEventListener("resize", updateTabScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateTabScrollState);
      window.removeEventListener("resize", updateTabScrollState);
    };
  }, [updateTabScrollState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isCommandPaletteOpen ||
        isSettingsOpen ||
        isQuickLauncherOpen ||
        isSendToOpen ||
        isPipelineBuilderOpen
      ) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;

      if (isMetaOrCtrl && normalizedKey === ",") {
        event.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      if (isMetaOrCtrl && (normalizedKey === "=" || normalizedKey === "+")) {
        event.preventDefault();
        setFontSizeLevel((prev) => {
          const next = Math.min(prev + 1, 5);
          if (next !== prev) persistSetting("app.fontSizeLevel", next);
          return next;
        });
        return;
      }

      if (isMetaOrCtrl && normalizedKey === "-") {
        event.preventDefault();
        setFontSizeLevel((prev) => {
          const next = Math.max(prev - 1, 1);
          if (next !== prev) persistSetting("app.fontSizeLevel", next);
          return next;
        });
        return;
      }

      if (isMetaOrCtrl && normalizedKey === "0") {
        event.preventDefault();
        setFontSizeLevel((prev) => {
          if (prev !== 3) persistSetting("app.fontSizeLevel", 3);
          return 3;
        });
        return;
      }

      if (isMetaOrCtrl && !event.shiftKey && normalizedKey === "t") {
        event.preventDefault();
        event.stopPropagation();
        handleAddTabAction();
        return;
      }

      if (isMetaOrCtrl && !event.shiftKey && normalizedKey === "w") {
        event.preventDefault();
        closeTab(activeTabId);
        return;
      }

      if (isMetaOrCtrl && !event.shiftKey && normalizedKey === "f") {
        event.preventDefault();
        sidebarSearchInputRef.current?.focus();
        return;
      }

      if (isMetaOrCtrl && event.shiftKey && normalizedKey === "c") {
        event.preventDefault();
        copyActiveOutput();
        return;
      }

      if (isMetaOrCtrl && event.shiftKey && normalizedKey === "x") {
        event.preventDefault();
        clearActiveTool();
        return;
      }

      if (isMetaOrCtrl && event.shiftKey && event.key === "ArrowRight") {
        event.preventDefault();
        openSendToPicker();
        return;
      }

      if (isMetaOrCtrl && !event.shiftKey && normalizedKey >= "1" && normalizedKey <= "9") {
        event.preventDefault();
        const tabIndex = parseInt(normalizedKey, 10) - 1;
        if (tabIndex < tabs.length) {
          setActiveTabId(tabs[tabIndex].id);
        }
        return;
      }

      const goToNextTab =
        (event.ctrlKey && !event.shiftKey && event.key === "Tab") ||
        (event.metaKey && event.shiftKey && event.key === "]");

      if (goToNextTab) {
        event.preventDefault();
        moveActiveTabByOffset(1);
        return;
      }

      const goToPreviousTab =
        (event.ctrlKey && event.shiftKey && event.key === "Tab") ||
        (event.metaKey && event.shiftKey && event.key === "[");

      if (goToPreviousTab) {
        event.preventDefault();
        moveActiveTabByOffset(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeTabId,
    clearActiveTool,
    closeTab,
    copyActiveOutput,
    handleAddTabAction,
    isCommandPaletteOpen,
    isPipelineBuilderOpen,
    isQuickLauncherOpen,
    isSendToOpen,
    isSettingsOpen,
    moveActiveTabByOffset,
    openSendToPicker,
    tabs,
  ]);

  useEffect(() => {
    void invoke<RegistryToolDefinition[]>("ranked_search_tools", {
      query: debouncedSearchQuery,
      favoriteToolIds: [],
      recentToolIds: [],
    })
      .then((tools) => {
        if (tools.length > 0 || debouncedSearchQuery.trim().length > 0) {
          setFilteredTools(tools.map((tool) => ({ id: tool.id, name: tool.name })));
        } else {
          setFilteredTools(sidebarCatalog);
        }
      })
      .catch((error) =>
        setDatabaseError(
          error instanceof Error ? error.message : "unknown ranking error",
        ),
      );
  }, [debouncedSearchQuery, sidebarCatalog]);

  const sidebarToolById = useMemo(
    () => new Map(sidebarCatalog.map((tool) => [tool.id, tool])),
    [sidebarCatalog],
  );

  /** Group filtered tools by category for sidebar rendering. */
  const groupedFilteredTools = useMemo(() => {
    const groups: Array<{ category: string; tools: ToolDefinition[] }> = [];
    const groupMap = new Map<string, ToolDefinition[]>();
    const order: string[] = [];
    for (const tool of filteredTools) {
      const cat = getToolCategory(tool.id);
      if (!groupMap.has(cat)) {
        groupMap.set(cat, []);
        order.push(cat);
      }
      groupMap.get(cat)!.push(tool);
    }
    for (const cat of order) {
      groups.push({ category: cat, tools: groupMap.get(cat)! });
    }
    return groups;
  }, [filteredTools]);

  const selectedSidebarToolId = filteredTools[selectedSidebarToolIndex]?.id;

  useEffect(() => {
    setSelectedSidebarToolIndex((current) => {
      if (filteredTools.length === 0) {
        return 0;
      }
      return Math.min(current, filteredTools.length - 1);
    });
  }, [filteredTools]);

  const toolActions: ToolAction[] = [
    {
      id: "copy-output",
      label: "Copy Output",
      shortcut: "Cmd/Ctrl+Shift+C",
      disabled:
        !activeTabWorkspace.greetMsg && !activeTabWorkspace.outputError,
      onClick: copyActiveOutput,
    },
    {
      id: "download-output",
      label: "Download Text",
      disabled:
        !activeTabWorkspace.greetMsg && !activeTabWorkspace.outputError,
      onClick: downloadActiveOutput,
    },
    {
      id: "clear",
      label: "Clear",
      shortcut: "Cmd/Ctrl+Shift+X",
      onClick: clearActiveTool,
    },
    {
      id: "send-to",
      label: "Send to…",
      shortcut: "Cmd/Ctrl+Shift+→",
      disabled:
        !activeTabWorkspace.greetMsg && !activeTabWorkspace.outputError,
      onClick: openSendToPicker,
    },
    {
      id: "fill-demo",
      label: "Fill Demo",
      onClick: fillDemoInput,
    },
    {
      id: "cancel-task",
      label: "Cancel",
      disabled: !greetTask.isRunning,
      onClick: cancelActiveTask,
    },
  ];

  if (batchModeEnabledForActiveTool) {
    toolActions.splice(1, 0, {
      id: "export-batch-txt",
      label: "Export .txt",
      disabled: activeTabWorkspace.batchResults.length === 0,
      onClick: () => exportBatchResults("txt"),
    });
    toolActions.splice(2, 0, {
      id: "export-batch-csv",
      label: "Export .csv",
      disabled: activeTabWorkspace.batchResults.length === 0,
      onClick: () => exportBatchResults("csv"),
    });
  }


  const filteredSendToTargets = useMemo(() => {
    const normalizedQuery = sendToQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return sendToTargets;
    }

    return sendToTargets.filter((tool) =>
      tool.name.toLowerCase().includes(normalizedQuery),
    );
  }, [sendToQuery, sendToTargets]);

  // commandPaletteActions, commandPaletteItems, and selectedCommandIndex clamping
  // are all provided by useCommandPalette hook

  useEffect(() => {
    setSelectedSendToIndex((current) => {
      if (filteredSendToTargets.length === 0) {
        return 0;
      }
      return Math.min(current, filteredSendToTargets.length - 1);
    });
  }, [filteredSendToTargets]);

  useEffect(() => {
    if (!isSendToOpen) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      sendToInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSendToOpen]);

  useEffect(() => {
    if (!isSendToOpen) {
      return;
    }

    const handleSendToHotkeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsSendToOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedSendToIndex((current) =>
          Math.min(current + 1, Math.max(0, filteredSendToTargets.length - 1)),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSendToIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selectedTarget = filteredSendToTargets[selectedSendToIndex];
        if (selectedTarget) {
          sendOutputToTool(selectedTarget);
        }
      }
    };

    window.addEventListener("keydown", handleSendToHotkeys);
    return () => {
      window.removeEventListener("keydown", handleSendToHotkeys);
    };
  }, [filteredSendToTargets, isSendToOpen, selectedSendToIndex, sendOutputToTool]);

  useEffect(() => {
    if (!isPipelineBuilderOpen) {
      return;
    }

    const handlePipelineBuilderHotkeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsPipelineBuilderOpen(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void runPipelineBuilder();
      }
    };

    window.addEventListener("keydown", handlePipelineBuilderHotkeys);
    return () => {
      window.removeEventListener("keydown", handlePipelineBuilderHotkeys);
    };
  }, [isPipelineBuilderOpen, runPipelineBuilder]);

  // executeCommandPaletteSelection and keyboard handler moved to useCommandPalette hook

  const quickLauncherResults = useMemo(() => {
    const normalizedQuery = quickLauncherQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return sidebarCatalog;
    }

    return sidebarCatalog.filter((tool) =>
      tool.name.toLowerCase().includes(normalizedQuery),
    );
  }, [quickLauncherQuery, sidebarCatalog]);

  useEffect(() => {
    setSelectedQuickLauncherIndex((current) => {
      if (quickLauncherResults.length === 0) {
        return 0;
      }
      return Math.min(current, quickLauncherResults.length - 1);
    });
  }, [quickLauncherResults]);

  useEffect(() => {
    const unlistenPromise = listen("quick-launcher://toggle", () => {
      setIsQuickLauncherOpen((value) => !value);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = listen("app://open-settings", () => {
      setIsSettingsOpen(true);
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const handleQuickLauncherKeys = (event: KeyboardEvent) => {
      if (
        !quickLauncherEnabled ||
        isSettingsOpen ||
        isCommandPaletteOpen ||
        isPipelineBuilderOpen ||
        isSendToOpen
      ) {
        return;
      }

      if (!isQuickLauncherOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsQuickLauncherOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedQuickLauncherIndex((current) =>
          Math.min(current + 1, Math.max(0, quickLauncherResults.length - 1)),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedQuickLauncherIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selectedTool =
          quickLauncherResults[selectedQuickLauncherIndex] ?? quickLauncherResults[0];
        if (selectedTool) {
          openToolWithPreference(selectedTool.id);
          setIsQuickLauncherOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleQuickLauncherKeys);
    return () => {
      window.removeEventListener("keydown", handleQuickLauncherKeys);
    };
  }, [
    isCommandPaletteOpen,
    isPipelineBuilderOpen,
    isQuickLauncherOpen,
    isSendToOpen,
    isSettingsOpen,
    openToolWithPreference,
    quickLauncherEnabled,
    quickLauncherResults,
    selectedQuickLauncherIndex,
  ]);

  useEffect(() => {
    if (!isQuickLauncherOpen) {
      return;
    }

    setQuickLauncherQuery("");
    setSelectedQuickLauncherIndex(0);
    const timeoutId = window.setTimeout(() => {
      quickLauncherInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isQuickLauncherOpen]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)] transition-colors duration-300">
      <header className="shrink-0 theme-surface theme-border border-b px-4 py-3 transition-colors duration-300">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              disabled={!canScrollTabsLeft}
              onClick={() => scrollTabsBy(-220)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              title="Scroll tabs left"
            >
              ◀
            </button>
            <div
              ref={tabScrollerRef}
              className="flex min-w-0 flex-1 gap-2 overflow-x-hidden"
            >
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    data-tab-id={tab.id}
                    draggable
                    onDragStart={() => setDraggingTabId(tab.id)}
                    onDragEnd={() => setDraggingTabId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onContextMenu={(event) => openTabContextMenu(event, tab.id)}
                    onDrop={() => {
                      if (draggingTabId) {
                        reorderTabs(draggingTabId, tab.id);
                      }
                    }}
                    className={`flex shrink-0 items-center gap-1 rounded-md border pr-1 transition ${
                      isActive
                        ? "border-cyan-400 bg-cyan-500/20"
                        : "border-slate-700 bg-slate-950"
                    }`}
                  >
                    <button
                      type="button"
                      draggable={false}
                      onMouseDown={handleNavigationMouseDown}
                      onClick={() => setActiveTabId(tab.id)}
                      className={`nav-no-callout select-none whitespace-nowrap px-3 py-1.5 text-sm ${
                        isActive ? "text-cyan-100" : "text-slate-300"
                      }`}
                    >
                      {tab.title}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(tab.id);
                      }}
                      disabled={tabs.length <= 1}
                      aria-label={`Close ${tab.title}`}
                      className="rounded px-1 py-0.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Close tab (Cmd/Ctrl+W)"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!canScrollTabsRight}
              onClick={() => scrollTabsBy(220)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              title="Scroll tabs right"
            >
              ▶
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500"
          >
            <Icon name="settings" className="h-3.5 w-3.5" />
            Settings
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className="theme-surface theme-border flex shrink-0 flex-col overflow-hidden border-r transition-colors duration-300"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="overflow-y-auto p-4">
            <div className="sticky top-0 z-10 bg-slate-900/95 pb-3">
              <input
                ref={sidebarSearchInputRef}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
                placeholder="Search tools..."
                aria-label="Search tools"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedSidebarToolIndex((current) =>
                      Math.min(current + 1, Math.max(0, filteredTools.length - 1)),
                    );
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedSidebarToolIndex((current) => Math.max(current - 1, 0));
                    return;
                  }

                  if (event.key === "Enter" && filteredTools.length > 0) {
                    event.preventDefault();
                    const selectedTool = filteredTools[selectedSidebarToolIndex] ?? filteredTools[0];
                    prepareNavigationInteraction();
                    openToolInNewTab(selectedTool.id);
                    return;
                  }

                  if (event.key === "Escape") {
                    if (searchQuery.trim().length > 0) {
                      event.preventDefault();
                      setSearchQuery("");
                      setSelectedSidebarToolIndex(0);
                    } else {
                      sidebarSearchInputRef.current?.blur();
                    }
                  }
                }}
              />
            </div>
            <div className="space-y-5">
            <section>
              <button
                type="button"
                onClick={() => setFavoritesCollapsed((v) => !v)}
                className="mb-2 flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-200"
              >
                <span className={`inline-block transition-transform ${favoritesCollapsed ? "-rotate-90" : ""}`}>▾</span>
                Favorites
              </button>
              {!favoritesCollapsed && (
              <ul className="space-y-1">
                {favoriteToolIds.length === 0 && (
                  <li className="px-2 py-1 text-xs text-slate-500">
                    Click the star next to any tool to add it here.
                  </li>
                )}
                {favoriteToolIds.map((toolId) => (
                  <li
                    key={toolId}
                    draggable
                    onDragStart={() => setDraggingFavoriteToolId(toolId)}
                    onDragEnd={() => setDraggingFavoriteToolId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingFavoriteToolId) {
                        reorderFavorites(draggingFavoriteToolId, toolId);
                      }
                    }}
                    className="rounded-md"
                  >
                    <div className="flex items-center gap-1 rounded-md bg-slate-900/50 px-1 py-1">
                      <button
                        type="button"
                        onMouseDown={handleNavigationMouseDown}
                        onClick={(event) => handleSidebarToolClick(event, toolId)}
                        onAuxClick={(event) => handleSidebarToolAuxClick(event, toolId)}
                        onContextMenu={suppressNavigationContextMenu}
                        className="nav-no-callout w-full select-none rounded-md px-2 py-1 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                      >
                        {highlightSearchMatch(
                          sidebarToolById.get(toolId)?.name ?? getTool(toolId).name,
                          searchQuery,
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(toolId)}
                        aria-label={`Remove ${sidebarToolById.get(toolId)?.name ?? getTool(toolId).name} from favorites`}
                        className="rounded px-1 py-0.5 text-xs text-amber-300"
                        title="Remove favorite"
                      >
                        ★
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              )}
            </section>

            <section>
              {filteredTools.length === 0 && (
                <div className="mt-2">
                  <EmptyState
                    title="No tool match"
                    description="Try a different keyword."
                    icon={<Icon name="search" className="h-4 w-4" />}
                  />
                </div>
              )}
              {groupedFilteredTools
                .filter((group) => !hiddenCategories.has(group.category))
                .map((group) => {
                  const isCollapsed = collapsedCategories.has(group.category);
                  return (
                    <div key={group.category} className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleCategoryCollapsed(group.category)}
                        className="flex w-full items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition hover:text-slate-300"
                      >
                        <span className={`inline-block text-[8px] transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>▾</span>
                        {group.category}
                        <span className="ml-auto text-[9px] font-normal text-slate-600">{group.tools.length}</span>
                      </button>
                      {!isCollapsed && (
                        <ul className="mt-0.5 space-y-0.5">
                          {group.tools.map((tool) => {
                            const flatIndex = filteredTools.indexOf(tool);
                            return (
                              <li key={tool.id}>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onMouseDown={handleNavigationMouseDown}
                                    onClick={(event) => handleSidebarToolClick(event, tool.id)}
                                    onAuxClick={(event) => handleSidebarToolAuxClick(event, tool.id)}
                                    onContextMenu={suppressNavigationContextMenu}
                                    className={`nav-no-callout w-full select-none rounded-md px-2 py-1 text-left text-sm transition ${
                                      selectedSidebarToolId === tool.id
                                        ? "bg-cyan-500/20 text-cyan-200"
                                        : "text-slate-300 hover:bg-slate-800"
                                    }`}
                                    onMouseEnter={() => setSelectedSidebarToolIndex(flatIndex)}
                                  >
                                    {highlightSearchMatch(tool.name, searchQuery)}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleFavorite(tool.id)}
                                    aria-label={
                                      favoriteToolIds.includes(tool.id)
                                        ? `Remove ${tool.name} from favorites`
                                        : `Add ${tool.name} to favorites`
                                    }
                                    className={`rounded px-1 py-0.5 text-xs ${
                                      favoriteToolIds.includes(tool.id)
                                        ? "text-amber-300"
                                        : "text-slate-500"
                                    }`}
                                    title="Toggle favorite"
                                  >
                                    {favoriteToolIds.includes(tool.id) ? "★" : "☆"}
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
            </section>
          </div>
          </div>
        </aside>

        <button
          type="button"
          aria-label="Resize sidebar"
          onMouseDown={() => setIsResizingSidebar(true)}
          className="w-1 shrink-0 cursor-col-resize bg-slate-800 transition hover:bg-cyan-500/80"
        />

        <main ref={mainContentRef} className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-[var(--app-bg)] p-6 transition-colors duration-300">
          <section className="order-1 theme-surface-elevated theme-border rounded-2xl border p-6 shadow-2xl shadow-slate-950/30 transition-colors duration-300">
            {activeTab ? (
              <ToolWorkspace
                toolId={activeTab.toolId}
                toolName={activeTab.title}
                input={activeTabWorkspace.name}
                onInputChange={(value) => updateActiveTabWorkspace({ name: value })}
                output={activeTabWorkspace.greetMsg}
                outputState={activeTabWorkspace.outputState}
                outputError={activeTabWorkspace.outputError}
                onRun={(options) => {
                  const updates: Partial<TabWorkspaceState> = {};
                  const runOverrides: ToolRunOverrides = {};

                  const formatterMode = normalizeFormatMode(options?.mode);
                  if (formatterMode) {
                    updates.formatMode = formatterMode;
                    runOverrides.formatterMode = formatterMode;
                  }

                  if (isCaseConverterMode(options?.mode)) {
                    updates.caseConverterMode = options.mode;
                    runOverrides.caseConverterMode = options.mode;
                  }

                  // Generic converter mode: any mode that isn't a formatter or case-converter mode
                  if (options?.mode && !formatterMode && !isCaseConverterMode(options.mode)) {
                    runOverrides.converterMode = options.mode;
                  }

                  const maxIndent = activeTab.toolId === "caesar-cipher" ? 25 : 8;
                  const indentSize = normalizeIndentSize(options?.indentSize, maxIndent);
                  if (indentSize !== null) {
                    updates.indentSize = indentSize;
                    runOverrides.indentSize = indentSize;
                  }

                  if (options?.inputOverride) {
                    runOverrides.inputOverride = options.inputOverride;
                  }

                  if (Object.keys(updates).length > 0) {
                    updateActiveTabWorkspace(updates);
                  }
                  void greetInActiveTab(
                    Object.keys(runOverrides).length > 0 ? runOverrides : undefined,
                  );
                }}
                onCopy={copyActiveOutput}
                onClear={clearActiveTool}
                onDownload={downloadActiveOutput}
                formatMode={activeTabWorkspace.formatMode}
                indentSize={activeTabWorkspace.indentSize}
                onFileDrop={loadToolInputFromFile}
                acceptedFiles={activeToolFileAccept}
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <p>Select a tool from the sidebar to get started.</p>
              </div>
            )}
          </section>

          <section className="order-2 theme-surface-elevated theme-border rounded-2xl border p-6 transition-colors duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                History
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => clearHistory("active")}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                >
                  Clear tool
                </button>
                <button
                  type="button"
                  onClick={() => clearHistory("all")}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                >
                  Clear all
                </button>
              </div>
            </div>
            {activeToolHistory.length > 3 && (
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Search history..."
                className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-600 focus:outline-none"
              />
            )}
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {activeToolHistory.length === 0 && (
                <li className="text-xs text-slate-500">
                  No history entries for this tool.
                </li>
              )}
              {historySearchQuery && filteredHistory.length === 0 && activeToolHistory.length > 0 && (
                <li className="text-xs text-slate-500">
                  No matches.
                </li>
              )}
              {filteredHistory.map((entry) => {
                const snapshot = parseHistorySnapshot(entry.inputSnapshot);
                const preview =
                  snapshot.name || snapshot.notes || entry.inputSnapshot;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => restoreHistoryEntry(entry)}
                      className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-left text-xs text-slate-300 transition hover:border-cyan-400/50"
                    >
                      <p className="truncate">
                        {preview.length > 80
                          ? `${preview.slice(0, 80)}…`
                          : preview}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatUnixTime(entry.createdAtUnix)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>
      </div>

      {tabContextMenuInfo && (
        <div
          ref={tabContextMenuRef}
          role="menu"
          aria-label="Tab context menu"
          className="nav-no-callout fixed z-[70] min-w-52 rounded-md border border-slate-700 bg-slate-950/98 p-1 shadow-2xl shadow-slate-950/70"
          style={{ left: `${tabContextMenuInfo.x}px`, top: `${tabContextMenuInfo.y}px` }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeTabContextMenu();
              closeAllTabs();
            }}
            className="w-full select-none rounded px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
          >
            Close all tabs
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!tabContextMenuInfo.hasTabsToRight}
            onClick={() => {
              closeTabContextMenu();
              closeTabsToRight(tabContextMenuInfo.tabId);
            }}
            className="w-full select-none rounded px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent"
          >
            Close tabs to the right
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!tabContextMenuInfo.hasTabsToLeft}
            onClick={() => {
              closeTabContextMenu();
              closeTabsToLeft(tabContextMenuInfo.tabId);
            }}
            className="w-full select-none rounded px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent"
          >
            Close tabs to the left
          </button>
        </div>
      )}

      {isSendToOpen && (
        <div
          className="fixed inset-0 z-[46] flex items-start justify-center bg-slate-950/55 p-6 pt-20 backdrop-blur-sm"
          onClick={() => setIsSendToOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Send output to compatible tool"
            className="theme-surface-elevated theme-border w-full max-w-2xl rounded-xl border shadow-2xl shadow-slate-950/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="theme-border border-b p-3">
              <p className="text-sm font-semibold text-slate-100">Send Output To…</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Compatible targets filtered by chain input/output types.
              </p>
              <input
                ref={sendToInputRef}
                value={sendToQuery}
                onChange={(event) => setSendToQuery(event.currentTarget.value)}
                placeholder="Search compatible target tools"
                aria-label="Search compatible target tools"
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </div>

            <ul className="max-h-96 overflow-y-auto p-2">
              {isLoadingSendToTargets && (
                <li className="p-2">
                  <LoadingState label="Loading compatible tools..." />
                </li>
              )}
              {!isLoadingSendToTargets && filteredSendToTargets.length === 0 && (
                <li>
                  <EmptyState
                    title="No compatible tools"
                    description="Try a different source output or tool."
                    icon={<Icon name="spark" className="h-4 w-4" />}
                  />
                </li>
              )}
              {!isLoadingSendToTargets &&
                filteredSendToTargets.map((target, index) => (
                  <li key={target.id}>
                    <button
                      type="button"
                      onClick={() => sendOutputToTool(target)}
                      onMouseEnter={() => setSelectedSendToIndex(index)}
                      className={`w-full rounded-md px-3 py-2 text-left ${
                        selectedSendToIndex === index
                          ? "bg-cyan-500/20 text-cyan-100"
                          : "text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <p className="text-sm font-medium">{target.name}</p>
                      <p className="text-xs text-slate-400">{target.id}</p>
                    </button>
                  </li>
                ))}
            </ul>

            <div className="theme-border flex justify-end border-t p-3">
              <button
                type="button"
                onClick={() => setIsSendToOpen(false)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isPipelineBuilderOpen && (
        <div
          className="fixed inset-0 z-[42] flex items-start justify-center bg-slate-950/65 p-6 pt-16 backdrop-blur-sm"
          onClick={() => setIsPipelineBuilderOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pipeline builder"
            className="theme-surface-elevated theme-border flex w-full max-w-5xl flex-col rounded-xl border shadow-2xl shadow-slate-950/60"
            style={{ maxHeight: "calc(100vh - 5rem)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Dialog header */}
            <div className="theme-border flex shrink-0 items-center justify-between border-b p-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">Pipeline Builder</p>
                <p className="text-xs text-slate-400">
                  Build multi-step chains and inspect intermediate outputs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPipelineBuilderOpen(false)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
              >
                Close
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Saved Chains - horizontal scrollable cards */}
              <div className="rounded border border-slate-700 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Saved Chains
                  </p>
                  <button
                    type="button"
                    onClick={savePipelineAsNew}
                    className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-200"
                  >
                    + Save New
                  </button>
                </div>
                {savedChains.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No saved chains yet. Save your current pipeline to reuse it later.
                  </p>
                ) : (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {savedChains.map((chain) => {
                      const isSelected = chain.id === selectedPipelineChainId;
                      const parsedChain = parsePersistedPipelinePayload(chain.chainJson);
                      const stepCount = parsedChain?.steps.length ?? 0;
                      return (
                        <div
                          key={chain.id}
                          className={`group relative flex shrink-0 cursor-pointer flex-col rounded border px-3 py-2 transition ${
                            isSelected
                              ? "border-cyan-500/60 bg-cyan-500/10"
                              : "border-slate-700 bg-slate-950 hover:border-slate-600"
                          }`}
                          style={{ minWidth: "120px", maxWidth: "180px" }}
                          onClick={() => {
                            loadPipelineFromChain(chain);
                          }}
                        >
                          <p
                            className={`truncate text-xs font-medium ${
                              isSelected ? "text-cyan-200" : "text-slate-200"
                            }`}
                            title={chain.name}
                          >
                            {chain.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {stepCount} step{stepCount !== 1 ? "s" : ""}
                          </p>
                          {/* Action buttons on hover */}
                          {isSelected && (
                            <div className="mt-1.5 flex items-center gap-1 border-t border-slate-700/50 pt-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  savePipelineEdits();
                                }}
                                className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
                                title="Save edits to this chain"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  renamePipelineChain();
                                }}
                                className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
                                title="Rename this chain"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  duplicatePipelineChain();
                                }}
                                className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
                                title="Duplicate this chain"
                              >
                                Dup
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deletePipelineChain();
                                }}
                                className="rounded px-1.5 py-0.5 text-[10px] text-red-400 transition hover:bg-red-500/20 hover:text-red-200"
                                title="Delete this chain"
                              >
                                Del
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pipeline Input */}
              <div className="rounded border border-slate-700 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Pipeline Input
                  </p>
                  <button
                    type="button"
                    onClick={addPipelineStep}
                    className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-200"
                  >
                    + Add Step
                  </button>
                </div>
                <textarea
                  value={pipelineInput}
                  onChange={(event) => setPipelineInput(event.currentTarget.value)}
                  className="mt-2 min-h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-cyan-400"
                  placeholder="Paste source input for step 1"
                />
              </div>

              {/* Steps with visual flow connectors */}
              <div className="space-y-0 pr-1">
                {pipelineSteps.map((step, index) => {
                  const stepTool =
                    sidebarCatalog.find((tool) => tool.id === step.toolId) ??
                    getTool(step.toolId);
                  const previousStep = index > 0 ? pipelineSteps[index - 1] : null;
                  const previousTool = previousStep
                    ? sidebarCatalog.find((tool) => tool.id === previousStep.toolId) ??
                      getTool(previousStep.toolId)
                    : null;
                  const isLinkValid = pipelineLinkCompatibility[index] ?? false;
                  const stepResult = pipelineStepResults[index];
                  const isFirst = index === 0;
                  const isLast = index === pipelineSteps.length - 1;

                  return (
                    <div key={step.id}>
                      {/* Visual flow connector between steps */}
                      {index > 0 && (
                        <div className="flex items-center justify-center py-1">
                          <div className="flex flex-col items-center">
                            <div
                              className={`h-3 w-1.5 rounded-sm ${
                                isLinkValid
                                  ? "bg-emerald-500/40"
                                  : "bg-red-500/40"
                              }`}
                            />
                            <span
                              className={`my-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isLinkValid
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-red-500/15 text-red-300"
                              }`}
                            >
                              {previousTool?.chainProduces ?? "unknown"}
                            </span>
                            <div
                              className={`h-3 w-1.5 rounded-sm ${
                                isLinkValid
                                  ? "bg-emerald-500/40"
                                  : "bg-red-500/40"
                              }`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Step card */}
                      <div
                        className={`rounded border p-3 ${
                          index > 0 && !isLinkValid
                            ? "border-red-500/60 bg-red-500/10"
                            : "border-slate-700 bg-slate-950/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100">
                            Step {index + 1}
                          </p>
                          <div className="flex items-center gap-1">
                            {index > 0 && (
                              <span
                                className={`rounded px-2 py-0.5 text-[11px] ${
                                  isLinkValid
                                    ? "bg-emerald-500/20 text-emerald-200"
                                    : "bg-red-500/20 text-red-200"
                                }`}
                              >
                                {isLinkValid ? "Valid Link" : "Invalid Link"}
                              </span>
                            )}
                            {/* Move up button */}
                            <button
                              type="button"
                              onClick={() => movePipelineStep(step.id, "up")}
                              disabled={isFirst}
                              className="rounded border border-slate-700 px-1.5 py-1 text-[11px] text-slate-200 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move step up"
                            >
                              &#8593;
                            </button>
                            {/* Move down button */}
                            <button
                              type="button"
                              onClick={() => movePipelineStep(step.id, "down")}
                              disabled={isLast}
                              className="rounded border border-slate-700 px-1.5 py-1 text-[11px] text-slate-200 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move step down"
                            >
                              &#8595;
                            </button>
                            <button
                              type="button"
                              onClick={() => removePipelineStep(step.id)}
                              disabled={pipelineSteps.length <= 1}
                              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 transition hover:border-red-500/50 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <PipelineToolSelector
                            tools={sidebarCatalog}
                            selectedToolId={step.toolId}
                            onSelect={(toolId) =>
                              updatePipelineStepTool(step.id, toolId)
                            }
                            highlightMatch={highlightSearchMatch}
                          />
                        </div>

                        <p className="mt-2 text-[11px] text-slate-400">
                          Produces: <code>{stepTool.chainProduces ?? "unknown"}</code>
                          {stepTool.chainAccepts && stepTool.chainAccepts.length > 0
                            ? ` | Accepts: ${stepTool.chainAccepts.join(", ")}`
                            : ""}
                        </p>

                        {index > 0 && previousTool && !isLinkValid && (
                          <p className="mt-1 text-[11px] text-red-200">
                            Link mismatch: previous step produces{" "}
                            <code>{previousTool.chainProduces ?? "unknown"}</code>, but
                            this step accepts{" "}
                            <code>
                              {(stepTool.chainAccepts ?? []).join(", ") || "none"}
                            </code>
                            .
                          </p>
                        )}

                        <div className="mt-2 rounded border border-slate-700 bg-slate-950 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Intermediate Output
                          </p>
                          {stepResult ? (
                            <pre
                              className={`mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-xs ${
                                stepResult.error
                                  ? stepResult.skipped
                                    ? "text-amber-200"
                                    : "text-red-200"
                                  : "text-slate-200"
                              }`}
                            >
                              {stepResult.error
                                ? `ERROR: ${stepResult.error}`
                                : stepResult.output || "(empty output)"}
                            </pre>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">
                              Run the pipeline to compute this step output.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sticky footer with Run Pipeline button */}
            <div className="theme-border flex shrink-0 items-center justify-between border-t px-4 py-3">
              <p className="text-[11px] text-slate-500">
                {pipelineSteps.length} step{pipelineSteps.length !== 1 ? "s" : ""} in pipeline
              </p>
              <button
                type="button"
                onClick={() => void runPipelineBuilder()}
                disabled={isRunningPipeline || pipelineSteps.length === 0}
                className="rounded border border-cyan-600 bg-cyan-600/20 px-4 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-600/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRunningPipeline ? "Running..." : "Run Pipeline (Cmd/Ctrl+Enter)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isQuickLauncherOpen && (
        <div
          className="fixed inset-0 z-[35] flex items-start justify-center bg-slate-950/45 p-4 pt-12 backdrop-blur-sm"
          onClick={() => setIsQuickLauncherOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Quick launcher"
            className="theme-surface-elevated theme-border w-full max-w-xl rounded-xl border shadow-2xl shadow-slate-950/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="theme-border border-b p-3">
              <input
                ref={quickLauncherInputRef}
                value={quickLauncherQuery}
                onChange={(event) => setQuickLauncherQuery(event.currentTarget.value)}
                placeholder={`Quick launcher (${quickLauncherShortcut})`}
                aria-label="Quick launcher search"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {quickLauncherResults.length === 0 && (
                <li>
                  <EmptyState
                    title="No tools found"
                    description="Adjust your launcher query."
                    icon={<Icon name="search" className="h-4 w-4" />}
                  />
                </li>
              )}
              {quickLauncherResults.map((tool, index) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => {
                      openToolWithPreference(tool.id);
                      setIsQuickLauncherOpen(false);
                    }}
                    className={`w-full rounded px-3 py-2 text-left text-sm ${
                      selectedQuickLauncherIndex === index
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "text-slate-200 hover:bg-slate-800"
                    }`}
                    onMouseEnter={() => setSelectedQuickLauncherIndex(index)}
                  >
                    {highlightSearchMatch(tool.name, quickLauncherQuery)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {isWhatsNewOpen && (
        <div
          className="fixed inset-0 z-[33] flex items-start justify-center bg-slate-950/55 p-6 pt-16 backdrop-blur-sm"
          onClick={() => setIsWhatsNewOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="What's new"
            className="theme-surface-elevated theme-border w-full max-w-3xl rounded-xl border shadow-2xl shadow-slate-950/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="theme-border flex items-center justify-between border-b p-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">What's New</p>
                <p className="text-xs text-slate-400">
                  Latest release notes for {currentAppVersion || "current version"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatsNewOpen(false)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap break-words text-sm text-slate-200">
                {whatsNewNotes.trim() || "No release notes are available."}
              </pre>
            </div>
          </div>
        </div>
      )}

      {isRestartPromptOpen && (
        <div className="fixed inset-0 z-[34] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Restart required"
            className="theme-surface-elevated theme-border w-full max-w-md rounded-xl border p-4 shadow-2xl shadow-slate-950/60"
          >
            <p className="text-sm font-semibold text-slate-100">Restart Required</p>
            <p className="mt-2 text-xs text-slate-300">
              An update is ready. Restart Binturong now to finish applying it.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRestartPromptOpen(false)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  void invoke("request_app_restart").catch((error) =>
                    setDatabaseError(
                      error instanceof Error
                        ? error.message
                        : "failed to restart application",
                    ),
                  );
                }}
                className="rounded border border-cyan-400 bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100"
              >
                Restart now
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        rememberLastInput={rememberLastInput}
        onRememberLastInputChange={setRememberLastInput}
        themeVariant={themeVariant}
        onThemeVariantChange={setThemeVariant}
        showStatusBar={showStatusBar}
        onShowStatusBarChange={setShowStatusBar}
        fontSizeLevel={fontSizeLevel}
        onFontSizeLevelChange={setFontSizeLevel}
        searchDebounceMs={searchDebounceMs}
        onSearchDebounceMsChange={setSearchDebounceMs}
        openToolsInNewTab={openToolsInNewTab}
        onOpenToolsInNewTabChange={setOpenToolsInNewTab}
        quickLauncherEnabled={quickLauncherEnabled}
        onQuickLauncherEnabledChange={setQuickLauncherEnabled}
        quickLauncherShortcut={quickLauncherShortcut}
        onQuickLauncherShortcutChange={setQuickLauncherShortcut}
        autoUpdateEnabled={autoUpdateEnabled}
        onAutoUpdateEnabledChange={setAutoUpdateEnabled}
        updateChannel={updateChannel}
        onUpdateChannelChange={setUpdateChannel}
        updateCheckInterval={updateCheckInterval}
        onUpdateCheckIntervalChange={setUpdateCheckInterval}
        isCheckingForUpdates={isCheckingForUpdates}
        lastUpdateCheckResult={lastUpdateCheckResult}
        currentAppVersion={currentAppVersion}
        whatsNewNotes={whatsNewNotes}
        onCheckForUpdates={checkForUpdates}
        onOpenWhatsNew={(notes) => {
          setWhatsNewNotes(notes);
          setIsWhatsNewOpen(true);
        }}
        lifecycle={lifecycle}
        lifecycleError={lifecycleError}
        databaseStatus={databaseStatus}
        storageCounts={storageCounts}
        databaseError={databaseError}
        persistSetting={persistSetting}
        hiddenCategories={hiddenCategories}
        onHiddenCategoriesChange={(cats) => {
          setHiddenCategories(cats);
          persistSetting("app.hiddenCategories", [...cats]);
        }}
        allCategories={ALL_CATEGORIES}
      />

      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/60 p-6 pt-20 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="theme-surface-elevated theme-border w-full max-w-2xl rounded-xl border shadow-2xl shadow-slate-950/60"
          >
            <div className="border-b border-slate-700 p-3">
              <input
                ref={commandPaletteInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.currentTarget.value)}
                placeholder={commandScope === "detect" ? "Paste content to detect matching tools..." : "Search commands (Cmd/Ctrl+K)"}
                aria-label="Command palette search"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {COMMAND_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => {
                      setCommandScope(scope);
                      setSelectedCommandIndex(0);
                    }}
                    className={`rounded border px-2 py-1 text-xs ${
                      commandScope === scope
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                        : "border-slate-700 text-slate-300"
                    }`}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-96 overflow-y-auto p-2">
              {commandScope === "detect" && isDetectingInPalette && (
                <li className="px-3 py-4 text-center text-xs text-slate-400">
                  Detecting...
                </li>
              )}
              {commandScope === "detect" && !isDetectingInPalette && commandPaletteItems.length === 0 && (
                <li>
                  <EmptyState
                    title={commandQuery.trim() ? "No matching tools detected" : "Smart Clipboard Detection"}
                    description={commandQuery.trim() ? "Try pasting different content." : "Paste or type content above to find the best matching tools."}
                    icon={<Icon name="command" className="h-4 w-4" />}
                  />
                </li>
              )}
              {commandScope !== "detect" && commandPaletteItems.length === 0 && (
                <li>
                  <EmptyState
                    title="No command match"
                    description="Try a different scope or query."
                    icon={<Icon name="command" className="h-4 w-4" />}
                  />
                </li>
              )}
              {commandPaletteItems.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      item.onSelect();
                      setIsCommandPaletteOpen(false);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      selectedCommandIndex === index
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-400">
                      {item.scope} • {item.subtitle}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showStatusBar && (
        <footer className="theme-surface theme-border flex items-center justify-between border-t px-4 py-2 text-xs text-[var(--text-muted)] transition-colors duration-300">
          <span>Tabs: {tabs.length}</span>
          <span>Sidebar width: {sidebarWidth}px</span>
          <span>
            {activeTab?.title ?? "No active tab"}
            {registryToolCount !== null ? ` • registry: ${registryToolCount}` : ""} •
            {` ${themeVariant}→${resolvedTheme}`}
          </span>
        </footer>
      )}
      <ToastHost toasts={toasts} />
    </div>
  );
}

export default App;
