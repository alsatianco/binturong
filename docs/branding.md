# Branding assets

The selected identity is the user-supplied `main-logo-b.png`: a charcoal and ivory binturong with cyan accents. Its colors and tilted face match the supplied desktop artwork. Version A is an unused alternative.

## Sources and usage

| Committed asset | Source | Use |
| --- | --- | --- |
| `public/branding/logo.png` | `main-logo-b.png` | About screen, README, color tray icon, favicon |
| `src-tauri/icons/desktop-source.png` | `desktop-icon.png` | Desktop icon and generated platform variants |
| `src-tauri/icons/tray-source.png` | `tray-icon.png` | Monochrome macOS menu bar template |

All three source PNGs are 1254 × 1254 with alpha transparency. They are user-provided AI artwork, not Tauri template assets. Runtime assets are committed outside `_tmp`; the app does not depend on that directory.

The macOS tray uses a 44 × 44 template image, allowing the operating system to choose its color. Windows and Linux use the 32 × 32 color head for contrast across panel themes. The favicon uses the head rather than the more detailed full-body desktop artwork.

## Regeneration

From the repository root, generate the platform icon family with the installed Tauri CLI:

```sh
npm run tauri -- icon src-tauri/icons/desktop-source.png --output src-tauri/icons
```

On macOS, regenerate the small PNG exports using the built-in image utility:

```sh
sips -z 44 44 src-tauri/icons/tray-source.png --out src-tauri/icons/tray-template.png
sips -z 32 32 public/branding/logo.png --out src-tauri/icons/tray-color.png
sips -z 32 32 public/branding/logo.png --out public/favicon-32.png
sips -z 16 16 public/branding/logo.png --out public/favicon-16.png
```

These are raster originals; there is no vector master. Inspect small exports at actual size when replacing the artwork. The desktop illustration has more detail than the small head and tray variants, so use those dedicated variants for compact placements.
