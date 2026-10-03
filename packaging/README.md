# Distribution packaging

- `macos/`: manual quarantine helper and installation instructions, included
  alongside the DMG in the universal Mac ZIP. The DMG is also published separately.
- Homebrew: maintained in the independent
  [alsatianco/homebrew-tap](https://github.com/alsatianco/homebrew-tap) repository.
  Consult its README for current availability and release automation.
- `winget/`, `snap/`, `flatpak/`: unpublished templates. Replace placeholder hashes,
  check asset URLs and sandbox permissions, test, then submit to each registry.

See [the release runbook](../docs/releasing.md). The app workflow publishes GitHub
Releases only on version tag pushes; release branches and manual runs produce
Actions artifacts for testing.
