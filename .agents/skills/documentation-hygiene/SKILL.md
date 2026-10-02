---
name: documentation-hygiene
description: Audit, consolidate, and prune Binturong documentation against its React/Tauri/Rust implementation. Use for documentation audits, stale README or usage guides, duplicate docs, and documentation reorganization. Support report-only audits and requested cleanup without expanding ordinary code changes into a repository-wide audit.
---

# Binturong Documentation Hygiene

Keep documentation accurate, give each maintained fact a canonical home, and make guides reachable from a hub. Verify claims against current code; distinguish current behavior from historical evidence and design rationale.

## Scope and working agreements

- Follow the user's requested scope. For an audit-only request, report findings without editing files, creating branches, or committing. Installing or editing this skill does not itself authorize a documentation cleanup.
- For cleanup, inspect `git status --short` first. Preserve unrelated changes; do not automatically commit, stash, or discard them. Prune only tracked project files whose unique information has a retained home. Use a separate branch if requested or useful for the work.
- After each meaningful change, make a commit with a concise, one-line message. Keep moves, content corrections, and deletions in separate reviewable commits when practical. Never run `git push` unless the user explicitly asks.
- Exclude `.agents/skills/`, any other agent skill directories, third-party docs, standard legal/contribution/security files, and issue/PR templates from cleanup. Use tracked files for the inventory; do not prune local `_tmp/`, caches, `node_modules/`, `dist/`, or Rust `target/` directories.

## Documentation homes

Adapt the existing layout rather than forcing every Markdown file into `docs/`:

| Home | Ownership and treatment |
| --- | --- |
| `README.md` | User entry point: installation, quick start, and links to deeper guides. Its current development/testing/build sections can remain canonical; link to them rather than duplicating commands. |
| `AGENTS.md` | Codex contributor conventions and a terse documentation index. Read it if present; during a full cleanup, create it if contributor guidance needs a home. Do not introduce `CLAUDE.md` unless requested or already required by the repo. |
| `how_to_use.md` | Existing detailed user guide. Verify its tool examples and UI instructions. Keep it unless reorganization is in scope; if moved to `docs/`, repair all inbound references and link it from the user hub. |
| `docs/` | Maintained guides, release instructions, audits, and validation evidence. Add `docs/README.md` when it improves navigation; keep every retained guide or evidence file reachable from an appropriate hub. |
| `packaging/README.md`, `packaging/macos/README.txt` | Distribution instructions beside packaging assets. Preserve this location: the Mac text file is shipped with installers. Read release scripts/workflows before changing paths or installation claims. |
| `docs/superpowers/specs/` | Design records. Preserve useful rationale and mark superseded behavior clearly; a shipped feature alone is not a reason to delete its design record. |

Treat this map as starting context, not a frozen inventory. Recheck paths and ownership at each run. Keep `AGENTS.md` concise; narrative belongs in the appropriate guide.

## Where to verify claims

Binturong has a React/TypeScript frontend and a Tauri/Rust backend. Start with the files that own the claim:

