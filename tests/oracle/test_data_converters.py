"""Oracle tests for data format converter tools.

Each test computes the expected output independently in Python (the oracle),
runs the same input through the CLI binary, then compares results using
the appropriate semantic comparator.
"""

import base64
import csv
import hashlib
import io
import json
import math
import re
import urllib.parse

import pytest
import yaml

from comparators import csv_semantic, json_semantic, stripped_match, yaml_semantic


# ---------------------------------------------------------------------------
# Python oracle helpers
# ---------------------------------------------------------------------------


def oracle_json_to_yaml(json_input: str) -> str:
    """Mimic serde_yaml::to_string with trim."""
    data = json.loads(json_input)
    return yaml.dump(data, default_flow_style=False, allow_unicode=True).strip()


def oracle_yaml_to_json(yaml_input: str) -> str:
    """Mimic serde_json::to_string_pretty."""
    data = yaml.safe_load(yaml_input)
    return json.dumps(data, indent=2, ensure_ascii=False)


def _json_value_to_csv_cell(value):
    """Mimic json_value_to_csv_cell in Rust."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        # serde_json::Number::to_string for integers has no decimal point
        if isinstance(value, float) and value == int(value):
            return str(int(value))
        return str(value)
    if isinstance(value, str):
        return value
    # arrays and objects -> JSON serialization
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def oracle_json_to_csv(json_input: str) -> str:
    """Mimic Rust json_to_csv with BTreeSet-sorted headers."""
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
    """Mimic Rust csv_to_json."""
    reader = csv.DictReader(io.StringIO(csv_input))
    rows = []
    for record in reader:
        rows.append({k: v for k, v in record.items()})
    return json.dumps(rows, indent=2, ensure_ascii=False)


def oracle_hash(text: str, algorithm: str = "sha256") -> str:
    """Produce the same JSON output as run_hash_generator."""
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


def oracle_hex_to_ascii(hex_input: str) -> str:
    cleaned = "".join(ch for ch in hex_input if not ch.isspace())
    if cleaned.startswith("0x") or cleaned.startswith("0X"):
        cleaned = cleaned[2:]
    return bytes.fromhex(cleaned).decode("utf-8")


def oracle_ascii_to_hex(text: str) -> str:
    """Rust joins with empty string, no spaces."""
    return "".join(f"{b:02X}" for b in text.encode("utf-8"))


def oracle_url_parser(url_str: str) -> str:
    """Mimic parse_url_to_json using urllib.parse.

    The Rust url crate is used internally; we replicate its behavior for
    standard URLs.
    """
    parsed = urllib.parse.urlparse(url_str)

    # Build query params handling repeated keys
    query_map: dict = {}
    if parsed.query:
        for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True):
            if key in query_map:
                existing = query_map[key]
                if isinstance(existing, list):
                    existing.append(value)
                else:
                    query_map[key] = [existing, value]
            else:
                query_map[key] = value

    result: dict = {}
    result["scheme"] = parsed.scheme
    result["host"] = parsed.hostname if parsed.hostname else None
    result["port"] = parsed.port if parsed.port else None
    result["path"] = parsed.path if parsed.path else "/"
    result["query"] = parsed.query if parsed.query else None
    result["fragment"] = parsed.fragment if parsed.fragment else None
    result["queryParams"] = query_map
    return json.dumps(result, indent=2, ensure_ascii=False)


def oracle_slugify(text: str) -> str:
    """Mimic slugify_text: lowercase, non-alnum -> hyphen, collapse, trim."""
    lowered = text.strip().lower()
    parts = []
    last_was_hyphen = False
    for ch in lowered:
        if ch.isascii() and ch.isalnum():
            parts.append(ch)
            last_was_hyphen = False
        elif not last_was_hyphen:
            parts.append("-")
            last_was_hyphen = True
    return "".join(parts).strip("-")


def oracle_query_string_to_json(qs_input: str) -> str:
    """Mimic convert_query_string_to_json.

    The Rust implementation builds single values as strings and repeated keys
    as arrays, preserving insertion order. Python's parse_qs always returns
    lists, so we need to replicate the Rust behavior manually.
    """
    if "?" in qs_input:
        _, query_part = qs_input.split("?", 1)
    else:
        query_part = qs_input

    result: dict = {}
    for segment in query_part.split("&"):
        if not segment:
            continue
        if "=" in segment:
            raw_key, raw_value = segment.split("=", 1)
        else:
            raw_key, raw_value = segment, ""
        key = urllib.parse.unquote_plus(raw_key)
        value = urllib.parse.unquote_plus(raw_value)

        if key in result:
            existing = result[key]
            if isinstance(existing, list):
                existing.append(value)
            else:
                result[key] = [existing, value]
        else:
            result[key] = value

    return json.dumps(result, indent=2, ensure_ascii=False)


def oracle_number_base(input_text: str) -> str:
    """Mimic convert_number_base.

    The Rust code calls parse_number_with_base which does prefix detection,
    then returns multi-line output: binary, octal, decimal, hex.
    """
    s = input_text.strip().replace("_", "")
    if s.startswith("0b") or s.startswith("0B"):
        n = int(s[2:], 2)
    elif s.startswith("0o") or s.startswith("0O"):
        n = int(s[2:], 8)
    elif s.startswith("0x") or s.startswith("0X"):
        n = int(s[2:], 16)
    elif all(ch in "01" for ch in s) and len(s) > 1:
        n = int(s, 2)
    elif all(ch in "0123456789abcdefABCDEF" for ch in s) and any(
        ch.isalpha() for ch in s
    ):
        n = int(s, 16)
    else:
        n = int(s)
    return f"binary: {n:b}\noctal: {n:o}\ndecimal: {n}\nhex: {n:X}"


def oracle_jwt_debugger(jwt_token: str) -> dict:
    """Decode JWT header and payload, return the structure (minus time fields)."""
    parts = jwt_token.strip().split(".")
    assert len(parts) == 3

    def decode_segment(seg):
        padded = seg.replace("-", "+").replace("_", "/")
        while len(padded) % 4 != 0:
            padded += "="
        raw = base64.b64decode(padded)
        return json.loads(raw)

    header = decode_segment(parts[0])
    payload = decode_segment(parts[1])
    return {
        "header": header,
        "payload": payload,
        "signature": parts[2],
    }


def _detect_delimiter(text: str) -> str:
    """Mimic detect_delimiter."""
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
    """Mimic convert_delimiter_to_newline_list."""
    delim = _detect_delimiter(text)
    parts = [item.strip() for item in text.split(delim) if item.strip()]
    return "\n".join(parts)


def _rgb_to_hsl(r: int, g: int, b: int) -> tuple:
    """RGB [0..255] -> (H degrees, S fraction, L fraction)."""
    rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
    mx = max(rf, gf, bf)
    mn = min(rf, gf, bf)
    delta = mx - mn
    light = (mx + mn) / 2.0
    if delta == 0.0:
        return (0.0, 0.0, light)
    sat = delta / (1.0 - abs(2.0 * light - 1.0))
    if abs(mx - rf) < 1e-10:
        hue = 60.0 * (((gf - bf) / delta) % 6.0)
    elif abs(mx - gf) < 1e-10:
        hue = 60.0 * (((bf - rf) / delta) + 2.0)
    else:
        hue = 60.0 * (((rf - gf) / delta) + 4.0)
    if hue < 0:
        hue += 360.0
    return (hue, sat, light)


def oracle_color_converter_hex(hex_input: str) -> str:
    """Mimic convert_color_formats for hex input."""
    trimmed = hex_input.strip().lstrip("#")
    if len(trimmed) == 3:
        trimmed = "".join(c * 2 for c in trimmed)
    r = int(trimmed[0:2], 16)
    g = int(trimmed[2:4], 16)
    b = int(trimmed[4:6], 16)
    h, s, light = _rgb_to_hsl(r, g, b)
    result = {
        "hex": f"#{r:02X}{g:02X}{b:02X}",
        "rgb": f"rgb({r}, {g}, {b})",
        "hsl": f"hsl({h:.0f}, {s * 100:.0f}%, {light * 100:.0f}%)",
    }
    return json.dumps(result, indent=2, ensure_ascii=False)


def oracle_color_converter_rgb(r: int, g: int, b: int) -> str:
    h, s, light = _rgb_to_hsl(r, g, b)
    result = {
        "hex": f"#{r:02X}{g:02X}{b:02X}",
        "rgb": f"rgb({r}, {g}, {b})",
        "hsl": f"hsl({h:.0f}, {s * 100:.0f}%, {light * 100:.0f}%)",
    }
    return json.dumps(result, indent=2, ensure_ascii=False)


def oracle_string_inspector(text: str) -> str:
    """Mimic inspect_string_details."""
    characters = list(text)
    code_points = []
    for i, ch in enumerate(characters):
        encoded = ch.encode("utf-8")
        utf8_hex = " ".join(f"{b:02X}" for b in encoded)
        code_points.append(
            {
                "index": i,
                "char": ch,
                "codePoint": f"U+{ord(ch):04X}",
                "utf8Hex": utf8_hex,
            }
        )
    result = {
        "characters": len(characters),
        "bytes": len(text.encode("utf-8")),
        "lines": len(text.splitlines()) if text else 0,
        "words": len(text.split()),
        "isAscii": all(ord(c) < 128 for c in text),
        "codePoints": code_points,
    }
    return json.dumps(result, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# 1. json-to-yaml
# ---------------------------------------------------------------------------


class TestJsonToYaml:
    def test_simple_object(self, cli):
        inp = '{"name": "binturong", "enabled": true}'
        expected = oracle_json_to_yaml(inp)
        result = cli.run_tool("json-to-yaml", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = yaml_semantic(result.stdout, expected)
        assert ok, msg

    def test_nested_object(self, cli):
        inp = json.dumps(
            {"server": {"host": "localhost", "port": 8080}, "debug": False}
        )
        expected = oracle_json_to_yaml(inp)
        result = cli.run_tool("json-to-yaml", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = yaml_semantic(result.stdout, expected)
        assert ok, msg

    def test_array_of_items(self, cli):
        inp = json.dumps({"items": [1, 2, 3], "label": "test"})
        expected = oracle_json_to_yaml(inp)
        result = cli.run_tool("json-to-yaml", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = yaml_semantic(result.stdout, expected)
        assert ok, msg

    def test_unicode_values(self, cli):
        inp = json.dumps({"greeting": "Hej varlden", "emoji": "hello"})
        expected = oracle_json_to_yaml(inp)
        result = cli.run_tool("json-to-yaml", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = yaml_semantic(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 2. yaml-to-json
# ---------------------------------------------------------------------------


class TestYamlToJson:
    def test_simple_mapping(self, cli):
        inp = "name: binturong\nenabled: true"
        expected = oracle_yaml_to_json(inp)
        result = cli.run_tool("yaml-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_nested_structure(self, cli):
        inp = "server:\n  host: localhost\n  port: 8080\ndebug: false"
        expected = oracle_yaml_to_json(inp)
        result = cli.run_tool("yaml-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_list_in_yaml(self, cli):
        inp = "colors:\n  - red\n  - green\n  - blue"
        expected = oracle_yaml_to_json(inp)
        result = cli.run_tool("yaml-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 3. json-to-csv
# ---------------------------------------------------------------------------


class TestJsonToCsv:
    def test_simple_records(self, cli):
        inp = '[{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]'
        expected = oracle_json_to_csv(inp)
        result = cli.run_tool("json-to-csv", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, msg

    def test_headers_sorted_alphabetically(self, cli):
        """BTreeSet ensures headers are alphabetically sorted."""
        inp = '[{"zebra": 1, "apple": 2, "mango": 3}]'
        expected = oracle_json_to_csv(inp)
        result = cli.run_tool("json-to-csv", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, msg
        # Verify header order in CLI output
        header_line = result.stdout.strip().splitlines()[0]
        assert header_line.startswith("apple,")

    def test_commas_quotes_newlines_in_values(self, cli):
        """Exercise proper CSV escaping: commas, quotes, and newlines."""
        records = [
            {
                "name": 'O\'Reilly, "Tim"',
                "address": "123 Main St\nApt 4",
                "note": "has, commas",
            },
            {
                "name": "Jane",
                "address": "456 Oak Ave",
                "note": 'She said "hello"',
            },
        ]
        inp = json.dumps(records)
        expected = oracle_json_to_csv(inp)
        result = cli.run_tool("json-to-csv", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, msg

    def test_empty_array(self, cli):
        inp = "[]"
        expected = oracle_json_to_csv(inp)
        result = cli.run_tool("json-to-csv", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_missing_keys_filled_empty(self, cli):
        """Records with different keys should fill missing with empty string."""
        inp = '[{"a": 1, "b": 2}, {"b": 3, "c": 4}]'
        expected = oracle_json_to_csv(inp)
        result = cli.run_tool("json-to-csv", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, msg

    def test_boolean_and_null_values(self, cli):
        inp = '[{"flag": true, "count": null, "label": "x"}]'
        expected = oracle_json_to_csv(inp)
        result = cli.run_tool("json-to-csv", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, msg

    def test_nested_object_in_value(self, cli):
        """Nested objects/arrays serialize as JSON strings in CSV cells."""
        inp = '[{"id": 1, "meta": {"x": 10}}, {"id": 2, "meta": [1, 2]}]'
        expected = oracle_json_to_csv(inp)
        result = cli.run_tool("json-to-csv", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = csv_semantic(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 4. csv-to-json
# ---------------------------------------------------------------------------


class TestCsvToJson:
    def test_basic_csv(self, cli):
        inp = "id,name\n1,A\n2,B"
        expected = oracle_csv_to_json(inp)
        result = cli.run_tool("csv-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_csv_with_quotes(self, cli):
        inp = 'name,address\nJane,"123 Main St, Apt 4"\nBob,"456 Oak ""Ave"""\n'
        expected = oracle_csv_to_json(inp)
        result = cli.run_tool("csv-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_single_row(self, cli):
        inp = "col1,col2\nval1,val2"
        expected = oracle_csv_to_json(inp)
        result = cli.run_tool("csv-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 5. hash-generator
# ---------------------------------------------------------------------------


class TestHashGenerator:
    @pytest.mark.parametrize(
        "algorithm",
        ["md5", "sha1", "sha256", "sha512"],
    )
    def test_algorithms(self, cli, algorithm):
        text = "hello"
        expected = oracle_hash(text, algorithm)
        inp = json.dumps({"algorithm": algorithm, "text": text})
        result = cli.run_tool("hash-generator", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_default_sha256_plain_text(self, cli):
        """Plain text input (not JSON) defaults to sha256."""
        text = "hello"
        expected = oracle_hash(text, "sha256")
        result = cli.run_tool("hash-generator", text)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_empty_string_hash(self, cli):
        text = ""
        expected = oracle_hash(text, "sha256")
        inp = json.dumps({"algorithm": "sha256", "text": text})
        result = cli.run_tool("hash-generator", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_unicode_text(self, cli):
        text = "Binturong!"
        expected = oracle_hash(text, "sha256")
        inp = json.dumps({"algorithm": "sha256", "text": text})
        result = cli.run_tool("hash-generator", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_known_md5(self, cli):
        """Cross-check with a well-known MD5 value."""
        text = "hello"
        inp = json.dumps({"algorithm": "md5", "text": text})
        result = cli.run_tool("hash-generator", inp)
        assert result.exit_code == 0, result.stderr
        parsed = json.loads(result.stdout)
        assert parsed["hash"] == "5d41402abc4b2a76b9719d911017c592"

    def test_known_sha256(self, cli):
        """Cross-check with a well-known SHA256 value."""
        text = "hello"
        result = cli.run_tool("hash-generator", text)
        assert result.exit_code == 0, result.stderr
        parsed = json.loads(result.stdout)
        assert (
            parsed["hash"]
            == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        )


# ---------------------------------------------------------------------------
# 6. hex-to-ascii
# ---------------------------------------------------------------------------


class TestHexToAscii:
    @pytest.mark.parametrize(
        "hex_input,expected_text",
        [
            ("48656C6C6F", "Hello"),
            ("48 65 6C 6C 6F", "Hello"),
            ("4869", "Hi"),
            ("0x48656C6C6F", "Hello"),
        ],
    )
    def test_basic(self, cli, hex_input, expected_text):
        expected = oracle_hex_to_ascii(hex_input)
        assert expected == expected_text
        result = cli.run_tool("hex-to-ascii", hex_input)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_lowercase_hex(self, cli):
        hex_input = "68656c6c6f"
        expected = oracle_hex_to_ascii(hex_input)
        result = cli.run_tool("hex-to-ascii", hex_input)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 7. ascii-to-hex
# ---------------------------------------------------------------------------


class TestAsciiToHex:
    @pytest.mark.parametrize(
        "text,expected_hex",
        [
            ("Hi", "4869"),
            ("Hello", "48656C6C6F"),
            ("A", "41"),
        ],
    )
    def test_basic(self, cli, text, expected_hex):
        expected = oracle_ascii_to_hex(text)
        assert expected == expected_hex
        result = cli.run_tool("ascii-to-hex", text)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_special_characters(self, cli):
        text = "Hello\tWorld\n!"
        expected = oracle_ascii_to_hex(text)
        result = cli.run_tool("ascii-to-hex", text)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 8. url-parser
# ---------------------------------------------------------------------------


class TestUrlParser:
    def test_simple_url(self, cli):
        url = "https://example.com/path?a=1&b=2"
        expected = oracle_url_parser(url)
        result = cli.run_tool("url-parser", url)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_url_with_port_and_fragment(self, cli):
        url = "https://example.com:8443/api/v1?key=val#section"
        expected = oracle_url_parser(url)
        result = cli.run_tool("url-parser", url)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_url_with_repeated_params(self, cli):
        url = "https://search.example.com/find?q=test&tag=a&tag=b&tag=c"
        expected = oracle_url_parser(url)
        result = cli.run_tool("url-parser", url)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_url_no_query_no_fragment(self, cli):
        url = "http://localhost:3000/health"
        expected = oracle_url_parser(url)
        result = cli.run_tool("url-parser", url)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_complex_url_encoded_params(self, cli):
        url = "https://example.com/search?q=hello%20world&lang=en"
        expected = oracle_url_parser(url)
        result = cli.run_tool("url-parser", url)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 9. slugify-url
# ---------------------------------------------------------------------------


class TestSlugifyUrl:
    @pytest.mark.parametrize(
        "text,expected_slug",
        [
            ("Hello, Binturong!", "hello-binturong"),
            ("My Blog Post Title", "my-blog-post-title"),
            ("  Spaces  Everywhere  ", "spaces-everywhere"),
            ("UPPER CASE", "upper-case"),
            ("already-slugified", "already-slugified"),
            ("Special @#$ Characters!!!", "special-characters"),
            ("foo---bar___baz", "foo-bar-baz"),
            ("123 Numbers 456", "123-numbers-456"),
        ],
    )
    def test_slugify(self, cli, text, expected_slug):
        oracle = oracle_slugify(text)
        assert oracle == expected_slug
        result = cli.run_tool("slugify-url", text)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, oracle)
        assert ok, msg


# ---------------------------------------------------------------------------
# 10. query-string-to-json
# ---------------------------------------------------------------------------


class TestQueryStringToJson:
    def test_simple_query(self, cli):
        inp = "a=1&b=two"
        expected = oracle_query_string_to_json(inp)
        result = cli.run_tool("query-string-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_with_leading_question_mark(self, cli):
        inp = "?name=binturong&version=1"
        expected = oracle_query_string_to_json(inp)
        result = cli.run_tool("query-string-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_full_url_with_query(self, cli):
        inp = "https://example.com?a=1&b=two&b=three"
        expected = oracle_query_string_to_json(inp)
        result = cli.run_tool("query-string-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_repeated_keys_become_array(self, cli):
        inp = "color=red&color=blue&color=green"
        expected = oracle_query_string_to_json(inp)
        result = cli.run_tool("query-string-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_encoded_values(self, cli):
        inp = "msg=hello+world&path=%2Ffoo%2Fbar"
        expected = oracle_query_string_to_json(inp)
        result = cli.run_tool("query-string-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_key_without_value(self, cli):
        inp = "flag&name=test"
        expected = oracle_query_string_to_json(inp)
        result = cli.run_tool("query-string-to-json", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 11. number-base-converter
# ---------------------------------------------------------------------------


class TestNumberBaseConverter:
    @pytest.mark.parametrize(
        "input_val",
        [
            "42",
            "255",
            "0",
            "1024",
            "0xFF",
            "0b1010",
            "0o77",
        ],
    )
    def test_various_inputs(self, cli, input_val):
        expected = oracle_number_base(input_val)
        result = cli.run_tool("number-base-converter", input_val)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_known_output_for_42(self, cli):
        result = cli.run_tool("number-base-converter", "42")
        assert result.exit_code == 0, result.stderr
        assert "binary: 101010" in result.stdout
        assert "octal: 52" in result.stdout
        assert "decimal: 42" in result.stdout
        assert "hex: 2A" in result.stdout

    def test_hex_string_auto_detection(self, cli):
        """A string like 'FF' with hex chars should be auto-detected as hex."""
        expected = oracle_number_base("FF")
        result = cli.run_tool("number-base-converter", "FF")
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 12. jwt-debugger
# ---------------------------------------------------------------------------


class TestJwtDebugger:
    def _make_jwt(self, header_dict, payload_dict, signature="test-signature"):
        """Build a JWT token from header and payload dicts."""
        h = base64.urlsafe_b64encode(
            json.dumps(header_dict).encode()
        ).rstrip(b"=").decode()
        p = base64.urlsafe_b64encode(
            json.dumps(payload_dict).encode()
        ).rstrip(b"=").decode()
        return f"{h}.{p}.{signature}"

    def test_basic_jwt(self, cli):
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {"sub": "123", "name": "Test User"}
        token = self._make_jwt(header, payload)
        oracle = oracle_jwt_debugger(token)

        result = cli.run_tool("jwt-debugger", token)
        assert result.exit_code == 0, result.stderr
        parsed = json.loads(result.stdout)
        assert parsed["header"] == oracle["header"]
        assert parsed["payload"] == oracle["payload"]
        assert parsed["signature"] == oracle["signature"]

    def test_jwt_with_exp_claim(self, cli):
        """JWT with an exp claim in the far future."""
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {"sub": "456", "exp": 4102444800}
        token = self._make_jwt(header, payload, "signature")
        oracle = oracle_jwt_debugger(token)

        result = cli.run_tool("jwt-debugger", token)
        assert result.exit_code == 0, result.stderr
        parsed = json.loads(result.stdout)
        assert parsed["header"] == oracle["header"]
        assert parsed["payload"] == oracle["payload"]
        assert parsed["signature"] == "signature"
        # Far-future exp should not be expired
        assert parsed["isExpired"] is False

    def test_jwt_with_rs256(self, cli):
        header = {"alg": "RS256", "typ": "JWT"}
        payload = {"iss": "auth.example.com", "aud": "api.example.com"}
        token = self._make_jwt(header, payload, "rs256sig")
        oracle = oracle_jwt_debugger(token)

        result = cli.run_tool("jwt-debugger", token)
        assert result.exit_code == 0, result.stderr
        parsed = json.loads(result.stdout)
        assert parsed["header"]["alg"] == "RS256"
        assert parsed["payload"]["iss"] == "auth.example.com"
        assert parsed["signature"] == oracle["signature"]


# ---------------------------------------------------------------------------
# 13. delimiter-converter
# ---------------------------------------------------------------------------


class TestDelimiterConverter:
    def test_comma_delimited(self, cli):
        inp = "one,two,three"
        expected = oracle_delimiter_converter(inp)
        result = cli.run_tool("delimiter-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_pipe_delimited(self, cli):
        inp = "red|green|blue"
        expected = oracle_delimiter_converter(inp)
        result = cli.run_tool("delimiter-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_semicolon_delimited(self, cli):
        inp = "a;b;c;d"
        expected = oracle_delimiter_converter(inp)
        result = cli.run_tool("delimiter-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_tab_delimited(self, cli):
        inp = "x\ty\tz"
        expected = oracle_delimiter_converter(inp)
        result = cli.run_tool("delimiter-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_empty_items_filtered(self, cli):
        inp = "a,,b,,,c"
        expected = oracle_delimiter_converter(inp)
        result = cli.run_tool("delimiter-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg

    def test_whitespace_trimmed(self, cli):
        inp = " a , b , c "
        expected = oracle_delimiter_converter(inp)
        result = cli.run_tool("delimiter-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = stripped_match(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 14. color-converter
# ---------------------------------------------------------------------------


class TestColorConverter:
    def test_hex_color(self, cli):
        inp = "#FF5733"
        expected = oracle_color_converter_hex(inp)
        result = cli.run_tool("color-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_hex_without_hash(self, cli):
        inp = "0EA5E9"
        expected = oracle_color_converter_hex(inp)
        result = cli.run_tool("color-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_short_hex(self, cli):
        inp = "#FFF"
        expected = oracle_color_converter_hex(inp)
        result = cli.run_tool("color-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_rgb_input(self, cli):
        inp = "rgb(14, 165, 233)"
        expected = oracle_color_converter_rgb(14, 165, 233)
        result = cli.run_tool("color-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_black(self, cli):
        inp = "#000000"
        expected = oracle_color_converter_hex(inp)
        result = cli.run_tool("color-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_white(self, cli):
        inp = "#FFFFFF"
        expected = oracle_color_converter_hex(inp)
        result = cli.run_tool("color-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_rgb_pure_red(self, cli):
        inp = "rgb(255, 0, 0)"
        expected = oracle_color_converter_rgb(255, 0, 0)
        result = cli.run_tool("color-converter", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg


# ---------------------------------------------------------------------------
# 15. string-inspector
# ---------------------------------------------------------------------------


class TestStringInspector:
    def test_ascii_text(self, cli):
        inp = "Hello"
        expected = oracle_string_inspector(inp)
        result = cli.run_tool("string-inspector", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_text_with_emoji(self, cli):
        inp = "Hi \U0001F43E"
        expected = oracle_string_inspector(inp)
        result = cli.run_tool("string-inspector", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_multiline(self, cli):
        inp = "line1\nline2\nline3"
        expected = oracle_string_inspector(inp)
        result = cli.run_tool("string-inspector", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_unicode_characters(self, cli):
        inp = "cafe"
        expected = oracle_string_inspector(inp)
        result = cli.run_tool("string-inspector", inp)
        assert result.exit_code == 0, result.stderr
        ok, msg = json_semantic(result.stdout, expected)
        assert ok, msg

    def test_counts_sanity(self, cli):
        inp = "two words"
        result = cli.run_tool("string-inspector", inp)
        assert result.exit_code == 0, result.stderr
        parsed = json.loads(result.stdout)
        assert parsed["characters"] == 9
        assert parsed["bytes"] == 9
        assert parsed["words"] == 2
        assert parsed["lines"] == 1
        assert parsed["isAscii"] is True


# ---------------------------------------------------------------------------
# Roundtrip tests
# ---------------------------------------------------------------------------


class TestConverterRoundtrips:
    def test_json_yaml_roundtrip(self, cli):
        """json -> yaml -> json should preserve data."""
        original = {"name": "binturong", "count": 42, "active": True}
        json_str = json.dumps(original)

        yaml_result = cli.run_tool("json-to-yaml", json_str)
        assert yaml_result.exit_code == 0, yaml_result.stderr

        json_result = cli.run_tool("yaml-to-json", yaml_result.stdout.strip())
        assert json_result.exit_code == 0, json_result.stderr

        roundtripped = json.loads(json_result.stdout)
        assert roundtripped == original

    def test_json_csv_json_roundtrip(self, cli):
        """json -> csv -> json preserves string values (all CSV values are strings)."""
        records = [
            {"age": "30", "city": "Paris", "name": "Alice"},
            {"age": "25", "city": "Tokyo", "name": "Bob"},
        ]
        json_str = json.dumps(records)

        csv_result = cli.run_tool("json-to-csv", json_str)
        assert csv_result.exit_code == 0, csv_result.stderr

        json_result = cli.run_tool("csv-to-json", csv_result.stdout.strip())
        assert json_result.exit_code == 0, json_result.stderr

        roundtripped = json.loads(json_result.stdout)
        assert roundtripped == records

    def test_ascii_hex_roundtrip(self, cli):
        text = "The quick brown fox"
        hex_result = cli.run_tool("ascii-to-hex", text)
        assert hex_result.exit_code == 0, hex_result.stderr

        ascii_result = cli.run_tool("hex-to-ascii", hex_result.stdout.strip())
        assert ascii_result.exit_code == 0, ascii_result.stderr
        ok, msg = stripped_match(ascii_result.stdout, text)
        assert ok, msg
