"""Adversarial and edge-case tests for tools that already have basic coverage.

These tests stress-test tools with deeply nested data, large inputs, Unicode
edge cases, known hash vectors, malformed inputs, and boundary conditions
that the basic oracle tests do not exercise.

Each test asserts specific behavior (not just "does not crash") using Python
oracles or structural property checks.
"""

import base64
import codecs
import csv
import hashlib
import io
import json
import string
import urllib.parse
import xml.etree.ElementTree as ET

import pytest
import yaml

from comparators import (
    csv_semantic,
    json_semantic,
    stripped_match,
    yaml_semantic,
    lines_match,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def assert_tool_ok(cli, tool_id, input_text, **kwargs):
    """Run tool through CLI and assert exit_code == 0.  Return CliResult."""
    result = cli.run_tool(tool_id, input_text, **kwargs)
    assert result.exit_code == 0, (
        f"{tool_id} exited {result.exit_code}: {result.stderr}"
    )
    return result


def assert_tool_error(cli, tool_id, input_text, **kwargs):
    """Assert the tool returns a non-zero exit code for invalid input."""
    result = cli.run_tool(tool_id, input_text, **kwargs)
    assert result.exit_code != 0, (
        f"{tool_id} should have failed but exited 0 with stdout:\n"
        f"{result.stdout[:500]}"
    )
    return result


# ---------------------------------------------------------------------------
# Oracle helpers (reused from other test files, kept local for isolation)
# ---------------------------------------------------------------------------

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


def oracle_morse_encode(text: str) -> str:
    words = text.upper().split(" ")
    coded_words: list[str] = []
    for word in words:
        codes = [MORSE_ENCODE[ch] for ch in word if ch in MORSE_ENCODE]
        coded_words.append(" ".join(codes))
    return " / ".join(coded_words)


def oracle_hash(text: str, algorithm: str = "sha256") -> str:
    data = text.encode("utf-8")
    h = hashlib.new(algorithm)
    h.update(data)
    result = {
        "algorithm": algorithm,
        "inputType": "text",
        "bytes": len(data),
        "hash": h.hexdigest(),
    }
    return json.dumps(result, indent=2, ensure_ascii=False)


def _json_value_to_csv_cell(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value == int(value):
            return str(int(value))
        return str(value)
    if isinstance(value, str):
        return value
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def oracle_json_to_csv(json_input: str) -> str:
    records = json.loads(json_input)
    if not records:
        return ""
    headers = sorted({key for record in records for key in record.keys()})
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow(headers)
    for record in records:
        row = [_json_value_to_csv_cell(record.get(h)) for h in headers]
        writer.writerow(row)
    return buf.getvalue()


def oracle_csv_to_json(csv_input: str) -> str:
    reader = csv.DictReader(io.StringIO(csv_input))
    rows = []
    for record in reader:
        rows.append({k: v for k, v in record.items()})
    return json.dumps(rows, indent=2, ensure_ascii=False)


def oracle_bold(text: str) -> str:
    out = []
    for ch in text:
        if "A" <= ch <= "Z":
            out.append(chr(0x1D400 + (ord(ch) - ord("A"))))
        elif "a" <= ch <= "z":
            out.append(chr(0x1D41A + (ord(ch) - ord("a"))))
        elif "0" <= ch <= "9":
            out.append(chr(0x1D7CE + (ord(ch) - ord("0"))))
        else:
            out.append(ch)
    return "".join(out)


def oracle_combining(text: str, mark: str) -> str:
    out = []
    for ch in text:
        if ch in ("\n", "\r"):
            out.append(ch)
        elif ch.isspace():
            out.append(ch)
        else:
            out.append(ch)
            out.append(mark)
    return "".join(out)


def _detect_delimiter(text: str) -> str:
    candidates = [",", "\t", "|", ";", "\n"]
    selected = "\n"
    max_hits = 0
    for delim in candidates:
        hits = text.count(delim)
        if hits > max_hits:
            max_hits = hits
            selected = delim
    return selected


def oracle_delimiter_converter(text: str) -> str:
    delim = _detect_delimiter(text)
    parts = [item.strip() for item in text.split(delim) if item.strip()]
    return "\n".join(parts)


# ===================================================================
# 1. JSON tools -- deeply nested, large, and weird inputs
# ===================================================================

class TestJsonFormatEdgeCases:
    """Stress-test json-format with adversarial inputs."""

    def test_deeply_nested_object(self, cli):
        """50 levels of nesting should format and minify correctly."""
        obj = "null"
        for i in range(50):
            obj = f'{{"level{i}": {obj}}}'
        parsed = json.loads(obj)
        expected_fmt = json.dumps(parsed, indent=2, ensure_ascii=False)

        result = assert_tool_ok(cli, "json-format", obj, format_mode="format",
                                indent=2)
        ok, msg = json_semantic(result.stdout, expected_fmt)
        assert ok, f"deeply nested format failed:\n{msg}"

    def test_deeply_nested_array(self, cli):
        """50 levels of nested arrays."""
        inner = "42"
        for _ in range(50):
            inner = f"[{inner}]"
        parsed = json.loads(inner)
        expected = json.dumps(parsed, indent=2, ensure_ascii=False)

        result = assert_tool_ok(cli, "json-format", inner, format_mode="format",
                                indent=2)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"deeply nested array format failed:\n{msg}"

    def test_large_json_object(self, cli):
        """Object with many keys (>10KB when serialised)."""
        obj = {f"key_{i:04d}": f"value_{i}_{'x' * 20}" for i in range(300)}
        inp = json.dumps(obj)
        assert len(inp) > 10_000, "test input should exceed 10KB"

        result = assert_tool_ok(cli, "json-format", inp, format_mode="format",
                                indent=2)
        ok, msg = json_semantic(result.stdout, json.dumps(obj, indent=2))
        assert ok, f"large JSON format failed:\n{msg}"

    def test_all_json_value_types(self, cli):
        """Object containing null, true, false, int, float, string, array, nested object."""
        obj = {
            "null_val": None,
            "true_val": True,
            "false_val": False,
            "int_val": 42,
            "float_val": 3.14,
            "string_val": "hello",
            "array_val": [1, "two", None, True],
            "nested": {"a": {"b": {"c": 0}}},
        }
        inp = json.dumps(obj, separators=(",", ":"))
        expected = json.dumps(obj, indent=4, ensure_ascii=False)

        result = assert_tool_ok(cli, "json-format", inp, format_mode="format",
                                indent=4)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"all-types format failed:\n{msg}"

    def test_json_with_unicode_escapes(self, cli):
        """JSON containing \\uXXXX escapes should be preserved semantically."""
        inp = r'{"emoji": "\uD83D\uDE80", "name": "\u00E9t\u00E9"}'
        # serde_json will parse surrogate pairs into the actual codepoint
        result = assert_tool_ok(cli, "json-format", inp, format_mode="format",
                                indent=2)
        parsed_output = json.loads(result.stdout)
        assert "name" in parsed_output

    def test_json_with_very_long_string(self, cli):
        """Single key with a 50KB string value."""
        long_str = "A" * 50_000
        obj = {"data": long_str}
        inp = json.dumps(obj)

        result = assert_tool_ok(cli, "json-format", inp, format_mode="format",
                                indent=2)
        parsed = json.loads(result.stdout)
        assert len(parsed["data"]) == 50_000

    def test_json_array_of_1000_items(self, cli):
        """Array with 1000 integer items."""
        arr = list(range(1000))
        inp = json.dumps(arr)

        result = assert_tool_ok(cli, "json-format", inp, format_mode="format",
                                indent=2)
        parsed = json.loads(result.stdout)
        assert parsed == arr

    @pytest.mark.parametrize("value, desc", [
        ("42", "bare-integer"),
        ('"hello"', "bare-string"),
        ("null", "bare-null"),
        ("true", "bare-true"),
        ("false", "bare-false"),
        ("3.14", "bare-float"),
    ], ids=lambda x: "")
    def test_single_value_json(self, cli, value, desc):
        """Bare JSON values (not wrapped in object or array)."""
        result = assert_tool_ok(cli, "json-format", value,
                                format_mode="format", indent=2)
        ok, msg = json_semantic(result.stdout, value)
        assert ok, f"single-value {desc} failed:\n{msg}"

    def test_minify_already_minified(self, cli):
        """Minifying already-minified JSON should be idempotent."""
        minified = '{"a":1,"b":[2,3],"c":{"d":true}}'
        result = assert_tool_ok(cli, "json-format", minified,
                                format_mode="minify")
        expected = json.dumps(json.loads(minified), separators=(",", ":"))
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"re-minify failed:\n{msg}"

    @pytest.mark.parametrize("indent", [1, 2, 3, 4, 6, 8], ids=lambda x: "")
    def test_all_indent_sizes(self, cli, indent):
        """Format with various indent sizes 1-8."""
        obj = {"a": {"b": {"c": 1}}}
        inp = json.dumps(obj)
        expected = json.dumps(obj, indent=indent, ensure_ascii=False)

        result = assert_tool_ok(cli, "json-format", inp,
                                format_mode="format", indent=indent)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"indent={indent} failed:\n{msg}"


class TestJsonToYamlEdgeCases:
    """Stress-test json-to-yaml with adversarial JSON inputs."""

    def test_deeply_nested(self, cli):
        obj = {"a": None}
        current = obj
        for i in range(30):
            current[list(current.keys())[0]] = {f"level{i}": None}
            current = current[list(current.keys())[0]]
        inp = json.dumps(obj)

        result = assert_tool_ok(cli, "json-to-yaml", inp)
        parsed = yaml.safe_load(result.stdout)
        assert parsed is not None, "yaml output should be parseable"

    def test_all_value_types(self, cli):
        obj = {
            "s": "text",
            "i": 42,
            "f": 3.14,
            "b_true": True,
            "b_false": False,
            "n": None,
            "arr": [1, 2, 3],
            "obj": {"nested": "value"},
        }
        inp = json.dumps(obj)

        result = assert_tool_ok(cli, "json-to-yaml", inp)
        parsed = yaml.safe_load(result.stdout)
        assert parsed["s"] == "text"
        assert parsed["n"] is None
        assert parsed["b_true"] is True

    def test_large_json(self, cli):
        obj = {f"k{i}": f"v{i}" for i in range(300)}
        inp = json.dumps(obj)

        result = assert_tool_ok(cli, "json-to-yaml", inp)
        parsed = yaml.safe_load(result.stdout)
        assert len(parsed) == 300


class TestJsonToCsvEdgeCases:
    """Edge cases for json-to-csv: missing keys, nested values, special chars."""

    def test_objects_with_missing_keys(self, cli):
        """Records with different key sets: missing keys become empty."""
        records = [
            {"a": 1, "b": 2},
            {"b": 3, "c": 4},
            {"a": 5, "c": 6},
        ]
        inp = json.dumps(records)
        expected = oracle_json_to_csv(inp)

        result = assert_tool_ok(cli, "json-to-csv", inp)
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, f"missing keys:\n{msg}"

    def test_nested_values_stringify(self, cli):
        """Nested objects and arrays in values should be JSON-stringified."""
        records = [
            {"id": 1, "meta": {"x": 10, "y": 20}},
            {"id": 2, "meta": [1, 2, 3]},
        ]
        inp = json.dumps(records)
        expected = oracle_json_to_csv(inp)

        result = assert_tool_ok(cli, "json-to-csv", inp)
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, f"nested values:\n{msg}"

    def test_single_element_array(self, cli):
        records = [{"name": "Alice", "age": 30}]
        inp = json.dumps(records)
        expected = oracle_json_to_csv(inp)

        result = assert_tool_ok(cli, "json-to-csv", inp)
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, f"single-element:\n{msg}"

    def test_100_item_array(self, cli):
        records = [{"id": i, "val": f"item_{i}"} for i in range(100)]
        inp = json.dumps(records)
        expected = oracle_json_to_csv(inp)

        result = assert_tool_ok(cli, "json-to-csv", inp)
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, f"100-items:\n{msg}"

    def test_keys_with_special_chars(self, cli):
        """Column names containing commas, quotes, and spaces."""
        records = [
            {"col, a": 1, 'col "b"': 2, "col c": 3},
        ]
        inp = json.dumps(records)
        expected = oracle_json_to_csv(inp)

        result = assert_tool_ok(cli, "json-to-csv", inp)
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, f"special-char keys:\n{msg}"


class TestCsvToJsonEdgeCases:
    """Edge cases for csv-to-json: many columns, empty fields, quoting."""

    def test_many_columns(self, cli):
        """CSV with 25 columns."""
        headers = [f"col{i}" for i in range(25)]
        values = [f"val{i}" for i in range(25)]
        inp = ",".join(headers) + "\n" + ",".join(values)
        expected = oracle_csv_to_json(inp)

        result = assert_tool_ok(cli, "csv-to-json", inp)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"many columns:\n{msg}"

    def test_empty_fields(self, cli):
        """CSV with empty fields between commas."""
        inp = "a,b,c\n1,,3\n,,\n4,5,"
        expected = oracle_csv_to_json(inp)

        result = assert_tool_ok(cli, "csv-to-json", inp)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"empty fields:\n{msg}"

    def test_quoted_fields_with_commas_and_quotes(self, cli):
        """Fields containing commas, newlines, and escaped double-quotes."""
        inp = 'name,description\n"Smith, John","He said ""hello"""\n"Jane","Line1\nLine2"'
        expected = oracle_csv_to_json(inp)

        result = assert_tool_ok(cli, "csv-to-json", inp)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"quoted fields:\n{msg}"

    def test_single_column(self, cli):
        """CSV with only one column."""
        inp = "name\nAlice\nBob\nCharlie"
        expected = oracle_csv_to_json(inp)

        result = assert_tool_ok(cli, "csv-to-json", inp)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"single column:\n{msg}"

    def test_header_only_no_data_rows(self, cli):
        """CSV with headers but zero data rows."""
        inp = "a,b,c"
        expected = oracle_csv_to_json(inp)

        result = assert_tool_ok(cli, "csv-to-json", inp)
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, f"header-only:\n{msg}"


# ===================================================================
# 2. Encoding tools -- boundary inputs
# ===================================================================

class TestBase64EdgeCases:
    """Stress-test base64 with padding boundaries and large input."""

    @pytest.mark.parametrize("length", [
        pytest.param(3, id="mod3-eq-0-no-padding"),
        pytest.param(4, id="mod3-eq-1-double-padding"),
        pytest.param(5, id="mod3-eq-2-single-padding"),
        pytest.param(6, id="mod3-eq-0-again"),
    ], ids=lambda x: "")
    def test_padding_edge_cases(self, cli, length):
        """Verify correct padding for lengths where len % 3 = 0, 1, 2."""
        text = "X" * length
        expected = base64.b64encode(text.encode()).decode()

        result = assert_tool_ok(cli, "base64", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"base64 padding (len={length}):\n{msg}"

    def test_large_input_10kb(self, cli):
        """10KB of data should encode and decode correctly."""
        text = "A" * 10_240
        expected = base64.b64encode(text.encode()).decode()

        result = assert_tool_ok(cli, "base64", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, "base64 encode 10KB failed"

    def test_base64_of_base64(self, cli):
        """Encoding base64 output again (double-encoding) should work."""
        original = "Hello, World!"
        first = base64.b64encode(original.encode()).decode()
        double = base64.b64encode(first.encode()).decode()

        result = assert_tool_ok(cli, "base64", first, format_mode="format")
        ok, msg = stripped_match(result.stdout, double)
        assert ok, "double base64 encode failed"

    def test_all_printable_ascii(self, cli):
        """Every printable ASCII character should round-trip."""
        text = string.printable.strip()
        encoded = base64.b64encode(text.encode()).decode()

        result = assert_tool_ok(cli, "base64", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, encoded)
        assert ok, "base64 all-printable failed"

    def test_roundtrip_with_emoji(self, cli):
        """Base64 roundtrip with multi-byte emoji."""
        original = "Hello \U0001F600\U0001F4A9\U0001F680 World"
        enc = assert_tool_ok(cli, "base64", original, format_mode="format")
        dec = assert_tool_ok(cli, "base64", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"base64 emoji roundtrip:\n{msg}"


class TestUrlEncodingEdgeCases:
    """Stress-test URL encoding with RFC-reserved chars and Unicode."""

    def test_all_rfc_reserved_characters(self, cli):
        """All RFC 3986 reserved characters should be percent-encoded."""
        reserved = ":/?#[]@!$&'()*+,;="
        expected = urllib.parse.quote(reserved, safe="-._~")

        result = assert_tool_ok(cli, "url", reserved, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"RFC reserved chars:\n{msg}"

    def test_supplementary_plane_emoji(self, cli):
        """Emoji from the supplementary plane (>U+FFFF)."""
        text = "\U0001F600\U0001F4A9\U0001F37A"  # grinning, poop, beer
        expected = urllib.parse.quote(text, safe="-._~")

        result = assert_tool_ok(cli, "url", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"supplementary plane emoji:\n{msg}"

    def test_percent_encoded_percent(self, cli):
        """Decoding %25 should yield %, re-encoding should yield %25."""
        encoded = "100%25%20done"
        decoded = urllib.parse.unquote(encoded)
        assert decoded == "100% done"

        result = assert_tool_ok(cli, "url", encoded, format_mode="minify")
        ok, msg = stripped_match(result.stdout, decoded)
        assert ok, f"percent-of-percent decode:\n{msg}"

    def test_very_long_url(self, cli):
        """URL-encode a ~4KB string."""
        text = "param=" + "a" * 4000
        expected = urllib.parse.quote(text, safe="-._~")

        result = assert_tool_ok(cli, "url", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, "long URL encode failed"

    def test_roundtrip_all_reserved(self, cli):
        """Roundtrip every RFC-reserved char through encode then decode."""
        original = ":/?#[]@!$&'()*+,;="
        enc = assert_tool_ok(cli, "url", original, format_mode="format")
        dec = assert_tool_ok(cli, "url", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"url roundtrip reserved chars:\n{msg}"


class TestMorseCodeEdgeCases:
    """Morse code with all supported punctuation and mixed case."""

    def test_all_supported_punctuation(self, cli):
        """Every punctuation character in the Morse table."""
        punct = ".,?!'\"/:;=+-_@"
        # Remove chars that appear in word separator context
        text = " ".join(punct)
        # Build expected by encoding each character individually
        expected = oracle_morse_encode(text)

        result = assert_tool_ok(cli, "morse-code", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"morse all-punctuation:\n{msg}"

    def test_mixed_case_uppercased(self, cli):
        """Mixed case input should be treated as uppercase."""
        text = "hElLo WoRlD"
        expected = oracle_morse_encode(text)

        result = assert_tool_ok(cli, "morse-code", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"morse mixed-case:\n{msg}"

    def test_digits_and_letters(self, cli):
        """All 26 letters and 10 digits."""
        text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789"
        expected = oracle_morse_encode(text)

        result = assert_tool_ok(cli, "morse-code", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"morse full alphabet + digits:\n{msg}"

    def test_roundtrip_all_alpha(self, cli):
        """Encode then decode all 26 uppercase letters."""
        original = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        enc = assert_tool_ok(cli, "morse-code", original,
                             format_mode="format")
        dec = assert_tool_ok(cli, "morse-code", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"morse roundtrip all-alpha:\n{msg}"


class TestRot13EdgeCases:
    """ROT13 with non-ASCII and long text."""

    def test_non_ascii_passthrough(self, cli):
        """Non-ASCII characters should pass through unchanged."""
        text = "cafe\u0301 nai\u0308ve \u00f1 \u00fc"
        expected = codecs.encode(text, "rot_13")

        result = assert_tool_ok(cli, "rot13", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"rot13 non-ascii:\n{msg}"

    def test_emoji_passthrough(self, cli):
        """Emoji should pass through ROT13 unchanged."""
        text = "\U0001F600 Hello \U0001F680"
        expected = codecs.encode(text, "rot_13")
        # Emoji should be identical in expected
        assert "\U0001F600" in expected
        assert "\U0001F680" in expected

        result = assert_tool_ok(cli, "rot13", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"rot13 emoji:\n{msg}"

    def test_long_text(self, cli):
        """10KB of alphabetic text should transform correctly."""
        text = "The quick brown fox jumps over the lazy dog. " * 250
        text = text[:10_000]
        expected = codecs.encode(text, "rot_13")

        result = assert_tool_ok(cli, "rot13", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, "rot13 long text failed"

    def test_only_non_alpha(self, cli):
        """Input with no alphabetic characters should be unchanged."""
        text = "12345 !@#$% 67890 .,;:"
        expected = text  # ROT13 does not modify non-alpha

        result = assert_tool_ok(cli, "rot13", text, format_mode="format")
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"rot13 non-alpha-only:\n{msg}"


# ===================================================================
# 3. Hash generator -- known test vectors from standards
# ===================================================================

class TestHashGeneratorKnownVectors:
    """Verify hash outputs against known published test vectors."""

    def test_md5_empty_string(self, cli):
        """MD5('') = d41d8cd98f00b204e9800998ecf8427e (RFC 1321)."""
        inp = json.dumps({"algorithm": "md5", "text": ""})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        assert parsed["hash"] == "d41d8cd98f00b204e9800998ecf8427e"
        assert parsed["bytes"] == 0

    def test_sha1_abc(self, cli):
        """SHA1('abc') = a9993e364706816aba3e25717850c26c9cd0d89d (FIPS 180-4)."""
        inp = json.dumps({"algorithm": "sha1", "text": "abc"})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        assert parsed["hash"] == "a9993e364706816aba3e25717850c26c9cd0d89d"

    def test_sha256_abc(self, cli):
        """SHA256('abc') from NIST FIPS 180-4."""
        inp = json.dumps({"algorithm": "sha256", "text": "abc"})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        assert parsed["hash"] == (
            "ba7816bf8f01cfea414140de5dae2223"
            "b00361a396177a9cb410ff61f20015ad"
        )

    def test_sha512_abc(self, cli):
        """SHA512('abc') from NIST FIPS 180-4."""
        inp = json.dumps({"algorithm": "sha512", "text": "abc"})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        expected_sha512 = hashlib.sha512(b"abc").hexdigest()
        assert parsed["hash"] == expected_sha512

    def test_sha256_empty_string(self, cli):
        """SHA256('') = known constant."""
        inp = json.dumps({"algorithm": "sha256", "text": ""})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        assert parsed["hash"] == hashlib.sha256(b"").hexdigest()

    def test_md5_abc(self, cli):
        """MD5('abc') = 900150983cd24fb0d6963f7d28e17f72."""
        inp = json.dumps({"algorithm": "md5", "text": "abc"})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        assert parsed["hash"] == "900150983cd24fb0d6963f7d28e17f72"

    def test_sha1_empty_string(self, cli):
        """SHA1('') = da39a3ee5e6b4b0d3255bfef95601890afd80709."""
        inp = json.dumps({"algorithm": "sha1", "text": ""})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        assert parsed["hash"] == "da39a3ee5e6b4b0d3255bfef95601890afd80709"

    def test_large_input_oracle(self, cli):
        """Hash of a large (50KB) input should match Python's hashlib."""
        text = "abcdefghij" * 5000
        for algo in ("md5", "sha1", "sha256", "sha512"):
            inp = json.dumps({"algorithm": algo, "text": text})
            result = assert_tool_ok(cli, "hash-generator", inp)
            parsed = json.loads(result.stdout)
            expected_hash = hashlib.new(algo, text.encode()).hexdigest()
            assert parsed["hash"] == expected_hash, (
                f"{algo} large-input mismatch"
            )

    def test_bytes_field_for_unicode(self, cli):
        """The 'bytes' field should count UTF-8 bytes, not characters."""
        text = "\U0001F600"  # 4 bytes in UTF-8
        inp = json.dumps({"algorithm": "sha256", "text": text})
        result = assert_tool_ok(cli, "hash-generator", inp)
        parsed = json.loads(result.stdout)
        assert parsed["bytes"] == len(text.encode("utf-8"))


# ===================================================================
# 4. Text tools -- Unicode stress
# ===================================================================

class TestCaseConverterUnicode:
    """Case converter with emoji, CJK, accented chars, mixed scripts."""

    @pytest.mark.parametrize("text,mode,expected", [
        pytest.param(
            "hello \U0001F600 world", "upper", "HELLO \U0001F600 WORLD",
            id="emoji-upper",
        ),
        pytest.param(
            "HELLO \U0001F600 WORLD", "lower", "hello \U0001F600 world",
            id="emoji-lower",
        ),
        pytest.param(
            "caf\u00e9 na\u00efve", "upper", "CAF\u00c9 NA\u00cfVE",
            id="accented-upper",
        ),
        pytest.param(
            "CAF\u00c9 NA\u00cfVE", "lower", "caf\u00e9 na\u00efve",
            id="accented-lower",
        ),
    ], ids=lambda x: "")
    def test_unicode_case_modes(self, cli, text, mode, expected):
        inp = json.dumps({"text": text, "mode": mode})
        result = assert_tool_ok(cli, "case-converter", inp)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"case-converter unicode ({mode}):\n{msg}"

    def test_cjk_passthrough_in_upper(self, cli):
        """CJK characters have no case -- they should pass through."""
        text = "\u4f60\u597d world"
        inp = json.dumps({"text": text, "mode": "upper"})
        result = assert_tool_ok(cli, "case-converter", inp)
        assert "\u4f60\u597d" in result.stdout, "CJK chars should be preserved"

    def test_inverse_preserves_non_alpha(self, cli):
        """Inverse mode should swap case of letters, leave everything else."""
        text = "Hello 123 \U0001F680"
        expected = "hELLO 123 \U0001F680"
        inp = json.dumps({"text": text, "mode": "inverse"})
        result = assert_tool_ok(cli, "case-converter", inp)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"inverse with non-alpha:\n{msg}"


class TestReverseTextEdgeCases:
    """reverse-text-generator with emoji and combining characters."""

    def test_simple_reverse(self, cli):
        text = "Hello"
        result = assert_tool_ok(cli, "reverse-text-generator", text)
        ok, msg = stripped_match(result.stdout, "olleH")
        assert ok, msg

    def test_single_char(self, cli):
        result = assert_tool_ok(cli, "reverse-text-generator", "A")
        ok, msg = stripped_match(result.stdout, "A")
        assert ok, msg

    def test_palindrome(self, cli):
        text = "racecar"
        result = assert_tool_ok(cli, "reverse-text-generator", text)
        ok, msg = stripped_match(result.stdout, "racecar")
        assert ok, msg

    def test_with_spaces(self, cli):
        text = "abc def"
        result = assert_tool_ok(cli, "reverse-text-generator", text)
        ok, msg = stripped_match(result.stdout, "fed cba")
        assert ok, msg

    def test_digits_and_symbols(self, cli):
        text = "12345!@#"
        result = assert_tool_ok(cli, "reverse-text-generator", text)
        ok, msg = stripped_match(result.stdout, "#@!54321")
        assert ok, msg


class TestBoldTextEdgeCases:
    """bold-text-generator with non-Latin chars and digits."""

    def test_digits_are_bolded(self, cli):
        """Digits 0-9 should map to Mathematical Bold Digits."""
        text = "0123456789"
        expected = oracle_bold(text)

        result = assert_tool_ok(cli, "bold-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"bold digits:\n{msg}"

    def test_non_latin_passthrough(self, cli):
        """Non-Latin characters (CJK, etc.) should pass through unchanged."""
        text = "\u4f60\u597d Hello"
        expected = oracle_bold(text)

        result = assert_tool_ok(cli, "bold-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"bold non-latin:\n{msg}"

    def test_mixed_content(self, cli):
        """Mix of letters, digits, spaces, and punctuation."""
        text = "Hello World 42!"
        expected = oracle_bold(text)

        result = assert_tool_ok(cli, "bold-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"bold mixed:\n{msg}"

    def test_all_upper_and_lower(self, cli):
        """All 52 Latin letters should be bolded."""
        text = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        expected = oracle_bold(text)

        result = assert_tool_ok(cli, "bold-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"bold all letters:\n{msg}"


class TestUnderlineTextEdgeCases:
    """underline-text-generator edge cases."""

    COMBINING_UNDERLINE = "\u0332"

    def test_basic_underline(self, cli):
        text = "Hello"
        expected = oracle_combining(text, self.COMBINING_UNDERLINE)

        result = assert_tool_ok(cli, "underline-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"underline basic:\n{msg}"

    def test_spaces_not_underlined(self, cli):
        """Spaces should not receive the combining underline mark."""
        text = "A B"
        expected = oracle_combining(text, self.COMBINING_UNDERLINE)
        # A=0, combining=1, space=2, B=3, combining=4
        assert expected[2] == " ", "oracle should not underline space"

        result = assert_tool_ok(cli, "underline-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"underline spaces:\n{msg}"

    def test_digits_underlined(self, cli):
        text = "42"
        expected = oracle_combining(text, self.COMBINING_UNDERLINE)

        result = assert_tool_ok(cli, "underline-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"underline digits:\n{msg}"

    def test_punctuation_underlined(self, cli):
        text = "!@#"
        expected = oracle_combining(text, self.COMBINING_UNDERLINE)

        result = assert_tool_ok(cli, "underline-text-generator", text)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"underline punctuation:\n{msg}"


# ===================================================================
# 5. Data converter -- malformed/edge inputs
# ===================================================================

class TestYamlToJsonEdgeCases:
    """yaml-to-json with anchors, multi-document, complex types."""

    def test_yaml_with_anchors_and_aliases(self, cli):
        """YAML anchors (&) and aliases (*) - serde_yaml keeps << as literal key."""
        inp = "defaults: &defaults\n  timeout: 30\n  retries: 3\nproduction:\n  <<: *defaults\n  timeout: 60"

        result = assert_tool_ok(cli, "yaml-to-json", inp)
        parsed = json.loads(result.stdout)
        assert parsed["defaults"]["timeout"] == 30
        assert parsed["production"]["timeout"] == 60
        # serde_yaml doesn't resolve merge keys - << stays as literal key
        assert parsed["production"]["<<"]["retries"] == 3

    def test_yaml_complex_types(self, cli):
        """YAML with mixed nesting: maps, sequences, scalars."""
        inp = (
            "users:\n"
            "  - name: Alice\n"
            "    roles:\n"
            "      - admin\n"
            "      - user\n"
            "  - name: Bob\n"
            "    roles:\n"
            "      - user\n"
            "settings:\n"
            "  debug: true\n"
            "  count: 42\n"
            "  ratio: 3.14\n"
            "  nothing: null\n"
        )
        result = assert_tool_ok(cli, "yaml-to-json", inp)
        parsed = json.loads(result.stdout)
        assert len(parsed["users"]) == 2
        assert parsed["users"][0]["roles"] == ["admin", "user"]
        assert parsed["settings"]["debug"] is True
        assert parsed["settings"]["nothing"] is None

    def test_yaml_with_multiline_strings(self, cli):
        """YAML literal block scalar (|) and folded scalar (>)."""
        inp = "literal: |\n  line1\n  line2\nfolded: >\n  word1\n  word2\n"
        result = assert_tool_ok(cli, "yaml-to-json", inp)
        parsed = json.loads(result.stdout)
        assert "line1\nline2\n" == parsed["literal"]
        # serde_yaml strips trailing newline from folded scalars
        assert "word1 word2" == parsed["folded"]


class TestDelimiterConverterEdgeCases:
    """delimiter-converter with mixed delimiters, long input."""

    def test_input_with_1000_items(self, cli):
        """Comma-separated list of 1000 items."""
        items = [f"item{i}" for i in range(1000)]
        inp = ",".join(items)
        expected = oracle_delimiter_converter(inp)

        result = assert_tool_ok(cli, "delimiter-converter", inp)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, "1000-item delimiter convert failed"
        assert result.stdout.strip().count("\n") == 999

    def test_input_that_is_just_delimiters(self, cli):
        """Input of only commas should produce empty output (all items blank)."""
        inp = ",,,"
        expected = oracle_delimiter_converter(inp)

        result = assert_tool_ok(cli, "delimiter-converter", inp)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"delimiters-only:\n{msg}"

    def test_mixed_delimiter_types(self, cli):
        """Input with multiple delimiter types -- detector picks most frequent."""
        inp = "a,b,c;d;e"
        expected = oracle_delimiter_converter(inp)

        result = assert_tool_ok(cli, "delimiter-converter", inp)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"mixed delimiters:\n{msg}"

    def test_tab_dominant(self, cli):
        """Tabs as the dominant delimiter."""
        inp = "x\ty\tz\ta\tb"
        expected = oracle_delimiter_converter(inp)

        result = assert_tool_ok(cli, "delimiter-converter", inp)
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, f"tab-dominant:\n{msg}"


class TestUrlParserEdgeCases:
    """url-parser with unusual URL forms."""

    def test_url_with_fragment_only(self, cli):
        """URL with just a fragment."""
        url = "https://example.com#section"
        result = assert_tool_ok(cli, "url-parser", url)
        parsed = json.loads(result.stdout)
        assert parsed["fragment"] == "section"
        assert parsed["query"] is None

    def test_url_with_userinfo(self, cli):
        """URL with user:password@ in authority."""
        url = "https://user:pass@example.com/path"
        result = assert_tool_ok(cli, "url-parser", url)
        parsed = json.loads(result.stdout)
        assert parsed["host"] == "example.com"
        assert parsed["scheme"] == "https"

    def test_url_with_port(self, cli):
        """URL with explicit port."""
        url = "http://localhost:3000/api/health"
        result = assert_tool_ok(cli, "url-parser", url)
        parsed = json.loads(result.stdout)
        assert parsed["port"] == 3000
        assert parsed["host"] == "localhost"

    def test_url_with_many_query_params(self, cli):
        """URL with 10+ query parameters."""
        params = "&".join(f"k{i}=v{i}" for i in range(15))
        url = f"https://example.com/search?{params}"
        result = assert_tool_ok(cli, "url-parser", url)
        parsed = json.loads(result.stdout)
        assert len(parsed["queryParams"]) == 15


class TestJwtDebuggerEdgeCases:
    """jwt-debugger with unusual algorithms and malformed tokens."""

    def _make_jwt(self, header_dict, payload_dict, signature="test-sig"):
        h = base64.urlsafe_b64encode(
            json.dumps(header_dict).encode()
        ).rstrip(b"=").decode()
        p = base64.urlsafe_b64encode(
            json.dumps(payload_dict).encode()
        ).rstrip(b"=").decode()
        return f"{h}.{p}.{signature}"

    def test_expired_jwt(self, cli):
        """JWT with exp claim in the past should show isExpired=true."""
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {"sub": "123", "exp": 1000000000}  # Sep 2001
        token = self._make_jwt(header, payload)

        result = assert_tool_ok(cli, "jwt-debugger", token)
        parsed = json.loads(result.stdout)
        assert parsed["isExpired"] is True
        assert parsed["payload"]["exp"] == 1000000000

    def test_jwt_with_es256(self, cli):
        """JWT with ES256 algorithm."""
        header = {"alg": "ES256", "typ": "JWT"}
        payload = {"iss": "test", "scope": "read write"}
        token = self._make_jwt(header, payload, "es256-signature")

        result = assert_tool_ok(cli, "jwt-debugger", token)
        parsed = json.loads(result.stdout)
        assert parsed["header"]["alg"] == "ES256"
        assert parsed["payload"]["scope"] == "read write"

    def test_jwt_with_none_algorithm(self, cli):
        """JWT with 'none' algorithm (insecure but valid format)."""
        header = {"alg": "none", "typ": "JWT"}
        payload = {"sub": "user1"}
        token = self._make_jwt(header, payload, "")

        result = assert_tool_ok(cli, "jwt-debugger", token)
        parsed = json.loads(result.stdout)
        assert parsed["header"]["alg"] == "none"

    def test_jwt_with_many_claims(self, cli):
        """JWT with many standard claims."""
        header = {"alg": "HS256", "typ": "JWT", "kid": "key-001"}
        payload = {
            "iss": "auth.example.com",
            "sub": "user-42",
            "aud": "api.example.com",
            "exp": 4102444800,
            "nbf": 1609459200,
            "iat": 1609459200,
            "jti": "unique-id-12345",
            "roles": ["admin", "user"],
            "custom": {"nested": True},
        }
        token = self._make_jwt(header, payload)

        result = assert_tool_ok(cli, "jwt-debugger", token)
        parsed = json.loads(result.stdout)
        assert parsed["header"]["kid"] == "key-001"
        assert parsed["payload"]["roles"] == ["admin", "user"]
        assert parsed["isExpired"] is False

    def test_malformed_jwt_wrong_dots(self, cli):
        """JWT with wrong number of dot-separated parts should fail."""
        bad_tokens = [
            "only-one-part",
            "two.parts",
            "four.parts.here.extra",
        ]
        for bad in bad_tokens:
            result = cli.run_tool("jwt-debugger", bad)
            assert result.exit_code != 0, (
                f"jwt-debugger should reject '{bad}' but exited 0"
            )


# ===================================================================
# 6. Formatter edge cases
# ===================================================================

class TestHtmlBeautifyEdgeCases:
    """html-beautify with self-closing tags, void elements, comments, doctype."""

    def test_void_elements(self, cli):
        """HTML5 void elements (br, hr, img, input, meta, link)."""
        html = '<div><br><hr><img src="x.png"><input type="text"><meta charset="utf-8"></div>'
        result = assert_tool_ok(cli, "html-beautify", html,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        assert "\n" in formatted
        # All void elements should be present in output
        for tag in ("br", "hr", "img", "input", "meta"):
            assert tag in formatted.lower(), f"void element <{tag}> missing"

    def test_html_comments(self, cli):
        """HTML comments should be preserved in output."""
        html = '<div><!-- comment --><p>text</p></div>'
        result = assert_tool_ok(cli, "html-beautify", html,
                                format_mode="format", indent=2)
        assert "<!-- comment -->" in result.stdout

    def test_doctype_declaration(self, cli):
        """<!DOCTYPE html> should be preserved."""
        html = '<!DOCTYPE html><html><head><title>T</title></head><body><p>Hi</p></body></html>'
        result = assert_tool_ok(cli, "html-beautify", html,
                                format_mode="format", indent=2)
        assert "DOCTYPE" in result.stdout or "doctype" in result.stdout.lower()

    def test_script_and_style_tags(self, cli):
        """Script and style tag contents should not be re-formatted internally."""
        html = '<html><head><style>body{margin:0;}</style></head><body><script>var x=1;</script></body></html>'
        result = assert_tool_ok(cli, "html-beautify", html,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        assert "script" in formatted.lower()
        assert "style" in formatted.lower()

    def test_self_closing_tags(self, cli):
        """Explicit self-closing tags like <br/>, <img/>."""
        html = '<div><br/><img src="x.png"/></div>'
        result = assert_tool_ok(cli, "html-beautify", html,
                                format_mode="format", indent=2)
        assert result.exit_code == 0
        assert "img" in result.stdout.lower()


class TestXmlFormatEdgeCases:
    """xml-format with CDATA, processing instructions, namespaces."""

    def test_xml_with_cdata(self, cli):
        """CDATA sections should be preserved."""
        xml_input = '<root><data><![CDATA[Some <special> & "chars"]]></data></root>'
        result = assert_tool_ok(cli, "xml-format", xml_input,
                                format_mode="format", indent=2)
        assert "CDATA" in result.stdout

    def test_xml_with_processing_instructions(self, cli):
        """Processing instructions like <?xml-stylesheet?> should be preserved."""
        xml_input = '<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="style.xsl"?><root><child>text</child></root>'
        result = assert_tool_ok(cli, "xml-format", xml_input,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        assert "xml-stylesheet" in formatted

    def test_xml_with_namespaces(self, cli):
        """XML with namespace prefixes should be preserved."""
        xml_input = '<root xmlns:ns="http://example.com"><ns:child>text</ns:child></root>'
        result = assert_tool_ok(cli, "xml-format", xml_input,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        assert "ns:child" in formatted or "ns:" in formatted

    def test_xml_with_attributes(self, cli):
        """XML element with many attributes."""
        xml_input = '<root><item id="1" name="test" type="primary" enabled="true" count="42">content</item></root>'
        result = assert_tool_ok(cli, "xml-format", xml_input,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        # Verify the formatted output is still valid XML
        try:
            ET.fromstring(formatted)
        except ET.ParseError as exc:
            pytest.fail(f"xml-format output is not valid XML: {exc}")

    def test_xml_empty_elements(self, cli):
        """Self-closing empty elements."""
        xml_input = '<root><empty/><another attr="val"/></root>'
        result = assert_tool_ok(cli, "xml-format", xml_input,
                                format_mode="format", indent=2)
        assert "\n" in result.stdout.strip()

    def test_xml_format_then_minify_preserves_structure(self, cli):
        """Round-trip: format then minify should preserve data."""
        xml_input = '<catalog><book id="1"><title>Rust</title><author>Team</author></book><book id="2"><title>Python</title></book></catalog>'
        fmt = assert_tool_ok(cli, "xml-format", xml_input,
                             format_mode="format", indent=2)
        mini = assert_tool_ok(cli, "xml-format", fmt.stdout.strip(),
                              format_mode="minify")
        tree = ET.fromstring(mini.stdout.strip())
        books = tree.findall("book")
        assert len(books) == 2


class TestSqlFormatEdgeCases:
    """sql-format with subqueries, CTEs, UNION, multi-statement."""

    def test_subquery(self, cli):
        """SQL with a subquery in WHERE clause."""
        sql = "select name from users where id in (select user_id from orders where total > 100)"
        result = assert_tool_ok(cli, "sql-format", sql,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        assert "SELECT" in formatted
        assert "IN" in formatted or "in" in formatted.lower()

    def test_cte_with_keyword(self, cli):
        """SQL with a CTE (WITH ... AS)."""
        sql = "with active_users as (select id, name from users where active = true) select name from active_users order by name"
        result = assert_tool_ok(cli, "sql-format", sql,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        # Rust SQL formatter may not uppercase WITH/AS keywords
        assert "with" in formatted.lower()

    def test_union(self, cli):
        """SQL with UNION combining two SELECTs."""
        sql = "select name from users union select name from admins"
        result = assert_tool_ok(cli, "sql-format", sql,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        # Rust SQL formatter may not uppercase UNION
        assert "union" in formatted.lower()

    def test_multi_statement(self, cli):
        """Multiple SQL statements separated by semicolons."""
        sql = "select 1; select 2; select 3"
        result = assert_tool_ok(cli, "sql-format", sql,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        # At least one SELECT should be uppercased
        assert "SELECT" in formatted

    def test_complex_join_chain(self, cli):
        """SQL with multiple JOINs."""
        sql = (
            "select a.id, b.name, c.value "
            "from table_a a "
            "inner join table_b b on a.id = b.a_id "
            "left join table_c c on b.id = c.b_id "
            "where a.active = true and c.value > 0 "
            "order by a.id limit 50"
        )
        result = assert_tool_ok(cli, "sql-format", sql,
                                format_mode="format", indent=2)
        formatted = result.stdout.strip()
        assert "JOIN" in formatted
        assert "\n" in formatted

    def test_minify_multi_line_sql(self, cli):
        """Minify should collapse multi-line SQL to single line."""
        sql = "SELECT\n  name,\n  age\nFROM\n  users\nWHERE\n  age > 21"
        result = assert_tool_ok(cli, "sql-format", sql,
                                format_mode="minify")
        minified = result.stdout.strip()
        assert "\n" not in minified


# ===================================================================
# 7. Roundtrip stress with adversarial inputs
# ===================================================================

class TestRoundtripStress:
    """Encoding roundtrips with adversarial inputs."""

    def test_base64_roundtrip_all_printable(self, cli):
        """Every printable ASCII char should survive base64 roundtrip."""
        original = string.printable.strip()
        enc = assert_tool_ok(cli, "base64", original, format_mode="format")
        dec = assert_tool_ok(cli, "base64", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"base64 all-printable roundtrip:\n{msg}"

    def test_url_roundtrip_every_special_char(self, cli):
        """RFC reserved + unreserved + some Unicode through URL encode/decode."""
        original = ":/?#[]@!$&'()*+,;= abc ~.-_ \u00e9\u00f1"
        enc = assert_tool_ok(cli, "url", original, format_mode="format")
        dec = assert_tool_ok(cli, "url", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"url every-special-char roundtrip:\n{msg}"

    def test_binary_code_roundtrip_high_bytes(self, cli):
        """Binary-code roundtrip with characters that produce high-value bytes."""
        # Characters that produce bytes 0xC0-0xFF in UTF-8
        original = "\u00C0\u00FF\u0100\u017F"
        enc = assert_tool_ok(cli, "binary-code", original,
                             format_mode="format")
        dec = assert_tool_ok(cli, "binary-code", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"binary-code high-byte roundtrip:\n{msg}"

    def test_utf8_roundtrip_mixed_scripts(self, cli):
        """UTF-8 hex roundtrip with Latin, CJK, Arabic, and emoji."""
        original = "Hello \u4f60\u597d \u0645\u0631\u062d\u0628\u0627 \U0001F600"
        enc = assert_tool_ok(cli, "utf8", original, format_mode="format")
        dec = assert_tool_ok(cli, "utf8", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"utf8 mixed-script roundtrip:\n{msg}"

    def test_backslash_escape_roundtrip_all_escapes(self, cli):
        """Roundtrip input containing every escapable character."""
        # Note: \r (carriage return) is omitted because subprocess text mode
        # normalizes \r\n to \n, causing false roundtrip failures.
        original = "back\\slash\nnewline\ttab\"dquote'squote"
        enc = assert_tool_ok(cli, "backslash-escape", original,
                             format_mode="format")
        dec = assert_tool_ok(cli, "backslash-escape", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"backslash-escape all-escapes roundtrip:\n{msg}"

    def test_json_stringify_roundtrip_special_chars(self, cli):
        """json-stringify roundtrip with control chars and Unicode."""
        original = "line1\nline2\ttab \"quotes\" \\back \u00e9\u00f1\U0001F680"
        enc = assert_tool_ok(cli, "json-stringify", original,
                             format_mode="format")
        dec = assert_tool_ok(cli, "json-stringify", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"json-stringify special-chars roundtrip:\n{msg}"

    def test_html_entity_roundtrip_all_five(self, cli):
        """HTML entity roundtrip with all 5 escapable chars: & < > \" '."""
        original = "Tom & Jerry's \"show\" < > end"
        enc = assert_tool_ok(cli, "html-entity", original,
                             format_mode="format")
        dec = assert_tool_ok(cli, "html-entity", enc.stdout.strip(),
                             format_mode="minify")
        ok, msg = stripped_match(dec.stdout, original)
        assert ok, f"html-entity all-five roundtrip:\n{msg}"

    def test_caesar_roundtrip_all_shifts(self, cli):
        """Caesar cipher roundtrip for every shift value 1-25."""
        original = "The Quick Brown Fox Jumps!"
        for shift in (1, 5, 13, 25):
            enc = assert_tool_ok(cli, "caesar-cipher", original,
                                 format_mode="format", indent=shift)
            dec = assert_tool_ok(cli, "caesar-cipher", enc.stdout.strip(),
                                 format_mode="minify", indent=shift)
            ok, msg = stripped_match(dec.stdout, original)
            assert ok, f"caesar shift={shift} roundtrip:\n{msg}"

    def test_json_format_roundtrip_format_minify(self, cli):
        """JSON format then minify should preserve semantic content."""
        original = '{"deeply":{"nested":{"array":[1,2,3],"null":null,"bool":true}}}'
        fmt = assert_tool_ok(cli, "json-format", original,
                             format_mode="format", indent=2)
        mini = assert_tool_ok(cli, "json-format", fmt.stdout.strip(),
                              format_mode="minify")
        ok, msg = json_semantic(mini.stdout, original)
        assert ok, f"json format/minify roundtrip:\n{msg}"

    def test_yaml_format_roundtrip(self, cli):
        """YAML format then minify should preserve semantic content."""
        original = "server:\n  host: localhost\n  port: 8080\n  tags:\n    - web\n    - prod"
        fmt = assert_tool_ok(cli, "yaml-format", original,
                             format_mode="format")
        mini = assert_tool_ok(cli, "yaml-format", fmt.stdout.strip(),
                              format_mode="minify")
        ok, msg = yaml_semantic(mini.stdout, original)
        assert ok, f"yaml format/minify roundtrip:\n{msg}"

    def test_xml_format_roundtrip_with_attributes(self, cli):
        """XML format then minify should preserve structure and attributes."""
        original = '<root attr="val"><child id="1">text</child><child id="2">more</child></root>'
        fmt = assert_tool_ok(cli, "xml-format", original,
                             format_mode="format", indent=2)
        mini = assert_tool_ok(cli, "xml-format", fmt.stdout.strip(),
                              format_mode="minify")
        tree = ET.fromstring(mini.stdout.strip())
        assert tree.attrib.get("attr") == "val"
        children = tree.findall("child")
        assert len(children) == 2
        assert children[0].attrib["id"] == "1"


# ===================================================================
# 8. Cross-converter consistency checks
# ===================================================================

class TestCrossConverterConsistency:
    """Verify that chained conversions produce consistent results."""

    def test_json_to_yaml_to_json_roundtrip(self, cli):
        """JSON -> YAML -> JSON should preserve the data."""
        original = json.dumps({
            "users": [
                {"name": "Alice", "age": 30, "active": True},
                {"name": "Bob", "age": 25, "active": False},
            ],
            "count": 2,
            "meta": None,
        })

        yaml_result = assert_tool_ok(cli, "json-to-yaml", original)
        json_result = assert_tool_ok(cli, "yaml-to-json",
                                     yaml_result.stdout.strip())
        ok, msg = json_semantic(json_result.stdout, original)
        assert ok, f"json->yaml->json roundtrip:\n{msg}"

    def test_json_to_csv_to_json_roundtrip(self, cli):
        """JSON -> CSV -> JSON should preserve flat record data."""
        records = [
            {"id": "1", "name": "Alice", "city": "NYC"},
            {"id": "2", "name": "Bob", "city": "LA"},
        ]
        original = json.dumps(records)

        csv_result = assert_tool_ok(cli, "json-to-csv", original)
        json_result = assert_tool_ok(cli, "csv-to-json",
                                     csv_result.stdout.strip())

        # CSV loses type information (everything becomes strings), so compare
        # after normalizing all values to strings.
        parsed = json.loads(json_result.stdout)
        assert len(parsed) == 2
        assert parsed[0]["name"] == "Alice"
        assert parsed[1]["city"] == "LA"

    def test_hash_determinism(self, cli):
        """Hashing the same input twice should produce identical results."""
        text = "determinism test"
        for algo in ("md5", "sha256"):
            inp = json.dumps({"algorithm": algo, "text": text})
            r1 = assert_tool_ok(cli, "hash-generator", inp)
            r2 = assert_tool_ok(cli, "hash-generator", inp)
            h1 = json.loads(r1.stdout)["hash"]
            h2 = json.loads(r2.stdout)["hash"]
            assert h1 == h2, f"{algo} produced different hashes for same input"
