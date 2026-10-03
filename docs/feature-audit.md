# Phase 3 Feature Audit (P3-011)

Date: 2026-03-28

> Historical record: results, counts, and UI descriptions below describe the dated run. They have not been revalidated by this documentation cleanup. See the [documentation index](README.md) and [current testing instructions](../README.md#testing) for maintained guidance.

## Scope
This historical audit maps source-app functionality to canonical Binturong tools,
using the former `project_requirements.md` §5.3. That planning file is no longer in
this checkout; its section identifiers remain in this report and CSV as provenance.
For the current inventory, use the [registry](../src-tauri/src/tool_registry.rs)
or `binturong-cli list`. The mapping CSV remains the original 133-tool capture.

## Audit Artifacts
- [feature-audit.csv](feature-audit.csv) (machine-readable mapping table)

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
