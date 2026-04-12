# Binturong User Guide

Binturong is an offline desktop utility suite with 133+ tools for developers, writers, and power users. All processing happens locally - no data leaves your machine.

---

## Getting Started

### Installation

| Platform | Method |
|----------|--------|
| macOS | Download `.dmg` from releases, drag to Applications |
| Windows | Download `.msi` or `.exe` installer and run it |
| Linux | `.AppImage`, `.deb`, or `.rpm` from releases |

### Launching

Open Binturong from your Applications folder, Start menu, or app launcher. The app loads in under 2 seconds and opens to the tool sidebar.

### Finding Tools

- **Search bar** - Type any keyword to fuzzy-search across all tools (e.g., "json", "base64", "password").
- **Command palette** - Press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) to open a quick-jump palette. Start typing to filter tools, actions, chains, and presets.
- **Sidebar** - Browse tools organized by category. Click any tool to open it.
- **Favorites** - Star frequently-used tools to pin them at the top of the sidebar.
- **Recents** - Recently used tools appear for quick re-access.

### General Workflow

1. Open a tool via search, sidebar, or command palette.
2. Paste or type your input.
3. Click the action button (or press Enter) to process.
4. Copy the output to your clipboard.

---

## Settings

Access settings via the gear icon. Categories include:

| Category | What It Controls |
|----------|-----------------|
| **General** | Default behaviors, quick launcher shortcut |
| **Appearance** | Theme (light, dark, auto) |
| **Search** | Fuzzy search behavior |
| **Workflow** | Batch mode, pipeline defaults |
| **Updates** | Update channel (stable/beta), check interval |
| **Privacy** | Clipboard monitoring on/off |
| **Advanced** | Database path, export/import settings |

---

## Features

### Tabs

Open multiple tools simultaneously in separate tabs. Right-click a tool in the sidebar or use the "Open in New Tab" option.

### Favorites & Recents

- Click the star icon on any tool to add it to Favorites.
- Recents track your most-used tools with usage counts.

### Clipboard History

When enabled, Binturong records clipboard entries for quick access. Toggle clipboard monitoring in **Settings > Privacy**.

### Clipboard Detection

Binturong can detect what's on your clipboard and suggest the right tool. Modes:

| Mode | Behavior |
|------|----------|
| Off | No detection |
| Suggest | Shows a suggestion banner |
| Auto Open | Opens the best-matching tool automatically |
| Always Ask | Prompts you to choose |

### Batch Mode

Process multiple inputs at once. Enable batch mode in the toolbar, then enter items separated by newline, tab, comma, or a custom delimiter. Each item is processed individually.

### Pipelines (Tool Chaining)

Chain multiple tools into a sequence. The output of one tool feeds into the next. Save pipelines for reuse.

### Presets

Save tool configurations (e.g., "JSON with 4-space indent") as named presets. Recall them instantly from the preset picker.

### History

Each tool keeps a history of past input/output pairs. Browse and restore previous runs.

---

## Tool Reference

Below is every tool grouped by category, with its options and a usage sample.

---

### Code Formatters

These tools format (prettify) or minify code. Each has two buttons: **Format** and **Minify**.

**Options:** Indent size (2 or 4 spaces)

#### JSON Format/Validate

Format messy JSON into clean, indented output, or minify it to a single line. Also validates JSON syntax.

```
Input:  {"name":"Alice","age":30}
Format: {
          "name": "Alice",
          "age": 30
        }
Minify: {"name":"Alice","age":30}
```

#### HTML Beautify/Minify

Beautify compressed HTML into readable, indented markup, or minify it.

```
Input:  <div><p>Hello</p></div>
Format: <div>
          <p>Hello</p>
        </div>
```

#### CSS Beautify/Minify

Format compressed CSS into readable rules, or minify it.

```
Input:  body{margin:0;padding:0}
Format: body {
          margin: 0;
          padding: 0;
        }
```

#### SCSS Beautify/Minify

