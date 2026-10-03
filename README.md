# Binturong

<img src="public/branding/logo.png" alt="Binturong mascot" width="128" height="128" />

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Everyday tools for developers. Format code, convert data, work with text and images, and more. Tools run locally on your computer.

Most tools work without an internet connection. Image-to-text requires Tesseract, and downloading OCR languages requires a connection. Install or configure Tesseract in **Settings → Tool dependencies**. See the [dependency setup guide](docs/tool-dependencies.md) for supported installers and manual setup.

Built with **Tauri 2**, **Rust**, **React 19**, **TypeScript**, and **Tailwind CSS 4**.

- **Website:** https://play.alsatian.co/software/binturong.html
- **Repository:** https://github.com/alsatianco/binturong
- **Author:** [Duc Nguyen](https://www.linkedin.com/in/ducnd87/)

## Support

If Binturong is useful to you, a [GitHub star](https://github.com/alsatianco/binturong) or a [coffee](https://www.alsatian.co/p/coffee.html) is a welcome way to support it.

## Install

Download installers from [GitHub Releases](https://github.com/alsatianco/binturong/releases/latest).

### macOS installation

Download `Binturong_<version>_macos-universal.zip` (Apple Silicon and Intel).
Extract it, open the included DMG, drag Binturong to Applications, then eject the DMG.

Or install with Homebrew:

```bash
brew install --cask alsatianco/tap/binturong
```

Update with `brew update && brew upgrade --cask binturong`.

For current cask availability and CLI linking, see the independent
[Homebrew tap](https://github.com/alsatianco/homebrew-tap). A manual DMG install includes the CLI inside the
app bundle; run it at
`/Applications/Binturong.app/Contents/MacOS/binturong-cli`. To put it on your
`PATH`, link it from a directory already on your `PATH`.

If macOS blocks Binturong after either installation method and you trust the
download, run this in Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Binturong.app
```

Then open Binturong normally. This removes only its quarantine attribute; it does
not disable Gatekeeper globally. The downloadable
[`allow-binturong.sh`](packaging/macos/allow-binturong.sh) does the same after
checking the app's identity and accepts a different app path if needed.

### Windows installation

Download the `.exe` setup installer or `.msi` (x64). Builds currently have no
Windows publisher signature, so Windows may show an unknown-publisher warning.

### Linux installation

Download the x86_64 `.deb` (Debian/Ubuntu), `.rpm` (Fedora), or `.AppImage`.
For AppImage, make it executable with `chmod +x Binturong_*.AppImage`, then run it.
Linux installers are built on Ubuntu 22.04; test your target distribution before
rollout. AppImage may require your distribution's FUSE 2 compatibility package.

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | LTS | Frontend build |
| [Rust](https://rustup.rs/) | stable | Backend build via Cargo |

Platform-specific dependencies are listed in the [Building](#building) section.

## Guides

- [User guide](how_to_use.md): tool examples, settings, workflows, and CLI usage.
- [Documentation index](docs/README.md): maintained guides and historical evidence.
- [Contributor agreements](AGENTS.md): working rules and documentation ownership.

## Development

```bash
npm install                # install JS dependencies
npm run tauri dev          # run desktop app in dev mode
npm run dev                # run frontend only (browser)
```

## Testing

```bash
npm run test:ui            # frontend unit/UI tests (vitest)
npm run test:coverage      # frontend tests with coverage
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test --manifest-path src-tauri/Cargo.toml
```

The command-scoped `TAURI_CONFIG` override disables the bundled CLI sidecar check
for direct Cargo tests and preserves any existing shell value afterward. In
PowerShell, temporarily set `$env:TAURI_CONFIG` to the same JSON and restore its
previous value after the command. Installer builds stage the CLI automatically;
use the normal bundle configuration for those builds.

## Building

Build a production desktop executable:

```bash
npm install
npm run tauri build
```

Build output for all platforms:

- Executable: `src-tauri/target/release/binturong` (`.exe` on Windows)
- Bundles: `src-tauri/target/release/bundle/`

### Linux (Ubuntu/Debian)

Install system dependencies, then build:

```bash
sudo apt-get update && sudo apt-get install -y \
    libwebkit2gtk-4.1-dev libgtk-3-dev \
    libayatana-appindicator3-dev librsvg2-dev patchelf

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # if Rust is not installed
source ~/.cargo/env

npm run tauri build -- --bundles appimage,deb,rpm
```

### macOS

Requires Xcode (open it once to complete initial setup):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # if Rust is not installed
source ~/.cargo/env

npm run tauri build -- --bundles dmg
```

> **Note:** Local Mac builds use ad-hoc signing by default and are not notarized. Developer ID signing requires Apple credentials and build configuration.

### Windows

Requires [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++" enabled. Edge WebView2 is pre-installed on Windows 10 1803+ and Windows 11.

```powershell
# Install Rust via rustup-init.exe from https://rustup.rs/ if not available

# Optional: for MSI/NSIS installer bundles
choco install -y nsis wixtoolset

npm run tauri build -- --bundles msi,nsis
```

> **Note:** If MSI packaging fails with `light.exe` errors, ensure the Windows VBScript feature is enabled.

## CI/CD

| Workflow | Trigger | Result |
| --- | --- | --- |
| **Installers** | Push `vX.Y.Z` / `vX.Y.Z-rc.N` tag | Test, build all platforms, publish release / prerelease |
| **Installers** | Push `release-*` branch or manual run | Test and build downloadable Actions artifacts |
| **Test Matrix** | Push branch / PR | Tests and audits |
| **RC QA** | Push `release-*` branch / manual | Extended release checks |

Publishing requires matching versions in package.json, package-lock.json,
Cargo.toml, Cargo.lock, and tauri.conf.json. Releases include SHA-256 checksums,
a universal Mac DMG and installation kit, Windows MSI/NSIS, and Linux AppImage/DEB/RPM.
Only tag pushes publish; manual builds cannot accidentally publish a different commit.

See the [release runbook](docs/releasing.md) for versioning, signing, the Homebrew
tap, and the first-release checklist. Run local RC QA with
`./scripts/release_candidate_qa.sh`.

## Code Signing

Mac CI builds use ad-hoc signing by default and are not notarized. To enable Apple
Developer ID signing and notarization later, wire these secrets into the build
workflow (they are intentionally omitted for the free ad-hoc release):

`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`.

The build action imports the certificate. Windows publisher signing still needs
a certificate/signing service and build configuration before it can be enabled.

## Package Managers

Homebrew is maintained in the independent
[alsatianco/homebrew-tap](https://github.com/alsatianco/homebrew-tap) repository.
Winget, Snap, and Flatpak files under [`packaging/`](packaging/) are unpublished templates.

## Performance Benchmarks

```bash
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo run --manifest-path src-tauri/Cargo.toml --release --bin perf-bench > perf-bench-local.csv
```

Build the frontend with `npm run build` before this release-mode Cargo run. OCR
measurement also needs Tesseract and English language data. The benchmark prints
CSV to stdout; the redirection above captures a new local result. Record the date,
platform, and run context when sharing a capture. The committed
[`docs/performance-bench.csv`](docs/performance-bench.csv) is historical evidence
explained in the [performance validation record](docs/performance-validation.md).

## License

[MIT](LICENSE)

## Privacy/Security Checks

- Run policy checks with:
  - `./scripts/privacy_security_check.sh`
- Validation artifact:
  - [Historical privacy/security validation](docs/privacy-security-validation.md)

## Dependency/License Audit

- Run dependency and license checks with:
  - `./scripts/dependency_license_audit.sh`
- Validation artifacts:
  - [Historical dependency/license audit](docs/dependency-license-audit.md)
  - [Bundled asset license manifest](docs/bundled-assets.tsv), an input to the audit script.
