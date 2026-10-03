# Contributing to Binturong

Start with a reproducible bug or a concrete workflow improvement. For a new tool,
describe the input, expected result, and why existing tools do not cover it.
Use synthetic data in issues, screenshots, tests, and pull requests.

## Setup and validation

The [README](README.md#prerequisites) owns prerequisites and the
[development](README.md#development), [testing](README.md#testing), and
[build commands](README.md#building). The frontend-only mode is useful for layout;
native file access, persistence, shortcuts, and integration need the desktop app.

Run the checks relevant to your change. For a React behavior change, run the
affected existing Vitest tests and the frontend build. For backend behavior,
run the applicable Rust tests using the README's sidecar override. If both
interfaces expose the operation, verify the desktop controls and a CLI invocation.
Installer changes also need the relevant platform and downloaded-artifact checks
in the [release runbook](docs/releasing.md).

## How a small text tool is wired

Use the existing `slugify-url` tool as a small, complete example:

1. [tool_registry.rs](src-tauri/src/tool_registry.rs) defines the ID, name,
   searchable aliases/keywords, accepted/produced pipeline data types, and
   supported batch, file, preset, and history capabilities. The `builtin_tools` list
   controls registration order; the execution catalog also needs consistent routing.
   Follow nearby entries.
2. [tools/mod.rs](src-tauri/src/tools/mod.rs) routes `slugify-url` through
   `run_converter_tool` to its implementation. Registering a tool alone does not
   make it executable. Add meaningful tests for real inputs, Unicode, invalid
   inputs, and any format-specific edge cases.
3. [toolConfigs.ts](src/components/tool-workspace/toolConfigs.ts) defines its
   Template D workspace, action label, placeholder, and sample input.
   [toolGroups.ts](src/components/tool-workspace/toolGroups.ts) puts it in the
   relevant category. Check the fallback catalog and file support in
   [App.tsx](src/App.tsx) when adding an ID.
4. The [CLI dispatcher](src-tauri/src/bin/binturong-cli.rs) calls shared formatter
   and converter functions. Verify both listing and execution, for example:

   ```bash
   binturong-cli run --tool slugify-url --input 'Hello, Binturong!'
   ```

   Expected output: `hello-binturong`. Check
   [CLI equivalence tests](src-tauri/tests/cli_equivalence.rs) when changing shared behavior.
5. Add a checked example to the [user guide](how_to_use.md), and test the actual
   desktop button and any advertised batch/pipeline behavior. A capability flag
   is a promise users should be able to exercise.

## Pull requests

Explain the problem, resulting behavior, and checks you ran. Keep changes focused;
update the owning documentation in the same commit. Distinguish runtime tests
from static inspection and list unavailable platform checks honestly. AI-assisted
changes need the same review and validation as other changes; contributors should
describe assistance accurately when relevant.

Follow [AGENTS.md](AGENTS.md): commit each meaningful change with a concise
one-line message. Preserve dated validation and design records; link maintained
guides from the [documentation index](docs/README.md).
