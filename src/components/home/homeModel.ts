export const PREVIEW_BYTES = 64 * 1024;
export type HomeTool = {
  id: string;
  name: string;
  aliases?: string[];
  keywords?: string[];
};
export type HomeFile = {
  name: string;
  input: string;
  kind: "text" | "image" | "document";
  extension: string;
};
export type Match = {
  toolId: string;
  toolName: string;
  confidence: number;
  reason: string;
};
export type Recent = {
  toolId: string;
  lastUsedAtUnix: number;
  useCount: number;
};
export const POPULAR = [
  "json-format",
  "jwt-debugger",
  "base64",
  "unix-time",
  "url",
  "text-diff",
  "regex-tester",
  "uuid-ulid",
];
export const EXAMPLES = [
  [
    "JSON",
    '{"order":{"id":10482,"status":"paid","items":[{"sku":"BT-01","qty":2}],"total":84.5}}',
  ],
  [
    "JWT token",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzQyIiwibmFtZSI6IkFkYSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTgyMjAwMDAwMH0.c2lnbmF0dXJl",
  ],
  ["Unix timestamp", "1759150800"],
  ["URL", "https://shop.example.com/search?q=binturong+plush&page=2#reviews"],
  ["Cron expression", "30 9 * * 1-5"],
  ["Color", "#3f7ab5"],
  [
    "SQL",
    "select id, email from users where active = 1 order by email limit 20",
  ],
  ["Base64", "QmludHVyb25nIHJ1bnMgZXZlcnl0aGluZyBsb2NhbGx5Lg=="],
];

/** Work on a bounded prefix even when the original string is many megabytes. */
export function previewPrefix(input: string): string {
  let prefix = input.slice(0, PREVIEW_BYTES);
  if (prefix.length < input.length && /[\uD800-\uDBFF]$/.test(prefix))
    prefix = prefix.slice(0, -1);
  const bytes = new TextEncoder().encode(prefix);
  let end = Math.min(bytes.length, PREVIEW_BYTES);
  // If the cut lands inside a UTF-8 character, exclude the whole character.
  while (end < bytes.length && end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return new TextDecoder().decode(bytes.slice(0, end));
}
export function relativeTime(unix: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor(now / 1000 - unix));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
export function fileMatches(file: HomeFile, tools: HomeTool[]): Match[] {
  const conversion = (
    {
      jpg: "jpg-to-png-converter",
      jpeg: "jpg-to-png-converter",
      png: "png-to-jpg-converter",
      webp: "webp-to-png-converter",
      gif: "base64-image",
      svg: "svg-to-png-converter",
    } as Record<string, string>
  )[file.extension];
  const ids =
    file.kind === "document"
      ? ["word-to-markdown"]
      : [conversion, "image-to-text-converter", "qr-code"].filter(Boolean);
  return ids.flatMap((id) => {
    const tool = tools.find((tool) => tool.id === id);
    return tool
      ? [
          {
            toolId: id,
            toolName: tool.name,
            confidence: 100,
            reason:
              file.kind === "document"
                ? "This is a Word document (.docx)."
                : `This is a ${file.extension.toUpperCase()} image.`,
          },
        ]
      : [];
  });
}
export function previewMode(toolId: string): "format" | "minify" {
  return [
    "base64",
    "url",
    "html-entity",
    "backslash-escape",
    "quote-helper",
    "utf8",
    "binary-code",
    "morse-code",
    "uuid-ulid",
    "qr-code",
  ].includes(toolId)
    ? "minify"
    : "format";
}
export function contentLabel(toolId: string): string {
  return (
    (
      {
        "json-format": "JSON",
        "jwt-debugger": "a JWT token",
        "unix-time": "a Unix timestamp",
        "url-parser": "a URL",
        url: "a URL-encoded string",
        "cron-parser": "a cron expression",
        "color-converter": "a color",
        "sql-format": "SQL",
        base64: "Base64 text",
        "html-beautify": "HTML",
        "html-preview": "HTML",
        "yaml-to-json": "YAML",
        "yaml-format": "YAML",
        "xml-format": "XML",
        "cert-decoder": "a certificate",
      } as Record<string, string>
    )[toolId] ?? "text this tool can work with"
  );
}

export async function readBrowserFile(file: File): Promise<HomeFile> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a file smaller than 20 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      bmp: "image/bmp",
      tif: "image/tiff",
      tiff: "image/tiff",
      svg: "image/svg+xml",
    } as Record<string, string>
  )[extension];
  if (extension === "docx" || mime) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
    return {
      name: file.name,
      extension,
      kind: mime ? "image" : "document",
      input: mime
        ? `IMAGE_BASE64:${mime};base64,${data}`
        : `DOCX_BASE64:${data}`,
    };
  }
  const input = new TextDecoder("utf-8", { fatal: true }).decode(
    await file.arrayBuffer(),
  );
  if (input.includes("\0"))
    throw new Error("This file appears to contain binary data.");
  return { name: file.name, extension, kind: "text", input };
}
