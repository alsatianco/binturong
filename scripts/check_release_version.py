#!/usr/bin/env python3
"""Fail before building if release metadata or a pushed tag disagree."""
import json
import os
from pathlib import Path
import re
import tomllib

root = Path(__file__).resolve().parents[1]

def read_json(path):
    return json.loads((root / path).read_text())

version = read_json('package.json')['version']
lock = read_json('package-lock.json')
cargo = tomllib.loads((root / 'src-tauri/Cargo.toml').read_text())
cargo_lock = tomllib.loads((root / 'src-tauri/Cargo.lock').read_text())
versions = {
    'package-lock.json': lock['version'],
    'package-lock.json root': lock['packages']['']['version'],
    'tauri.conf.json': read_json('src-tauri/tauri.conf.json')['version'],
    'Cargo.toml': cargo['package']['version'],
    'Cargo.lock': next(p['version'] for p in cargo_lock['package'] if p['name'] == 'binturong'),
}
# Keep release names deliberately narrow and compatible with all installer formats.
if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta|rc)\.[1-9]\d*)?', version):
    raise SystemExit(f'Unsupported release version: {version}')
for source, actual in versions.items():
    if actual != version:
        raise SystemExit(f'{source}: {actual} differs from package.json: {version}')
if os.environ.get('GITHUB_REF_TYPE') == 'tag':
    tag = os.environ['GITHUB_REF_NAME']
    if tag != f'v{version}':
        raise SystemExit(f'Tag {tag} must match v{version}')
print(f'Release version: {version}')
if output := os.environ.get('GITHUB_OUTPUT'):
    with open(output, 'a') as stream:
        stream.write(f'version={version}\nprerelease={str("-" in version).lower()}\n')
