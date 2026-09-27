#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v rg >/dev/null 2>&1 || {
  echo "error: ripgrep (rg) is required for privacy checks" >&2
  exit 1
}
REPORT="$(mktemp "${TMPDIR:-/tmp}/binturong-privacy.XXXXXX")"
trap 'rm -f "$REPORT"' EXIT
FAILED=0

check_forbidden() {
  local description="$1"
  local pattern="$2"
  shift 2
  local status=0
  rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' "$pattern" "$@" >"$REPORT" || status=$?
  case "$status" in
    0) echo "[FAIL] ${description}"; cat "$REPORT"; FAILED=1 ;;
    1) echo "[PASS] ${description}" ;;
    *) echo "[FAIL] ${description}: search failed (exit ${status})" >&2; FAILED=1 ;;
  esac
}

check_forbidden "No runtime eval/new Function usage" "eval\\(|new Function\\(" src src-tauri/src
check_forbidden "No dangerouslySetInnerHTML usage" "dangerouslySetInnerHTML" src
check_forbidden "No frontend network request APIs" "\\bfetch\\(|XMLHttpRequest|WebSocket\\(" src
check_forbidden "No telemetry SDK references" "\\bmixpanel\\b|\\bamplitude\\b|\\bposthog\\b|\\bsentry\\b|analytics\\.(track|identify)|segment\\.io" src src-tauri/src package.json

check_forbidden "reqwest usage is scoped to the OCR download helper" "reqwest::" \
  --glob '!src-tauri/src/tools/image_tools.rs' src-tauri/src

if [[ "$FAILED" -ne 0 ]]; then
  echo "Privacy/security check failed"
  exit 1
fi

echo "Privacy/security check passed"
