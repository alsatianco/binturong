#!/usr/bin/env python3
"""Collect every expected installer and make the Mac download kit."""
import argparse
import json
from pathlib import Path
import shutil
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
if args.platform == 'macos':
    dmg = out / f'Binturong_{version}_universal.dmg'
    if not dmg.is_file():
        raise SystemExit(f'Missing expected Homebrew asset: {dmg.name}')
    helper = root / 'packaging/macos/allow-binturong.sh'
    shutil.copy2(helper, out / helper.name)
    with zipfile.ZipFile(out / f'Binturong_{version}_macos-universal.zip', 'w', zipfile.ZIP_DEFLATED) as kit:
        for file in [dmg, helper, root / 'packaging/macos/README.txt']:
            kit.write(file, f'Binturong-{version}/{file.name}')
