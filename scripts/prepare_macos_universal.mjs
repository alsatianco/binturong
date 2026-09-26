// Tauri merges the main executable, but its bundler also expects Cargo's other
// binaries. Merge those before packaging so every bundled executable is universal.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.env.TAURI_ENV_TARGET_TRIPLE === 'universal-apple-darwin') {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const profile = process.env.TAURI_ENV_DEBUG === 'true' ? 'debug' : 'release';
  const target = process.env.CARGO_TARGET_DIR
    ? path.resolve(root, process.env.CARGO_TARGET_DIR)
    : path.join(root, 'src-tauri/target');
  const output = path.join(target, 'universal-apple-darwin', profile);
  mkdirSync(output, { recursive: true });
  for (const entry of readdirSync(path.join(root, 'src-tauri/src/bin'))) {
    if (!entry.endsWith('.rs')) continue;
    const name = entry.slice(0, -3);
    execFileSync('lipo', ['-create', '-output', path.join(output, name),
      ...['aarch64-apple-darwin', 'x86_64-apple-darwin'].map(
        arch => path.join(target, arch, profile, name))], { stdio: 'inherit' });
    execFileSync('lipo', [path.join(output, name), '-verify_arch', 'arm64', 'x86_64'],
      { stdio: 'inherit' });
  }
}
