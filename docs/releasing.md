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

## Cut a release

1. Update `package.json`, both root versions in `package-lock.json`,
   `src-tauri/tauri.conf.json`, and the package version in `src-tauri/Cargo.toml`.
   Run `cargo check --manifest-path src-tauri/Cargo.toml` to refresh the root
   package entry in `Cargo.lock`. Use the full prerelease version everywhere for RCs.
2. Run `python3 scripts/check_release_version.py` (Python 3.11+), review the diff,
   and commit. Ensure branch CI and the manual RC QA workflow pass on this commit.
3. Build a candidate via manual workflow or a `release-*` branch, download its
   installers, and smoke-test install, first launch, upgrade, and uninstall on
   clean machines. Test both Mac architectures. Automated unit tests do not
   replace installer testing.
4. Tag and push the reviewed commit, for example:

   ```bash
   git tag -a v0.1.0 -m "Binturong 0.1.0"
   git push origin v0.1.0
   ```

5. Check the release assets and generated notes. The separate Homebrew tap checks
   every six hours; manually run its update workflow for immediate availability.

## First-release setup

The initial release uses free macOS ad-hoc signing with the manual quarantine
helper and unsigned Windows installers. Developer ID notarization and Windows
publisher signing are deferred. No Apple signing secrets are needed for this mode.

- Push the independent `~/git/homebrew-tap` repository to public
  `alsatianco/homebrew-tap`; its README has exact commands. Enable Actions in
  both repositories. No cross-repository token is required.
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

The tap generates its cask from the latest stable release's universal DMG and
SHA256SUMS. Before the first stable release there is intentionally no installable
cask. It leaves quarantine removal to the user. Scheduled updates use the tap's
own GITHUB_TOKEN; if branch protection prevents bot commits, adapt to PR updates.
GitHub may delay schedules or disable them after inactivity; manual dispatch is
available. The tap must use `main` as its default branch for the supplied workflow.

## Later improvements

Consider an SBOM and signed build provenance, pinned action commit SHAs with
Dependabot updates, and a signed in-app updater as separate follow-ups. The
current workflow does not publish Tauri updater manifests or updater signatures.
The app's current update check reads mock environment variables, not GitHub releases;
replace or clearly label that behavior before advertising in-app update checks.

References: [Tauri GitHub builds](https://v2.tauri.app/distribute/pipelines/github/),
[Mac signing](https://v2.tauri.app/distribute/sign/macos/),
[Homebrew casks](https://docs.brew.sh/Cask-Cookbook), and
[GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
