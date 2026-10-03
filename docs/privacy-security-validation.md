# Phase 3 Privacy & Security Validation (P3-015)

Date: 2026-03-28

> Historical record: results, counts, and UI descriptions below describe the dated run. They have not been revalidated by this documentation cleanup. See the [documentation index](README.md) and [current testing instructions](../README.md#testing) for maintained guidance.

Current differences: [the CSP](../src-tauri/tauri.conf.json) permits `frame-src
'self'` for previews, and [the policy script](../scripts/privacy_security_check.sh)
no longer checks for clipboard-persistence tests. The current settings UI provides
manual release downloads rather than automatic update preferences. Dependency
installation and OCR language downloads are documented [network exceptions](tool-dependencies.md).

## Enforcements Implemented
- Added strict desktop CSP in `src-tauri/tauri.conf.json` to block external script execution and reduce injection surface:
  - `script-src 'self'`
  - `connect-src 'self'`
  - `object-src 'none'`, `frame-src 'none'`
- Added repository policy check script: `scripts/privacy_security_check.sh`.
  - Fails on disallowed runtime patterns (`eval`, `new Function`, `dangerouslySetInnerHTML`).
  - Fails on frontend network API usage (`fetch`, `XMLHttpRequest`, `WebSocket`).
  - Fails on telemetry SDK signatures.
  - Verifies `reqwest` usage is scoped.
  - Verifies clipboard persistence tests exist (default disabled + encrypted-at-rest).

## Commands Run
- `./scripts/privacy_security_check.sh`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`

## Result
- No telemetry signatures detected.
- No eval/external script patterns detected.
- Frontend network APIs not used.
- Clipboard persistence protections remain validated in tests.

## Notes
- OCR language download remains explicit user-driven behavior and is scoped to tool flow.
- Update checks are user-configurable through update settings and can be disabled.