Format SCSS (Sass) stylesheets with proper nesting and indentation.

#### LESS Beautify/Minify

Format LESS stylesheets with proper indentation.

#### JavaScript Beautify/Minify

Beautify compressed JavaScript into readable code, or minify it.

```
Input:  function add(a,b){return a+b}
Format: function add(a, b) {
          return a + b;
        }
```

#### TypeScript Beautify/Minify

Format TypeScript code with proper indentation.

#### GraphQL Format/Minify

Format GraphQL queries and schemas into readable structure.

```
Input:  query{user(id:1){name email}}
Format: query {
          user(id: 1) {
            name
            email
          }
        }
```

#### ERB Beautify/Minify

Format embedded Ruby (ERB) HTML templates.

#### XML Format/Minify

Format XML documents with proper indentation.

```
Input:  <root><item>hello</item></root>
Format: <root>
          <item>hello</item>
        </root>
```

#### SQL Format/Minify

Format one-line SQL into readable, indented statements.

```
Input:  SELECT id,name FROM users WHERE active=1 ORDER BY name
Format: SELECT
          id,
          name
        FROM
          users
        WHERE
          active = 1
        ORDER BY
          name
```

#### Markdown Format/Minify

Normalize spacing, headings, and list formatting in Markdown.

#### YAML Format/Minify

Format YAML with consistent indentation and validate syntax.

---

### Encoders & Decoders

Bidirectional tools with two directions: **Encode** and **Decode** (or equivalent pair).

#### URL Encode/Decode

Percent-encode special characters for URLs, or decode them back.

```
Encode: hello world  →  hello%20world
Decode: hello%20world  →  hello world
```

#### HTML Entity Encode/Decode

Convert special characters to HTML entities, or decode them.

```
Encode: <div> & "test"  →  &lt;div&gt; &amp; &quot;test&quot;
Decode: &lt;p&gt;  →  <p>
```

#### Base64 Encode/Decode

Encode text to Base64 or decode Base64 back to text.

```
Encode: Hello, World!  →  SGVsbG8sIFdvcmxkIQ==
Decode: SGVsbG8=  →  Hello
```

#### Base64 Image Encode/Decode

Encode images to Base64 data URIs or decode Base64 back to image data.

#### JSON Stringify/Unstringify

Stringify text for embedding in JSON strings (escapes quotes, newlines), or parse it back.

```
Stringify:   Line 1\nLine 2  →  "Line 1\\nLine 2"
Unstringify: "Line 1\\nLine 2"  →  Line 1\nLine 2
```

#### Backslash Escape/Unescape

Escape or unescape backslash sequences like `\n`, `\t`, `\\`.

```
Escape:   Hello	World  →  Hello\tWorld
Unescape: Hello\tWorld  →  Hello	World
```

#### Quote/Unquote Helper

Add or remove quotes (single, double, backtick) around text or each line. Escapes inner quotes.

```
Quote:   hello world  →  "hello world"
Unquote: "hello world"  →  hello world
```

#### UTF-8 Encoder/Decoder

Encode text to UTF-8 byte representation or decode bytes back to text.

#### Binary Code Translator

Translate between text and binary (0s and 1s).

```
Text to Binary: Hi  →  01001000 01101001
Binary to Text: 01001000 01101001  →  Hi
```

#### Morse Code Translator

Translate between text and Morse code.

```
Text to Morse: SOS  →  ... --- ...
Morse to Text: ... --- ...  →  SOS
```

#### ROT13 Encoder

Apply ROT13 - shift each letter by 13 positions. Self-inverse (apply twice to decode).

```
Input: Hello  →  Uryyb
```

#### Caesar Cipher

Encrypt/decrypt text by shifting letters by a configurable amount (1-25).

**Options:** Shift amount (1-25)

```
Encrypt (shift 3): ABC  →  DEF
Decrypt (shift 3): DEF  →  ABC
```

#### Hex to ASCII / ASCII to Hex

Convert between hexadecimal strings and ASCII text.

