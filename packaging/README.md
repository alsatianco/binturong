# Distribution packaging

Published channel: the independent [Homebrew tap](https://github.com/alsatianco/homebrew-tap).
Use the [README install guide](../README.md#install) for actual installation commands.
The candidates below are not registry listings and do not establish platform QA.

- `macos/`: quarantine helper and instructions shipped beside the DMG in the
  universal Mac ZIP. The helper removes the app's quarantine attribute; it does
  not provide notarization or publisher verification.
- [winget candidate](winget/manifests/b/Binturong/Binturong/0.1.2/): v0.1.2 EXE and
  MSI URLs and hashes match downloaded assets and `SHA256SUMS`. All three manifests
  pass Microsoft's 1.12.0 JSON schemas. The MSI's Property table supplies its
  ProductCode and `ALLUSERS=1` (machine scope); NSIS user scope follows the shipped
  Tauri default configuration and still needs Windows confirmation. No PATH alias
  or global CLI discovery is promised.
- [Flatpak candidate](flatpak/io.github.alsatianco.Binturong.yml): selected additional
  Linux channel for local preparation. Repackages the checksum-verified x86_64 DEB
  with GNOME 50 (GTK/WebKit), desktop entry, metainfo, and pinned Ayatana dependencies.
  YAML, XML, local sources, and archive layout were checked on macOS. It has **not**
  passed `flatpak-builder`, AppStream validation, sandbox execution, or Flathub review.
- [Snap](snap/snapcraft.yaml): old placeholder retained as optional follow-up, not
  the chosen Linux channel. It cannot build a usable package as written.

## Winget validation handoff

On a clean Windows x64 test machine with WinGet available, enable local manifests
if required by that client's policy and run from the repository root:

```powershell
winget validate --manifest packaging/winget/manifests/b/Binturong/Binturong/0.1.2
winget install --manifest packaging/winget/manifests/b/Binturong/Binturong/0.1.2 --installer-type nullsoft
```

Test EXE/user and MSI/machine separately, interactive and silent installation,
first launch, missing WebView2, GUI JSON → YAML, actual CLI location/discovery,
upgrade from an earlier installed version, and uninstall. Confirm the installed
app's version and its uninstall entry. Add `AppsAndFeaturesEntries` only after
reading the real installed metadata. Do not claim `winget install --id ...` works
until submission is accepted. Use [Microsoft's validation/submission guide](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest)
at that time; schema validation here is narrower than WinGet validation.

## Flatpak validation handoff

Initialize the pinned third-party build modules:

```bash
git submodule update --init packaging/flatpak/shared-modules
```

The [shared-modules repository](https://github.com/flathub/shared-modules) is pinned
to `cb9ec602a1ece1c76d5a4f8aa1d87c4a6bf99c3e`. This prevents dependency recipes drifting
between reviews. On an x86_64 Linux machine with Flatpak/flatpak-builder and Flathub
already configured, install the candidate runtime/SDK and build locally:

```bash
flatpak install --user flathub org.gnome.Platform//50 org.gnome.Sdk//50
flatpak-builder --user --install --force-clean /tmp/binturong-flatpak-build packaging/flatpak/io.github.alsatianco.Binturong.yml
flatpak run io.github.alsatianco.Binturong
flatpak run --command=binturong-cli io.github.alsatianco.Binturong --version
flatpak uninstall --user io.github.alsatianco.Binturong
```

These are maintainer validation commands, not a published package installation.
Use an isolated test machine and test file pickers, exports, clipboard, saved
chains, CLI stdin, Wayland/X11, tray integration, clean install, update, and removal.
Inspect `ldd` inside the sandbox for missing libraries. The candidate grants home
access for path-based tools and network for OCR model downloads; review this broad
permission and portal compatibility before submission. No host package-manager or
host-spawn permission is granted. OCR has no bundled Tesseract: automatic host
installation is unavailable in the sandbox, and a host executable path is not a
working sandbox dependency. Resolve OCR packaging or make its unsupported state
explicit in the UI before publishing. Check runtime support at build time.

The app ID uses the GitHub organization namespace for potential ownership checks;
it differs from the compiled Tauri identifier `com.binturong.app`. This repack
candidate demonstrates artifact layout; an open-source Flathub submission needs
an offline source build (vendored Cargo/npm inputs and sidecar staging), metainfo
lint, ownership verification, current runtime/dependency review, and sandbox QA.
Follow [Tauri's Flathub guide](https://v2.tauri.app/distribute/flatpak/) and
[Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements).
Do not submit this repack candidate as a source-build-ready manifest.

## Updating candidates

For each release, update manifest directory/version, exact URLs, recomputed asset
hashes, MSI ProductCode/scope, Flatpak DEB version/hash and metainfo date. Download
and verify the new bytes against that release's `SHA256SUMS`; API digests alone do
not establish installability. Review the shared-module pin and runtime, repeat
native/platform checks, and record evidence in the [docs hub](../docs/README.md).
Do not overwrite previous QA results with a new version claim. Store submission,
account enrollment, signing, and publication require explicit maintainer action.

The [release runbook](../docs/releasing.md) owns CI/tag/signing instructions.
