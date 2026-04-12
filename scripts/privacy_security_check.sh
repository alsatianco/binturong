#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILED=0

check_forbidden() {
  local description="$1"
  local pattern="$2"
  shift 2
  local paths=("$@")

  if rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' "$pattern" "${paths[@]}" >/tmp/privacy-check.out; then
    echo "[FAIL] ${description}"
    cat /tmp/privacy-check.out
    FAILED=1
  else
    echo "[PASS] ${description}"
  fi
}

check_required() {
  local description="$1"
  local pattern="$2"
  local file="$3"

  if rg -n "$pattern" "$file" >/dev/null; then
    echo "[PASS] ${description}"
  else
    echo "[FAIL] ${description}"
    FAILED=1
  fi
}

check_forbidden "No runtime eval/new Function usage" "eval\\(|new Function\\(" src src-tauri/src
check_forbidden "No dangerouslySetInnerHTML usage" "dangerouslySetInnerHTML" src
check_forbidden "No frontend network request APIs" "\\bfetch\\(|XMLHttpRequest|WebSocket\\(" src
check_forbidden "No telemetry SDK references" "\\bmixpanel\\b|\\bamplitude\\b|\\bposthog\\b|\\bsentry\\b|analytics\\.(track|identify)|segment\\.io" src src-tauri/src package.json

if rg -n "reqwest::" src-tauri/src | rg -v "src-tauri/src/formatter_tools.rs" >/tmp/privacy-reqwest.out; then
  echo "[FAIL] reqwest usage must stay scoped to formatter_tools OCR/update helpers"
  cat /tmp/privacy-reqwest.out
  FAILED=1
else
  echo "[PASS] reqwest usage is scoped"
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "Privacy/security check failed"
  exit 1
fi

echo "Privacy/security check passed"
