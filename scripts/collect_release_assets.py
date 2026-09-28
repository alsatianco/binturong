#!/usr/bin/env python3
"""Collect every expected installer and make the Mac download kit."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('platform', choices=['macos', 'linux', 'windows'])
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
out = root / 'release-files'
out.mkdir(exist_ok=True)
target = root / 'src-tauri/target'
if args.platform == 'macos':
    target /= 'universal-apple-darwin'
patterns = {'macos': ['dmg/*.dmg'], 'linux': ['appimage/*.AppImage', 'deb/*.deb', 'rpm/*.rpm'],
            'windows': ['msi/*.msi', 'nsis/*.exe']}[args.platform]
for pattern in patterns:
    files = list((target / 'release/bundle').glob(pattern))
    if len(files) != 1:
        raise SystemExit(f'Expected exactly one {pattern}, found {len(files)}')
    shutil.copy2(files[0], out / files[0].name)
if args.platform == 'linux':
    deb = next(out.glob('*.deb'))
    contents = subprocess.check_output(['dpkg-deb', '--contents', str(deb)], text=True)
    if not any(line.endswith('/binturong-cli') for line in contents.splitlines()):
        raise SystemExit(f'Missing CLI from Debian package: {deb}')
if args.platform == 'windows':
    wix_source = target / 'release/wix/x64/main.wxs'
    if not wix_source.is_file() or 'binturong-cli.exe' not in wix_source.read_text():
        raise SystemExit('Missing CLI from Windows MSI manifest')
if args.platform == 'macos':
    dmg = out / f'Binturong_{version}_universal.dmg'
    if not dmg.is_file():
        raise SystemExit(f'Missing expected Homebrew asset: {dmg.name}')
    # Tauri deletes the temporary .app after packaging the DMG. Inspect the
    # shipped image so the check covers the actual downloadable installer.
    with tempfile.TemporaryDirectory(prefix='binturong-dmg-') as mount_dir:
        subprocess.run(['hdiutil', 'attach', '-readonly', '-nobrowse', '-quiet',
                        '-mountpoint', mount_dir, str(dmg)], check=True)
        try:
            cli = Path(mount_dir) / 'Binturong.app/Contents/MacOS/binturong-cli'
            if not cli.is_file():
                raise SystemExit(f'Missing CLI from macOS DMG: {cli}')
            architectures = set(subprocess.check_output(['lipo', '-archs', str(cli)], text=True).split())
            if architectures != {'arm64', 'x86_64'}:
                raise SystemExit(f'CLI must be universal, found: {sorted(architectures)}')
        finally:
            subprocess.run(['hdiutil', 'detach', '-quiet', mount_dir], check=True)
    helper = root / 'packaging/macos/allow-binturong.sh'
    shutil.copy2(helper, out / helper.name)
    with zipfile.ZipFile(out / f'Binturong_{version}_macos-universal.zip', 'w', zipfile.ZIP_DEFLATED) as kit:
        for file in [dmg, helper, root / 'packaging/macos/README.txt']:
            kit.write(file, f'Binturong-{version}/{file.name}')
