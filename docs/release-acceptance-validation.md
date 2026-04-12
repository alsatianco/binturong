# Release Acceptance Validation (R-001 to R-017)

Date: 2026-03-28

This checklist maps each final release criterion in `task.md` to concrete automated and documented evidence in this repository.

## Criteria Mapping

1. `R-001` Search discoverability (exact/alias/partial/fuzzy/typo)
   - `src-tauri/src/tool_registry.rs`:
     - `search_supports_exact_alias_partial_fuzzy_and_typo_queries`
     - `ranked_search_exact_match_tier_beats_partial_match`
   - Verified by `cargo test --manifest-path src-tauri/Cargo.toml`.

2. `R-002` Left panel canonical adjacency, no category group headers
   - `src/App.ui.test.tsx`:
     - `renders all-tools sidebar in canonical order without category headers`
   - Registry order source: `list_tools` -> `setSidebarCatalog` in `src/App.tsx`.
   - Verified by `npm run test:ui`.

3. `R-003` Clipboard detection modes and suggest/auto-open behavior
   - `src/App.ui.test.tsx`:
     - `shows clipboard suggestions in suggest mode`
     - `auto-opens top tool in autoOpen mode when confidence is high`
     - `opens chooser dialog in alwaysAsk mode`
   - Detection engine tests: `src-tauri/src/clipboard_detection.rs`.

4. `R-004` All 133 tools complete/polished/consistent
   - Tool count gate: `tool_registry::tests::builtin_registry_contains_tools` (`133`).
   - Functional wave tests in `src-tauri/src/formatter_tools.rs` cover all tool waves.
   - Phase-2 completion artifact: `docs/phase2-validation.md`.
   - RC gate: `scripts/release_candidate_qa.sh`.

5. `R-005` Favorites/recents/presets/history correctness
   - DB tests in `src-tauri/src/db.rs`:
     - favorites/recents caps
     - tool preset/history CRUD and limits
     - export/import roundtrip.
   - RC gate includes full Rust test suite.

6. `R-006` Pipeline chaining quick + builder modes
   - Implemented in Phase 3 tasks (`P3-001`..`P3-004`).
   - Covered in release QA doc: `docs/release-candidate-qa.md`.

7. `R-007` Batch mode for applicable tools
   - Tool metadata + batch flow implemented and validated in Phase 2:
     - `P2-031`, `docs/phase2-validation.md`.

8. `R-008` Drag-and-drop for applicable tools
   - File-type matrix and validation in `src/App.tsx` (`FILE_DROP_EXTENSIONS_BY_TOOL`).
   - Phase-2 validation artifact: `docs/phase2-validation.md` (`P2-030`).

9. `R-009` All 10 themes with compliant contrast
   - Theme system and variants: `P1-017`.
   - Accessibility validation artifact: `docs/accessibility-audit.md`.

10. `R-010` Settings complete and immediate-apply
   - Settings parsing/persistence in `src/App.tsx`.
   - Validated in Phase-1 and update/privacy docs:
     - `docs/phase1-validation.md`
     - `docs/update-channel-validation.md`
     - `docs/privacy-security-validation.md`.

11. `R-011` Quick launcher works on macOS/Windows/Linux
   - Platform integration implementation: `P3-010`.
   - RC matrix workflow: `.github/workflows/release-candidate-qa.yml`.

12. `R-012` CLI output parity with desktop logic
   - `src-tauri/tests/cli_equivalence.rs` (CLI vs shared core parity tests).
   - Verified in `cargo test`.

13. `R-013` Cross-platform parity for core features
   - CI matrix: `.github/workflows/ci-test-matrix.yml` (Ubuntu/macOS/Windows).
   - RC matrix: `.github/workflows/release-candidate-qa.yml`.

14. `R-014` Performance targets met
   - Benchmark binary: `src-tauri/src/bin/perf-bench.rs`.
   - Validation artifacts:
     - `docs/performance-validation.md`
     - `docs/performance-bench.csv`.

15. `R-015` Accessibility requirements met
   - Accessibility audit artifact: `docs/accessibility-audit.md`.
   - WCAG AA + keyboard/screen-reader improvements implemented in `P3-013`.

16. `R-016` Feature audit complete
   - Artifacts:
     - `docs/feature-audit.csv`
     - `docs/feature-audit.md`.

17. `R-017` MIT compatibility for project/dependencies/assets
   - Audit script: `scripts/dependency_license_audit.sh`.
   - Artifacts:
     - `docs/dependency-license-audit.md`
     - `docs/bundled-assets.tsv`
     - `LICENSE`.

## Validation Commands

- `./scripts/release_candidate_qa.sh`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run test:ui`
- `./scripts/dependency_license_audit.sh`
