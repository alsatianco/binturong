/** Recognize an SVG document with or without its optional XML declaration. */
export function isSvgDocument(value: string): boolean {
  return /^\s*(?:<\?xml[^>]*\?>\s*)?<svg(?:\s|>)/i.test(value);
}
