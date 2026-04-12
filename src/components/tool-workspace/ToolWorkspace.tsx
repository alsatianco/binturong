import { Component, memo, type ReactNode, type ErrorInfo, type ComponentType } from "react";
import { getToolConfig } from "./toolConfigs";
import type { TemplateProps } from "./templates/types";
import { TemplateA } from "./templates/TemplateA";
import { TemplateB } from "./templates/TemplateB";
import { TemplateC } from "./templates/TemplateC";
import { TemplateD } from "./templates/TemplateD";
import { TemplateE } from "./templates/TemplateE";
import { TemplateF, type TemplateFProps } from "./templates/TemplateF";
import { TemplateG } from "./templates/TemplateG";
import { TemplateH, type TemplateHProps } from "./templates/TemplateH";
import { TemplateI } from "./templates/TemplateI";
import { TemplateJ } from "./templates/TemplateJ";
import { TemplateK, type TemplateKProps } from "./templates/TemplateK";
import { TemplateL } from "./templates/TemplateL";
import { TemplateM } from "./templates/TemplateM";

export type ToolWorkspaceProps = {
  toolId: string;
  toolName: string;
  input: string;
  onInputChange: (value: string) => void;
  output: string;
  outputState: "idle" | "loading" | "success" | "error";
  outputError: string;
  onRun: (options?: { mode?: string; indentSize?: number; inputOverride?: string }) => void;
  onCopy: () => void;
  onClear: () => void;
  onDownload: () => void;
  formatMode: "format" | "minify";
  indentSize: number;
  onPaste?: (text: string) => void;
  onFileDrop?: (file: File) => void;
  acceptedFiles?: string;
};

// --- Error Boundary ---

type ErrorBoundaryProps = { toolId: string; children: ReactNode };
type ErrorBoundaryState = { error: Error | null };

class ToolErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ToolWorkspace] CRASH in tool="${this.props.toolId}":`,
      error.message,
      "\nStack:", error.stack,
      "\nComponent stack:", info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when switching to a different tool
    if (prevProps.toolId !== this.props.toolId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-3 rounded-md border border-red-500/60 bg-red-500/10 p-4">
          <p className="font-semibold text-red-300">
            Tool &quot;{this.props.toolId}&quot; crashed during rendering
          </p>
          <p className="text-sm text-red-200">{this.state.error.message}</p>
          <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-red-300">
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded border border-red-500 px-3 py-1 text-sm text-red-200 hover:bg-red-500/20"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Wrapper components that render each template as proper JSX ---
// Each template function uses hooks, so it must be rendered as a React component via JSX.
// We wrap each in a thin component that calls it and renders the slot results.

type SlotResult = {
  inputArea: ReactNode;
  actionButtons: ReactNode;
  outputArea: ReactNode;
};

function SlotLayout({ slots }: { slots: SlotResult }) {
  return (
    <>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Input</p>
        {slots.inputArea}
      </div>
      <div className="flex flex-wrap gap-2">{slots.actionButtons}</div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Output</p>
        {slots.outputArea}
      </div>
    </>
  );
}

// Wrapper components - each is a proper React component so hooks inside templates work.
// Without these wrappers, calling TemplateX(props) directly would violate Rules of Hooks.
const RenderA = memo(function RenderA(p: TemplateProps) { return <SlotLayout slots={TemplateA(p)} />; });
const RenderB = memo(function RenderB(p: TemplateProps) { return <SlotLayout slots={TemplateB(p)} />; });
const RenderC = memo(function RenderC(p: TemplateProps) { return <SlotLayout slots={TemplateC(p)} />; });
const RenderD = memo(function RenderD(p: TemplateProps) { return <SlotLayout slots={TemplateD(p)} />; });
const RenderE = memo(function RenderE(p: TemplateProps) { return <SlotLayout slots={TemplateE(p)} />; });
const RenderF = memo(function RenderF(p: TemplateFProps) { return <SlotLayout slots={TemplateF(p)} />; });
const RenderG = memo(function RenderG(p: TemplateProps) { return <SlotLayout slots={TemplateG(p)} />; });
const RenderH = memo(function RenderH(p: TemplateHProps) { return <SlotLayout slots={TemplateH(p)} />; });
const RenderI = memo(function RenderI(p: TemplateProps) { return <SlotLayout slots={TemplateI(p)} />; });
const RenderJ = memo(function RenderJ(p: TemplateProps) { return <SlotLayout slots={TemplateJ(p)} />; });
const RenderK = memo(function RenderK(p: TemplateKProps) { return <SlotLayout slots={TemplateK(p)} />; });
const RenderL = memo(function RenderL(p: TemplateProps) { return <SlotLayout slots={TemplateL(p)} />; });
const RenderM = memo(function RenderM(p: TemplateProps) { return <SlotLayout slots={TemplateM(p)} />; });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEMPLATE_MAP: Record<string, ComponentType<any>> = {
  A: RenderA,
  B: RenderB,
  C: RenderC,
  D: RenderD,
  E: RenderE,
  F: RenderF,
  G: RenderG,
  H: RenderH,
  I: RenderI,
  J: RenderJ,
  K: RenderK,
  L: RenderL,
  M: RenderM,
};

// --- Main component ---

export const ToolWorkspace = memo(function ToolWorkspace(props: ToolWorkspaceProps) {
  const { toolId, toolName } = props;
  const config = getToolConfig(toolId);

  const description = config?.description ?? "Run this tool to transform your input.";
  const buttons = config?.buttons ?? [{ label: "Run", primary: true }];
  const template = config?.template ?? "D";


  const templateProps: TemplateProps = {
    toolId,
    input: props.input,
    onInputChange: props.onInputChange,
    output: props.output,
    outputState: props.outputState,
    outputError: props.outputError,
    onRun: props.onRun,
    onCopy: props.onCopy,
    onClear: props.onClear,
    onDownload: props.onDownload,
    formatMode: props.formatMode,
    indentSize: props.indentSize,
    buttons,
    placeholder: config?.placeholder,
    mono: config?.mono,
    onPaste: props.onPaste,
    onFileDrop: props.onFileDrop,
    acceptedFiles: config?.acceptedFiles ?? props.acceptedFiles,
    directionLabels: config?.directionLabels,
  };

  // Extended props for templates that need extra fields
  const extendedProps = {
    ...templateProps,
    generatorFields: config?.generatorFields,
    multiFields: config?.multiFields,
    outputIsText: config?.outputIsText,
    ocrLanguageSelect: config?.ocrLanguageSelect,
    extras: config?.extras,
  };

  const TemplateComponent = TEMPLATE_MAP[template] ?? RenderD;

  return (
    <ToolErrorBoundary toolId={toolId}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{toolName}</h1>
          <p className="mt-1 text-sm text-slate-300">{description}</p>
        </div>
        {props.outputState === "error" && props.outputError && (
          <div
            role="alert"
            className="rounded-md border border-red-500/60 bg-red-500/10 p-3"
          >
            <p className="text-sm font-semibold text-red-200">
              Tool execution failed
            </p>
            <p className="mt-1 text-xs text-red-200/90">
              The Rust backend returned an error response.
            </p>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-xs text-red-100">
              {props.outputError}
            </pre>
          </div>
        )}
        {/* key={template} forces remount when template type changes, resetting hook state */}
        <TemplateComponent key={`${toolId}-${template}`} {...extendedProps} />
      </div>
    </ToolErrorBoundary>
  );
});
