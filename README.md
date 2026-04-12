# Binturong

Binturong is an offline-first desktop developer utility suite built with Tauri 2,
Rust, React, TypeScript, and Tailwind CSS.

- Website: https://play.alsatian.co/software/binturong.html
- GitHub: https://github.com/alsatianco/binturong
- Author: [Duc Nguyen](https://github.com/scorta)

## Development

1. Install dependencies: `npm install`
2. Run desktop dev app: `npm run tauri dev`
3. Run frontend only: `npm run dev`
4. Build frontend assets: `npm run build`

## Toolchain

- Tauri 2
- Rust (backend/core processing)
- React + TypeScript (frontend)
- Tailwind CSS (styling)

## Installer Builds

- CI workflow: `.github/workflows/build-installers.yml`
- Push a `v*` tag (for example `v1.0.0`) to automatically:
  - build installers for macOS, Windows, and Linux
  - create/update a GitHub Release for that tag
  - upload installers to that release
- You can also run `workflow_dispatch` manually:
  - with no `tag` input: build artifacts only
  - with a `tag` input: build + publish to that GitHub Release
  - optional `prerelease` input: mark manual release as pre-release
- Produced artifacts:
  - macOS: `.dmg`
  - Windows: `.msi`, `.exe` (NSIS)
  - Linux: `.AppImage`, `.deb`, `.rpm`

## Signing Status

- Current default: unsigned builds (including macOS) if signing secrets are not set.
- This is expected and valid for development/distribution before you have a signing account.
- Once you have Apple Developer signing details, add these GitHub repository secrets:
  - `APPLE_CERTIFICATE`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY`
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
- After those secrets are present, the same workflow can use them for signed/notarized macOS builds.

## CI Matrix

- Cross-platform test matrix workflow: `.github/workflows/ci-test-matrix.yml`
- Includes:
  - Frontend build + UI tests (`vitest`)
  - Privacy/security policy checks
  - Rust unit/integration tests
  - Dedicated performance regression job (`perf-bench`, release mode)

## Release Candidate QA

- Manual release-candidate QA workflow: `.github/workflows/release-candidate-qa.yml`
- Local RC command:
  - `./scripts/release_candidate_qa.sh`
- This validates:
  - UI + core tests
  - Privacy/security and dependency/license audits
  - Tool inventory count (`134`)
  - Performance benchmarks (Linux by default in CI)

## Package Managers

- Package manager manifests/templates live under `packaging/`.
- Included targets: Homebrew cask, Winget manifests, Snap (`snapcraft.yaml`), and Flatpak manifest.

## Performance Benchmarks

- Run release performance checks with:
  - `cargo run --manifest-path src-tauri/Cargo.toml --release --bin perf-bench`
- Validation artifacts:
  - `docs/performance-validation.md`
  - `docs/performance-bench.csv`

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
