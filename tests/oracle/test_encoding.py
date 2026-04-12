"""Oracle tests for encoding / decoding tools.

For each tool the test computes the expected output in pure Python (the oracle),
runs the same input through binturong-cli, and asserts they match.
"""

import base64
import codecs
import json
import urllib.parse

import pytest

from comparators import stripped_match

# ---------------------------------------------------------------------------
# Python oracle helpers
# ---------------------------------------------------------------------------

# ---- Morse code table (matches Rust source) ----

MORSE_ENCODE: dict[str, str] = {
    "A": ".-",    "B": "-...",  "C": "-.-.",  "D": "-..",   "E": ".",
    "F": "..-.",  "G": "--.",   "H": "....",  "I": "..",    "J": ".---",
    "K": "-.-",   "L": ".-..",  "M": "--",    "N": "-.",    "O": "---",
    "P": ".--.",  "Q": "--.-",  "R": ".-.",   "S": "...",   "T": "-",
    "U": "..-",   "V": "...-",  "W": ".--",   "X": "-..-",  "Y": "-.--",
    "Z": "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...",  "8": "---..",  "9": "----.",
    ".": ".-.-.-",  ",": "--..--",  "?": "..--..",  "!": "-.-.--",
    "'": ".----.",  '"': ".-..-.",  "/": "-..-.",   "(": "-.--.",
    ")": "-.--.-", "&": ".-...",   ":": "---...",  ";": "-.-.-.",
    "=": "-...-",  "+": ".-.-.",   "-": "-....-",  "_": "..--.-",
    "@": ".--.-.",
}

MORSE_DECODE: dict[str, str] = {v: k for k, v in MORSE_ENCODE.items()}


def oracle_morse_encode(text: str) -> str:
    words = text.upper().split(" ")
    coded_words: list[str] = []
    for word in words:
        codes = [MORSE_ENCODE[ch] for ch in word if ch in MORSE_ENCODE]
        coded_words.append(" ".join(codes))
    return " / ".join(coded_words)


def oracle_morse_decode(morse: str) -> str:
    words = morse.split(" / ")
    decoded_words: list[str] = []
    for word in words:
        chars = [MORSE_DECODE.get(code, "") for code in word.split(" ") if code]
        decoded_words.append("".join(chars))
    return " ".join(decoded_words)


# ---- HTML entity encoding (matches Rust: & < > " ' only) ----

HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
}

HTML_UNESCAPE_MAP = {v: k for k, v in HTML_ESCAPE_MAP.items()}


def oracle_html_encode(text: str) -> str:
    return "".join(HTML_ESCAPE_MAP.get(ch, ch) for ch in text)


def oracle_html_decode(text: str) -> str:
    result = text
    # Order matters: decode &amp; last so that &amp;lt; doesn't become &lt;
    for entity in ("&lt;", "&gt;", "&quot;", "&#39;", "&amp;"):
        result = result.replace(entity, HTML_UNESCAPE_MAP[entity])
    return result


# ---- Backslash escape (matches Rust source) ----

BACKSLASH_ESCAPE_MAP = {
    "\\": "\\\\",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    '"': '\\"',
    "'": "\\'",
}

BACKSLASH_UNESCAPE_MAP = {
    "\\\\": "\\",
    "\\n": "\n",
    "\\r": "\r",
    "\\t": "\t",
    '\\"': '"',
    "\\'": "'",
    "\\0": "\0",
}


def oracle_backslash_escape(text: str) -> str:
    return "".join(BACKSLASH_ESCAPE_MAP.get(ch, ch) for ch in text)


def oracle_backslash_unescape(text: str) -> str:
    result: list[str] = []
    i = 0
    while i < len(text):
        if text[i] == "\\" and i + 1 < len(text):
            two = text[i : i + 2]
            if two in BACKSLASH_UNESCAPE_MAP:
                result.append(BACKSLASH_UNESCAPE_MAP[two])
                i += 2
                continue
        result.append(text[i])
        i += 1
    return "".join(result)


# ---- Quote helper (matches Rust source) ----

