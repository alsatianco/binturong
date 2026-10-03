# Releasing Binturong

## Release policy

Use immutable version tags: `v1.2.3` for stable releases and `v1.2.3-rc.1`
(or `alpha.N` / `beta.N`) for prereleases. Tag the reviewed commit you intend to
ship. A `release-*` branch is optional for stabilizing candidates: its pushes
build installers but never publish. Manual installer workflow runs also only build.

The installer workflow validates metadata, runs UI and Rust tests on each host,
and builds a universal Mac DMG, Windows x64 MSI/NSIS, and Linux x86_64
AppImage/DEB/RPM. All jobs must succeed before publication. It stages a draft,
uploads the complete asset set with `SHA256SUMS`, then publishes. Prereleases
never become latest. Stable releases become latest, so do not tag an older
maintenance version with this workflow without adjusting that policy.

A failed upload can be retried while the release remains a draft. Already public
releases are never overwritten by this workflow: fix forward with a new version.
Do not move published tags. GitHub Actions artifacts expire after 14 days; published
release assets persist.

## Workflow reference

| Workflow | Trigger | Result |
| --- | --- | --- |
| [Installers](../.github/workflows/build-installers.yml) | Version tag push | Tests, bundles, GitHub release publication |
| Installers | `release-*` branch push or manual run | Downloadable Actions artifacts; no release publication |
| [Test matrix](../.github/workflows/ci-test-matrix.yml) | Any branch push / pull request | Tests and audits |
| [RC QA](../.github/workflows/release-candidate-qa.yml) | `release-*` push / manual run | Extended candidate checks |

Local QA and all development/testing/build commands are owned by the
[README](../README.md#release-and-distribution).

## Signing configuration

Mac builds currently use ad-hoc signing and are unnotarized. Developer ID signing
and notarization require Apple membership, a certificate, and build configuration.
The current installer action has no Apple secret inputs wired. When those accounts
are available, configure `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password),
and `APPLE_TEAM_ID` following Tauri's signing guide, then verify the downloaded
release artifact. Windows publisher signing also requires a certificate or signing
service and workflow integration. No signing status should be inferred from a
package-manager listing.

## Cut a release

1. Update `package.json`, both root versions in `package-lock.json`,
   `src-tauri/tauri.conf.json`, and the package version in `src-tauri/Cargo.toml`.
   Run `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo check --manifest-path src-tauri/Cargo.toml` to refresh the root
   package entry in `Cargo.lock`. Use the full prerelease version everywhere for RCs.
2. Run `python3 scripts/check_release_version.py` (Python 3.11+), review the diff,
   and commit. Ensure branch CI and the RC QA workflow pass on this commit. RC QA runs on
   `release-*` pushes and can also be dispatched manually.
3. Build a candidate via manual workflow or a `release-*` branch, download its
   installers, and smoke-test install, first launch, upgrade, and uninstall on
   clean machines. Test both Mac architectures. Automated unit tests do not
   replace installer testing.
4. Tag and push the reviewed commit, for example:

   ```bash
   git tag -a v0.1.0 -m "Binturong 0.1.0"
   git push origin v0.1.0
   ```

5. Check the release assets and generated notes. Follow the independent
   [Homebrew tap's instructions](https://github.com/alsatianco/homebrew-tap)
   to update and verify its cask.

## First-release setup

The initial release uses free macOS ad-hoc signing with the manual quarantine
helper and unsigned Windows installers. Developer ID notarization and Windows
publisher signing are deferred. No Apple signing secrets are needed for this mode.

- Verify the independent [Homebrew tap](https://github.com/alsatianco/homebrew-tap)
  is available and configured according to its README. Enable Actions in this
  repository; tap permissions and automation are maintained separately.
- Protect the default branch and `v*` tags using GitHub rulesets. Restrict release
  tag creation to maintainers and prevent tag updates/deletion. Keep CI required
  before merging; the release workflow itself gates publication on UI/Rust tests,
  not the separate audit/oracle/performance jobs.
- Confirm Binturong and its release assets are public before announcing downloads.
- Prefer Apple Developer ID signing plus notarization for public distribution.
  Until configured, Mac builds are ad-hoc signed and the Mac ZIP includes the
  manual quarantine helper. It is a workaround, not publisher verification.
- Configure Windows code signing when a certificate or signing service is available.
  Expect SmartScreen/unknown-publisher friction until then.
- Review dependency/license audits and bundled third-party notices. OCR requires
  a separate Tesseract installation; verify the app explains that requirement.
- Keep Winget/Snap/Flatpak listed as templates until submitted and tested. Avoid
  announcing package-manager installation commands before their packages exist.

## Download integrity

Each release includes SHA256SUMS. From a directory containing all release assets:

```bash
shasum -a 256 -c SHA256SUMS   # macOS
sha256sum -c SHA256SUMS      # Linux
```

For one download, compare its hash with the corresponding line in SHA256SUMS.
Windows: `Get-FileHash .\Binturong_<version>_x64-setup.exe -Algorithm SHA256`.
Checksums detect corruption; code signing provides publisher identity.

## Homebrew

Homebrew packaging lives in [alsatianco/homebrew-tap](https://github.com/alsatianco/homebrew-tap).
Check that repository for current cask availability, asset selection, CLI linking,
automation schedules, and token requirements. This checkout publishes the universal
Mac DMG and `SHA256SUMS`; it does not maintain the cask. Verify app installation and
`binturong-cli --version` when testing a candidate cask, using the bundled CLI path
from the [installation guide](../README.md#macos-installation) if needed.

## Later improvements

Consider an SBOM and signed build provenance, pinned action commit SHAs with
Dependabot updates, and a signed in-app updater as separate follow-ups. The
current workflow does not publish Tauri updater manifests or updater signatures.
The app directs users to GitHub Releases for manual downloads. Automatic checks
and installation are disabled until a signed updater is implemented.

References: [Tauri GitHub builds](https://v2.tauri.app/distribute/pipelines/github/),
[Mac signing](https://v2.tauri.app/distribute/sign/macos/),
[Homebrew casks](https://docs.brew.sh/Cask-Cookbook), and
[GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
