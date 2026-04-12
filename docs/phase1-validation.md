# Phase 1 Exit Validation (P1-026)

Date: 2026-03-27
Repository: `binturong`

## Validation Summary

Phase-1 core shell workflows are validated in this environment with automated build/test evidence and feature smoke checks.

## Automated Evidence

1. Backend + domain tests
   - Command: `cargo test --manifest-path src-tauri/Cargo.toml`
   - Result: PASS (`27 passed, 0 failed`)
   - Coverage includes: search ranking, favorites/recents constraints, presets CRUD primitives, history retention/clear behavior, clipboard history cap and encryption behavior.

2. Frontend build
   - Command: `npm run build`
   - Result: PASS

3. Desktop app bundle build (installable app artifact)
   - Command: `npm run tauri build -- --bundles app`
   - Result: PASS
   - Artifact: `src-tauri/target/release/bundle/macos/Binturong.app`

4. Full installer bundle attempt (informational)
   - Command: `npm run tauri build`
   - Result: FAIL at DMG bundling script stage (`bundle_dmg.sh`)
   - Notes: Non-blocking for Phase-1 shell validation; installer packaging is tracked in `P3-008`.

## Exit-Criteria Checklist

- Install: PASS (macOS `.app` bundle generated)
- Navigate: PASS (sidebar/tool selection, command palette, quick launcher code paths active)
- Search: PASS (ranked search path active + ranking tests passing)
- Tabs: PASS (create/close/reorder/overflow keyboard flows active)
- Favorites/Recents: PASS (max limits, reorder, ranking inputs, persistence commands)
- Presets/History: PASS (save/load/rename/delete presets; append/restore/clear history)
- Settings: PASS (settings load/persist paths active; privacy/workflow/search/appearance settings wired)
- Themes: PASS (theme token apply + system mapping behavior wired)
- Quick launcher: PASS (global shortcut registration + launcher UI/filter flow wired)

## Notes

- This validation is scoped to Phase-1 shell requirements and local CI-style verification available in this environment.
- Cross-platform installer and package-manager distribution validation is deferred to Phase-3 tasks.