```
Hex to ASCII: 48656c6c6f  →  Hello
ASCII to Hex: Hello  →  48656c6c6f
```

#### UUID/ULID Generate/Decode

Generate new UUIDs (v4) and ULIDs, or paste an existing one to decode its version, variant, and timestamp.

```
Generate: → 550e8400-e29b-41d4-a716-446655440000
Decode:   550e8400-e29b-41d4-a716-446655440000 → Version: 4, Variant: RFC 4122
```

#### QR Code Reader/Generator

Generate QR codes from text or URLs, or read QR codes from uploaded images.

```
Generate: https://example.com  →  [QR code image]
Read:     [Upload QR image]  →  https://example.com
```

---

### Converters

One-way conversion tools. Paste input, click **Convert**, get output.

#### JSON to YAML

```
Input:  {"name": "Alice", "age": 30}
Output: name: Alice
        age: 30
```

#### YAML to JSON

```
Input:  name: Alice
        age: 30
Output: {"name": "Alice", "age": 30}
```

#### JSON to CSV

Convert JSON arrays to CSV. Each object becomes a row, keys become column headers.

```
Input:  [{"name":"Alice","age":30},{"name":"Bob","age":25}]
Output: name,age
        Alice,30
        Bob,25
```

#### CSV to JSON

Convert CSV to JSON. Each row becomes an object with header keys.

```
Input:  name,age
        Alice,30
Output: [{"name":"Alice","age":"30"}]
```

#### JSON to PHP / PHP to JSON

Convert between JSON and PHP array syntax.

```
JSON to PHP: {"key": "value"}  →  array('key' => 'value')
PHP to JSON: array('key' => 'value')  →  {"key": "value"}
```

#### PHP Serialize / Unserialize

Convert between JSON and PHP serialized format.

#### HTML to JSX

Convert HTML to JSX syntax. Handles `class` to `className`, `for` to `htmlFor`, self-closing tags.

```
Input:  <div class="box"><input type="text"></div>
Output: <div className="box"><input type="text" /></div>
```

#### HTML to Markdown

Convert HTML markup into clean Markdown.

```
Input:  <h1>Title</h1><p>A <strong>bold</strong> paragraph.</p>
Output: # Title

        A **bold** paragraph.
```

#### Word to Markdown

Drop a `.docx` file to convert it to Markdown.

#### SVG to CSS

Convert inline SVG to a CSS `background-image` data URI.

```
Input:  <svg>...</svg>
Output: background-image: url("data:image/svg+xml,...");
```

#### cURL to Code

Convert cURL commands to code in multiple languages (JavaScript fetch, Python requests, etc.).

```
Input:  curl -X POST https://api.example.com/data -H "Content-Type: application/json" -d '{"key":"value"}'
Output: fetch("https://api.example.com/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "value" })
        });
```

#### JSON to Code

Generate type/class definitions from JSON (TypeScript interfaces, Go structs, etc.).

```
Input:  {"name": "Alice", "age": 30}
Output: interface Root {
          name: string;
          age: number;
        }
```

#### Query String to JSON

Parse URL query strings into JSON objects.

```
Input:  ?name=Alice&age=30&active=true
Output: {"name": "Alice", "age": "30", "active": "true"}
```

---

### Text Manipulation

Tools that transform, sort, clean, or analyze text.

#### Case Converter

Convert text between 14 case styles. Click the style you want.

| Button | Sample Output |
|--------|--------------|
| Sentence case | `Hello world example` |
| lower case | `hello world example` |
| UPPER CASE | `HELLO WORLD EXAMPLE` |
| Capitalized Case | `Hello World Example` |
| aLtErNaTiNg CaSe | `hElLo WoRlD eXaMpLe` |
| Title Case | `Hello World Example` |
| iNVERSE cASE | `hELLO wORLD eXAMPLE` |
| camelCase | `helloWorldExample` |
| snake_case | `hello_world_example` |
| kebab-case | `hello-world-example` |
| PascalCase | `HelloWorldExample` |
| CONSTANT_CASE | `HELLO_WORLD_EXAMPLE` |
| dot.case | `hello.world.example` |
| path/case | `hello/world/example` |

