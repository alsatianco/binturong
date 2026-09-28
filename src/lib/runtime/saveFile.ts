import { isTauri } from "@tauri-apps/api/core";
import { downloadDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

/** Save through the native dialog in desktop builds, or a browser download in preview. */
export async function saveFile(blob: Blob, fileName: string, extension: string): Promise<boolean> {
  if (isTauri()) {
    let defaultPath = fileName;
    try {
      defaultPath = await join(await downloadDir(), fileName);
    } catch {
      // The platform may not have a configured Downloads directory.
    }
    const path = await save({
      defaultPath,
      filters: [{ name: `${extension.toUpperCase()} file`, extensions: [extension] }],
    });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser may still be reading the blob after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return true;
}
