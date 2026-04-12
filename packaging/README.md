# Package Manager Definitions

This directory contains release templates/manifests for package managers referenced in `P3-009`.

## Included

- Homebrew cask: `packaging/homebrew/Casks/binturong.rb`
- Winget manifests: `packaging/winget/manifests/b/Binturong/Binturong/0.1.0/`
- Snap template: `packaging/snap/snapcraft.yaml`
- Flatpak manifest template: `packaging/flatpak/com.binturong.app.yml`

## Release Checklist

1. Build installer artifacts via `.github/workflows/build-installers.yml`.
2. Replace all `REPLACE_WITH_*_SHA256` placeholders with real hashes.
3. Confirm installer URLs and names match the release artifacts.
4. Submit/publish:
   - Homebrew tap/cask PR.
   - Winget-pkgs PR.
   - Snapcraft release.
   - Flatpak (Flathub) submission.
