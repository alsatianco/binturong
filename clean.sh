#!/usr/bin/env bash
# clean.sh - Remove all generated, built, and downloaded files.
# After running this, only source code and config remain.
# To restore: npm install && cd src-tauri && cargo build
set -euo pipefail

cd "$(dirname "$0")"
echo "Cleaning Binturong project..."

# Node dependencies
if [ -d "node_modules" ]; then
  echo "  Removing node_modules/"
  rm -rf node_modules
fi

# Frontend build output
if [ -d "dist" ]; then
  echo "  Removing dist/"
  rm -rf dist
fi
rm -rf dist-ssr build .parcel-cache

# Test coverage
if [ -d "coverage" ]; then
  echo "  Removing coverage/"
  rm -rf coverage
fi

# Vite cache
rm -rf node_modules/.vite 2>/dev/null || true

# Rust build artifacts (the big one - often several GB)
if [ -d "src-tauri/target" ]; then
  echo "  Removing src-tauri/target/ (Rust build artifacts)"
  rm -rf src-tauri/target
fi

# Tauri codegen
rm -rf src-tauri/gen src-tauri/bundle src-tauri/.cargo src-tauri/.tauri 2>/dev/null || true

# Python oracle test caches
find tests -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find tests -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
rm -rf tests/oracle/.pytest_cache tests/oracle/__pycache__ 2>/dev/null || true

# OS junk
find . -name ".DS_Store" -delete 2>/dev/null || true
find . -name "Thumbs.db" -delete 2>/dev/null || true

# Editor / IDE caches
rm -rf .idea 2>/dev/null || true

# Log files
find . -maxdepth 2 -name "*.log" -delete 2>/dev/null || true

echo ""
echo "Done. To rebuild:"
echo "  npm install"
echo "  npm run tauri dev"
