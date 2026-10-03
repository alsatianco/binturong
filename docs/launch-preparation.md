# Launch preparation — October 3, 2026

Scope: positioning, one working demo, README, targeted contributor/privacy docs,
and the product website. This record describes preparation, not installer QA or
an independent security audit.

## Verified claims

- Latest public release checked: v0.1.2, published September 30, 2026. It includes
  universal macOS DMG/ZIP, Windows x64 EXE/MSI, Linux x86_64 AppImage/DEB/RPM,
  the Mac quarantine helper, and SHA256SUMS.
- The app source under `src/` and `src-tauri/src/` matches tag `v0.1.2`. The local
  CLI reports v0.1.2; `list` and the current registry contain 134 tools. Earlier
  133-tool audit counts remain dated historical evidence.
- The public Homebrew cask points to the v0.1.2 universal DMG and links the
  bundled CLI. Its command is `brew install --cask alsatianco/tap/binturong`.
  A fresh Homebrew install was not performed in this preparation.
- JSON Format/Validate → JSON to YAML Converter works through the shared CLI
  dispatchers. The unchanged frontend can build, run, and save this chain.
- Pipeline formatters always use Format and indent 2. Per-step decoding modes
  and arbitrary tool configuration are not exposed. Do not advertise a nested
  decoding pipeline based solely on individual Decode buttons.
- Detection uses entered text; there is no continuous clipboard monitoring.
  Tool history retains 20 entries per tool, separately from Remember last input.
- Automatic updating is unavailable. OCR dependency/language setup uses the
  network. Current Mac releases are ad-hoc signed/unnotarized and Windows
  installers have no publisher signature.

## Positioning

Everyday developer tools, together on your desktop.

The first workflow is a synthetic order-service JSON object converted to reusable
YAML through a saved chain. Breadth supports that workflow; it is not the main
promise. No size, speed, absolute privacy, or unique-pipeline claim is made.

The README's small comparison was checked against the official DevToys and
DevUtils sites and the IT-Tools and CyberChef projects on October 3, 2026.
It describes workflow fit, not measured performance or exclusive features.
The maintainer's origin story and personal AI-assistance account need firsthand
input; this preparation does not invent them.

## Evidence and limitations

`npm run build` passed; `npm run test:ui` passed all 69 tests across 16 files.
`python3 scripts/check_release_version.py` reports 0.1.2. The CLI executed the
documented formatting and JSON-to-YAML example successfully.
All four existing CLI equivalence tests passed. The generated product page was
checked at desktop and mobile widths, including image loading, download access,
canonical metadata, and playback of its roughly 15-second MP4.

[Capture provenance and reproduction](assets/README.md) describes the browser
bridge used for screenshots and the demo. Native install/update/uninstall,
Windows/Linux smoke tests, native chain persistence, publisher signing, and
store acceptance remain outside this verification.

The product website is generated from `../gen-web/content/software/binturong.md`.
The requested canonical URL is `https://play.alsatian.co/software/binturong.htm`;
the `.html` path is retained for existing app and Homebrew links.

## GitHub presentation copy

Description: `Everyday developer tools for macOS, Windows, and Linux. Local processing, saved pipelines, and a CLI.`

Website: `https://play.alsatian.co/software/binturong.htm`

Topics: `developer-tools`, `devtools`, `tauri`, `rust`, `productivity`,
`cross-platform`, `offline`.

Social preview: [social-preview.png](assets/social-preview.png).
GitHub's social-preview upload needs the repository settings UI.

## Website deployment

Website commit `1f55eb1` was pushed to `alsatianco/alsatianco.github.io` on
October 3, 2026. [GitHub Pages deployment](https://github.com/alsatianco/alsatianco.github.io/actions/runs/37129284369)
completed successfully. Both [the canonical .htm page](https://play.alsatian.co/software/binturong.htm)
and [the compatible .html page](https://play.alsatian.co/software/binturong.html)
returned HTTP 200. Published screenshots, social preview, MP4, favicon,
sitemap, and robots.txt matched the generated files. Regeneration produced no
additional deployment diff.

The source article and metadata extension are committed in `gen-web`; pre-existing
changes there were preserved. The extension was also validated with the committed
generator in isolation, without relying on those earlier uncommitted edits.
Binturong's README/assets/docs are committed locally and were not pushed by this
website-only publication request. Website links therefore use existing public
repository documents, while the page itself includes the new workflow and privacy
explanations. GitHub About settings, release edits, issue creation, and social
preview upload remain unapplied; drafts are in [GitHub presentation](github-presentation.md).
