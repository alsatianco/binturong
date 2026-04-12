#!/usr/bin/env bash
set -euo pipefail

LC_ALL=C

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/binturong-dependency-audit.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command not found: $cmd" >&2
    exit 1
  fi
}

require_cmd cargo
require_cmd jq
require_cmd npx
require_cmd comm
require_cmd sort
require_cmd awk

if ! cargo audit --version >/dev/null 2>&1; then
  echo "error: cargo-audit is not installed. Install with: cargo install cargo-audit" >&2
  exit 1
fi

if ! cargo license --help >/dev/null 2>&1; then
  echo "error: cargo-license is not installed. Install with: cargo install cargo-license" >&2
  exit 1
fi

echo "[1/4] Running cargo audit (src-tauri/Cargo.lock)"
(
  cd "$ROOT_DIR/src-tauri"
  cargo audit --format json > "$TMP_DIR/cargo-audit.json"
)

vulnerability_count="$(jq '.vulnerabilities.list | length' "$TMP_DIR/cargo-audit.json")"
unmaintained_count="$(jq '(.warnings.unmaintained // []) | length' "$TMP_DIR/cargo-audit.json")"
unsound_count="$(jq '(.warnings.unsound // []) | length' "$TMP_DIR/cargo-audit.json")"
yanked_count="$(jq '(.warnings.yanked // []) | length' "$TMP_DIR/cargo-audit.json")"

if [[ "$vulnerability_count" -ne 0 ]]; then
  echo "error: cargo audit found vulnerabilities:" >&2
  jq -r '.vulnerabilities.list[] | "- \(.advisory.id): \(.package.name) \(.package.version) - \(.advisory.title)"' "$TMP_DIR/cargo-audit.json" >&2
  exit 1
fi

echo "  cargo audit summary: vulnerabilities=0, unmaintained=${unmaintained_count}, unsound=${unsound_count}, yanked=${yanked_count}"

echo "[2/4] Auditing Rust dependency licenses"
cargo license --manifest-path "$ROOT_DIR/src-tauri/Cargo.toml" --tsv > "$TMP_DIR/cargo-licenses.tsv"

missing_rust_licenses_file="$TMP_DIR/rust-missing-licenses.txt"
awk -F '\t' 'NR > 1 && $5 == "" { print $1 "\t" $2 }' "$TMP_DIR/cargo-licenses.tsv" > "$missing_rust_licenses_file"
if [[ -s "$missing_rust_licenses_file" ]]; then
  echo "error: Rust crates with missing license metadata:" >&2
  sed 's/^/- /' "$missing_rust_licenses_file" >&2
  exit 1
fi

tail -n +2 "$TMP_DIR/cargo-licenses.tsv" | cut -f5 | sed '/^$/d' | sort -u > "$TMP_DIR/rust-licenses-found.txt"
cat > "$TMP_DIR/rust-licenses-allowed.txt" <<'EOF_RUST_LICENSES'
(Apache-2.0 OR MIT) AND Unicode-3.0
0BSD OR Apache-2.0 OR MIT
Apache-2.0
Apache-2.0 AND ISC
Apache-2.0 AND MIT
Apache-2.0 OR Apache-2.0 WITH LLVM-exception OR MIT
Apache-2.0 OR BSD-2-Clause OR MIT
Apache-2.0 OR BSD-3-Clause
Apache-2.0 OR BSD-3-Clause OR MIT
Apache-2.0 OR BSL-1.0
Apache-2.0 OR CC0-1.0 OR MIT-0
Apache-2.0 OR ISC OR MIT
Apache-2.0 OR LGPL-2.1-or-later OR MIT
Apache-2.0 OR MIT
Apache-2.0 OR MIT OR Zlib
Apache-2.0 WITH LLVM-exception
BSD-2-Clause
BSD-3-Clause
BSD-3-Clause AND MIT
BSD-3-Clause OR MIT
CDLA-Permissive-2.0
ISC
MIT
MIT OR Unlicense
MPL-2.0
Unicode-3.0
Zlib
EOF_RUST_LICENSES
sort -u -o "$TMP_DIR/rust-licenses-allowed.txt" "$TMP_DIR/rust-licenses-allowed.txt"

comm -23 "$TMP_DIR/rust-licenses-found.txt" "$TMP_DIR/rust-licenses-allowed.txt" > "$TMP_DIR/rust-licenses-unapproved.txt"
if [[ -s "$TMP_DIR/rust-licenses-unapproved.txt" ]]; then
  echo "error: Found unapproved Rust license expressions:" >&2
  sed 's/^/- /' "$TMP_DIR/rust-licenses-unapproved.txt" >&2
  exit 1
fi

rust_package_count="$(awk -F '\t' 'NR > 1 { count++ } END { print count + 0 }' "$TMP_DIR/cargo-licenses.tsv")"
rust_license_expression_count="$(wc -l < "$TMP_DIR/rust-licenses-found.txt" | tr -d ' ')"
echo "  Rust license summary: packages=${rust_package_count}, unique_expressions=${rust_license_expression_count}"

echo "[3/4] Auditing npm production dependency licenses"
(
  cd "$ROOT_DIR"
  npx --yes license-checker --production --json > "$TMP_DIR/npm-licenses-prod.json"
)

jq -r --arg root "$ROOT_DIR" 'to_entries[] | select((.value.path // "") != $root) | [.key, (.value.licenses // "UNKNOWN")] | @tsv' "$TMP_DIR/npm-licenses-prod.json" > "$TMP_DIR/npm-licenses-prod.tsv"
cut -f2 "$TMP_DIR/npm-licenses-prod.tsv" | sort -u > "$TMP_DIR/npm-licenses-found.txt"