def oracle_quote(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def oracle_unquote(text: str) -> str:
    s = text.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'", "`"):
        inner = s[1:-1]
        return inner.replace('\\"', '"').replace("\\\\", "\\")
    return s


# ---- Caesar cipher (matches Rust source) ----

def oracle_caesar_encrypt(text: str, shift: int) -> str:
    result: list[str] = []
    for ch in text:
        if "a" <= ch <= "z":
            result.append(chr((ord(ch) - ord("a") + shift) % 26 + ord("a")))
        elif "A" <= ch <= "Z":
            result.append(chr((ord(ch) - ord("A") + shift) % 26 + ord("A")))
        else:
            result.append(ch)
    return "".join(result)


def oracle_caesar_decrypt(text: str, shift: int) -> str:
    return oracle_caesar_encrypt(text, -shift)


# ---------------------------------------------------------------------------
# Assertion helper
# ---------------------------------------------------------------------------

def assert_tool_output(cli, tool_id, input_text, expected, *,
                       format_mode=None, indent=None):
    """Run tool through CLI and compare with oracle via stripped_match."""
    result = cli.run_tool(tool_id, input_text,
                          format_mode=format_mode, indent=indent)
    assert result.exit_code == 0, (
        f"{tool_id} exited {result.exit_code}: {result.stderr}"
    )
    passed, msg = stripped_match(result.stdout, expected)
    assert passed, (
        f"{tool_id} output mismatch:\n{msg}\n"
        f"--- input repr ---\n{input_text!r}"
    )


# ===================================================================
# 1. base64
# ===================================================================

class TestBase64:

    @pytest.mark.parametrize("text", [
        pytest.param("Hello, World!", id="ascii-greeting"),
        pytest.param("a", id="single-char"),
        pytest.param("ab", id="two-chars-padding"),
        pytest.param("abc", id="three-chars-no-padding"),
        pytest.param("line1\nline2\nline3", id="multiline"),
        pytest.param("café ☕ naïve", id="unicode-accents"),
        pytest.param("こんにちは世界", id="japanese"),
        pytest.param("🚀🎉💡", id="emoji"),
        pytest.param("<script>alert('xss')</script>", id="html-special"),
        pytest.param("a" * 1000, id="long-repeated"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_encode(self, cli, text):
        expected = base64.b64encode(text.encode()).decode()
        assert_tool_output(cli, "base64", text, expected, format_mode="format")

    @pytest.mark.parametrize("text", [
        pytest.param("Hello, World!", id="ascii-greeting"),
        pytest.param("abc", id="simple"),
        pytest.param("café ☕", id="unicode"),
        pytest.param("🚀🎉", id="emoji"),
        pytest.param("line1\nline2", id="newlines"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_decode(self, cli, text):
        encoded = base64.b64encode(text.encode()).decode()
        assert_tool_output(cli, "base64", encoded, text, format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = "Round-trip: àáâã 1234 🎯"
        enc_result = cli.run_tool("base64", original, format_mode="format")
        assert enc_result.exit_code == 0
        dec_result = cli.run_tool("base64", enc_result.stdout.strip(),
                                  format_mode="minify")
        assert dec_result.exit_code == 0
        passed, msg = stripped_match(dec_result.stdout, original)
        assert passed, f"base64 roundtrip mismatch:\n{msg}"


# ===================================================================
# 2. url
# ===================================================================

class TestUrlEncoding:

    @pytest.mark.parametrize("text, expected_fn", [
        pytest.param("hello world", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="space"),
        pytest.param("abc-._~xyz", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="unreserved-passthrough"),
        pytest.param("foo@bar.com", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="email"),
        pytest.param("a=1&b=2", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="query-params"),
        pytest.param("https://example.com/path?q=hello world",
                      lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="full-url"),
        pytest.param("café", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="unicode"),
        pytest.param("🚀", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="emoji"),
        pytest.param("<script>", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="angle-brackets"),
        pytest.param("100% done!", lambda t: urllib.parse.quote(t, safe="-._~"),
                      id="percent-sign"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_encode(self, cli, text, expected_fn):
        expected = expected_fn(text)
        assert_tool_output(cli, "url", text, expected, format_mode="format")

    @pytest.mark.parametrize("text", [
        pytest.param("hello world", id="space"),
        pytest.param("a=1&b=2", id="query-params"),
        pytest.param("café", id="unicode"),
        pytest.param("🚀", id="emoji"),
        pytest.param("100% done!", id="percent"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_decode(self, cli, text):
        encoded = urllib.parse.quote(text, safe="-._~")
        assert_tool_output(cli, "url", encoded, text, format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = "path/to/resource?name=value&special=@#$"
        enc_result = cli.run_tool("url", original, format_mode="format")
        assert enc_result.exit_code == 0
        dec_result = cli.run_tool("url", enc_result.stdout.strip(),
                                  format_mode="minify")
        assert dec_result.exit_code == 0
        passed, msg = stripped_match(dec_result.stdout, original)
        assert passed, f"url roundtrip mismatch:\n{msg}"


# ===================================================================
# 3. html-entity
# ===================================================================

class TestHtmlEntity:

    @pytest.mark.parametrize("text", [
        pytest.param('<p class="main">Hello & goodbye</p>', id="html-tags"),
        pytest.param("no special chars", id="passthrough"),
        pytest.param("&&&", id="multiple-amps"),
        pytest.param('She said "hello" & \'goodbye\'', id="all-five-chars"),
        pytest.param("<script>alert('xss')</script>", id="xss-vector"),
        pytest.param("a < b > c & d", id="math-expression"),
        pytest.param("Tom & Jerry's \"show\"", id="mixed"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_encode(self, cli, text):
        expected = oracle_html_encode(text)
        assert_tool_output(cli, "html-entity", text, expected,
                           format_mode="format")

    @pytest.mark.parametrize("text", [
        pytest.param('<p class="main">Hello & goodbye</p>', id="html-tags"),
        pytest.param("no special chars", id="passthrough"),
        pytest.param("&&&", id="amps"),
        pytest.param('She said "hello" & \'goodbye\'', id="all-five-chars"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_decode(self, cli, text):
        encoded = oracle_html_encode(text)
        assert_tool_output(cli, "html-entity", encoded, text,
                           format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = '<div class="alert">Warning: x < y & a > b</div>'
        enc_result = cli.run_tool("html-entity", original, format_mode="format")
        assert enc_result.exit_code == 0
        dec_result = cli.run_tool("html-entity", enc_result.stdout.strip(),
                                  format_mode="minify")
        assert dec_result.exit_code == 0
        passed, msg = stripped_match(dec_result.stdout, original)
        assert passed, f"html-entity roundtrip mismatch:\n{msg}"


# ===================================================================
# 4. utf8 (hex bytes)
# ===================================================================

class TestUtf8:

    @pytest.mark.parametrize("text", [
        pytest.param("Hello", id="ascii"),
        pytest.param("A", id="single-char"),
        pytest.param("café", id="unicode-accents"),
        pytest.param("こんにちは", id="japanese"),
        pytest.param("🚀", id="emoji"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_encode(self, cli, text):
        expected = " ".join(f"{b:02X}" for b in text.encode("utf-8"))
        assert_tool_output(cli, "utf8", text, expected, format_mode="format")

    @pytest.mark.parametrize("text", [
        pytest.param("Hello", id="ascii"),
        pytest.param("café", id="unicode"),
        pytest.param("🚀", id="emoji"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_decode(self, cli, text):
        hex_str = " ".join(f"{b:02X}" for b in text.encode("utf-8"))
        assert_tool_output(cli, "utf8", hex_str, text, format_mode="minify")

    @pytest.mark.category_a
    def test_decode_with_0x_prefix(self, cli):
        """Rust decoder strips 0x prefixes from hex chunks."""
        text = "Hi"
        hex_str = " ".join(f"0x{b:02X}" for b in text.encode("utf-8"))
        assert_tool_output(cli, "utf8", hex_str, text, format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = "UTF-8 roundtrip: été 日本語 🎉"
        enc_result = cli.run_tool("utf8", original, format_mode="format")
        assert enc_result.exit_code == 0
        dec_result = cli.run_tool("utf8", enc_result.stdout.strip(),
                                  format_mode="minify")
        assert dec_result.exit_code == 0
        passed, msg = stripped_match(dec_result.stdout, original)
        assert passed, f"utf8 roundtrip mismatch:\n{msg}"


# ===================================================================
# 5. binary-code
# ===================================================================

class TestBinaryCode:

    @pytest.mark.parametrize("text", [
        pytest.param("Hello", id="ascii"),
        pytest.param("A", id="single-char"),
        pytest.param("AB", id="two-chars"),
        pytest.param("café", id="unicode"),
        pytest.param("🚀", id="emoji"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_encode(self, cli, text):
        expected = " ".join(f"{b:08b}" for b in text.encode("utf-8"))
        assert_tool_output(cli, "binary-code", text, expected,
                           format_mode="format")

    @pytest.mark.parametrize("text", [
        pytest.param("Hello", id="ascii"),
        pytest.param("AB", id="two-chars"),
        pytest.param("café", id="unicode"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_decode(self, cli, text):
        binary_str = " ".join(f"{b:08b}" for b in text.encode("utf-8"))
        assert_tool_output(cli, "binary-code", binary_str, text,
                           format_mode="minify")

    @pytest.mark.category_a
    def test_decode_no_spaces(self, cli):
        """Rust decoder handles 8-bit chunks when no spaces present."""
        text = "Hi"
        binary_str = "".join(f"{b:08b}" for b in text.encode("utf-8"))
        assert_tool_output(cli, "binary-code", binary_str, text,
                           format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = "Binary roundtrip!"
        enc_result = cli.run_tool("binary-code", original, format_mode="format")
        assert enc_result.exit_code == 0
        dec_result = cli.run_tool("binary-code", enc_result.stdout.strip(),
                                  format_mode="minify")
        assert dec_result.exit_code == 0
        passed, msg = stripped_match(dec_result.stdout, original)
        assert passed, f"binary-code roundtrip mismatch:\n{msg}"


# ===================================================================
# 6. morse-code
# ===================================================================

class TestMorseCode:

    @pytest.mark.parametrize("text, expected", [
        pytest.param("SOS", "... --- ...", id="sos"),
        pytest.param("HELLO", ".... . .-.. .-.. ---", id="hello"),
        pytest.param("HELLO WORLD",
                     ".... . .-.. .-.. --- / .-- --- .-. .-.. -..",
                     id="hello-world"),
        pytest.param("hello world",
                     ".... . .-.. .-.. --- / .-- --- .-. .-.. -..",
                     id="lowercase-uppercased"),
        pytest.param("A", ".-", id="single-letter"),
        pytest.param("1", ".----", id="single-digit"),
        pytest.param("123", ".---- ..--- ...--", id="digits"),
        pytest.param("HI THERE",
                     ".... .. / - .... . .-. .",
                     id="two-words"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_encode(self, cli, text, expected):
        assert_tool_output(cli, "morse-code", text, expected,
                           format_mode="format")

    @pytest.mark.category_a
    def test_encode_oracle(self, cli):
        text = "QUICK BROWN FOX"
        expected = oracle_morse_encode(text)
        assert_tool_output(cli, "morse-code", text, expected,
                           format_mode="format")

    @pytest.mark.parametrize("morse, expected", [
        pytest.param("... --- ...", "SOS", id="sos"),
        pytest.param(".... . .-.. .-.. ---", "HELLO", id="hello"),
        pytest.param(".... . .-.. .-.. --- / .-- --- .-. .-.. -..",
                     "HELLO WORLD", id="hello-world"),
        pytest.param(".-", "A", id="single-letter"),
        pytest.param(".---- ..--- ...--", "123", id="digits"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_decode(self, cli, morse, expected):
        assert_tool_output(cli, "morse-code", morse, expected,
                           format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = "THE QUICK BROWN FOX"
        enc_result = cli.run_tool("morse-code", original, format_mode="format")
        assert enc_result.exit_code == 0
        dec_result = cli.run_tool("morse-code", enc_result.stdout.strip(),
                                  format_mode="minify")
        assert dec_result.exit_code == 0
        # Morse decode always produces uppercase
        passed, msg = stripped_match(dec_result.stdout, original.upper())
        assert passed, f"morse-code roundtrip mismatch:\n{msg}"

    @pytest.mark.category_a
    def test_encode_with_punctuation(self, cli):
        text = "HELLO, WORLD!"
        expected = oracle_morse_encode(text)
        assert_tool_output(cli, "morse-code", text, expected,
                           format_mode="format")


# ===================================================================
# 7. rot13
# ===================================================================

class TestRot13:

    @pytest.mark.parametrize("text", [
        pytest.param("Hello, World!", id="basic"),
        pytest.param("abcdefghijklmnopqrstuvwxyz", id="full-lowercase"),
        pytest.param("ABCDEFGHIJKLMNOPQRSTUVWXYZ", id="full-uppercase"),
        pytest.param("The Quick Brown Fox Jumps Over The Lazy Dog",
                     id="pangram"),
        pytest.param("12345!@#$%", id="non-alpha-unchanged"),
        pytest.param("AaBbCc", id="mixed-case"),
        pytest.param("café naïve", id="unicode-passthrough"),
        pytest.param("🚀 rocket", id="emoji-mixed"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_rot13(self, cli, text):
        expected = codecs.encode(text, "rot_13")
        assert_tool_output(cli, "rot13", text, expected, format_mode="format")

    @pytest.mark.category_a
    def test_double_rot13_is_identity(self, cli):
        original = "Double ROT13 = identity"
        first = cli.run_tool("rot13", original, format_mode="format")
        assert first.exit_code == 0
        second = cli.run_tool("rot13", first.stdout.strip(),
                              format_mode="format")
        assert second.exit_code == 0
        passed, msg = stripped_match(second.stdout, original)
        assert passed, f"rot13 double-apply mismatch:\n{msg}"

    @pytest.mark.category_a
    def test_rot13_involution(self, cli):
        """ROT13 applied twice returns original - also test via minify mode."""
        original = "Test involution."
        enc = cli.run_tool("rot13", original, format_mode="format")
        assert enc.exit_code == 0
        dec = cli.run_tool("rot13", enc.stdout.strip(), format_mode="minify")
        assert dec.exit_code == 0
        passed, msg = stripped_match(dec.stdout, original)
        assert passed, f"rot13 involution mismatch:\n{msg}"


# ===================================================================
# 8. caesar-cipher
# ===================================================================

class TestCaesarCipher:

    @pytest.mark.parametrize("text, shift", [
        pytest.param("Hello, World!", 3, id="shift-3"),
        pytest.param("Hello, World!", 1, id="shift-1"),
        pytest.param("Hello, World!", 25, id="shift-25"),
        pytest.param("Hello, World!", 13, id="shift-13-like-rot13"),
        pytest.param("abcxyz", 3, id="wrap-around"),
        pytest.param("ABCXYZ", 3, id="wrap-around-upper"),
        pytest.param("123!@#", 7, id="non-alpha-unchanged"),
        pytest.param("The Quick Brown Fox", 10, id="pangram-shift10"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_encrypt(self, cli, text, shift):
        expected = oracle_caesar_encrypt(text, shift)
        assert_tool_output(cli, "caesar-cipher", text, expected,
                           format_mode="format", indent=shift)

    @pytest.mark.parametrize("text, shift", [
        pytest.param("Hello, World!", 3, id="shift-3"),
        pytest.param("abcxyz", 3, id="wrap-around"),
        pytest.param("ABCXYZ", 3, id="wrap-upper"),
        pytest.param("The Quick Brown Fox", 10, id="shift-10"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_decrypt(self, cli, text, shift):
        encrypted = oracle_caesar_encrypt(text, shift)
        assert_tool_output(cli, "caesar-cipher", encrypted, text,
                           format_mode="minify", indent=shift)

    @pytest.mark.category_a
    def test_default_shift_is_3(self, cli):
        """When no indent (shift) is specified, default is 3."""
        text = "Hello"
        expected = oracle_caesar_encrypt(text, 3)
        assert_tool_output(cli, "caesar-cipher", text, expected,
                           format_mode="format")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = "Caesar cipher roundtrip!"
        shift = 7
        enc = cli.run_tool("caesar-cipher", original,
                           format_mode="format", indent=shift)
        assert enc.exit_code == 0
        dec = cli.run_tool("caesar-cipher", enc.stdout.strip(),
                           format_mode="minify", indent=shift)
        assert dec.exit_code == 0
        passed, msg = stripped_match(dec.stdout, original)
        assert passed, f"caesar-cipher roundtrip mismatch:\n{msg}"


# ===================================================================
# 9. backslash-escape
# ===================================================================

class TestBackslashEscape:

    @pytest.mark.parametrize("text", [
        pytest.param("Hello\\World", id="backslash"),
        pytest.param("line1\nline2", id="newline"),
        pytest.param("tab\there", id="tab"),
        pytest.param("carriage\rreturn", id="carriage-return"),
        pytest.param('She said "hi"', id="double-quotes"),
        pytest.param("It's fine", id="single-quote"),
        pytest.param("all\\of\n\tthem\"'", id="all-escapes"),
        pytest.param("no special chars", id="passthrough"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_escape(self, cli, text):
        expected = oracle_backslash_escape(text)
        assert_tool_output(cli, "backslash-escape", text, expected,
                           format_mode="format")

    @pytest.mark.parametrize("text", [
        pytest.param("Hello\\World", id="backslash"),
        pytest.param("line1\nline2", id="newline"),
        pytest.param("tab\there", id="tab"),
        pytest.param('She said "hi"', id="double-quotes"),
        pytest.param("all\\of\n\tthem\"'", id="all-escapes"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_unescape(self, cli, text):
        escaped = oracle_backslash_escape(text)
        assert_tool_output(cli, "backslash-escape", escaped, text,
                           format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = "Path: C:\\Users\\test\nLine2\t\"quoted\""
        enc = cli.run_tool("backslash-escape", original, format_mode="format")
        assert enc.exit_code == 0
        dec = cli.run_tool("backslash-escape", enc.stdout.strip(),
                           format_mode="minify")
        assert dec.exit_code == 0
        passed, msg = stripped_match(dec.stdout, original)
        assert passed, f"backslash-escape roundtrip mismatch:\n{msg}"


# ===================================================================
# 10. quote-helper
# ===================================================================

class TestQuoteHelper:

    @pytest.mark.parametrize("text, expected", [
        pytest.param("hello", '"hello"', id="simple"),
        pytest.param('say "hi"', '"say \\"hi\\""', id="inner-quotes"),
        pytest.param("back\\slash", '"back\\\\slash"', id="backslash"),
        pytest.param('both \\ and "', '"both \\\\ and \\""', id="both"),
        pytest.param("no escapes needed", '"no escapes needed"', id="plain"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_quote(self, cli, text, expected):
        assert_tool_output(cli, "quote-helper", text, expected,
                           format_mode="format")

    @pytest.mark.category_a
    def test_quote_oracle(self, cli):
        text = 'complex "string" with \\ chars'
        expected = oracle_quote(text)
        assert_tool_output(cli, "quote-helper", text, expected,
                           format_mode="format")

    @pytest.mark.parametrize("quoted, expected", [
        pytest.param('"hello"', "hello", id="double-quoted"),
        pytest.param("'hello'", "hello", id="single-quoted"),
        pytest.param("`hello`", "hello", id="backtick-quoted"),
        pytest.param('"say \\"hi\\""', 'say "hi"', id="escaped-inner"),
        pytest.param('"back\\\\slash"', "back\\slash", id="escaped-backslash"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_unquote(self, cli, quoted, expected):
        assert_tool_output(cli, "quote-helper", quoted, expected,
                           format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = 'A "quoted" and \\escaped\\ string'
        enc = cli.run_tool("quote-helper", original, format_mode="format")
        assert enc.exit_code == 0
        dec = cli.run_tool("quote-helper", enc.stdout.strip(),
                           format_mode="minify")
        assert dec.exit_code == 0
        passed, msg = stripped_match(dec.stdout, original)
        assert passed, f"quote-helper roundtrip mismatch:\n{msg}"


# ===================================================================
# 11. json-stringify
# ===================================================================

class TestJsonStringify:

    @pytest.mark.parametrize("text", [
        pytest.param("Hello, World!", id="basic"),
        pytest.param("line1\nline2", id="newline"),
        pytest.param("tab\there", id="tab"),
        pytest.param('She said "hello"', id="double-quotes"),
        pytest.param("back\\slash", id="backslash"),
        pytest.param("café ☕", id="unicode"),
        pytest.param("🚀🎉", id="emoji"),
        pytest.param("a" * 500, id="long-string"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_stringify(self, cli, text):
        expected = json.dumps(text, ensure_ascii=False)
        assert_tool_output(cli, "json-stringify", text, expected,
                           format_mode="format")

    @pytest.mark.parametrize("text", [
        pytest.param("Hello, World!", id="basic"),
        pytest.param("line1\nline2", id="newline"),
        pytest.param('She said "hello"', id="double-quotes"),
        pytest.param("back\\slash", id="backslash"),
        pytest.param("café ☕", id="unicode"),
        pytest.param("🚀", id="emoji"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_unstringify(self, cli, text):
        stringified = json.dumps(text, ensure_ascii=False)
        assert_tool_output(cli, "json-stringify", stringified, text,
                           format_mode="minify")

    @pytest.mark.category_a
    def test_roundtrip(self, cli):
        original = 'JSON: "quotes" and \\backslash\\ and \nnewlines'
        enc = cli.run_tool("json-stringify", original, format_mode="format")
        assert enc.exit_code == 0
        dec = cli.run_tool("json-stringify", enc.stdout.strip(),
                           format_mode="minify")
        assert dec.exit_code == 0
        passed, msg = stripped_match(dec.stdout, original)
        assert passed, f"json-stringify roundtrip mismatch:\n{msg}"
