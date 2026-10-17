Binturong for Windows x64 - portable download

Extract the entire ZIP to a folder of your choice, then open binturong.exe.
No Binturong installation or administrator privileges are needed. Keep the
included files together; do not run the app from inside the ZIP viewer.

The GUI requires Microsoft Edge WebView2 Runtime. If it is missing, install
the Evergreen Runtime for x64 from Microsoft:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/
The portable ZIP does not install or bundle WebView2.

To use the CLI, open PowerShell in the extracted folder:
  .\binturong-cli.exe --version
  .\binturong-cli.exe list
  '{"hello":"world"}' | .\binturong-cli.exe run --tool json-to-yaml

Settings, saved chains, history, and WebView2 data use the normal Windows
user profile locations, shared with an installed copy of Binturong. This
download makes the executables portable; user data stays on each computer.
Close Binturong before replacing or deleting its extracted folder. Deleting
the folder does not remove saved user data. Updates are downloaded manually
from https://github.com/alsatianco/binturong/releases/latest

Windows builds currently have no publisher signature, so Windows may show
an unknown-publisher warning. OCR requires a separate Tesseract installation.
