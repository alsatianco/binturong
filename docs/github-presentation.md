# GitHub presentation drafts

Prepared October 3, 2026 for v0.1.2. The initial public API check showed an empty About description, homepage, and
topics. On October 3, the authorized API follow-up applied and re-read the prepared
About settings using a credential file without displaying its contents.

The repository had no open or closed issues in the duplicate check. The scoped
drafts below were created as [issue #1](https://github.com/alsatianco/binturong/issues/1)
and [issue #2](https://github.com/alsatianco/binturong/issues/2). GitHub omitted the
requested labels on creation; explicit label requests returned HTTP 403 with all
three available tokens. Apply `good first issue` when issue-label write access is
available. Their bodies and acceptance criteria were verified through the API.

The release-description update also returned HTTP 403 with all three tokens
(`Resource not accessible by personal access token`). The original changelog
remains unchanged. The text below is still an unpublished draft. Release editing
requires a token with the necessary repository Contents write permission.

Use the description, URL, topics, and social-preview asset in
[launch preparation](launch-preparation.md#github-presentation-copy).
The social preview requires GitHub's repository settings UI.

## Latest release description

Title: `Binturong v0.1.2`

Everyday developer tools, together on your desktop. This release packages the
desktop app and CLI for macOS, Windows, and Linux.

| Platform | Recommended download | Notes |
| --- | --- | --- |
| macOS, Apple Silicon and Intel | `Binturong_0.1.2_macos-universal.zip` | Extract, open the included DMG, drag the app to Applications. Ad-hoc signed and unnotarized. |
| Windows x64 | `Binturong_0.1.2_x64-setup.exe` | MSI also available. No publisher signature; Windows may show a warning. |
| Linux x86_64 | `.deb` for Debian/Ubuntu or `.rpm` for Fedora | AppImage also available; it may require FUSE 2 compatibility support. Built on Ubuntu 22.04. |

Homebrew: `brew install --cask alsatianco/tap/binturong`.

See [installation and current limitations](https://github.com/alsatianco/binturong#install)
and [the product page](https://play.alsatian.co/software/binturong.htm).
The release includes `SHA256SUMS` and a Mac quarantine helper. Automatic updates
are unavailable; use a newer installer or Homebrew. Winget, Snap, and Flatpak
templates are not published packages. OCR requires Tesseract.

Keep the [original full changelog](https://github.com/alsatianco/binturong/compare/v0.1.1...v0.1.2).
Do not invent changes that the release diff does not establish.

## Approachable issue: respect the selected theme in the pipeline tool selector

Suggested label: `good first issue`.

PipelineToolSelector uses fixed slate/cyan classes, while surrounding Pipeline
Builder controls use the application's theme tokens. In the light theme the
selector remains dark and does not follow the selected palette.

Scope: update selector backgrounds, borders, labels, hover states, focus states,
and selected/highlighted rows in `src/components/PipelineToolSelector.tsx` using
existing theme variables. Preserve keyboard navigation and the component's behavior.

Acceptance criteria:

- Closed/open selectors follow both light and dark themes.
- Focus, hover, active selection, and no-results text remain readable.
- Arrow keys, Enter, Escape, search, and outside-click dismissal still work.
- Frontend build and applicable existing tests pass; include light/dark screenshots.

## Approachable issue: keep saved-chain actions inside their card

Suggested label: `good first issue`.

Select a saved chain in Pipeline Builder. The Save/Rename/Duplicate/Delete row
can extend beyond its card; this is visible in the current pipeline screenshot.

Scope: allow the action row to wrap or otherwise fit within the existing card
width in `src/App.tsx`. Preserve the action handlers and card selection.

Acceptance criteria:

- All four controls remain within the card and are individually reachable.
- Long chain names and more than one saved chain do not break the card layout.
- Save, Rename, Duplicate, and Delete still work.
- Frontend build passes; include a screenshot with the selected card.

Check existing issues for duplicates before creating either draft. These small
layout tasks are suitable for newcomers; history controls and signing integration
require broader design work and should not receive beginner labels.
