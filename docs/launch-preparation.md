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

## Follow-up: Home-first media and local reinstall

On October 3, 2026, the old v0.1.0 app bundle was removed from
`src-tauri/target/debug/bundle/macos/Binturong.app`, along with its app support,
cache, and WebKit directories. Removed items were moved together to
`~/.Trash/Binturong-removed-20261003-215125` for recovery. No repository source
or exported user files were removed.

The latest public release, v0.1.2, was downloaded and installed at
`/Applications/Binturong.app` on this macOS arm64 host. Its universal DMG
matched SHA256SUMS (`271ee032171aa53ecee7360a32f504220a8634560d5ae6eccc99e83d9c6811e5`),
and the installed bundle passed `codesign --verify --deep --strict`. Its bundled
CLI reports v0.1.2 and formatted the synthetic order-service JSON successfully.
The native app was launched and its Home dashboard visually confirmed. Its new
runtime state starts with launchCount 1. This is one local reinstall/launch check,
not clean-environment validation across all supported platforms.

The lead screenshot, website hero, and video poster now show Home. The new 103-second walkthrough
starts with Home and holds each action for at least five seconds, with ten seconds
for Home and results. The capture uses the unchanged source frontend and the newly
installed release CLI. Static preview avoids development reloads during recording.

Website media update `d04262f` was pushed and its
[Pages deployment](https://github.com/alsatianco/alsatianco.github.io/actions/runs/37131845142)
succeeded. Both public page URLs, Home screenshot, and 103.125-second MP4 returned
HTTP 200 and matched the regenerated files. Desktop/mobile checks confirmed Home
as the hero, first gallery screenshot, and video poster, with no horizontal
overflow and successful video playback. The frontend build passed; regeneration
left the deployment repository clean.

## Follow-up: README and documentation checks

October 3–4 continuation moved detailed CI/signing material from README to its
release runbook, keeping development/testing/build commands in README. The Windows
prerequisite now describes WebView2 bootstrapping instead of assuming every Windows
10 1803+ installation has the runtime. Existing historical reports and design
records remain dated and separate from maintained guides in the docs hub; no
linked historical input or provenance was deleted. This is targeted launch-doc
cleanup, not a new full tool-reference or repository security audit.

Every README relative link/image and heading anchor resolved, including the new
native-evidence links. All external README URLs returned HTTP 200. There are no
badge links in the current README. A local Markdown render with tables/fenced code
and a responsive reading stylesheet was checked at 1440 and 390 pixels: Home/GIF
images loaded and there was no page overflow. This is local rendering evidence,
not proof that unpushed content is on GitHub. Development/test/build command names,
CLI options, sidecar hooks, platform bundle targets, and prerequisites were compared
with package scripts, Tauri config, release workflows, and installed CLI help.
Actual frontend/native candidate builds, UI tests, Homebrew fetch, and the README
CLI file/stdin/output example passed. Windows/Linux installation/build commands
were reviewed statically and are not cross-platform runtime passes.

[Native checks and the unreleased dialog fix](installation-validation-2026-10-03.md)
supersede the earlier assumption that bridge-backed media established native chain
saving. The released macOS v0.1.2 chain-name prompt failed; the local source candidate
passed native save/restart/restore/rename/duplicate/delete and history-clear checks.
The installed public app and finished 103-second demo were preserved. Current
capture-script dialog handling follows the source fix; exact historical media
reproduction uses capture commit `8e9baf6` as documented in the assets guide.

[Packaging candidates](../packaging/README.md), [launch drafts and FAQ](launch-kit.md),
[actual launch actions](launch-log.csv), and [dated reporting baseline](adoption/README.md)
now provide the local handoff. About settings and two issues were applied through
the authorized API follow-up. The release edit and issue-label writes returned
HTTP 403 with each supplied token; social preview upload remains a UI action.
No Binturong push or new community/package publication occurred in this continuation.

A fresh unauthenticated browser context checked the public repository on October 4:
HTTP 200, the applied About text, canonical homepage, developer-tools topic, and
existing README's latest-release link were visible. The release URL also returned
HTTP 200 in the link checks. The new local README/media/docs are still unpushed;
this structural check does not replace a new visitor's timed download-finding test
or a signed-out check after the remaining presentation is published.
