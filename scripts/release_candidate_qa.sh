#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_step() {
  local label="$1"
  shift
  echo "[rc-qa] ${label}"
  "$@"
}

cd "$ROOT_DIR"

run_step "Frontend build" npm run build
run_step "UI tests" npm run test:ui
run_step "Privacy/security checks" ./scripts/privacy_security_check.sh
run_step "Dependency/license audit" ./scripts/dependency_license_audit.sh
run_step "Rust unit/integration tests" cargo test --manifest-path src-tauri/Cargo.toml

echo "[rc-qa] Verify tool inventory count"
tool_count="$(
  cargo run --manifest-path src-tauri/Cargo.toml --quiet --bin binturong-cli -- list | wc -l | tr -d ' '
)"
if [[ "$tool_count" != "134" ]]; then
  echo "error: expected 134 tools but found ${tool_count}" >&2
  exit 1
fi
echo "[rc-qa] Tool inventory count verified: ${tool_count}"

if [[ "${BINTURONG_SKIP_PERF_BENCH:-0}" == "1" ]]; then
  echo "[rc-qa] Skipping performance benchmark (BINTURONG_SKIP_PERF_BENCH=1)"
else
  run_step "Performance benchmark" cargo run --manifest-path src-tauri/Cargo.toml --release --bin perf-bench
fi

echo "[rc-qa] Release candidate QA passed"
