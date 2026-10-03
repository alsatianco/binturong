# Privacy and data retention

Checked against v0.1.2 source on October 3, 2026. This is an implementation
description, not a security audit.

## Local processing and network use

The desktop tools and CLI process input locally. No analytics or telemetry
integration is present in the current application source. Automatic update
checks and installation are disabled; **View releases and downloads** opens
GitHub in your browser.

Installing Tesseract invokes the supported system package manager and may require
administrator permission and network downloads. Downloading OCR languages uses
the Tesseract project's `tessdata_best` repository. See [dependency setup](tool-dependencies.md).
Opening website, repository, author, or support links uses your browser; those
sites have their own data handling. Local processing does not protect data from
other software, other users with access to your files, or backups.

## What is retained

The app's `binturong.sqlite3` database stores settings, favorites, recents,
presets, tool history, and saved chains. Find its actual path in
**Settings → Diagnostics → Database location**. It is a normal SQLite database,
without application-level encryption.

Tool history stores input snapshots, options, and results, including some error
results. It keeps the newest 20 entries per tool; there is no timed expiry.
AES passphrases are redacted from the history snapshot, but the plaintext input
or decrypted output can still be recorded. There is no control to turn history
recording off. **Remember last input** is a separate setting and does not prevent
history recording.

Saved chains contain the pipeline input and step IDs. They remain until deleted.
User-data exports include settings, favorites, recents, presets, history, and
chains. Treat exported files and shared saved-chain data as potentially sensitive.

## Detection and clipboard

Home and the command palette's **detect** field analyze text you enter. The
palette suggests up to three matching tools; selecting a suggestion opens a
tool. The app does not continuously watch the clipboard or retain clipboard
history. Copy and auto-copy actions place output on the system clipboard, where
other applications or an operating-system clipboard manager may retain it.

## Clear stored data

- Use **Clear tool history** beneath the workspace for the current tool, or
  **Clear all history** for all tools. The command palette has corresponding actions.
- Delete a saved chain from Pipeline Builder using its **Delete** control.
- Clearing the active input/output does not clear already recorded history.
- To reset all database-backed data, quit the app and delete the database at the
  displayed location, plus its `-wal` and `-shm` companions if present. This removes
  settings, favorites, recents, presets, history, and chains together. Also remove
  exported files you no longer need. Downloaded OCR models are separate from this database.

These controls delete application records; they do not promise forensic erasure
from SQLite pages, storage media, backups, or the system clipboard.

Implementation: [database and retention](../src-tauri/src/db.rs),
[history snapshots](../src/hooks/useToolExecution.ts),
[detection](../src/hooks/useClipboardDetection.ts), and
[dependency installation](../src-tauri/src/dependencies.rs).
