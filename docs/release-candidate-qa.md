# Phase 3 Final Release Candidate QA (P3-018)

Date: 2026-03-28

## Objective
Run final release-candidate QA across macOS, Windows, and Linux for all 133 tools and core workflows.

## Implemented QA Runner
- Script: `scripts/release_candidate_qa.sh`
- Cross-platform CI workflow: `.github/workflows/release-candidate-qa.yml`
  - OS matrix: `ubuntu-22.04`, `macos-latest`, `windows-latest`
  - Runs build/tests/security/license checks/tool-count verification on every OS.
  - Runs perf benchmark on Linux (`BINTURONG_SKIP_PERF_BENCH=1` on macOS/Windows in CI).

## Tool and Workflow Coverage Signals
- Tool inventory count check:
  - `binturong-cli list` must return `133` entries.
- Rust test suite (`cargo test`) includes:
  - Tool-registry assertions (`133` tools, alias/keyword coverage, ranking/compatibility behavior).
  - Formatter/converter wave tests spanning all canonical tools.
  - Core data/workflow tests (settings, favorites, recents, presets/history/chains, clipboard persistence).
  - CLI equivalence tests between CLI and shared desktop processing.
- UI test suite (`vitest`) covers key app-shell keyboard and command-palette flows.
- Policy/performance/compliance checks:
  - `scripts/privacy_security_check.sh`
  - `scripts/dependency_license_audit.sh`
  - `perf-bench` release targets

## Local Validation Executed (Current Environment)
- `./scripts/release_candidate_qa.sh`
- Additional explicit run:
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin binturong-cli -- list | wc -l` -> `133`

## Result
- Release-candidate QA gate passes locally.
- Cross-platform RC QA is codified in a dedicated macOS/Windows/Linux matrix workflow for repeatable launch-gate execution.
