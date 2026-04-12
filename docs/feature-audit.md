# Phase 3 Feature Audit (P3-011)

Date: 2026-03-28

## Scope
This audit maps source-app functionality to canonical Binturong tools, per `project_requirements.md` §5.3.

## Audit Artifacts
- `docs/feature-audit.csv` (machine-readable mapping table)

CSV columns follow the required schema:
- `source_product`
- `source_feature_name`
- `binturong_canonical_tool`
- `status` (`mapped` / `merged` / `new` / `intentionally excluded`)
- `notes`

## Method
1. Enumerated canonical tools from the shared Rust core using:
   - `cargo run --manifest-path src-tauri/Cargo.toml --bin binturong-cli -- list`
2. Added one `mapped` row per canonical tool (133 rows), referenced to the definitive canonical inventory in `project_requirements.md` §8.
3. Added explicit `merged` rows for overlap-normalization examples listed in `project_requirements.md` §5.2.

## Summary
- `mapped`: 133
- `merged`: 23
- `new`: 0
- `intentionally excluded`: 0

## Documented Exclusions
- No source feature is intentionally excluded in this release audit.
- Overlapping standalone features from source products are represented as `merged` into a single canonical Binturong tool (mode-selector pattern), not excluded.
