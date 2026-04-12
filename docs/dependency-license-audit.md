# Phase 3 Dependency/License Audit (P3-017)

Date: 2026-03-28

## Scope
- Rust dependency security audit (`cargo audit`).
- Rust dependency license inventory (`cargo license`).
- npm production dependency license inventory (`license-checker`).
- Bundled asset license/provenance coverage check.

## Implemented Guardrail
- Added `scripts/dependency_license_audit.sh` to enforce:
  - `cargo audit` reports zero vulnerabilities.
  - Rust crates have known, approved license expressions.
  - npm production dependencies have known, approved license expressions.
  - Every bundled asset is explicitly listed in `docs/bundled-assets.tsv` with approved license metadata.
- Added workflow enforcement in `.github/workflows/ci-test-matrix.yml` (`dependency-license-audit` job).

## Commands Run
- `./scripts/dependency_license_audit.sh`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`

## Results
- `cargo audit`: **0 vulnerabilities**
  - Warnings remain:
    - Unmaintained advisories: 17 (`RUSTSEC-2024-0370`, `RUSTSEC-2024-0411`..`0420`, `RUSTSEC-2025-0057`, `0075`, `0080`, `0081`, `0098`, `0100`)
    - Unsound advisories: 2 (`RUSTSEC-2024-0429`, `RUSTSEC-2026-0002`)
  - These warnings are currently transitive via the Tauri Linux stack and `rqrr`; no vulnerability advisories were reported.
- Rust license inventory:
  - Packages scanned: 670
  - Unique approved license expressions: 27
  - Missing/unknown licenses: 0
- npm production license inventory:
  - Packages scanned (excluding root project entry): 5
  - Unique approved license expressions: 3 (`MIT`, `MIT OR Apache-2.0`, `Apache-2.0 OR MIT`)
  - Missing/unknown licenses: 0
- Bundled assets:
  - Assets scanned: 16
  - Manifest coverage: 100% via `docs/bundled-assets.tsv`

## Metadata Updates
- Added repository `LICENSE` file (MIT).
- Added `license = "MIT"` to:
  - `src-tauri/Cargo.toml`
  - `package.json`