| Claim | Backing source |
| --- | --- |
| Tool IDs, names, metadata, batch/file/preset/history support | `src-tauri/src/tool_registry.rs`; compare UI configuration in `src/components/tool-workspace/toolConfigs.ts` and `toolGroups.ts`. Registry membership alone does not prove a tool works in every interface. |
| Tool behavior, formats, defaults, errors | `src-tauri/src/tools/`, `src-tauri/src/operation_runtime.rs`, and relevant Rust tests; UI templates under `src/components/tool-workspace/templates/` and `src/hooks/useToolExecution.ts`. |
| CLI options and supported operations | `src-tauri/src/bin/binturong-cli.rs`, `src-tauri/tests/cli_equivalence.rs`, and `tests/oracle/`. Check the CLI dispatcher separately from the desktop registry: listing a tool does not prove the CLI can execute it. |
| Navigation, shortcuts, settings, clipboard, persistence | `src/App.tsx`, `src/components/SettingsModal.tsx`, `src/hooks/`, `src/components/home/`, and the relevant Rust modules under `src-tauri/src/` (`lib.rs`, `clipboard_detection.rs`, `db.rs`, `home_files.rs`). |
| OCR dependencies, downloads, offline/privacy claims | `src-tauri/src/dependencies.rs`, `src-tauri/src/tools/image_tools.rs`, `src/lib/dependencies/dependencies.ts`, `src/components/ToolDependencies.tsx`, and `scripts/privacy_security_check.sh`. Verify network exceptions instead of repeating blanket offline claims. |
| Commands, dependency versions, release version consistency | `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, and `scripts/check_release_version.py`. |
| Sidecar staging, installers, signing, CI and release triggers | `scripts/stage_cli.mjs`, `scripts/prepare_macos_universal.mjs`, `scripts/collect_release_assets.py`, `.github/workflows/`, `packaging/`, and `docs/releasing.md`. Homebrew is maintained in a separate repository; do not claim its current state from this checkout alone. |
| Performance and license evidence | `src-tauri/src/bin/perf-bench.rs`, `scripts/dependency_license_audit.sh`, and the corresponding CI jobs. Verify how outputs are produced before calling a file generated. |

Link to sources for changing inventories, versions, and exhaustive option lists. Keep necessary user explanations and runnable examples, verifying their details instead of replacing useful prose with source links alone. Never invent tool counts, platform support, timing guarantees, or current release status from old reports.

## Audit and cleanup workflow

1. Inventory tracked documentation with `git ls-files '*.md'`, plus relevant non-Markdown distribution instructions and linked CSV/TSV evidence. Classify each file as a maintained guide, historical evidence, design record, duplicate, generated output, or scratch. Read before classifying.
2. Verify non-trivial claims against the sources above. Prioritize tool counts, UI labels and shortcuts, CLI examples, offline exceptions, installation assets, signing, versions, broken paths, and references to removed requirements files. Record the claim, backing source, and required correction.
3. For a report-only request, return findings here. For cleanup, reconcile stale claims, consolidate duplicates into their owning guide, and update hub links. Before any move or deletion, use `git grep -n -F -- 'old/path'` and search the basename too; inspect scripts, CI, code, and packaging references as well as docs.
4. Prune only confirmed scratch, redundant content, or superseded instructions. Preserve unique rationale and dated validation evidence when useful. If a file's purpose remains unclear after inspecting consumers, retain it and report the uncertainty.
5. Check all changed Markdown links, including images, reference-style links, and heading anchors. Resolve relative paths from the containing document, checking filename case for Linux. Verify generated/distributed references against their producer rather than assuming every target must exist in the source tree.
6. Validate affected commands as described below, review the diff, and commit each meaningful change. For a full cleanup, add the documentation ownership map and anti-drift rule to `AGENTS.md`; do not add CI jobs or new tooling unless requested or needed for the agreed scope.

## Evidence and generated artifacts

- `docs/*-validation.md`, audit documents, and `docs/feature-audit.csv` may capture a past run or migration, rather than current product status. Verify provenance, dates, and remaining value; do not relabel an old pass as a fresh pass or delete it solely because it is old.
- `docs/bundled-assets.tsv` is an input consumed by `scripts/dependency_license_audit.sh`. Preserve its path, schema, and coverage unless updating the consumer in the same change.
- `perf-bench` prints CSV to stdout. `docs/performance-bench.csv` is a captured result, not automatically rewritten by the binary. A new capture needs explicit redirection and run context; inspect CI for how its artifact is captured.
- The privacy and dependency audit scripts run checks; they do not regenerate the similarly named Markdown reports. Do not promise regenerate-and-diff verification unless an actual deterministic generator exists.
- Never hand-edit generated output. Preserve its producer and document reproduction; only remove committed output when its consumers and unique information remain covered. Benchmarks and dated audit results may vary across machines and should not be forced into deterministic diffs.

## Command validation

Read current scripts and CI before choosing checks. Run only checks relevant to the changed claims; a documentation move does not require the whole application test suite.

- Frontend build/examples: `npm run build`; UI behavior: `npm run test:ui` (or the relevant existing test). Browser/frontend-only runs do not establish native Tauri behavior.
- Rust tests and CLI checks: use the CI override below to disable the bundled sidecar requirement for tests. Preserve and restore an existing `TAURI_CONFIG`; this override is for direct Cargo checks, not installer builds.

  ```bash
  TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test --manifest-path src-tauri/Cargo.toml
  TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo run --manifest-path src-tauri/Cargo.toml --bin binturong-cli -- --help
  TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo run --manifest-path src-tauri/Cargo.toml --bin binturong-cli -- list
  ```

- Python oracle examples require a built CLI and dependencies from `tests/oracle/requirements.txt`; inspect `tests/oracle/conftest.py` for binary selection and `BINTURONG_CLI` before running a relevant subset.
- Read `scripts/check_release_version.py` before running it: it checks local versions and honors GitHub tag/output environment variables. Inspect release workflows statically for publishing and signing claims.
- `scripts/release_candidate_qa.sh` runs builds, tests, audits, a tool-count check, and optionally benchmarks. Use it for release validation when warranted, not every documentation edit. The dependency audit requires additional tools and network access; report unmet prerequisites without installing them unnecessarily.
- Verify package installation, quarantine removal, system setup, OCR downloads, signing, publishing, and other stateful examples statically unless their execution is part of the user's authorized task. Do not launch long-lived development servers just to check command spelling.
- Report checks actually run and limitations. Static review or unavailable platform prerequisites are not a successful runtime check.

## Anti-drift rule for a full cleanup

Adapt this into the contributor hub without duplicating existing rules:

```markdown
## Documentation
- README.md is the user entry point; AGENTS.md holds contributor rules and pointers; deeper guides and validation evidence live under docs/. Keep distribution instructions beside packaging assets.
- Changes to behavior, commands, configuration, or builds update the owning documentation in the same commit.
- Link changing inventories and version sources; verify user examples against the implementation.
- Preserve dated evidence and design rationale separately from current instructions, and keep retained documents reachable from a hub.
```

## Completion report

List corrected claims, moved/merged files, deletions with reasons, notable retained evidence, checks run, and unresolved claims. A cleanup is complete when the requested scope matches the code, retained material has clear ownership and navigation, changed links resolve, and moves preserve code/CI/packaging consumers. Do not declare the whole repository clean after a partial audit.
