# Tool UI Implementation Design

## Context

Binturong has 133 mini tools with a fully implemented Rust backend, but the frontend renders all tools through a single generic UI in a 7,256-line monolithic App.tsx. Every tool gets the same textarea input, generic "Actions" bar, and `<div>` output - regardless of whether the tool needs a color picker, dual textareas, file drop zone, or algorithm selector. The only exception is `case-converter`, which has its own custom layout.

The goal is to implement proper, working UI for every tool while maintaining a consistent visual structure: Tool Name, Description, Input, Action Buttons, Output, Extras.

## Architecture

### Standard Tool Layout

Every tool, without exception, renders through a `StandardToolLayout` component that enforces this visual rhythm:

```
[Tool Name]
[Description - what the tool does, when to use it]
"Input" label
[Input area - varies by template]
[Action button(s) - varies by template]
"Output" label
[Output area - varies by template]
[Extras - Copy, Download, Clear, stats]
```

Even tools with unusual input methods (dual textareas for text-diff, file drop for images, multi-field form for regex-tester) follow this same top-to-bottom structure.

### Component Hierarchy

```
App.tsx (slimmed)
  └─ ToolWorkspace.tsx (dispatch)
       └─ StandardToolLayout.tsx (enforces structure)
            └─ ToolTemplate[A-L].tsx (template-specific slots)
```

**Files to create:**
- `src/components/tool-workspace/ToolWorkspace.tsx` - reads tool metadata, selects template, passes shared callbacks (greet, copy, clear, etc.)
- `src/components/tool-workspace/StandardToolLayout.tsx` - enforces Name→Description→Input→Buttons→Output→Extras
- `src/components/tool-workspace/templates/TemplateA.tsx` through `TemplateL.tsx` - 12 template components
- `src/components/tool-workspace/toolConfigs.ts` - static per-tool metadata (description, template, buttons, options)

**Files to modify:**
- `src/App.tsx` - extract the main content rendering section (lines ~5254-5498) and delegate to ToolWorkspace. Keep all state management, sidebar, tabs, overlays in App.tsx.

### Template Components

Each template provides three slots to StandardToolLayout:

1. **inputArea** - the tool-specific input (textarea, file drop, dual textareas, form fields)
2. **actionButtons** - the tool-specific action buttons (Format/Minify, Encode/Decode, Generate, etc.)
3. **outputArea** - the tool-specific output (read-only textarea, image preview, iframe, structured fields)

| Template | Input Slot | Buttons | Output Slot | Tool Count |
|----------|-----------|---------|-------------|------------|
| A: Format/Minify | Monospaced textarea + file drop | Format, Minify + indent selector | Read-only monospaced textarea | 13 |
| B: Encode/Decode | Monospaced textarea | Direction toggle (Encode/Decode) | Read-only monospaced textarea | 14 |
| C: One-Way Converter | Monospaced textarea + file drop | Run Convert | Read-only monospaced textarea | 15 |
| D: Text Manipulation | Textarea | Run + per-tool mode controls | Read-only textarea | 22 |
| E: Unicode Generator | Textarea (auto-run on type) | (no button - instant) | Large read-only textarea | 27 |
| F: Generator | Config form (fields per tool) | Generate | Read-only textarea | 11 |
| G: Structured Output | Monospaced textarea | Run | Key-value field list | 6 |
| H: File I/O | File drop zone + thumbnail | (auto on file load) | Image preview + download OR textarea | 9 |
| I: Live Preview | Monospaced textarea (auto-run) | (no button - live) | Sandboxed iframe | 3 |
| J: Dual Input | Two side-by-side textareas | Compare | Colored diff output | 1 |
| K: Multi-Field | Multiple labeled inputs | Run | Per-tool output | 2 |
| L: Visual Interactive | Custom widget + text fallback | Run | Per-tool output | 2 |

### Per-Tool Configuration

Static config in `toolConfigs.ts` - no custom code needed for 120+ tools:

```ts
type ToolConfig = {
  id: string;
  template: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";
  description: string;
  buttons: ButtonConfig[];
  options?: ToolOptions; // template-specific options (indent selector, direction labels, etc.)
};
```

### Backend Wiring

The current `greetInActiveTab` function handles all tool execution through two Tauri commands: `run_formatter_tool` (for formatters) and `run_converter_tool` (for converters). This stays the same - each template calls the appropriate command with the right parameters.

Tools with structured JSON input (case-converter, regex-tester, text-diff, generators, etc.) need the template to serialize form fields into JSON before sending to the backend. This is handled per-template, not per-tool.

### State Management

All workspace state (`TabWorkspaceState`) stays in App.tsx. The `ToolWorkspace` component receives state and callbacks as props - no state migration needed. The `TabWorkspaceState` type gains optional fields for template-specific state (e.g., `extraFields` for multi-field inputs).

## Scope

- All 133 tools get proper working UI
- Every tool has: tool-specific name, descriptive message, proper input area, labeled action buttons, proper output area
- The current case-converter custom layout is absorbed into the template system (it becomes TemplateD with case-mode button grid)
- All existing features preserved: batch mode, presets, history, auto-copy, send-to, clipboard detection

## Verification

1. `npm run build` compiles without errors
2. Each template category has at least one tool manually tested end-to-end
3. All 133 tools appear in the sidebar and produce correct output when given sample input
4. Case converter continues to work as before (regression test)
5. Batch mode works with applicable tools
6. File drop works for image tools and file-accepting converters