#### Delimiter Converter

Switch between comma, tab, newline, pipe, and other separators.

```
Input:  apple,banana,cherry
Output: apple
        banana
        cherry
```

#### Number Base Converter

Convert numbers between binary, octal, decimal, and hexadecimal.

```
Input:  42
Output: Binary: 101010 | Octal: 52 | Decimal: 42 | Hex: 2A
```

#### Roman Numeral Date Converter

Convert dates to/from Roman numerals.

**Buttons:** To Roman, From Roman

```
To Roman:   2026  →  MMXXVI
From Roman: MMXXVI  →  2026
```

#### Slugify URL

Generate URL-safe slugs from text.

```
Input:  Hello World! This is a Test
Output: hello-world-this-is-a-test
```

#### Unix Time Converter

Convert between Unix timestamps and human-readable dates.

```
Input:  1711584000
Output: 2024-03-28T00:00:00Z
```

#### Line Sort/Dedupe

Sort lines alphabetically, numerically, or by length. Optionally remove duplicates.

```
Input:  banana
        apple
        cherry
        apple
Output: apple
        banana
        cherry
```

#### Sort Words

Sort individual words within text alphabetically.

```
Input:  cherry banana apple
Output: apple banana cherry
```

#### Number Sorter

Sort numbers in ascending or descending order.

**Buttons:** Sort Ascending, Sort Descending

```
Input:  42, 7, 99, 3, 15
Asc:    3, 7, 15, 42, 99
Desc:   99, 42, 15, 7, 3
```

#### Duplicate Word Finder

Find duplicate words with frequency counts.

```
Input:  the cat sat on the mat the
Output: the - 3 occurrences
```

#### Text Replacement Tool

Find and replace with regex and case-sensitive options.

#### Character Remover

Remove specific characters or character classes (digits, punctuation, etc.).

#### Whitespace Remover

Strip leading, trailing, or extra whitespace. Normalize multiple spaces to single.

```
Input:  Hello     World
Output: Hello World
```

#### Remove Line Breaks

Remove line breaks from text, optionally replace with spaces or commas.

```
Input:  Line 1
        Line 2
        Line 3
Output: Line 1 Line 2 Line 3
```

#### Remove Text Formatting

Strip Unicode formatting, Markdown syntax, and HTML tags.

#### Remove Underscores

Replace all underscores with spaces.

```
Input:  hello_world_example
Output: hello world example
```

#### Em Dash Remover

Remove or replace em/en dashes with hyphens or spaces.

#### Plain Text Converter

Convert rich/formatted text to clean plain text. Strips all formatting.

#### Repeat Text Generator

Repeat text N times with a configurable separator (newline, space, comma, custom).

```
Input:  hello (repeat 3, separator: ", ")
Output: hello, hello, hello
```

#### Reverse Text Generator

Reverse the character order of text.

```
Input:  Hello World
Output: dlroW olleH
```

#### Upside Down Text Generator

Flip text upside down using Unicode characters.

```
Input:  Hello
Output: ollǝH
```

#### Mirror Text Generator

Mirror text horizontally using Unicode characters.

#### Invisible Text Generator

Generate invisible Unicode characters (zero-width spaces, joiners).

---

### Unicode Style Generators

Type text in the input box and get styled Unicode output. Works in social media bios, messages, and posts. Each tool has a **Generate** button and shows a live preview.

