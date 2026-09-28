Binturong for macOS (Apple Silicon and Intel)

1. Open the included DMG and drag Binturong to Applications.
2. Eject the DMG and open Binturong from Applications.
   The CLI is included at /Applications/Binturong.app/Contents/MacOS/binturong-cli.
   Run it from Terminal with that full path, or link it into a directory on PATH.
3. If macOS blocks this unnotarized download, and you trust its source,
   open Terminal, type `bash `, drag allow-binturong.sh into Terminal,
   then press Return. Or run from this extracted directory:

   bash ./allow-binturong.sh

For a custom installation path:
   bash ./allow-binturong.sh "$HOME/Applications/Binturong.app"

The script removes only com.apple.quarantine from the installed Binturong
bundle. It does not disable Gatekeeper globally or require sudo.
Source and releases: https://github.com/alsatianco/binturong
