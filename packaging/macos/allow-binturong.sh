#!/bin/bash
# Run only after installing a trusted Binturong download.
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'This script is for macOS.' >&2; exit 1; }
app="${1:-/Applications/Binturong.app}"
[[ "$app" = /* && -d "$app" && ! -L "$app" ]] || {
  echo 'Pass the absolute path to your installed Binturong.app.' >&2; exit 1;
}
identifier=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Contents/Info.plist")
[[ "$identifier" == com.binturong.app ]] || { echo 'This is not Binturong.' >&2; exit 1; }
# Remove only download quarantine; preserve other extended attributes.
/usr/bin/xattr -dr com.apple.quarantine "$app"
echo "Done. Open $app normally."