| Tool | Sample Output |
|------|--------------|
| Bold Text | 𝗛𝗲𝗹𝗹𝗼 |
| Italic Text | 𝘏𝘦𝘭𝘭𝘰 |
| Underline Text | H̲e̲l̲l̲o̲ |
| Strikethrough Text | H̶e̶l̶l̶o̶ |
| Small Text | ˢᵐᵃˡˡ ᵗᵉˣᵗ |
| Subscript | ₕₑₗₗₒ |
| Superscript | ʰᵉˡˡᵒ |
| Wide Text | Ｈｅｌｌｏ |
| Double-Struck | ℍ𝕖𝕝𝕝𝕠 |
| Bubble Text | Ⓗⓔⓛⓛⓞ |
| Gothic (Fraktur) | 𝔊𝔬𝔱𝔥𝔦𝔠 |
| Cursed (Zalgo) | Glitchy text with combining diacritics |
| Big Text | ASCII art block letters |
| Typewriter | 𝚃𝚢𝚙𝚎𝚠𝚛𝚒𝚝𝚎𝚛 |
| Fancy Text | Decorative Unicode variants |
| Cute Font | Cute Unicode decorations |
| Aesthetic Text | Aesthetic-styled Unicode |
| Slash Text | Text with slash decorations |
| Stacked Text | Vertically stacked combining characters |

**Cursed Text Generator** has an intensity option - higher values add more combining characters for a glitchier look.

#### Social Media Font Generators

Dedicated generators for platform-specific styled text:

- **Facebook Font Generator** - Styled text for posts and bios
- **Instagram Font Generator** - Styled text for bios and captions
- **Twitter/X Font Generator** - Styled text for tweets
- **TikTok Font Generator** - Styled text for bios and comments
- **Discord Font Generator** - Styled text for messages
- **WhatsApp Font Generator** - Styled text for messages

Each generates multiple style variants. Copy the one you like.

#### Language & Alphabet Converters

| Tool | Example |
|------|---------|
| NATO Phonetic | `SOS` → `Sierra Oscar Sierra` |
| Pig Latin | `hello apple` → `ellohay appleay` |
| Wingdings | Text → Wingdings symbol characters |
| Phonetic Spelling | `ABC` → `A as in Alpha, B as in Bravo, C as in Charlie` |
| Unicode Text Converter | Text → various Unicode representations |
| Unicode to Text | `U+0041 U+0042` → `AB` |

---

### Generators

Tools that produce data based on configurable parameters. Set options, click **Generate**.

#### Random String Generator

Generate random strings with configurable options.

| Option | Values | Default |
|--------|--------|---------|
| Length | 1–512 | 16 |
| Count | 1–100 | 1 |
| Character Set | alphanumeric, alpha, numeric, hex, symbols | alphanumeric |

```
Sample output: a7Xk9mQ2pR4wN8bZ
```

#### Strong Password Generator

Generate strong passwords with complexity rules.

