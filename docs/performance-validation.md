# Phase 3 Performance Validation (P3-012)

Date: 2026-03-28

## Optimization Pass Completed
- Reduced ranked-search overhead in [`src-tauri/src/tool_registry.rs`] by:
  - Adding a per-tool lowercased search index at registration time.
  - Avoiding full-list cloning for every query.
  - Reusing indexed lowercase fields for tier matching and sorting.
- Added reproducible performance benchmark binary: [`src-tauri/src/bin/perf-bench.rs`].

## Benchmark Command
```bash
cargo run --manifest-path src-tauri/Cargo.toml --release --bin perf-bench
```

Latest captured run is stored in [`docs/performance-bench.csv`].

## Measured Results (Release)
| Metric | Target | Measured | Result |
|---|---:|---:|---|
| Search results update per keystroke | < 50 ms | 0.05 ms (p95) | Pass |
| Smart clipboard detection | < 200 ms | 0.60 ms (p95) | Pass |
| Formatter/encoder on typical input (<10KB) | < 50 ms | 0.06 ms (p95) | Pass |
| Hash computation on 100MB file | < 5000 ms | 248.46 ms | Pass |
| Image conversion (single file, <10MB) | < 3000 ms | 21.66 ms (p95) | Pass |
| OCR on a standard document page | < 10000 ms | 162.66 ms | Pass |

## Notes
- The benchmark intentionally runs in `--release` mode to avoid debug-build distortion.
- OCR measurement uses English language data (`eng`) and excludes first-time language download cost.
- UI-only metrics (`cold start`, `tool switch`, `60fps`) remain validated in runtime/UX checks and final cross-platform QA gates (`P3-018`).
