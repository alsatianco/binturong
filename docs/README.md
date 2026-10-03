# Documentation

Start with the [project README](../README.md) for installation, development, testing,
and builds, or the [user guide](../how_to_use.md) for tool examples and workflows.
[Contributor agreements](../AGENTS.md) describe documentation ownership.

## Maintained guides

- [Contributing](../CONTRIBUTING.md): setup pointers, focused checks, and a tool-wiring example.
- [Privacy and data retention](privacy.md): processing, network exceptions, local storage, and deletion.
- [Security reporting](../SECURITY.md): private-report routes and support expectations.
- [Launch assets](assets/README.md): screenshots, demo, social preview, and reproduction.
- [GitHub presentation drafts](github-presentation.md): release notes and scoped contributor issues.
- [Tool dependencies](tool-dependencies.md): Tesseract installation, language models, and CLI setup.
- [Releasing](releasing.md): version checks, release workflows, signing, and installer validation.
- [Distribution packaging](../packaging/README.md): packaging assets and package-manager ownership.
- [Mac installation instructions](../packaging/macos/README.txt): text shipped in the Mac installation kit.
- [Branding](branding.md): artwork sources, runtime assets, and regeneration.
- [Bundled asset license manifest](bundled-assets.tsv): maintained input to [the license audit script](../scripts/dependency_license_audit.sh).

## Historical validation and audits

The [October 2026 launch preparation](launch-preparation.md) records the verified
pitch, demo, checks, and remaining launch limits for v0.1.2.

These records capture March 2026 implementation and validation work. Their results,
tool counts, and UI descriptions describe those runs; they do not establish current
release readiness. Follow the README and maintained guides for current commands.
The original `project_requirements.md` and `task.md` referenced by some records are
no longer in this checkout; their section and task identifiers are retained for
provenance.

- [Phase 1 exit validation](phase1-validation.md)
- [Phase 2 exit validation](phase2-validation.md)
- [Feature audit](feature-audit.md) and [mapping CSV](feature-audit.csv)
- [Accessibility audit](accessibility-audit.md)
- [Dependency/license audit](dependency-license-audit.md)
- [Privacy/security validation](privacy-security-validation.md)
- [Performance validation](performance-validation.md) and [captured benchmark CSV](performance-bench.csv)
- [Automated test matrix](test-matrix-validation.md)
- [Update UX validation](update-channel-validation.md)
- [Release candidate QA](release-candidate-qa.md)
- [Release acceptance mapping](release-acceptance-validation.md)

## Design records

- [Tool UI implementation design, March 28, 2026](superpowers/specs/2026-03-28-tool-ui-implementation-design.md): original template architecture and rationale, with notes about subsequent changes.
