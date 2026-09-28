// Build the CLI under the target-triple filename Tauri expects for sidecars.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = path.join(root, 'src-tauri/Cargo.toml');
const targetDir = process.env.CARGO_TARGET_DIR
  ? path.resolve(root, process.env.CARGO_TARGET_DIR)
  : path.join(root, 'src-tauri/target');
const hostTriple = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)?.[1];
const triple = process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple;
if (!triple) throw new Error('Could not determine the Rust target triple');

const profile = process.argv.includes('--debug') || process.env.TAURI_ENV_DEBUG === 'true'
  ? 'debug' : 'release';
const extension = triple.includes('windows') ? '.exe' : '';
const output = path.join(root, 'src-tauri/binaries', `binturong-cli-${triple}${extension}`);
mkdirSync(path.dirname(output), { recursive: true });

function build(target) {
  const staged = path.join(root, 'src-tauri/binaries', `binturong-cli-${target}${extension}`);
  const args = ['build', '--locked', '--manifest-path', manifest, '--bin', 'binturong-cli'];
  const explicitTarget = target !== hostTriple || triple === 'universal-apple-darwin';
  if (explicitTarget) args.push('--target', target);
  if (profile === 'release') args.push('--release');
  // The CLI depends on the same Tauri library as the GUI. Disable the sidecar
  // check for this bootstrap build; the GUI build sees the staged binary.
  const config = JSON.parse(process.env.TAURI_CONFIG || '{}');
  config.bundle = { ...config.bundle, externalBin: [] };
  execFileSync('cargo', args, {
    stdio: 'inherit',
    env: { ...process.env, CARGO_TARGET_DIR: targetDir, TAURI_CONFIG: JSON.stringify(config) },
  });
  const binary = path.join(targetDir, explicitTarget ? target : '', profile, `binturong-cli${extension}`);
  copyFileSync(binary, staged);
  return binary;
}

if (triple === 'universal-apple-darwin') {
  const binaries = ['aarch64-apple-darwin', 'x86_64-apple-darwin'].map(build);
  execFileSync('lipo', ['-create', '-output', output, ...binaries], { stdio: 'inherit' });
  execFileSync('lipo', [output, '-verify_arch', 'arm64', 'x86_64'], { stdio: 'inherit' });
} else {
  build(triple);
}
