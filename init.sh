#!/usr/bin/env bash
set -euo pipefail

echo "==> Bootstrapping local Rust + Tauri test repo"

# Make sure we're inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: This folder is not a git repo yet."
  echo "Run: git init"
  exit 1
fi

# -------------------------------------------------------------------
# 1) Repo-local git identity only (does not touch global config)
# -------------------------------------------------------------------
echo "==> Setting repo-local git identity"
git config --local user.name "dude"
git config --local user.email "dude@dude.com"

# Disable signing only in this repo
git config --local commit.gpgsign false
git config --local tag.gpgSign false

# Also remove any local signing key if present
git config --local --unset-all user.signingkey >/dev/null 2>&1 || true

# Optional: avoid accidental SSH signing if your global config uses it
git config --local --unset-all gpg.format >/dev/null 2>&1 || true
git config --local --unset-all gpg.program >/dev/null 2>&1 || true

# -------------------------------------------------------------------
# 2) Create .gitignore
# -------------------------------------------------------------------
echo "==> Writing .gitignore"
cat > .gitignore <<'EOF'
# ----------------------------
# OS / editor junk
# ----------------------------
.DS_Store
Thumbs.db
*.swp
*.swo
.idea/
.vscode/

# ----------------------------
# Logs / env
# ----------------------------
*.log
.env
.env.local
.env.*.local
!.env.example

# ----------------------------
# Rust
# ----------------------------
target/
**/*.rs.bk

# Keep Cargo.lock for apps/binaries.
# Uncomment the next line only if this repo is a reusable library:
# Cargo.lock

# ----------------------------
# Node / frontend
# ----------------------------
node_modules/
dist/
build/
coverage/
.npm/
.pnpm-store/
.yarn/
.parcel-cache/
.next/
.nuxt/
.svelte-kit/
vite.config.ts.timestamp-*
*.tsbuildinfo

# ----------------------------
# Tauri
# ----------------------------
src-tauri/target/
src-tauri/gen/
EOF

# -------------------------------------------------------------------
# 3) Optional starter files if missing
# -------------------------------------------------------------------
if [ ! -f README.md ]; then
  echo "==> Writing README.md"
  cat > README.md <<'EOF'
# Test Rust + Tauri Repo

Local test repo with repo-only Git identity and signing disabled.

## Notes
- Git user is local to this repo only
- Commit/tag signing is disabled only in this repo
EOF
fi

if [ ! -f .editorconfig ]; then
  echo "==> Writing .editorconfig"
  cat > .editorconfig <<'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.rs]
indent_size = 4
EOF
fi

# -------------------------------------------------------------------
# 4) Show resulting local git config
# -------------------------------------------------------------------
echo
echo "==> Repo-local git config:"
git config --local --list || true

echo
echo "==> Done."
echo "Recommended next steps:"
echo "  1) Create your project files"
echo "  2) git add ."
echo "  3) git commit -m 'Initial commit'"
