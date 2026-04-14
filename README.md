# Binturong

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An offline-first desktop developer utility suite — encoding, hashing, formatting, image tools, and more — all running locally with no network required.

Built with **Tauri 2**, **Rust**, **React 19**, **TypeScript**, and **Tailwind CSS 4**.

- **Website:** https://play.alsatian.co/software/binturong.html
- **Repository:** https://github.com/alsatianco/binturong
- **Author:** [Duc Nguyen](https://github.com/scorta)

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | LTS | Frontend build |
| [Rust](https://rustup.rs/) | stable | Backend build via Cargo |

Platform-specific dependencies are listed in the [Building](#building) section.

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
cargo test --manifest-path src-tauri/Cargo.toml  # Rust tests
```

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

> **Note:** Local builds are unsigned unless Apple signing credentials are configured.

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

| Workflow | File | Trigger |
| --- | --- | --- |
| **Installers** | `.github/workflows/build-installers.yml` | `v*` tag push or manual `workflow_dispatch` |
| **Test Matrix** | `.github/workflows/ci-test-matrix.yml` | Push / PR |
| **RC QA** | `.github/workflows/release-candidate-qa.yml` | Manual |

**Installer artifacts:** `.dmg` (macOS), `.msi` / `.exe` (Windows), `.AppImage` / `.deb` / `.rpm` (Linux)

Run local RC QA: `./scripts/release_candidate_qa.sh`

## Code Signing

Builds are unsigned by default. To enable macOS signing and notarization, set these GitHub repository secrets:

`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`

## Package Managers

Manifests live under [`packaging/`](packaging/): Homebrew cask, Winget, Snap, and Flatpak.

## Performance Benchmarks

```bash
cargo run --manifest-path src-tauri/Cargo.toml --release --bin perf-bench
```

Results are written to [`docs/performance-bench.csv`](docs/performance-bench.csv).

## License

[MIT](LICENSE)

## Privacy/Security Checks

- Run policy checks with:
  - `./scripts/privacy_security_check.sh`
- Validation artifact:
  - `docs/privacy-security-validation.md`

## Dependency/License Audit

- Run dependency and license checks with:
  - `./scripts/dependency_license_audit.sh`
- Validation artifacts:
  - `docs/dependency-license-audit.md`
  - `docs/bundled-assets.tsv`
