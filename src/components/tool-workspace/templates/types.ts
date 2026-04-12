export type TemplateProps = {
  /** Tool identifier (e.g. "caesar-cipher", "aes-encrypt") */
  toolId?: string;
  /** Current input value */
  input: string;
  /** Called when input changes */
  onInputChange: (value: string) => void;
  /** Current output value */
  output: string;
  /** Output state */
  outputState: "idle" | "loading" | "success" | "error";
  /** Error message when outputState is "error" */
  outputError: string;
  /** Execute the tool */
  onRun: (options?: { mode?: string; indentSize?: number; inputOverride?: string }) => void;
  /** Copy output to clipboard */
  onCopy: () => void;
  /** Clear input and output */
  onClear: () => void;
  /** Download output as text file */
  onDownload: () => void;
  /** Current format mode */
  formatMode: "format" | "minify";
  /** Current indent size */
  indentSize: number;
  /** Tool-specific button configs */
  buttons: Array<{ label: string; mode?: string; primary?: boolean }>;
  /** Placeholder text for input */
  placeholder?: string;
  /** Whether to use monospaced font */
  mono?: boolean;
  /** Record clipboard history entry */
  onPaste?: (text: string) => void;
  /** For file drop support */
  onFileDrop?: (file: File) => void;
  /** Accepted file extensions for drag-drop */
  acceptedFiles?: string;
  /** Direction labels for Template B */
  directionLabels?: [string, string];
  /** Extra input fields for Template B (slider, text) */
  extras?: Array<{
    key: string;
    label: string;
    type: "slider" | "text";
    placeholder?: string;
    min?: number;
    max?: number;
    defaultValue?: number | string;
    jsonWrap?: boolean;
  }>;
};
