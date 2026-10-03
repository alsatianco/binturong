# Phase 3 Update UX Validation (P3-014)

Date: 2026-03-28

> Historical record: results, counts, and UI descriptions below describe the dated run. They have not been revalidated by this documentation cleanup. See the [documentation index](README.md) and [current testing instructions](../README.md#testing) for maintained guidance.

The automatic-check/channel/interval UI described here has been superseded.
Current [Settings](../src/components/SettingsModal.tsx) offers **View releases and
downloads**; [the app](../src/App.tsx) opens GitHub Releases for manual downloads.
Backend mock-update commands remain for development, but they do not install an
update. See [the release guide](releasing.md#later-improvements) for updater status.

## Implemented UX Scope
- Update preferences in Settings (`Updates` category):
  - Auto-update check toggle
  - Channel selector (`stable` / `beta`)
  - Check interval (`onLaunch` / `daily` / `weekly`)
- Manual update check action:
  - Settings button: **Check for updates now**
  - Command palette action: **Check for Updates**
- In-app "What's New" panel:
  - Command palette action: **Open What's New**
  - Automatically shown on detected version change
- Restart prompt flow after update availability when auto-update is enabled.

## Backend Commands
Implemented in `src-tauri/src/lib.rs`:
- `get_app_version`
- `check_for_updates`
- `request_app_restart`

## Mock Update Source (for local QA)
Update checks use environment-variable channels so the UX can be exercised without a hosted update feed:
- Stable channel version: `BINTURONG_UPDATE_MOCK_VERSION`
- Stable channel notes: `BINTURONG_UPDATE_MOCK_NOTES`
- Beta channel version: `BINTURONG_UPDATE_MOCK_BETA_VERSION`
- Beta channel notes: `BINTURONG_UPDATE_MOCK_BETA_NOTES`

If the selected channel mock version differs from the current app version, the app treats it as an available update and opens release-note/restart flows.

## Validation Checklist
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`
- Manual UX verification:
  - Settings > Updates preferences persist immediately.
  - Manual check surfaces up-to-date or update-available feedback.
  - "What's New" modal opens from settings and command palette.
  - Restart prompt displays after update availability when auto-update is enabled.
