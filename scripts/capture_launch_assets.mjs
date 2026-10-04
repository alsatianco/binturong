// Capture the unchanged desktop frontend with synthetic data and real CLI outputs.
// See docs/assets/README.md for prerequisites and the capture's limits.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaRequire = createRequire(path.join(process.env.BINTURONG_MEDIA_DIR ?? '/tmp/binturong-media', 'package.json'));
const { chromium } = mediaRequire('playwright');
const cli = process.env.BINTURONG_CLI ?? path.join(root, 'src-tauri/target/debug/binturong-cli');
const assetDir = path.join(root, 'docs/assets');
await mkdir(assetDir, { recursive: true });
const sample = '{"service":"orders","environment":"local","retries":3}';
const tools = execFileSync(cli, ['list'], { encoding: 'utf8' }).trim().split('\n').map(line => {
  const [id, name] = line.split('\t');
  return { id, name, chain_accepts: id === 'json-to-yaml' ? ['json', 'structuredText'] : ['plainText', 'structuredText'], chain_produces: id === 'json-format' ? 'json' : 'structuredText', supports_batch: ['json-format', 'json-to-yaml'].includes(id) };
});
// Only the two demonstrated tools use compatibility metadata in this capture.
const formatterIds = new Set(['json-format', 'json-stringify', 'url', 'base64', 'html-beautify', 'css-beautify', 'yaml-format']);
const chains = [];
const settings = [];
let chainId = 0;
const bridge = async (_source, command, payload = {}) => {
  if (command === 'list_tools') return tools;
  if (command === 'list_tool_catalog') return tools.map(t => ({ id: t.id, name: t.name, executionKind: formatterIds.has(t.id) ? 'formatter' : 'converter' }));
  if (command === 'ranked_search_tools') {
    const query = String(payload.query ?? '').toLowerCase();
    return tools.filter(t => `${t.id} ${t.name}`.toLowerCase().includes(query));
  }
  if (command === 'run_formatter_tool' || command === 'run_converter_tool') {
    return execFileSync(cli, ['run', '--tool', payload.toolId, '--format', payload.mode ?? 'format', '--indent', String(payload.indentSize ?? 2)], { input: payload.input, encoding: 'utf8' });
  }
  if (command === 'get_app_version') return execFileSync(cli, ['--version'], { encoding: 'utf8' }).trim().split(' ')[1];
  if (command === 'get_lifecycle_bootstrap') return { coldStartMs: 0, recoveredAfterUncleanShutdown: false };
  if (command === 'get_database_status') return { dbPath: 'capture session (memory)', currentSchemaVersion: 1, latestSchemaVersion: 1, appliedMigrationsOnBoot: [] };
  if (command === 'get_storage_model_counts') return { settingsCount: settings.length, favoritesCount: 0, recentsCount: 0, presetsCount: 0, historyCount: 0, chainsCount: chains.length };
  if (command === 'list_settings') return settings;
  if (command === 'upsert_setting') { settings.push(payload); return payload; }
  if (command === 'list_chains') return chains;
  if (command === 'save_chain') {
    const record = { ...payload, id: payload.id ?? ++chainId, createdAtUnix: 0, updatedAtUnix: 0 };
    const index = chains.findIndex(c => c.id === record.id);
    if (index < 0) chains.push(record); else chains[index] = record;
    return record;
  }
  if (command === 'configure_quick_launcher_shortcut') return { enabled: false, shortcut: payload.shortcut };
  if (command === 'append_tool_history') return { ...payload, id: 1, createdAtUnix: Math.floor(Date.now() / 1000) };
  if (command.startsWith('list_') || command === 'compatible_tool_targets') return [];
  if (command === 'plugin:event|listen') return 1;
  return null;
};
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1120 }, colorScheme: 'dark', recordVideo: { dir: path.join(assetDir, 'raw'), size: { width: 1360, height: 1120 } } });
  await context.exposeBinding('captureInvoke', bridge);
  await context.addInitScript(() => {
    window.__TAURI_INTERNALS__ = {
      invoke: (command, payload) => window.captureInvoke(command, payload),
      transformCallback: () => 1,
      unregisterCallback: () => {},
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  });
  const page = await context.newPage();
  const hold = async (label, seconds = 5) => {
    console.log(`Showing ${label} for ${seconds}s`);
    await page.waitForTimeout(seconds * 1000);
  };
  await page.goto(process.env.BINTURONG_CAPTURE_URL ?? 'http://127.0.0.1:1421');
  await page.getByRole('heading', { name: 'What do you have?', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await hold('Home dashboard', 10);
  await page.screenshot({ path: path.join(assetDir, 'home.png') });
  await page.getByRole('button', { name: 'JSON Format/Validate', exact: true }).first().click();
  await hold('the JSON workspace');
  await page.getByRole('textbox', { name: 'Input text' }).fill(sample);
  await hold('the JSON input');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await page.getByRole('textbox', { name: 'Output text' }).filter({ hasText: '' }).first().waitFor();
  await hold('the formatted JSON result', 10);
  await page.screenshot({ path: path.join(assetDir, 'json-format.png') });
  await page.keyboard.press('Meta+k');
  await hold('the command palette');
  await page.getByRole('button', { name: 'actions', exact: true }).click();
  await hold('the Actions list');
  await page.getByText('Open Pipeline Builder', { exact: true }).click();
  const pipeline = page.getByRole('dialog', { name: 'Pipeline builder' });
  await hold('Pipeline Builder');
  await pipeline.getByPlaceholder('Paste source input for step 1').fill(sample);
  await hold('the pipeline input');
  await pipeline.getByRole('button', { name: '+ Add Step', exact: true }).click();
  await hold('the new pipeline step');
  await pipeline.getByRole('button').filter({ hasText: 'Change' }).last().click();
  await hold('the step tool selector');
  await pipeline.getByPlaceholder('Search tools...').fill('JSON to YAML');
  await hold('the matching YAML converter');
  await pipeline.locator('[data-pipeline-tool-item]').filter({ hasText: 'JSON to YAML' }).click();
  await hold('the configured two-step pipeline');
  await pipeline.getByRole('button', { name: 'Run Pipeline (Cmd/Ctrl+Enter)', exact: true }).click();
  await pipeline.getByText('environment: local', { exact: false }).waitFor();
  await hold('both pipeline outputs', 10);
  await pipeline.getByRole('button', { name: 'Save as new chain', exact: true }).click();
  const nameDialog = page.getByRole('dialog', { name: 'Chain name', exact: true });
  await nameDialog.getByRole('textbox', { name: 'Chain name', exact: true }).fill('JSON to YAML');
  await hold('the save-chain name dialog');
  await nameDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  const descriptionDialog = page.getByRole('dialog', { name: 'Description (optional)', exact: true });
  await hold('the optional chain description');
  await descriptionDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await pipeline.getByText('JSON to YAML', { exact: true }).last().waitFor();
  await hold('the saved chain and final YAML', 10);
  await page.screenshot({ path: path.join(assetDir, 'pipeline.png') });
  const videoPath = await page.video().path();
  await context.close();
  execFileSync('ffmpeg', ['-y', '-i', videoPath, '-vf', 'fps=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '25', '-movflags', '+faststart', path.join(assetDir, 'workflow.mp4')], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-i', path.join(assetDir, 'workflow.mp4'), '-vf', 'fps=2,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer', '-loop', '0', path.join(assetDir, 'workflow.gif')], { stdio: 'ignore' });
  // Compose existing mascot and captured UI in HTML; no generated product artwork.
  const ui = (await readFile(path.join(assetDir, 'home.png'))).toString('base64');
  const mascot = (await readFile(path.join(root, 'public/branding/logo.png'))).toString('base64');
  const social = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await social.setContent(`<html><style>body{margin:0;background:#101820;color:#f4f6f8;font-family:Arial,sans-serif}.copy{position:absolute;left:55px;top:48px;width:440px}.mascot{width:108px;height:108px;object-fit:contain}h1{font-size:57px;letter-spacing:-2px;margin:18px 0}p{font-size:29px;line-height:1.3;color:#c5d5df}small{font-size:19px;color:#7ccbc3}.ui{position:absolute;left:520px;top:62px;width:870px;border:1px solid #3f545e;border-radius:12px;box-shadow:0 15px 50px #0008}</style><div class="copy"><img class="mascot" src="data:image/png;base64,${mascot}"><h1>Binturong</h1><p>Everyday developer tools,<br>together on your desktop.</p><small>macOS · Windows · Linux<br><br>Free and open source · MIT</small></div><img class="ui" src="data:image/png;base64,${ui}"></html>`);
  await social.screenshot({ path: path.join(assetDir, 'social-preview.png') });
  await writeFile(path.join(assetDir, 'sample.json'), sample + '\n');
  console.log(`Captured ${tools.length} registered tools; assets in ${assetDir}`);
} finally {
  await browser.close();
}
