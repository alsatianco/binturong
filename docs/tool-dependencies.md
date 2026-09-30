# Tool dependencies

The tool audit found one external executable: **Tesseract OCR**, used by Image to Text Converter. Its language models are also downloaded separately. Word-to-Markdown uses the bundled Rust ZIP/XML conversion code; it does not require Word, LibreOffice, Pandoc, or another installation. Image conversion, QR scanning, SVG rendering, cryptography, and SQLite use libraries bundled with Binturong.

## In the app

Open **Settings → Tool dependencies**. The page shows availability, the resolved executable path, download size estimates, installation progress/errors, and the settings file location.

- **Download & configure** installs Tesseract through an existing supported package manager and saves the detected executable path after verifying it.
- **Save path** validates a custom absolute path before saving. No shell syntax or command-line arguments are accepted in the path field.
- **Auto-detect** clears the saved override and searches the environment and standard installation folders.
- **Installation instructions** opens <https://play.alsatian.co/software/binturong.html>.

When OCR cannot find or run Tesseract, a dialog offers the dependency manager, manual instructions, or dismissal. Input remains in the tool; run it again after installation. Ordinary input errors do not open this dialog.

Installation continues when Settings is closed. Keep Binturong open until it finishes. Failed installs can be retried; detailed package-manager output is written to `dependency-install.log` beside `tool-dependencies.json` in the app data directory. The app does not install a package manager itself.

## Supported automatic installers

| Platform | Prerequisite | Package |
| --- | --- | --- |
| macOS | Homebrew | `tesseract` |
| Windows | WinGet | `UB-Mannheim.TesseractOCR` |
| Debian/Ubuntu | APT and a working Polkit authentication agent | `tesseract-ocr`, `tesseract-ocr-eng` |
| Fedora | DNF and a working Polkit authentication agent | `tesseract`, `tesseract-langpack-eng` |
| Arch | Pacman and a working Polkit authentication agent | `tesseract`, `tesseract-data-eng` |

These are system package installations. Windows or Linux may display an administrator prompt. WinGet uses its noninteractive installation options and accepts package/source agreements; the Settings page identifies this before installation. Package-manager integrity checks remain enabled. Downloads are estimated at 30–150 MB; actual size depends on the platform and already-installed libraries, and may exceed that estimate.

## Manual installation instructions (website copy)

On macOS, run `brew install tesseract` in Terminal after installing Homebrew, or use the installation options in the [Tesseract documentation](https://tesseract-ocr.github.io/tessdoc/Installation.html).

On Windows, use the installer linked by Tesseract's documentation, or run `winget install --id UB-Mannheim.TesseractOCR --exact --source winget`. See Microsoft's [WinGet install documentation](https://learn.microsoft.com/en-us/windows/package-manager/winget/install) for options.

On Debian/Ubuntu, run `sudo apt-get install tesseract-ocr tesseract-ocr-eng`. On Fedora, run `sudo dnf install tesseract tesseract-langpack-eng`. On Arch, run `sudo pacman -S tesseract tesseract-data-eng`.

Return to Settings → Tool dependencies and select **Refresh status**. If detection fails, enter the full executable path, such as `/opt/homebrew/bin/tesseract`, `/usr/local/bin/tesseract`, `/usr/bin/tesseract`, or `C:\Program Files\Tesseract-OCR\tesseract.exe`, and select **Save path**. No app restart is required.

## Language models and CLI

The OCR file picker downloads missing selected languages on Run and caches them for offline use. The UI estimates roughly 2–50 MB per language. The language-data directory is shown in Settings; `BINTURONG_TESSDATA_DIR` can override it. Models come from the Tesseract project's `tessdata_best` repository. A failed write does not leave a partially downloaded model at its final path.

The desktop uses its saved executable override first, then `BINTURONG_TESSERACT_PATH`, then PATH and standard installation folders. The CLI uses `BINTURONG_TESSERACT_PATH` or automatic detection; desktop settings are not loaded by the CLI. In raw OCR JSON inputs, `downloadMissingLanguage: true` permits language downloads. With downloads disabled, complete cached language sets are reused, otherwise Tesseract uses its installed language data.

## Validation

Automated coverage includes structured dependency errors, executable validation and saved-path use in OCR, unsupported installers and UI error states, background progress after reopening Settings, and DOCX/image file pickers and drops. Package-manager commands require live checks on their respective operating systems; tests do not install software on the test machine.