if grep -Eq '^(UNKNOWN|UNLICENSED)$' "$TMP_DIR/npm-licenses-found.txt"; then
  echo "error: npm production licenses include UNKNOWN/UNLICENSED entries:" >&2
  jq -r --arg root "$ROOT_DIR" 'to_entries[] | select((.value.path // "") != $root) | select((.value.licenses // "UNKNOWN") == "UNKNOWN" or (.value.licenses // "UNKNOWN") == "UNLICENSED") | "- \(.key): \(.value.licenses // "UNKNOWN")"' "$TMP_DIR/npm-licenses-prod.json" >&2
  exit 1
fi

cat > "$TMP_DIR/npm-licenses-allowed.txt" <<'EOF_NPM_LICENSES'
Apache-2.0 OR MIT
MIT
MIT OR Apache-2.0
EOF_NPM_LICENSES
sort -u -o "$TMP_DIR/npm-licenses-allowed.txt" "$TMP_DIR/npm-licenses-allowed.txt"

comm -23 "$TMP_DIR/npm-licenses-found.txt" "$TMP_DIR/npm-licenses-allowed.txt" > "$TMP_DIR/npm-licenses-unapproved.txt"
if [[ -s "$TMP_DIR/npm-licenses-unapproved.txt" ]]; then
  echo "error: Found unapproved npm production license expressions:" >&2
  sed 's/^/- /' "$TMP_DIR/npm-licenses-unapproved.txt" >&2
  echo "Affected packages:" >&2
  while IFS= read -r expr; do
    jq -r --arg expr "$expr" 'to_entries[] | select((.value.licenses // "UNKNOWN") == $expr) | "- \(.key)"' "$TMP_DIR/npm-licenses-prod.json" >&2
  done < "$TMP_DIR/npm-licenses-unapproved.txt"
  exit 1
fi

npm_package_count="$(awk 'END { print NR + 0 }' "$TMP_DIR/npm-licenses-prod.tsv")"
npm_license_expression_count="$(wc -l < "$TMP_DIR/npm-licenses-found.txt" | tr -d ' ')"
echo "  npm license summary: packages=${npm_package_count}, unique_expressions=${npm_license_expression_count}"

echo "[4/4] Checking bundled asset license manifest"
manifest_file="$ROOT_DIR/docs/bundled-assets.tsv"
if [[ ! -f "$manifest_file" ]]; then
  echo "error: Missing bundled asset manifest: $manifest_file" >&2
  exit 1
fi

cat > "$TMP_DIR/asset-licenses-allowed.txt" <<'EOF_ASSET_LICENSES'
Apache-2.0
Apache-2.0 OR MIT
MIT
MIT OR Apache-2.0
EOF_ASSET_LICENSES
sort -u -o "$TMP_DIR/asset-licenses-allowed.txt" "$TMP_DIR/asset-licenses-allowed.txt"

(
  cd "$ROOT_DIR"
  asset_dirs=()
  for candidate in public src-tauri/icons; do
    if [[ -d "$candidate" ]]; then
      asset_dirs+=("$candidate")
    fi
  done

  if [[ ${#asset_dirs[@]} -eq 0 ]]; then
    echo "error: no bundled asset directories found (expected public or src-tauri/icons)" >&2
    exit 1
  fi

  find "${asset_dirs[@]}" -type f \
    \( -name "*.png" -o -name "*.ico" -o -name "*.icns" -o -name "*.svg" -o -name "*.ttf" -o -name "*.otf" -o -name "*.woff" -o -name "*.woff2" \) \
    | sed 's#^\./##' \
    | sort > "$TMP_DIR/bundled-assets-found.txt"
)

if [[ ! -s "$TMP_DIR/bundled-assets-found.txt" ]]; then
  echo "error: no bundled assets discovered in git-tracked files" >&2
  exit 1
fi

awk -F '\t' 'NR > 1 && $1 != "" { print $1 }' "$manifest_file" | sort > "$TMP_DIR/bundled-asset-manifest-paths.txt"
awk -F '\t' 'NR > 1 && $3 != "" { print $3 }' "$manifest_file" | sort -u > "$TMP_DIR/bundled-asset-manifest-licenses.txt"

comm -23 "$TMP_DIR/bundled-assets-found.txt" "$TMP_DIR/bundled-asset-manifest-paths.txt" > "$TMP_DIR/bundled-assets-missing-manifest-entry.txt"
if [[ -s "$TMP_DIR/bundled-assets-missing-manifest-entry.txt" ]]; then
  echo "error: bundled assets missing manifest entries:" >&2
  sed 's/^/- /' "$TMP_DIR/bundled-assets-missing-manifest-entry.txt" >&2
  exit 1
fi

comm -23 "$TMP_DIR/bundled-asset-manifest-licenses.txt" "$TMP_DIR/asset-licenses-allowed.txt" > "$TMP_DIR/bundled-assets-unapproved-licenses.txt"
if [[ -s "$TMP_DIR/bundled-assets-unapproved-licenses.txt" ]]; then
  echo "error: bundled asset manifest contains unapproved licenses:" >&2
  sed 's/^/- /' "$TMP_DIR/bundled-assets-unapproved-licenses.txt" >&2
  exit 1
fi

asset_count="$(wc -l < "$TMP_DIR/bundled-assets-found.txt" | tr -d ' ')"
echo "  Bundled asset summary: assets=${asset_count}, all assets mapped in docs/bundled-assets.tsv"

echo "dependency/license audit passed"
