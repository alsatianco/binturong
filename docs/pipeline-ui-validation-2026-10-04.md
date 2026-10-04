# Pipeline UI fixes — October 4, 2026

## Theme-aware tool selector ([issue #1](https://github.com/alsatianco/binturong/issues/1))

`PipelineToolSelector` now uses the existing theme variables for its trigger,
search field, dropdown, labels, borders, shadow, hover and selected/highlighted
rows. Keyboard focus uses the theme accent. Selection and dismissal handlers
are unchanged.

Validation against the production frontend in Chromium:

- `npm run build` passed.
- `npm run test:ui` passed all 74 tests in 17 files.
- Paper (light) and Midnight (dark) followed their theme colors in the closed and
  open states. Focus rings, hover, selected rows, highlighted rows, search-match
  marks and no-results text were checked using rendered styles and screenshots.
- ArrowDown/ArrowUp and Enter selected the expected filtered tools; mouse
  selection, automatic search focus, no-result Enter, clearing the query on
  reopening and outside-click dismissal worked. Escape retained the existing
  app behavior: it dismisses the selector and Pipeline Builder together.
- No uncaught browser errors occurred.

Screenshots: [light closed](assets/pipeline-fixes-2026-10-04/selector-paper-closed.png),
[light open](assets/pipeline-fixes-2026-10-04/selector-paper-open.png),
[dark closed](assets/pipeline-fixes-2026-10-04/selector-midnight-closed.png),
[dark open](assets/pipeline-fixes-2026-10-04/selector-midnight-open.png).

The screenshots capture the current source with Playwright, a 1360 × 1120
Chromium viewport and `npm run preview -- --host 127.0.0.1 --port 1421` after the
frontend build. The temporary Tauri bridge follows the
[launch capture approach](assets/README.md): tool names come from the installed
v0.1.2 CLI, and settings/chains use session memory. The fixtures are synthetic.
These checks verify frontend presentation and interactions, not native webview
behavior or SQLite persistence. Historical launch screenshots remain unchanged.
