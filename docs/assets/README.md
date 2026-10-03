# Launch assets

Captured October 3, 2026 for Binturong v0.1.2 using synthetic order-service data.

- [JSON screenshot](json-format.png): format a compact API/configuration object.
- [Pipeline screenshot](pipeline.png): JSON Format/Validate → JSON to YAML Converter, saved as a chain.
- [README GIF](workflow.gif) and [MP4](workflow.mp4): the same roughly 15-second workflow.
- [Social preview](social-preview.png): 1280 × 640, existing mascot plus the actual frontend capture.
- [Sample input](sample.json): synthetic data used in the captures.

The frontend source matches release tag `v0.1.2`. Captures run that React UI in
Chromium with a temporary Tauri bridge. Processing calls execute the local
`binturong-cli` v0.1.2 binary; settings and saved chains use session memory. These
assets show the shipped controls and real tool output. They do not verify native
window behavior, SQLite persistence, installers, or operating-system integration.
Only the demonstrated tools' compatibility and batch metadata are supplied by
the capture bridge; the full catalog's names come from `binturong-cli list`.

To reproduce, use Node.js, ffmpeg, a built v0.1.2 CLI, and a separate temporary
Playwright installation. Keep media dependencies outside the app package:

```bash
npm install --prefix /tmp/binturong-media playwright
/tmp/binturong-media/node_modules/.bin/playwright install chromium
npm run dev -- --host 127.0.0.1
```

In another terminal, from the project root:

```bash
node scripts/capture_launch_assets.mjs
```

`BINTURONG_MEDIA_DIR`, `BINTURONG_CLI`, and `BINTURONG_CAPTURE_URL` override the
temporary dependency directory, executable, and frontend URL. Raw video files
are ignored. Review the generated images and demo before committing refreshed
assets. The [branding guide](../branding.md) records the mascot's provenance.
