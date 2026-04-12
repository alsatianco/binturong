export type TemplateId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M";

export type ButtonConfig = {
  label: string;
  /** For formatter tools: "format" or "minify". For encode/decode: used as direction. */
  mode?: string;
  /** If true, this is the primary/default button */
  primary?: boolean;
};

export type ToolConfig = {
  id: string;
  template: TemplateId;
  description: string;
  buttons: ButtonConfig[];
  /** Placeholder text for main input */
  placeholder?: string;
  /** Whether to use monospaced font in input/output */
  mono?: boolean;
  /** For Template B: direction labels */
  directionLabels?: [string, string];
  /** For Template F: generator field definitions */
  generatorFields?: GeneratorField[];
  /** For Template K: multi-field definitions */
  multiFields?: MultiField[];
  /** For Template H: accepted file extensions */
  acceptedFiles?: string;
  /** For Template H: whether output is text (OCR, ASCII art) vs image */
  outputIsText?: boolean;
  /** For Template H: show OCR language selector dropdown */
  ocrLanguageSelect?: boolean;
  /** For Template B: extra input fields (slider, text) rendered below the main textarea */
  extras?: TemplateBExtra[];
};

export type GeneratorField = {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "checkbox";
  options?: string[];
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
};

export type MultiField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "checkboxes";
  placeholder?: string;
  options?: string[];
};

/** Extra input field rendered alongside the main textarea in Template B. */
export type TemplateBExtra = {
  key: string;
  label: string;
  type: "slider" | "text";
  placeholder?: string;
  min?: number;
  max?: number;
  defaultValue?: number | string;
  /** If true, the field value is included in a JSON wrapper around the main input
   *  (e.g. AES sends {"text":"...", "key":"..."} instead of plain text). */
  jsonWrap?: boolean;
};

// --- Template A: Format/Minify (13 tools) ---

