# Installation and native workflow checks — October 3, 2026

Scope: one macOS arm64 host, the installed public v0.1.2 app, a local source
candidate, downloaded release assets, and packaging metadata. No clean Windows,
Linux desktop, Intel Mac, store, signing, or update test is claimed.

## Released macOS build

The prior [reinstall record](launch-preparation.md#follow-up-home-first-media-and-local-reinstall)
identifies the checksum-verified DMG and `/Applications/Binturong.app`. This session
used that app's native controls through macOS accessibility, with synthetic input:

```json
{"service":"orders","environment":"local","retries":3}
```

The command palette opened Pipeline Builder; JSON Format/Validate followed by
JSON to YAML Converter produced:

```yaml
environment: local
retries: 3
service: orders
```

**Release blocker:** clicking **Save as new chain** opened no name prompt and
created no SQLite chain. The implementation uses `window.prompt`; the browser
media bridge supplied those dialogs, while this native webview did not. Running
a pipeline passed; saving it in the released native Mac build did not. Rename,
duplicate, delete, and history-clear controls shared browser-dialog dependencies;
do not infer their native reliability from browser tests.

The installed bundled CLI reports `binturong-cli 0.1.2`. The README's two-process
JSON → YAML example was executed with a temporary `response.json` and
`--output config.yaml`; output matched the synthetic example. A manual install
has no `binturong-cli` on this host's PATH. Its absolute bundle path works; the
README documents it. Homebrew CLI linking remains separate from manual installs.

A valid PNG was passed to CLI OCR with `BINTURONG_TESSERACT_PATH` pointing to a
nonexistent absolute executable and downloads disabled. It exited 1 with a
structured `missingDependency` error, dependency ID `tesseract`, and a suggestion
to configure/install it. No package installation or OCR model download was made.
This covers the missing-executable error; it does not cover clean-machine OCR
installation or GUI dependency recovery on every platform.

`HOMEBREW_NO_AUTO_UPDATE=1 brew fetch --cask alsatianco/tap/binturong` succeeded
for v0.1.2, checking the cask download/hash without replacing the installed app.
Fresh Homebrew installation, upgrade, uninstall, and PATH linking remain untested.

## Local dialog fix — unreleased

Browser prompts/chain confirmations and history-clear confirmation were replaced
with in-app dialogs in [App](../src/App.tsx) and [useAppDialog](../src/hooks/useAppDialog.tsx).
The dialogs support text entry, explicit confirmation/cancellation, Escape, focus
restoration, and a keyboard focus loop. Cancelling either save prompt writes nothing.

`npm run build` passed. `npm run test:ui` passed **74 tests in 17 files**, including
App-to-backend chain submission/history confirmation and dialog keyboard checks.
`npm run tauri build -- --no-bundle` passed. Rust implementation was unchanged;
this did not repeat the entire Rust/oracle/installer QA matrix.

A copy of the installed app was made at `/tmp/Binturong-native-candidate.app`, with
the freshly built arm64 GUI/CLI substituted and the temporary bundle ad-hoc signed.
It was launched using the real native backend and existing local SQLite database.
The public `/Applications/Binturong.app` bundle was not replaced.

Native candidate results:

- JSON → YAML ran and matched the output above.
- In-app name and description dialogs saved `Launch validation JSON to YAML`.
- A read-only SQLite query confirmed its input and `json-format`/`json-to-yaml` steps.
- After quitting/reopening the candidate, its card restored input and both steps;
  rerunning produced the same YAML.
- Rename and Duplicate persisted two synthetic chains; Delete cancellation kept
  both, confirmation removed the selected chain. Both test chains were then removed
  through the UI, leaving no synthetic saved-chain records.
- History-clear cancellation retained the newly generated synthetic JSON run;
  confirmation cleared that tool’s history, verified by a read-only SQLite query.

The installed v0.1.2 app was reopened afterward. This validates a local native
candidate, not a corrected released installer or universal Intel execution. The
existing 103-second media was preserved; its capture remains historical evidence
from the pre-fix frontend. Release the fix and recheck the downloaded artifact
before treating the saved-chain launch workflow as complete.

## Package metadata and integrity

Downloaded public v0.1.2 assets matched both `SHA256SUMS` and manifest hashes:

| Asset | SHA-256 |
| --- | --- |
| Windows x64 EXE | `b5e09160fb59e73a75a2ee057f5ea0d7b9f3b166dc7947742f964d5ae22b00b6` |
| Windows x64 MSI | `5ec1d47c86234f680ab9a5b39dd123782045ec48b126eaa2c54189dad93f7b23` |
| Linux amd64 DEB | `5bc1eb0c96e7e06af8a28e50f5aaa1dcba2b19bb606240084f02ad5181c1c07a` |

Archive inspection found GUI and CLI executables in EXE/MSI and `/usr/bin/` in
DEB. The DEB declares `libayatana-appindicator3-1`, `libwebkit2gtk-4.1-0`, and
`libgtk-3-0`; its desktop entry/icons match the Flatpak extraction commands.
The MSI Property table declares version 0.1.2, `ALLUSERS=1`, and ProductCode
`{AFD9AE6C-D572-4A4B-805A-5953137C151D}`. This corrects the old manifest's MSI
user-scope assumption. NSIS user scope follows the Tauri config default and still
needs Windows installation verification.

The winget v0.1.2 version/defaultLocale/installer YAML files passed Microsoft's
published 1.12.0 JSON schemas using PyYAML and jsonschema in an isolated temporary
venv. This is not `winget validate` or a Windows install test.
The Flatpak repack candidate's YAML/XML, pinned dependency-module paths, desktop
ID, x86_64 restriction, and DEB hash were checked; its metainfo screenshot returned
HTTP 200. Full AppStream lint, offline source packaging, builder execution,
sandbox dependencies, OCR behavior, install/update/uninstall, and Flathub review
remain open. See [packaging instructions](../packaging/README.md).

An attempted disposable Ubuntu Docker smoke environment could not obtain the
Ubuntu image and was stopped. No Linux install/launch pass is inferred from it.

## Remaining platform matrix

| Environment | Still needed |
| --- | --- |
| Clean macOS arm64 and Intel | Downloaded corrected installer, first use/save/reopen, quarantine, Homebrew CLI link, manual upgrade, uninstall |
| Clean Windows x64 | EXE/user and MSI/machine, missing WebView2, warnings, GUI/CLI first use, upgrade, uninstall, WinGet validation |
| Linux x86_64 desktop | DEB/RPM/AppImage install/dependencies, GUI/CLI first use, update, uninstall, X11/Wayland |
| Flatpak x86_64 | Source-build readiness, metainfo lint, runtime/libs, portals/permissions, OCR, CLI, sandbox lifecycle |

For each test, record date, tester/environment, artifact URL/hash, commands, result,
and any reproducible failure. Use [feedback log](adoption/feedback.csv) for problems;
never turn an untested row into a pass because CI produced an artifact.