| Option | Values | Default |
|--------|--------|---------|
| Length | 4–256 | 20 |
| Count | 1–50 | 1 |
| Lowercase (a-z) | on/off | on |
| Uppercase (A-Z) | on/off | on |
| Numbers (0-9) | on/off | on |
| Symbols (!@#$...) | on/off | on |

```
Sample output: k9#Pm$vR2!xN7@wQ5&bZ
```

#### Lorem Ipsum Generator

Generate placeholder text.

| Option | Values | Default |
|--------|--------|---------|
| Mode | paragraphs, sentences, words | paragraphs |
| Count | 1–100 | 2 |

#### Random Number Generator

| Option | Values | Default |
|--------|--------|---------|
| Min | any number | 0 |
| Max | any number | 100 |
| Count | 1–500 | 1 |
| Integer only | on/off | on |
| Unique values | on/off | off |

#### Random Letter Generator

| Option | Values | Default |
|--------|--------|---------|
| Count | 1–500 | 1 |
| Uppercase | on/off | on |
| Lowercase | on/off | on |

#### Random Date Generator

| Option | Values | Default |
|--------|--------|---------|
| Start date | date string | 2020-01-01 |
| End date | date string | 2030-12-31 |
| Count | 1–200 | 1 |
| Format | strftime pattern | %Y-%m-%d |

#### Random Month Generator

| Option | Values | Default |
|--------|--------|---------|
| Count | 1–200 | 1 |
| Output format | name, number | name |

#### Random IP Address Generator

| Option | Values | Default |
|--------|--------|---------|
| Count | 1–200 | 1 |
| IP version | both, ipv4, ipv6 | both |

#### Random Choice Picker

Enter items (one per line), then pick randomly.

| Option | Values | Default |
|--------|--------|---------|
| Pick count | 1–200 | 1 |
| Unique picks | on/off | off |

```
Input:  Red
        Green
        Blue
Output: Green
```

#### Sentence Counter

Paste text to get counts for sentences, words, characters, paragraphs, and estimated reading time.

```
Input:  Hello world. How are you?
Output: Sentences: 2 | Words: 5 | Characters: 25 | Reading time: ~1 sec
```

#### Word Frequency Counter

Paste text to see a sorted table of word frequencies.

```
Input:  the cat and the dog and the fish
Output: the - 3 | and - 2 | cat - 1 | dog - 1 | fish - 1
```

---

### Parsers & Inspectors

Paste structured input and get a detailed breakdown displayed as formatted fields.

#### URL Parser

Parse a URL into its components.

```
Input:  https://example.com:8080/path?q=hello#section
Output: Scheme: https
        Host: example.com
        Port: 8080
        Path: /path
        Query: q=hello
        Fragment: section
```

#### Cron Job Parser

Parse cron expressions to human-readable schedules with the next 5 run times.

```
Input:  */15 * * * *
Output: "Every 15 minutes"
        Next: 2026-03-28 10:15, 10:30, 10:45, 11:00, 11:15
```

#### Certificate Decoder (X.509)

Paste a PEM certificate to decode subject, issuer, validity dates, and more.

#### String Inspector

Inspect character details, Unicode code points, byte length, and encoding of any text.

```
Input:  Cafe
Output: Length: 4 chars, 5 bytes (UTF-8)
        C: U+0043 | a: U+0061 | f: U+0066 | e: U+00E9
```

#### JWT Debugger

Decode JWT tokens to see header, payload, signature, and expiration status.

```
Input:  eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature
Output: Header: {"alg": "HS256"}
        Payload: {"sub": "1234"}
        Status: Valid / Expired
```

#### Color Converter

Convert colors between HEX, RGB, and HSL formats.

```
Input:  #0ea5e9
Output: HEX: #0ea5e9
        RGB: rgb(14, 165, 233)
        HSL: hsl(199, 89%, 48%)
```

#### Hash Generator

Generate hash digests from text. Supports MD5, SHA-1, SHA-256, SHA-512, and Keccak-256.

```
Input:  hello
Output: MD5:    5d41402abc4b2a76b9719d911017c592
        SHA-256: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

For a specific algorithm, use JSON input: `{"algorithm": "sha256", "text": "hello"}`

---

### Image Converters

Drag-and-drop or use the file picker to upload an image, then click **Convert**.

| Tool | Input Format | Output Format |
|------|-------------|---------------|
| JPG to PNG | `.jpg`, `.jpeg` | `.png` |
| PNG to JPG | `.png` | `.jpg` |
| JPG to WebP | `.jpg`, `.jpeg` | `.webp` |
| WebP to JPG | `.webp` | `.jpg` |
| PNG to WebP | `.png` | `.webp` |
| WebP to PNG | `.webp` | `.png` |
| SVG to PNG | `.svg` | `.png` (rasterized) |

**SVG to PNG** has a configurable resolution for the output image.

After conversion, click **Download** to save the output file.

#### Image to Text (OCR)

Extract text from images using optical character recognition. Supports `.png`, `.jpg`, `.tiff`, `.bmp`.

1. Drop an image file.
2. Click **Extract Text**.
3. Copy the extracted text.

#### ASCII Art Generator

Convert images to ASCII art with configurable width and character set.

1. Drop a `.png` or `.jpg` file.
2. Click **Generate ASCII Art**.
3. Copy the text output.

---

### Live Preview

These tools render output in real time as you type - no button needed.

#### HTML Preview

Type or paste HTML in the left pane. The right pane shows the rendered result live.

```
Input:  <h1 style="color: blue">Hello</h1><p>This is <em>live</em> HTML.</p>
Output: [Rendered HTML preview]
```

#### Markdown Preview

Type or paste Markdown in the left pane. See headings, lists, links, and formatting rendered live.

```
Input:  # Hello
        This is **bold** and *italic*.
        - Item 1
        - Item 2
Output: [Rendered Markdown preview]
```

#### Word Cloud Generator

Paste text to see a visual word cloud where the most frequent words appear larger.

---

### Text Diff Checker

Compare two texts side by side with color-coded highlighting.

1. Paste the original text in the left pane.
2. Paste the modified text in the right pane.
3. Click **Compare**.

Additions are highlighted in green, removals in red, unchanged text in default color.

```
Left:   The quick brown fox
Right:  The quick red fox
Output: The quick [brown → red] fox
```

---

### Multi-Field Tools

#### RegExp Tester

Test regex patterns with real-time match highlighting and group capture display.

| Field | Purpose |
|-------|---------|
| Pattern | The regex to test (e.g., `\d+`) |
| Test Text | The text to match against |
| Flags | `g` (global), `i` (case-insensitive), `m` (multiline), `s` (dotall), `x` (extended), `U` (ungreedy) |
| Replace With | Optional replacement text |

```
Pattern:   (\d{4})-(\d{2})-(\d{2})
Test Text: Today is 2026-03-28
Matches:   2026-03-28 (Group 1: 2026, Group 2: 03, Group 3: 28)
```

#### UTM Generator

Build UTM-tagged campaign URLs by filling in the fields.

| Field | Required | Example |
|-------|----------|---------|
| Base URL | Yes | `https://example.com/page` |
| Source | Yes | `google`, `newsletter` |
| Medium | Yes | `cpc`, `email`, `social` |
| Campaign | Yes | `spring_sale` |
| Term | No | `running+shoes` |
| Content | No | `ad_variation_1` |

```
Output: https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale
```

---

### Citation & Table Tools

#### APA Format Generator

Format citations in APA style. Provide a JSON object with author, year, title, and source.

```
Input:  {"authors": ["Smith, J.", "Doe, A."], "year": "2024", "title": "Example Study", "source": "Journal of Examples"}
Output: Smith, J., & Doe, A. (2024). Example Study. Journal of Examples.
```

#### Markdown Table Generator

Build Markdown tables from JSON with headers and rows.

```
Input:  {"headers": ["Name", "Age"], "rows": [["Alice", "30"], ["Bob", "25"]]}
Output: | Name  | Age |
        |-------|-----|
        | Alice | 30  |
        | Bob   | 25  |
```

---

## CLI Usage

Binturong includes a command-line interface for scripting and automation.

### Run a tool

```bash
binturong-cli run --tool <tool-id> [--mode <mode>] [--input <text>] [--file <path>] [--output <path>]
```

### Examples

```bash
# Format JSON
binturong-cli run --tool json-format --input '{"a":1}' --mode format

# Encode Base64
binturong-cli run --tool base64 --mode encode --input "hello world"

# Pipe from stdin
cat data.json | binturong-cli run --tool json-format --mode format

# Save output to file
binturong-cli run --tool json-format --file input.json --output formatted.json

# List all available tools
binturong-cli list
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + Shift + Space` | Quick launcher (global, configurable) |
| `Enter` | Execute current tool action |
| `Cmd/Ctrl + C` | Copy output |

---

## Data & Privacy

- All processing is local. No data is sent to any server.
- Data is stored in a local SQLite database at:
  - macOS: `~/Library/Application Support/Binturong/`
  - Windows: `%APPDATA%\Binturong\`
  - Linux: `~/.config/binturong/`
- Clipboard monitoring is opt-in and can be disabled in Settings > Privacy.