const templateATools: ToolConfig[] = [
  { id: "json-format", template: "A", description: "Format, validate, and minify JSON. Paste messy JSON and get clean, indented output.", buttons: [{ label: "Format", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste JSON here", mono: true },
  { id: "html-beautify", template: "A", description: "Beautify or minify HTML markup. Clean up messy HTML into readable, indented code.", buttons: [{ label: "Beautify", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste HTML here", mono: true },
  { id: "css-beautify", template: "A", description: "Beautify or minify CSS. Format compressed stylesheets into readable code.", buttons: [{ label: "Beautify", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste CSS here", mono: true },
  { id: "scss-beautify", template: "A", description: "Beautify or minify SCSS. Format Sass stylesheets with proper indentation.", buttons: [{ label: "Beautify", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste SCSS here", mono: true },
  { id: "less-beautify", template: "A", description: "Beautify or minify LESS. Format LESS stylesheets with proper indentation.", buttons: [{ label: "Beautify", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste LESS here", mono: true },
  { id: "javascript-beautify", template: "A", description: "Beautify or minify JavaScript. Format compressed JS into readable code.", buttons: [{ label: "Beautify", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste JavaScript here", mono: true },
  { id: "typescript-beautify", template: "A", description: "Format TypeScript code. Clean up messy TS into well-indented output.", buttons: [{ label: "Format", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste TypeScript here", mono: true },
  { id: "graphql-format", template: "A", description: "Format GraphQL queries and schemas. Clean up messy GraphQL into readable structure.", buttons: [{ label: "Format", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste GraphQL here", mono: true },
  { id: "erb-format", template: "A", description: "Beautify or minify ERB templates. Format embedded Ruby HTML templates.", buttons: [{ label: "Beautify", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste ERB here", mono: true },
  { id: "xml-format", template: "A", description: "Beautify or minify XML. Format XML documents with proper indentation.", buttons: [{ label: "Beautify", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste XML here", mono: true },
  { id: "sql-format", template: "A", description: "Format and indent SQL queries. Turn one-line SQL into readable, indented statements.", buttons: [{ label: "Format", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste SQL here", mono: true },
  { id: "markdown-format", template: "A", description: "Format and clean up Markdown. Normalize spacing, headings, and list formatting.", buttons: [{ label: "Format", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste Markdown here", mono: true },
  { id: "yaml-format", template: "A", description: "Format and validate YAML. Clean up YAML with consistent indentation.", buttons: [{ label: "Format", mode: "format", primary: true }, { label: "Minify", mode: "minify" }], placeholder: "Paste YAML here", mono: true },
];

// --- Template B: Bidirectional Encode/Decode (14 tools) ---

const templateBTools: ToolConfig[] = [
  { id: "json-stringify", template: "B", description: "Stringify text for JSON embedding or parse a JSON string back to readable text.", buttons: [{ label: "Stringify", mode: "format", primary: true }, { label: "Unstringify", mode: "minify" }], placeholder: "Paste text to stringify", mono: true, directionLabels: ["Stringify", "Unstringify"] },
  { id: "url", template: "B", description: "Encode or decode percent-encoded URL strings. Handle special characters in URLs.", buttons: [{ label: "Encode", mode: "format", primary: true }, { label: "Decode", mode: "minify" }], placeholder: "Paste URL or text to encode", mono: true, directionLabels: ["Encode", "Decode"] },
  { id: "html-entity", template: "B", description: "Encode or decode HTML entities. Convert special characters to/from HTML-safe representations.", buttons: [{ label: "Encode", mode: "format", primary: true }, { label: "Decode", mode: "minify" }], placeholder: "Paste HTML or text", mono: true, directionLabels: ["Encode", "Decode"] },
  { id: "base64", template: "B", description: "Encode or decode Base64 strings. Convert text to Base64 or decode Base64 back to text.", buttons: [{ label: "Encode", mode: "format", primary: true }, { label: "Decode", mode: "minify" }], placeholder: "Paste text or Base64 string", mono: true, directionLabels: ["Encode", "Decode"] },
  { id: "base64-image", template: "M", description: "Encode images to Base64 data URIs or decode Base64 back to image data.", buttons: [{ label: "Encode", mode: "format", primary: true }, { label: "Decode", mode: "minify" }], placeholder: "Paste Base64 image data", mono: true, directionLabels: ["Encode", "Decode"] },
  { id: "backslash-escape", template: "B", description: "Escape or unescape backslash sequences (\\n, \\t, etc.). Useful for string literals.", buttons: [{ label: "Escape", mode: "format", primary: true }, { label: "Unescape", mode: "minify" }], placeholder: "Paste text with escape sequences", mono: true, directionLabels: ["Escape", "Unescape"] },
  { id: "quote-helper", template: "B", description: "Add or remove quotes (single, double, backtick) around text or each line. Escapes inner quotes.", buttons: [{ label: "Quote", mode: "format", primary: true }, { label: "Unquote", mode: "minify" }], placeholder: "Paste text to quote/unquote", mono: true, directionLabels: ["Quote", "Unquote"] },
  { id: "utf8", template: "B", description: "Encode text to UTF-8 byte representation or decode UTF-8 bytes back to text.", buttons: [{ label: "Encode", mode: "format", primary: true }, { label: "Decode", mode: "minify" }], placeholder: "Paste text or UTF-8 bytes", mono: true, directionLabels: ["Encode", "Decode"] },
  { id: "binary-code", template: "B", description: "Translate between text and binary representation. Convert characters to 0s and 1s.", buttons: [{ label: "Text to Binary", mode: "format", primary: true }, { label: "Binary to Text", mode: "minify" }], placeholder: "Paste text or binary", mono: true, directionLabels: ["Text to Binary", "Binary to Text"] },
  { id: "morse-code", template: "B", description: "Translate between text and Morse code. Dots and dashes for every letter.", buttons: [{ label: "Text to Morse", mode: "format", primary: true }, { label: "Morse to Text", mode: "minify" }], placeholder: "Paste text or Morse code", mono: true, directionLabels: ["Text to Morse", "Morse to Text"] },
  { id: "rot13", template: "B", description: "Apply ROT13 encoding. Shifts each letter by 13 positions. Self-inverse - apply twice to decode.", buttons: [{ label: "ROT13", mode: "format", primary: true }], placeholder: "Paste text", mono: true, directionLabels: ["ROT13", "ROT13"] },
  { id: "caesar-cipher", template: "B", description: "Encrypt or decrypt text with a Caesar cipher. Shift each letter by a configurable amount (1-25).", buttons: [{ label: "Encrypt", mode: "format", primary: true }, { label: "Decrypt", mode: "minify" }], placeholder: "Paste text to encrypt/decrypt", mono: true, directionLabels: ["Encrypt", "Decrypt"], extras: [{ key: "shift", label: "Shift", type: "slider", min: 1, max: 25, defaultValue: 3 }] },
  { id: "aes-encrypt", template: "B", description: "Encrypt or decrypt text using AES-256-GCM authenticated encryption with a passphrase.", buttons: [{ label: "Encrypt", mode: "format", primary: true }, { label: "Decrypt", mode: "minify" }], placeholder: "Paste text to encrypt or ciphertext to decrypt", mono: true, directionLabels: ["Encrypt", "Decrypt"], extras: [{ key: "key", label: "Passphrase", type: "text", placeholder: "Enter encryption key / passphrase", jsonWrap: true }] },
  { id: "hex-to-ascii", template: "B", description: "Convert hex strings to ASCII text or ASCII text back to hex representation.", buttons: [{ label: "Hex to ASCII", mode: "format", primary: true }, { label: "ASCII to Hex", mode: "minify" }], placeholder: "Paste hex string", mono: true, directionLabels: ["Hex to ASCII", "ASCII to Hex"] },
  { id: "ascii-to-hex", template: "B", description: "Convert ASCII text to hexadecimal representation.", buttons: [{ label: "ASCII to Hex", mode: "format", primary: true }, { label: "Hex to ASCII", mode: "minify" }], placeholder: "Paste ASCII text", mono: true, directionLabels: ["ASCII to Hex", "Hex to ASCII"] },
];

// --- Template C: One-Way Converter (15 tools) ---

const templateCTools: ToolConfig[] = [
  { id: "json-to-yaml", template: "C", description: "Convert JSON to YAML format. Paste JSON and get clean YAML output.", buttons: [{ label: "Convert to YAML", primary: true }], placeholder: "Paste JSON here", mono: true },
  { id: "yaml-to-json", template: "C", description: "Convert YAML to JSON format. Paste YAML and get structured JSON output.", buttons: [{ label: "Convert to JSON", primary: true }], placeholder: "Paste YAML here", mono: true },
  { id: "json-to-csv", template: "C", description: "Convert JSON arrays to CSV. Each object becomes a row, keys become column headers.", buttons: [{ label: "Convert to CSV", primary: true }], placeholder: "Paste JSON array here", mono: true },
  { id: "csv-to-json", template: "C", description: "Convert CSV data to JSON. Each row becomes a JSON object with header keys.", buttons: [{ label: "Convert to JSON", primary: true }], placeholder: "Paste CSV data here", mono: true },
  { id: "json-to-php", template: "C", description: "Convert JSON to PHP array syntax.", buttons: [{ label: "Convert to PHP", primary: true }], placeholder: "Paste JSON here", mono: true },
  { id: "php-to-json", template: "C", description: "Convert PHP array syntax to JSON.", buttons: [{ label: "Convert to JSON", primary: true }], placeholder: "Paste PHP array here", mono: true },
  { id: "php-serialize", template: "C", description: "Serialize JSON data to PHP serialized format.", buttons: [{ label: "Serialize", primary: true }], placeholder: "Paste JSON here", mono: true },
  { id: "php-unserialize", template: "C", description: "Unserialize PHP strings to readable JSON.", buttons: [{ label: "Unserialize", primary: true }], placeholder: "Paste PHP serialized string", mono: true },
  { id: "html-to-jsx", template: "C", description: "Convert HTML markup to JSX syntax. Handles class→className, for→htmlFor, and self-closing tags.", buttons: [{ label: "Convert to JSX", primary: true }], placeholder: "Paste HTML here", mono: true },
  { id: "html-to-markdown", template: "C", description: "Convert HTML to Markdown. Turns markup into clean, readable Markdown.", buttons: [{ label: "Convert to Markdown", primary: true }], placeholder: "Paste HTML here", mono: true },
  { id: "word-to-markdown", template: "H", description: "Convert .docx files to Markdown. Drop a Word document to generate clean Markdown.", buttons: [{ label: "Convert to Markdown", primary: true }], acceptedFiles: ".docx", outputIsText: true },
  { id: "svg-to-css", template: "C", description: "Convert inline SVG to a CSS background-image data URI. Embed SVG directly in CSS.", buttons: [{ label: "Convert to CSS", primary: true }], placeholder: "Paste SVG markup here", mono: true },
  { id: "curl-to-code", template: "C", description: "Convert cURL commands to code. Generates JavaScript fetch, Python requests, and more.", buttons: [{ label: "Convert to Code", primary: true }], placeholder: "Paste cURL command here", mono: true },
  { id: "json-to-code", template: "C", description: "Generate type/class definitions from JSON. Create TypeScript interfaces, Go structs, and more.", buttons: [{ label: "Generate Types", primary: true }], placeholder: "Paste JSON here", mono: true },
  { id: "query-string-to-json", template: "C", description: "Parse URL query strings into JSON objects. Extract key-value pairs from URLs.", buttons: [{ label: "Parse to JSON", primary: true }], placeholder: "Paste URL or query string", mono: true },
];

// --- Template D: Text Manipulation (22 tools) ---

const templateDTools: ToolConfig[] = [
  { id: "delimiter-converter", template: "D", description: "Convert between delimiter-separated lists. Switch between comma, tab, newline, pipe, and more.", buttons: [{ label: "Convert", primary: true }], placeholder: "Paste delimited list here" },
  { id: "number-base-converter", template: "D", description: "Convert numbers between binary, octal, decimal, and hex.", buttons: [{ label: "Convert", primary: true }], placeholder: "Enter a number (e.g. 42, 0xFF, 0b101)", mono: true },
  { id: "roman-date-converter", template: "D", description: "Convert dates to/from Roman numerals.", buttons: [{ label: "To Roman", mode: "format", primary: true }, { label: "From Roman", mode: "minify" }], placeholder: "Enter date (e.g. 2026-03-27) or Roman numeral" },
  { id: "slugify-url", template: "D", description: "Generate URL-safe slugs from text. Remove special characters and normalize spacing.", buttons: [{ label: "Slugify", primary: true }], placeholder: "Paste text to slugify" },
  { id: "unix-time", template: "D", description: "Convert between Unix timestamps and human-readable dates. Paste a timestamp or date string.", buttons: [{ label: "Convert", primary: true }], placeholder: "Paste Unix timestamp or date string", mono: true },
  { id: "line-sort-dedupe", template: "D", description: "Sort lines alphabetically, numerically, or by length. Optionally remove duplicates.", buttons: [{ label: "Sort A-Z", mode: "alpha", primary: true }, { label: "Sort A-Z (Dedupe)", mode: "alpha-dedupe" }, { label: "Sort 0-9", mode: "numeric" }, { label: "Sort 0-9 (Dedupe)", mode: "numeric-dedupe" }, { label: "Sort by Length", mode: "length" }], placeholder: "Paste lines to sort (one per line)" },
  { id: "sort-words", template: "D", description: "Sort individual words within text alphabetically.", buttons: [{ label: "Sort Words", primary: true }], placeholder: "Paste text with words to sort" },
  { id: "number-sorter", template: "D", description: "Sort a list of numbers in ascending or descending order.", buttons: [{ label: "Sort Ascending", mode: "asc", primary: true }, { label: "Sort Descending", mode: "desc" }], placeholder: "Paste numbers (one per line or comma-separated)" },
  { id: "duplicate-word-finder", template: "D", description: "Find and highlight duplicate words in your text with frequency counts.", buttons: [{ label: "Find Duplicates", primary: true }], placeholder: "Paste text to scan for duplicate words" },
  { id: "text-replace", template: "K", description: "Find and replace text with support for regex and case-sensitive matching.", buttons: [{ label: "Replace", primary: true }], mono: true, multiFields: [{ key: "text", label: "Text", type: "textarea", placeholder: "Paste text to search in" }, { key: "find", label: "Find", type: "text", placeholder: "Search string or regex pattern" }, { key: "replace", label: "Replace With", type: "text", placeholder: "Replacement text (leave empty to delete matches)" }] },
  { id: "character-remover", template: "D", description: "Remove specific characters or character classes (digits, punctuation, etc.) from text.", buttons: [{ label: "Digits", mode: "digits", primary: true }, { label: "Letters", mode: "letters" }, { label: "Punctuation", mode: "punctuation" }, { label: "Non-ASCII", mode: "non-ascii" }], placeholder: "Paste text here" },
  { id: "whitespace-remover", template: "D", description: "Strip leading, trailing, or all extra whitespace. Normalize multiple spaces to single.", buttons: [{ label: "Trim", mode: "trim", primary: true }, { label: "Collapse Extra", mode: "extra" }, { label: "Remove All", mode: "all" }], placeholder: "Paste text with extra whitespace" },
  { id: "line-break-remover", template: "D", description: "Remove line breaks from text. Optionally replace with spaces or commas.", buttons: [{ label: "Replace with Space", mode: "replace-with-space", primary: true }, { label: "Remove", mode: "remove" }], placeholder: "Paste multi-line text" },
  { id: "text-formatting-remover", template: "D", description: "Strip Unicode formatting, Markdown syntax, and HTML tags from text.", buttons: [{ label: "Remove Formatting", primary: true }], placeholder: "Paste formatted text" },
  { id: "remove-underscores", template: "D", description: "Replace all underscores with spaces. Clean up variable names and file names.", buttons: [{ label: "Remove Underscores", primary: true }], placeholder: "Paste text_with_underscores" },
  { id: "em-dash-remover", template: "D", description: "Remove or replace em dashes and en dashes with hyphens or spaces.", buttons: [{ label: "Replace with Hyphen", mode: "hyphen", primary: true }, { label: "Replace with Space", mode: "space" }, { label: "Remove", mode: "remove" }], placeholder: "Paste text with em dashes (-, –)" },
  { id: "plain-text-converter", template: "D", description: "Convert rich/formatted text to clean plain text. Strips all formatting.", buttons: [{ label: "Convert to Plain Text", primary: true }], placeholder: "Paste formatted text" },
  { id: "repeat-text-generator", template: "F", description: "Repeat text N times with a configurable separator (newline, space, comma, custom).",
    buttons: [{ label: "Repeat", primary: true }], placeholder: "Enter text to repeat",
    generatorFields: [
      { key: "count", label: "Count", type: "number", defaultValue: 3, min: 1, max: 100 },
      { key: "separator", label: "Separator", type: "select", options: ["newline", "space", "comma", "dash", "custom"], defaultValue: "newline" },
    ],
  },
  { id: "reverse-text-generator", template: "D", description: "Reverse the character order of your text. \"Hello\" becomes \"olleH\".", buttons: [{ label: "Reverse", primary: true }], placeholder: "Paste text to reverse" },
  { id: "invisible-text-generator", template: "F", description: "Generate invisible Unicode characters (zero-width spaces, joiners).",
    buttons: [{ label: "Generate", primary: true }],
    generatorFields: [
      { key: "length", label: "Length", type: "number", defaultValue: 12, min: 1, max: 1000 },
      { key: "character", label: "Character", type: "select", options: ["zwsp", "zwnj", "zwj", "wj"], defaultValue: "zwsp" },
    ],
  },
  { id: "upside-down-text-generator", template: "D", description: "Flip text upside down using Unicode characters. Great for social media posts.", buttons: [{ label: "Flip Upside Down", primary: true }], placeholder: "Paste text to flip" },
  { id: "mirror-text-generator", template: "D", description: "Mirror text horizontally using Unicode characters.", buttons: [{ label: "Mirror", primary: true }], placeholder: "Paste text to mirror" },
];

// --- Template E: Unicode Style Generator (27 tools) ---

const templateETools: ToolConfig[] = [
  { id: "bold-text-generator", template: "E", description: "Generate bold Unicode text (𝗯𝗼𝗹𝗱). Works in social media bios, messages, and posts.", buttons: [{ label: "Generate Bold", primary: true }], placeholder: "Type text to make bold" },
  { id: "italic-text-converter", template: "E", description: "Generate italic Unicode text (𝘪𝘵𝘢𝘭𝘪𝘤). Copy and paste anywhere.", buttons: [{ label: "Generate Italic", primary: true }], placeholder: "Type text to italicize" },
  { id: "underline-text-generator", template: "E", description: "Generate underlined Unicode text (u\u0332n\u0332d\u0332e\u0332r\u0332l\u0332i\u0332n\u0332e\u0332). Uses combining characters.", buttons: [{ label: "Generate Underline", primary: true }], placeholder: "Type text to underline" },
  { id: "strikethrough-text-generator", template: "E", description: "Generate strikethrough Unicode text. Cross out any text with combining characters.", buttons: [{ label: "Generate Strikethrough", primary: true }], placeholder: "Type text to strike through" },
  { id: "small-text-generator", template: "E", description: "Generate small caps and superscript text using Unicode characters.", buttons: [{ label: "Generate Small Text", primary: true }], placeholder: "Type text to shrink" },
  { id: "subscript-generator", template: "E", description: "Generate subscript Unicode text. Useful for chemical formulas and math notation.", buttons: [{ label: "Generate Subscript", primary: true }], placeholder: "Type text (e.g. H2O)" },
  { id: "superscript-generator", template: "E", description: "Generate superscript Unicode text. Useful for exponents and annotations.", buttons: [{ label: "Generate Superscript", primary: true }], placeholder: "Type text (e.g. x2)" },
  { id: "wide-text-generator", template: "E", description: "Generate fullwidth aesthetic text. Each character takes double width.", buttons: [{ label: "Generate Wide Text", primary: true }], placeholder: "Type text to widen" },
  { id: "double-struck-text-generator", template: "E", description: "Generate double-struck (blackboard bold) Unicode text.", buttons: [{ label: "Generate Double-Struck", primary: true }], placeholder: "Type text" },
  { id: "bubble-text-generator", template: "E", description: "Generate circled/bubble Unicode text.", buttons: [{ label: "Generate Bubble Text", primary: true }], placeholder: "Type text" },
  { id: "gothic-text-generator", template: "E", description: "Generate gothic (Fraktur) Unicode text. Medieval-style lettering.", buttons: [{ label: "Generate Gothic", primary: true }], placeholder: "Type text" },
  { id: "cursed-text-generator", template: "E", description: "Generate Zalgo-style glitchy text with combining characters. Configurable intensity.", buttons: [{ label: "Generate Cursed", primary: true }], placeholder: "Type text to curse" },
  { id: "slash-text-generator", template: "E", description: "Generate text with slash decorations through each character.", buttons: [{ label: "Generate Slash Text", primary: true }], placeholder: "Type text" },
  { id: "stacked-text-generator", template: "E", description: "Generate vertically stacked text using Unicode combining characters.", buttons: [{ label: "Generate Stacked", primary: true }], placeholder: "Type text" },
  { id: "big-text-converter", template: "E", description: "Generate large block-letter text using ASCII art characters.", buttons: [{ label: "Generate Big Text", primary: true }], placeholder: "Type text", mono: true },
  { id: "typewriter-text-generator", template: "E", description: "Generate typewriter-style monospaced Unicode text.", buttons: [{ label: "Generate Typewriter", primary: true }], placeholder: "Type text" },
  { id: "fancy-text-generator", template: "E", description: "Generate decorative Unicode text in multiple styles. Pick your favorite variant.", buttons: [{ label: "Generate Fancy", primary: true }], placeholder: "Type text" },
  { id: "cute-font-generator", template: "E", description: "Generate text with cute Unicode decorations and symbols.", buttons: [{ label: "Generate Cute", primary: true }], placeholder: "Type text" },
  { id: "aesthetic-text-generator", template: "E", description: "Generate aesthetic-styled Unicode text with special characters.", buttons: [{ label: "Generate Aesthetic", primary: true }], placeholder: "Type text" },
  { id: "unicode-text-converter", template: "E", description: "Convert text to various Unicode representations and styles.", buttons: [{ label: "Convert", primary: true }], placeholder: "Type text" },
  { id: "unicode-to-text-converter", template: "E", description: "Convert Unicode code points (U+0041) back to readable text characters.", buttons: [{ label: "Convert to Text", primary: true }], placeholder: "Paste code points (e.g. U+0041 U+1F642)" },
  { id: "facebook-font-generator", template: "E", description: "Generate styled text for Facebook posts and bios using Unicode fonts.", buttons: [{ label: "Generate", primary: true }], placeholder: "Type text for Facebook" },
  { id: "instagram-font-generator", template: "E", description: "Generate styled text for Instagram bios and captions using Unicode fonts.", buttons: [{ label: "Generate", primary: true }], placeholder: "Type text for Instagram" },
  { id: "x-font-generator", template: "E", description: "Generate styled text for Twitter/X posts using Unicode fonts.", buttons: [{ label: "Generate", primary: true }], placeholder: "Type text for X" },
  { id: "tiktok-font-generator", template: "E", description: "Generate styled text for TikTok bios and comments using Unicode fonts.", buttons: [{ label: "Generate", primary: true }], placeholder: "Type text for TikTok" },
  { id: "discord-font-generator", template: "E", description: "Generate styled text for Discord messages using Unicode fonts.", buttons: [{ label: "Generate", primary: true }], placeholder: "Type text for Discord" },
  { id: "whatsapp-font-generator", template: "E", description: "Generate styled text for WhatsApp messages using Unicode fonts.", buttons: [{ label: "Generate", primary: true }], placeholder: "Type text for WhatsApp" },
  { id: "nato-phonetic-converter", template: "E", description: "Convert text to/from NATO phonetic alphabet. A=Alpha, B=Bravo, etc.", buttons: [{ label: "Convert", primary: true }], placeholder: "Type text (e.g. SOS)" },
  { id: "pig-latin-converter", template: "E", description: "Translate text to/from Pig Latin. Move first consonant(s) to end and add 'ay'.", buttons: [{ label: "Convert", primary: true }], placeholder: "Type text (e.g. hello apple)" },
  { id: "wingdings-converter", template: "E", description: "Convert text to/from Wingdings symbol font characters.", buttons: [{ label: "Convert", primary: true }], placeholder: "Type text" },
  { id: "phonetic-spelling-converter", template: "E", description: "Generate phonetic spellings for each letter (A as in Alpha, etc.).", buttons: [{ label: "Convert", primary: true }], placeholder: "Type text" },
];

// --- Template F: Generator (11 tools) ---

const templateFTools: ToolConfig[] = [
  {
    id: "random-string", template: "F", description: "Generate random strings with configurable length, count, and character set.",
    buttons: [{ label: "Generate", primary: true }], mono: true,
    generatorFields: [
      { key: "length", label: "Length", type: "number", defaultValue: 16, min: 1, max: 512 },
      { key: "count", label: "Count", type: "number", defaultValue: 1, min: 1, max: 100 },
      { key: "charset", label: "Character Set", type: "select", options: ["alphanumeric", "alpha", "numeric", "hex", "symbols"], defaultValue: "alphanumeric" },
    ],
  },
  {
    id: "password-generator", template: "F", description: "Generate strong passwords with configurable length and complexity rules.",
    buttons: [{ label: "Generate Password", primary: true }], mono: true,
    generatorFields: [
      { key: "length", label: "Length", type: "number", defaultValue: 20, min: 4, max: 256 },
      { key: "count", label: "Count", type: "number", defaultValue: 1, min: 1, max: 50 },
      { key: "includeLowercase", label: "Lowercase (a-z)", type: "checkbox", defaultValue: true },
      { key: "includeUppercase", label: "Uppercase (A-Z)", type: "checkbox", defaultValue: true },
      { key: "includeNumbers", label: "Numbers (0-9)", type: "checkbox", defaultValue: true },
      { key: "includeSymbols", label: "Symbols (!@#$...)", type: "checkbox", defaultValue: true },
    ],
  },
  {
    id: "lorem-ipsum", template: "F", description: "Generate placeholder Lorem Ipsum text. Choose words, sentences, or paragraphs.",
    buttons: [{ label: "Generate", primary: true }],
    generatorFields: [
      { key: "mode", label: "Mode", type: "select", options: ["paragraphs", "sentences", "words"], defaultValue: "paragraphs" },
      { key: "count", label: "Count", type: "number", defaultValue: 2, min: 1, max: 100 },
    ],
  },
  {
    id: "random-number", template: "F", description: "Generate random numbers within a configurable range. Supports integer, float, and unique mode.",
    buttons: [{ label: "Generate", primary: true }], mono: true,
    generatorFields: [
      { key: "min", label: "Min", type: "number", defaultValue: 0 },
      { key: "max", label: "Max", type: "number", defaultValue: 100 },
      { key: "count", label: "Count", type: "number", defaultValue: 1, min: 1, max: 500 },
      { key: "integer", label: "Integer only", type: "checkbox", defaultValue: true },
      { key: "unique", label: "Unique values", type: "checkbox", defaultValue: false },
    ],
  },
  {
    id: "random-letter", template: "F", description: "Generate random letters. Choose uppercase, lowercase, or both.",
    buttons: [{ label: "Generate", primary: true }], mono: true,
    generatorFields: [
      { key: "count", label: "Count", type: "number", defaultValue: 1, min: 1, max: 500 },
      { key: "uppercase", label: "Uppercase", type: "checkbox", defaultValue: true },
      { key: "lowercase", label: "Lowercase", type: "checkbox", defaultValue: true },
    ],
  },
  {
    id: "random-date", template: "F", description: "Generate random dates within a configurable range and format.",
    buttons: [{ label: "Generate", primary: true }], mono: true,
    generatorFields: [
      { key: "start", label: "Start date", type: "text", defaultValue: "2020-01-01" },
      { key: "end", label: "End date", type: "text", defaultValue: "2030-12-31" },
      { key: "count", label: "Count", type: "number", defaultValue: 1, min: 1, max: 200 },
      { key: "format", label: "Format", type: "text", defaultValue: "%Y-%m-%d" },
    ],
  },
  {
    id: "random-month", template: "F", description: "Generate random month names or numbers.",
    buttons: [{ label: "Generate", primary: true }],
    generatorFields: [
      { key: "count", label: "Count", type: "number", defaultValue: 1, min: 1, max: 200 },
      { key: "output", label: "Output format", type: "select", options: ["name", "number"], defaultValue: "name" },
    ],
  },
  {
    id: "random-ip", template: "F", description: "Generate random IP addresses. Choose IPv4, IPv6, or both.",
    buttons: [{ label: "Generate", primary: true }], mono: true,
    generatorFields: [
      { key: "count", label: "Count", type: "number", defaultValue: 1, min: 1, max: 200 },
      { key: "version", label: "IP version", type: "select", options: ["both", "ipv4", "ipv6"], defaultValue: "both" },
    ],
  },
  {
    id: "random-choice", template: "F", description: "Pick random items from a list you provide. Supports unique selection.",
    buttons: [{ label: "Pick", primary: true }],
    generatorFields: [
      { key: "count", label: "Pick count", type: "number", defaultValue: 1, min: 1, max: 200 },
      { key: "unique", label: "Unique picks", type: "checkbox", defaultValue: false },
    ],
    placeholder: "Enter items (one per line)",
  },
  { id: "sentence-counter", template: "F", description: "Count sentences, words, characters, paragraphs, and estimate reading time.", buttons: [{ label: "Count", primary: true }], placeholder: "Paste text to analyze" },
  { id: "word-frequency-counter", template: "F", description: "Count frequency of each word in your text. Shows a sorted table of results.", buttons: [{ label: "Count", primary: true }], placeholder: "Paste text to analyze" },
];

// --- Template G: Structured JSON Output (6 tools) ---

const templateGTools: ToolConfig[] = [
  { id: "url-parser", template: "G", description: "Parse a URL into its components: scheme, host, port, path, query, and fragment.", buttons: [{ label: "Parse URL", primary: true }], placeholder: "Paste a URL to parse", mono: true },
  { id: "cron-parser", template: "G", description: "Parse cron expressions into human-readable schedules with next 5 run times.", buttons: [{ label: "Parse", primary: true }], placeholder: "Paste cron expression (e.g. */15 * * * *)", mono: true },
  { id: "cert-decoder", template: "G", description: "Decode and inspect X.509 PEM/DER certificates. View subject, issuer, validity, and more.", buttons: [{ label: "Decode Certificate", primary: true }], placeholder: "Paste PEM certificate", mono: true },
  { id: "string-inspector", template: "G", description: "Inspect characters, Unicode code points, byte length, and encoding details of any text.", buttons: [{ label: "Inspect", primary: true }], placeholder: "Paste text to inspect", mono: true },
  { id: "jwt-debugger", template: "G", description: "Decode and inspect JWT tokens. View header, payload, signature, and expiration status.", buttons: [{ label: "Decode JWT", primary: true }], placeholder: "Paste JWT token (eyJ...)", mono: true },
  { id: "color-converter", template: "G", description: "Convert colors between HEX, RGB, and HSL formats. Paste any color value to see all formats.", buttons: [{ label: "Convert", primary: true }], placeholder: "Paste color (e.g. #0ea5e9, rgb(14,165,233))", mono: true },
];

// --- Template H: File-In / File-Out (9 tools) ---

const templateHTools: ToolConfig[] = [
  { id: "jpg-to-png-converter", template: "H", description: "Convert JPG/JPEG images to PNG format.", buttons: [{ label: "Convert to PNG", primary: true }], acceptedFiles: ".jpg,.jpeg" },
  { id: "png-to-jpg-converter", template: "H", description: "Convert PNG images to JPG format.", buttons: [{ label: "Convert to JPG", primary: true }], acceptedFiles: ".png" },
  { id: "jpg-to-webp-converter", template: "H", description: "Convert JPG/JPEG images to WebP format.", buttons: [{ label: "Convert to WebP", primary: true }], acceptedFiles: ".jpg,.jpeg" },
  { id: "webp-to-jpg-converter", template: "H", description: "Convert WebP images to JPG format.", buttons: [{ label: "Convert to JPG", primary: true }], acceptedFiles: ".webp" },
  { id: "png-to-webp-converter", template: "H", description: "Convert PNG images to WebP format.", buttons: [{ label: "Convert to WebP", primary: true }], acceptedFiles: ".png" },
  { id: "webp-to-png-converter", template: "H", description: "Convert WebP images to PNG format.", buttons: [{ label: "Convert to PNG", primary: true }], acceptedFiles: ".webp" },
  { id: "svg-to-png-converter", template: "H", description: "Rasterize SVG to PNG at configurable resolution.", buttons: [{ label: "Convert to PNG", primary: true }], acceptedFiles: ".svg" },
  { id: "image-to-text-converter", template: "H", description: "Extract text from images using OCR. Supports PNG, JPG, TIFF, and BMP.", buttons: [{ label: "Extract Text", primary: true }], acceptedFiles: ".png,.jpg,.jpeg,.tiff,.bmp", outputIsText: true, ocrLanguageSelect: true },
  { id: "ascii-art-generator", template: "H", description: "Convert images or text to ASCII art. Configurable width and character set.", buttons: [{ label: "Generate ASCII Art", primary: true }], acceptedFiles: ".png,.jpg,.jpeg", outputIsText: true },
];

// --- Template I: Live Preview (3 tools) ---

const templateITools: ToolConfig[] = [
  { id: "html-preview", template: "I", description: "Live-preview rendered HTML. See your markup rendered in real time as you type.", buttons: [], placeholder: "Type or paste HTML", mono: true },
  { id: "markdown-preview", template: "I", description: "Live-preview rendered Markdown. See headings, lists, links, and formatting in real time.", buttons: [], placeholder: "Type or paste Markdown", mono: true },
  { id: "word-cloud-generator", template: "I", description: "Generate a visual word cloud from your text. Most frequent words appear larger.", buttons: [], placeholder: "Paste text for word cloud" },
];

// --- Template J: Dual-Input (1 tool) ---

const templateJTools: ToolConfig[] = [
  { id: "text-diff", template: "J", description: "Compare two texts side by side. See additions, removals, and unchanged lines with colored highlighting.", buttons: [{ label: "Compare", primary: true }], mono: true },
];

// --- Template K: Multi-Field Input (2 tools) ---

const templateKTools: ToolConfig[] = [
  {
    id: "regex-tester", template: "K", description: "Test regex patterns with real-time match highlighting, group capture display, and replace mode.",
    buttons: [{ label: "Test", primary: true }], mono: true,
    multiFields: [
      { key: "pattern", label: "Pattern", type: "text", placeholder: "Enter regex pattern (e.g. \\d+)" },
      { key: "text", label: "Test Text", type: "textarea", placeholder: "Paste text to test against" },
      { key: "flags", label: "Flags", type: "checkboxes", options: ["g", "i", "m", "s", "x", "U"] },
      { key: "replace", label: "Replace With", type: "text", placeholder: "Replacement text (optional)" },
    ],
  },
  {
    id: "utm-generator", template: "K", description: "Build UTM-tagged campaign URLs. Fill in the parameters and get a ready-to-use tracking URL.",
    buttons: [{ label: "Generate URL", primary: true }], mono: true,
    multiFields: [
      { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://example.com/page" },
      { key: "source", label: "Source", type: "text", placeholder: "google, newsletter, facebook" },
      { key: "medium", label: "Medium", type: "text", placeholder: "cpc, email, social" },
      { key: "campaign", label: "Campaign", type: "text", placeholder: "spring_sale" },
      { key: "term", label: "Term (optional)", type: "text", placeholder: "keyword" },
      { key: "content", label: "Content (optional)", type: "text", placeholder: "ad variation" },
    ],
  },
];

// --- Custom tools that use standard templates with special handling ---

const customTools: ToolConfig[] = [
  {
    id: "case-converter", template: "D", description: "Got the words right but somehow offended the alphabet? Paste your text and fix the case in one click.",
    buttons: [
      { label: "Sentence case", mode: "sentence" },
      { label: "lower case", mode: "lower" },
      { label: "UPPER CASE", mode: "upper" },
      { label: "Capitalized Case", mode: "capitalized" },
      { label: "aLtErNaTiNg CaSe", mode: "alternating" },
      { label: "Title Case", mode: "title" },
      { label: "iNVERSE cASE", mode: "inverse" },
      { label: "camelCase", mode: "camel" },
      { label: "snake_case", mode: "snake" },
      { label: "kebab-case", mode: "kebab" },
      { label: "PascalCase", mode: "pascal" },
      { label: "CONSTANT_CASE", mode: "constant" },
      { label: "dot.case", mode: "dot" },
      { label: "path/case", mode: "path" },
    ],
    placeholder: "Paste your text here",
  },
  {
    id: "uuid-ulid", template: "B", description: "Generate UUIDs (v4) and ULIDs, or decode existing ones to inspect version, variant, and timestamp.",
    buttons: [{ label: "Generate", mode: "format", primary: true }, { label: "Decode", mode: "minify" }],
    placeholder: "Paste UUID or ULID to decode", mono: true, directionLabels: ["Generate", "Decode"],
  },
  {
    id: "qr-code", template: "B", description: "Generate QR codes from text/URLs, or read QR codes from images.",
    buttons: [{ label: "Generate QR", mode: "format", primary: true }, { label: "Read QR", mode: "minify" }],
    placeholder: "Enter text or URL to encode", mono: true, directionLabels: ["Generate", "Read"],
  },
  {
    id: "hash-generator", template: "G", description: "Generate hash digests using MD5, SHA-1, SHA-256, SHA-512, and Keccak-256. Paste text or drop a file.",
    buttons: [{ label: "Calculate Hashes", primary: true }],
    placeholder: "Paste text to hash", mono: true,
  },
  {
    id: "apa-format-generator", template: "D", description: "Format citations and references in APA style. Provide author, year, title, and source.",
    buttons: [{ label: "Format Citation", primary: true }],
    placeholder: "Paste citation JSON ({\"authors\":[...],\"year\":\"...\",\"title\":\"...\",\"source\":\"...\"})", mono: true,
  },
  {
    id: "markdown-table-generator", template: "D", description: "Build Markdown tables from JSON. Provide headers and rows to generate table syntax.",
    buttons: [{ label: "Generate Table", primary: true }],
    placeholder: "Paste JSON ({\"headers\":[...],\"rows\":[[...]]})", mono: true,
  },
];

// --- Combine all configs ---

const allToolConfigs: ToolConfig[] = [
  ...templateATools,
  ...templateBTools,
  ...templateCTools,
  ...templateDTools,
  ...templateETools,
  ...templateFTools,
  ...templateGTools,
  ...templateHTools,
  ...templateITools,
  ...templateJTools,
  ...templateKTools,
  ...customTools,
];

const toolConfigMap = new Map<string, ToolConfig>();
for (const config of allToolConfigs) {
  toolConfigMap.set(config.id, config);
}

export function getToolConfig(toolId: string): ToolConfig | undefined {
  return toolConfigMap.get(toolId);
}

export const TOOL_CONFIGS = allToolConfigs;

/** Category labels for sidebar grouping, keyed by template ID. */
export const TEMPLATE_CATEGORY: Record<TemplateId, string> = {
  A: "Formatters",
  B: "Encoders & Ciphers",
  C: "Converters",
  D: "Text Tools",
  E: "Unicode & Fonts",
  F: "Generators",
  G: "Inspectors & Parsers",
  H: "Image & File Tools",
  I: "Live Previews",
  J: "Comparison",
  K: "Multi-Field Tools",
  L: "Specialized",
  M: "Specialized",
};

/** Get the sidebar category for a tool ID. */
export function getToolCategory(toolId: string): string {
  const config = toolConfigMap.get(toolId);
  return config ? TEMPLATE_CATEGORY[config.template] : "Other";
}

/** Unique ordered list of all category names. */
export const ALL_CATEGORIES: string[] = [...new Set(Object.values(TEMPLATE_CATEGORY))];

/** Sample input text prefilled when a tool is first opened. Lazily initialized on first access. */
let _sampleInputsCache: Record<string, string> | null = null;

export function getSampleInput(toolId: string): string {
  if (!_sampleInputsCache) {
    _sampleInputsCache = _buildSampleInputs();
  }
  return _sampleInputsCache[toolId] ?? "Binturong";
}

function _buildSampleInputs(): Record<string, string> {
  return {
  "json-format": "{\"project\":\"binturong\",\"tasks\":[\"format\",\"validate\"],\"active\":true}",
  "html-beautify": "<main><section><h1>Hello</h1><p>Formatter sample</p></section></main>",
  "css-beautify": "body{font-family:sans-serif;color:#0f172a}.card{padding:16px;border-radius:8px}",
  "scss-beautify": "$brand:#0ea5e9;.card{color:$brand;&:hover{color:darken($brand,10%)}}",
  "less-beautify": "@pad: 12px;\n.card { padding: @pad; }",
  "javascript-beautify": "function greet(name){console.log('hello '+name);}",
  "typescript-beautify": "type User={id:number};const user:User={id:1};",
  "graphql-format": "query GetUser($id:ID!){user(id:$id){id name}}",
  "erb-format": "<div><% if @user %><span><%= @user.name %></span><% end %></div>",
  "xml-format": "<root><user id=\"1\"><name>Binturong</name></user></root>",
  "sql-format": "select id,name from users where active = 1 and team_id = 3 order by name",
  "markdown-format": "# Binturong\n\nA fast local toolbox.\n\n- Format\n- Convert",
  "yaml-format": "name: binturong\nfeatures:\n  - format\n  - convert\n",
  "json-to-yaml": "{\"name\":\"binturong\",\"features\":[\"format\",\"convert\"]}",
  "yaml-to-json": "name: binturong\nfeatures:\n  - format\n  - convert\n",
  "json-to-csv": "[{\"id\":1,\"name\":\"A\"},{\"id\":2,\"name\":\"B\"}]",
  "csv-to-json": "id,name\n1,A\n2,B",
  "json-to-php": "{\"name\":\"binturong\",\"enabled\":true}",
  "php-to-json": "['name' => 'binturong', 'enabled' => true]",
  "php-serialize": "{\"name\":\"binturong\",\"count\":2}",
  "php-unserialize": "a:2:{s:4:\"name\";s:9:\"binturong\";s:5:\"count\";i:2;}",
  "json-stringify": "hello \"world\"",
  "base64": "hello world",
  "base64-image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "backslash-escape": "line one\nline two\tvalue",
  "quote-helper": "hello \"world\"",
  "utf8": "Binturong",
  "binary-code": "Hello",
  "morse-code": "SOS HELP",
  "rot13": "Hello, Binturong!",
  "caesar-cipher": "Attack at Dawn",
  "aes-encrypt": "The quick brown fox jumps over the lazy dog",
  "unix-time": "1700000000",
  "jwt-debugger": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjQxMDI0NDQ4MDB9.signature",
  "regex-tester": "{\"pattern\":\"\\\\d+\",\"flags\":\"g\",\"text\":\"id=42 code=77\",\"replace\":\"#\"}",
  "text-diff": "{\"left\":\"one\\ntwo\\nthree\",\"right\":\"one\\n2\\nthree\"}",
  "string-inspector": "Binturong 🐾",
  "cron-parser": "*/15 * * * *",
  "color-converter": "#0ea5e9",
  "cert-decoder": "-----BEGIN CERTIFICATE-----\nMIIDCTCCAfGgAwIBAgIUP8nqVf82sAirwQ0qGg7djTJfNoswDQYJKoZIhvcNAQEL\nBQAwFDESMBAGA1UEAwwJQmludHVyb25nMB4XDTI2MDMyNzE5Mjk1N1oXDTI3MDMy\nNzE5Mjk1N1owFDESMBAGA1UEAwwJQmludHVyb25nMIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEAyhJzNhU2D1G0oaDOdMw2RX2A3G0ax/T3NmkTZcfv8Vv5\nkst9Es1QyvuXJMBbd+gBZ9n31c3Pplv1BZtqoFzJLo92dfcIVy9OEazSklK9wOkV\nKJwipGtbzb5bwXycXQVUmpp7xkCPbrjzMBT3rBdjhyUJ66tv3VnM6oZ25NmSz32U\nTh8Q4yDAIwkd2j65dABetlCAr/Hk+marJdWbOHxCoxFOsQW0IaEIFlXwUNwlF/od\nbZGag4PY1oZAn8hzIZw2/HpG4JFSCRaVBwDOlPnASR+WOAbKOaA6c2rP52WV+obz\nMGcHxmd1/uStwigpza2sLomcjAzVHHFLHIOQeowG1QIDAQABo1MwUTAdBgNVHQ4E\nFgQUAWAUO2n331jGLNRAa1G4wqFLMeIwHwYDVR0jBBgwFoAUAWAUO2n331jGLNRA\na1G4wqFLMeIwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEASx5w\nSiAZG3K9grU11V7fjSsMrdYN+rtwMJvU9357G/gitTJiVxEvBcHWG4KVg17gOOhX\niBu/Gs3Nb1hP9QBgzTMMrwlxqPao71GxDSyfT1vbEK9tDqLFiG4YC68klOCQjiJQ\nWBB8vBnoIYKzBNPb7d+gt9r4Bp4lKJ7pGtxY6kYzAh+mKD1YQNFvUvmIU+qOsVw9\noahkRJg3ZtbxKPzBUziJ8XSUZkElY1bVJf6WG1Cs/xiVexPJJOKMAyZ4C4VbjxHy\nYFjr704cU7wf94yTWKw+Gysvu4jhv07cX/9YSC8hlrwEMlvSGZhLpbW8nQkjHhYz\nxO+Kgb/A2Z7i52DQmw==\n-----END CERTIFICATE-----",
  "uuid-ulid": "550e8400-e29b-41d4-a716-446655440000",
  "random-string": "{\"length\":16,\"count\":2,\"charset\":\"alphanumeric\"}",
  "password-generator": "{\"length\":20,\"count\":1,\"includeLowercase\":true,\"includeUppercase\":true,\"includeNumbers\":true,\"includeSymbols\":true}",
  "lorem-ipsum": "{\"mode\":\"paragraphs\",\"count\":2}",
  "qr-code": "Binturong QR",
  "random-number": "{\"min\":1,\"max\":100,\"count\":5,\"integer\":true}",
  "random-letter": "{\"count\":8,\"uppercase\":true,\"lowercase\":true}",
  "random-date": "{\"start\":\"2026-01-01\",\"end\":\"2026-12-31\",\"count\":3,\"format\":\"%Y-%m-%d\"}",
  "random-month": "{\"count\":4,\"output\":\"name\"}",
  "random-ip": "{\"count\":3,\"version\":\"both\"}",
  "random-choice": "{\"items\":[\"alpha\",\"beta\",\"gamma\"],\"count\":2,\"unique\":false}",
  "hash-generator": "hello",
  "case-converter": "Hello Binturong",
  "line-sort-dedupe": "banana\napple\ncherry\napple",
  "sort-words": "banana apple cherry",
  "number-sorter": "4, 1, 7, 3, 9, 2",
  "duplicate-word-finder": "one two one three two",
  "text-replace": "{\"text\":\"hello world\",\"find\":\"world\",\"replace\":\"binturong\",\"regex\":false,\"case_sensitive\":true}",
  "character-remover": "a1b2c3!@# test",
  "whitespace-remover": "  hello   world  ",
  "line-break-remover": "Hello World\nThis is line two\nAnd line three",
  "text-formatting-remover": "# Title\n**bold** <b>tag</b>",
  "remove-underscores": "hello_world__again",
  "em-dash-remover": "alpha\u2014beta\u2013gamma",
  "plain-text-converter": "# Title\n**Bold** <b>tag</b> &amp; more",
  "repeat-text-generator": "go",
  "reverse-text-generator": "Binturong",
  "upside-down-text-generator": "Hello!",
  "mirror-text-generator": "ab(cd)",
  "invisible-text-generator": "",
  "sentence-counter": "One. Two three!\n\nFour?",
  "word-frequency-counter": "apple banana apple pear banana apple",
  "word-cloud-generator": "{\"text\":\"apple banana apple pear orange orange\",\"maxWords\":6}",
  "bold-text-generator": "Binturong 123",
  "italic-text-converter": "Binturong",
  "underline-text-generator": "Binturong",
  "strikethrough-text-generator": "Binturong",
  "small-text-generator": "Binturong 2026",
  "subscript-generator": "H2O + NaCl",
  "superscript-generator": "H2O + NaCl",
  "wide-text-generator": "Hello 2026!",
  "double-struck-text-generator": "Binturong 42",
  "bubble-text-generator": "Binturong 42",
  "gothic-text-generator": "Binturong",
  "cursed-text-generator": "Binturong",
  "slash-text-generator": "Binturong",
  "stacked-text-generator": "Binturong",
  "big-text-converter": "Binturong",
  "typewriter-text-generator": "Binturong 2026",
  "fancy-text-generator": "Binturong",
  "cute-font-generator": "Binturong",
  "aesthetic-text-generator": "Binturong",
  "unicode-text-converter": "A\uD83D\uDE42",
  "unicode-to-text-converter": "U+0041 U+1F642",
  "facebook-font-generator": "Binturong",
  "instagram-font-generator": "Binturong",
  "x-font-generator": "Binturong",
  "tiktok-font-generator": "Binturong",
  "discord-font-generator": "Binturong",
  "whatsapp-font-generator": "Binturong",
  "nato-phonetic-converter": "AB 1",
  "pig-latin-converter": "hello apple",
  "wingdings-converter": "ABC",
  "phonetic-spelling-converter": "AZ",
  "url": "https://example.com/hello world?q=binturong tools",
  "html-entity": "<span class=\"lead\">Tom & Jerry</span>",
  "html-to-jsx": "<label class=\"field\" for=\"name\">Name</label><input type=\"text\">",
  "html-to-markdown": "<h1>Title</h1><p>Hello <strong>world</strong></p>",
  "word-to-markdown": "Drop a .docx file to generate markdown",
  "svg-to-css": "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\"/></svg>",
  "curl-to-code": "curl -X POST https://api.example.com -H \"Content-Type: application/json\" -d '{\"a\":1}'",
  "json-to-code": "{\"user\":{\"id\":1,\"name\":\"A\"}}",
  "query-string-to-json": "https://example.com?a=1&b=two&b=three",
  "delimiter-converter": "one,two,three",
  "number-base-converter": "42",
  "hex-to-ascii": "48656C6C6F",
  "ascii-to-hex": "Hello",
  "roman-date-converter": "2026-03-27",
  "url-parser": "https://example.com/path/to/page?utm_source=newsletter&item=42#section",
  "utm-generator": "{\"baseUrl\":\"https://example.com/landing\",\"source\":\"newsletter\",\"medium\":\"email\",\"campaign\":\"spring-launch\",\"term\":\"binturong\",\"content\":\"hero\"}",
  "slugify-url": "Hello, Binturong! 2026",
  "html-preview": "<h1>Hello</h1><p><strong>Binturong</strong> preview.</p>",
  "markdown-preview": "# Preview\n\n- one\n- two\n\n[Docs](https://example.com)",
  "jpg-to-png-converter": "IMAGE_BASE64:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "png-to-jpg-converter": "IMAGE_BASE64:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "jpg-to-webp-converter": "IMAGE_BASE64:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "webp-to-jpg-converter": "IMAGE_BASE64:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "png-to-webp-converter": "IMAGE_BASE64:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "webp-to-png-converter": "IMAGE_BASE64:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "svg-to-png-converter": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><rect width=\"16\" height=\"16\" fill=\"#f97316\"/></svg>",
  "image-to-text-converter": "{\"image\":\"IMAGE_BASE64:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=\",\"language\":\"eng\",\"downloadMissingLanguage\":false}",
  "ascii-art-generator": "{\"text\":\"Binturong\"}",
  "apa-format-generator": "{\"authors\":[\"Jane Doe\"],\"year\":\"2024\",\"title\":\"Testing Tools\",\"source\":\"Journal of Tooling\"}",
  "markdown-table-generator": "{\"headers\":[\"Name\",\"Age\"],\"rows\":[[\"Alice\",\"30\"],[\"Bob\",\"28\"]]}",
  };
}
