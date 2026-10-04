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

## Saved-chain action wrapping ([issue #2](https://github.com/alsatianco/binturong/issues/2))

The selected card's action row now wraps within the existing 120–180px card
limits. Card selection, truncation and action handlers are unchanged.

Before the fix, Chromium reproduced a 180px selected card with Delete extending
beyond its right edge in both themes. After the fix:

- `npm run build` passed; the 21 existing App UI tests passed again.
- Short, long spaced and long unbroken names worked with three saved cards.
  Every action button's bounding rectangle stayed inside the selected card;
  the card had no internal horizontal overflow.
- At viewport widths of 1360, 800 and 480px, all four buttons remained inside
  their card and individually reachable by mouse and keyboard focus.
- Save submitted the edited pipeline input under the same chain ID without
  reloading the old input. Rename updated that card; Duplicate copied its
  payload under a new ID and selected the new card. Delete cancellation kept
  the copy; confirmation removed it. Selecting the original again loaded the
  saved edits.
- Both Paper and Midnight passed, with no uncaught browser errors.

Selected-card screenshots: [light](assets/pipeline-fixes-2026-10-04/saved-chains-paper.png),
[dark](assets/pipeline-fixes-2026-10-04/saved-chains-midnight.png).

## Capture scope

The screenshots capture the current source with Playwright, a 1360 × 1120
Chromium viewport and `npm run preview -- --host 127.0.0.1 --port 1421` after the
frontend build. The temporary Tauri bridge follows the
[launch capture approach](assets/README.md): tool names come from the installed
v0.1.2 CLI, and settings/chains use session memory. Tool compatibility metadata
is supplied by the bridge; these captures do not validate the full catalog.
The fixtures are synthetic.
These checks verify frontend presentation and interactions, not native webview
behavior or SQLite persistence. Historical launch screenshots remain unchanged.
