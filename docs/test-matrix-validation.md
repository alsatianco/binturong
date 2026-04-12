# Phase 3 Automated Test Matrix (P3-016)

Date: 2026-03-28

## Implemented Coverage
- **Unit + integration (Rust):** `cargo test --manifest-path src-tauri/Cargo.toml`
- **UI automation (frontend):** `npm run test:ui` (Vitest + Testing Library)
- **Cross-platform CI matrix:** macOS / Windows / Linux via `.github/workflows/ci-test-matrix.yml`
- **Performance regression gate:** release benchmark (`perf-bench`) in dedicated CI job

## Added Artifacts
- Workflow: `.github/workflows/ci-test-matrix.yml`
- UI test config: `vitest.config.ts`
- UI test setup: `src/test/setup.ts`
- UI test suite: `src/App.ui.test.tsx`

## CI Jobs
1. `test-matrix`
   - Runs on Ubuntu, macOS, Windows.
   - Executes frontend build, UI tests, privacy/security checks, and Rust tests.
2. `perf-regression`
   - Runs on Ubuntu.
   - Installs Tesseract + desktop build deps.
   - Runs `cargo run --release --bin perf-bench` and uploads benchmark artifact.

## Local Validation Commands
- `npm run test:ui`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`
- `./scripts/privacy_security_check.sh`
- `cargo run --manifest-path src-tauri/Cargo.toml --release --bin perf-bench`
