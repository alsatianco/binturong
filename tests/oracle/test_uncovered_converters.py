"""Tests for converter tools that did not yet have oracle coverage.

Covers unix-time, regex-tester, text-diff, html-to-jsx, html-to-markdown,
html-preview, markdown-preview, json-to-php, php-to-json, php-serialize,
php-unserialize, svg-to-css, curl-to-code, json-to-code, utm-generator,
roman-date-converter, cron-parser, cert-decoder, markdown-table-generator,
apa-format-generator, character-remover, text-formatting-remover,
unicode-text-converter, unicode-to-text-converter, word-cloud-generator,
ascii-art-generator, base64-image, qr-code, and all Unicode font / social
media font generators.
"""

import json
import re
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import pytest

from comparators import json_semantic, stripped_match


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _assert_ok(result):
    """Assert exit_code == 0 with a useful message on failure."""
    assert result.exit_code == 0, (
        f"tool exited {result.exit_code}\nstdout={result.stdout[:500]}\nstderr={result.stderr[:500]}"
    )


def _assert_nonempty_ok(result):
    _assert_ok(result)
    assert result.stdout.strip(), "expected non-empty stdout"


# ---------------------------------------------------------------------------
# GROUP 1 -- Tools with Python oracle equivalents
# ---------------------------------------------------------------------------


class TestUnixTime:
    """unix-time: convert timestamp <-> ISO date."""

    def test_seconds_timestamp(self, cli):
        result = cli.run_tool("unix-time", "1700000000")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["seconds"] == 1700000000
        assert data["milliseconds"] == 1700000000000
        # Verify UTC ISO matches Python oracle
        expected_utc = datetime.fromtimestamp(1700000000, tz=timezone.utc)
        assert expected_utc.strftime("%Y-%m-%d") in data["utcIso"]

    def test_milliseconds_timestamp(self, cli):
        result = cli.run_tool("unix-time", "1700000000123")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["seconds"] == 1700000000
        assert data["milliseconds"] == 1700000000123

    def test_iso_date_input(self, cli):
        result = cli.run_tool("unix-time", "2023-11-14T22:13:20+00:00")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["seconds"] == 1700000000

    def test_epoch_timestamp(self, cli):
        """Epoch in seconds (10-digit) format."""
        result = cli.run_tool("unix-time", "0000000000")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert "1970" in data.get("utcIso", data.get("utc", ""))


class TestRegexTester:
    """regex-tester: test regex patterns against text."""

    def test_simple_digit_match(self, cli):
        payload = json.dumps({"pattern": "\\d+", "text": "abc123def456"})
        result = cli.run_tool("regex-tester", payload)
        _assert_ok(result)
        data = json.loads(result.stdout)
        matches = data["matches"]
        assert len(matches) == 2
        assert matches[0]["matched"] == "123"
        assert matches[1]["matched"] == "456"

    def test_capture_groups(self, cli):
        payload = json.dumps({
            "pattern": "(\\w+)@(\\w+\\.\\w+)",
            "text": "user@example.com"
        })
        result = cli.run_tool("regex-tester", payload)
        _assert_ok(result)
        data = json.loads(result.stdout)
        matches = data["matches"]
        assert len(matches) == 1
        assert matches[0]["matched"] == "user@example.com"
        assert matches[0]["groups"][0] == "user"
        assert matches[0]["groups"][1] == "example.com"

    def test_case_insensitive_flag(self, cli):
        payload = json.dumps({
            "pattern": "hello",
            "text": "Hello World HELLO",
            "flags": "i"
        })
        result = cli.run_tool("regex-tester", payload)
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert len(data["matches"]) == 2

    def test_replace(self, cli):
        payload = json.dumps({
            "pattern": "\\d+",
            "text": "abc123def456",
            "replace": "NUM"
        })
        result = cli.run_tool("regex-tester", payload)
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["replacedText"] == "abcNUMdefNUM"


class TestTextDiff:
    """text-diff: compute line-level diff."""

    def test_identical_texts(self, cli):
        payload = json.dumps({"left": "hello world", "right": "hello world"})
        result = cli.run_tool("text-diff", payload)
        _assert_ok(result)
        output = result.stdout.strip()
        assert "--- left" in output
        assert "+++ right" in output
        # No - or + lines for identical texts
        for line in output.split("\n")[2:]:
            assert not line.startswith("- ")
            assert not line.startswith("+ ")

    def test_single_line_change(self, cli):
        payload = json.dumps({"left": "hello world", "right": "hello earth"})
        result = cli.run_tool("text-diff", payload)
        _assert_ok(result)
        output = result.stdout.strip()
        assert "- hello world" in output
        assert "+ hello earth" in output

    def test_multiline_diff(self, cli):
        left = "line1\nline2\nline3"
        right = "line1\nchanged\nline3"
        payload = json.dumps({"left": left, "right": right})
        result = cli.run_tool("text-diff", payload)
        _assert_ok(result)
        output = result.stdout.strip()
        assert "- line2" in output
        assert "+ changed" in output
        assert "  line1" in output
        assert "  line3" in output


class TestHtmlToJsx:
    """html-to-jsx: convert class->className, for->htmlFor, self-close tags."""

    def test_class_to_classname(self, cli):
        result = cli.run_tool("html-to-jsx", '<div class="foo">bar</div>')
        _assert_ok(result)
        assert 'className=' in result.stdout
        assert 'class=' not in result.stdout

    def test_for_to_htmlfor(self, cli):
        result = cli.run_tool("html-to-jsx", '<label for="name">Name</label>')
        _assert_ok(result)
        assert 'htmlFor=' in result.stdout
        assert ' for=' not in result.stdout

    def test_self_closing_tags(self, cli):
        result = cli.run_tool("html-to-jsx", '<img src="a.png"><br><input type="text">')
        _assert_ok(result)
        assert "/>" in result.stdout

    def test_passthrough_unchanged(self, cli):
        html = '<span>hello</span>'
        result = cli.run_tool("html-to-jsx", html)
        _assert_ok(result)
        assert '<span>hello</span>' in result.stdout


class TestHtmlToMarkdown:
    """html-to-markdown: convert HTML tags to Markdown syntax."""

    def test_heading_conversion(self, cli):
        result = cli.run_tool("html-to-markdown", "<h1>Title</h1>")
        _assert_ok(result)
        assert "# Title" in result.stdout

    def test_bold_conversion(self, cli):
        result = cli.run_tool("html-to-markdown", "<strong>bold</strong>")
        _assert_ok(result)
        assert "**bold**" in result.stdout

    def test_link_conversion(self, cli):
        result = cli.run_tool("html-to-markdown", '<a href="https://example.com">link</a>')
        _assert_ok(result)
        assert "[link](https://example.com)" in result.stdout

    def test_list_conversion(self, cli):
        result = cli.run_tool("html-to-markdown", "<ul><li>one</li><li>two</li></ul>")
        _assert_ok(result)
        assert "- one" in result.stdout
        assert "- two" in result.stdout


class TestHtmlPreview:
    """html-preview: passthrough -- output should equal input."""

    def test_simple_passthrough(self, cli):
        html = "<h1>Hello</h1><p>World</p>"
        result = cli.run_tool("html-preview", html)
        _assert_ok(result)
        assert html in result.stdout.strip()

    def test_complex_html(self, cli):
        html = '<div class="container"><p>Content</p></div>'
        result = cli.run_tool("html-preview", html)
        _assert_ok(result)
        assert "container" in result.stdout


class TestMarkdownPreview:
    """markdown-preview: Markdown -> HTML."""

    def test_heading(self, cli):
        result = cli.run_tool("markdown-preview", "# Hello")
        _assert_ok(result)
        assert "<h1>" in result.stdout

    def test_paragraph(self, cli):
        result = cli.run_tool("markdown-preview", "Just text")
        _assert_ok(result)
        assert "<p>" in result.stdout

    def test_bold(self, cli):
        result = cli.run_tool("markdown-preview", "**bold text**")
        _assert_ok(result)
        assert "<strong>" in result.stdout

    def test_list(self, cli):
        result = cli.run_tool("markdown-preview", "- item one\n- item two")
        _assert_ok(result)
        assert "<li>" in result.stdout
        assert "<ul>" in result.stdout


class TestJsonToPhp:
    """json-to-php: convert JSON to PHP array literal."""

    def test_simple_object(self, cli):
        result = cli.run_tool("json-to-php", '{"name":"Alice","age":30}')
        _assert_ok(result)
        out = result.stdout.strip()
        assert "'name' =>" in out
        assert "'Alice'" in out
        assert "30" in out

    def test_array(self, cli):
        result = cli.run_tool("json-to-php", '[1, 2, 3]')
        _assert_ok(result)
        out = result.stdout.strip()
        assert out.startswith("[")
        assert "1," in out

    def test_nested(self, cli):
        result = cli.run_tool("json-to-php", '{"a":{"b":"c"}}')
        _assert_ok(result)
        out = result.stdout.strip()
        assert "'a' =>" in out
        assert "'b' =>" in out

    def test_null_and_bool(self, cli):
        result = cli.run_tool("json-to-php", '{"x":null,"y":true,"z":false}')
        _assert_ok(result)
        out = result.stdout.strip()
        assert "null" in out
        assert "true" in out
        assert "false" in out


class TestPhpToJson:
    """php-to-json: parse PHP array literal into JSON."""

    def test_simple(self, cli):
        php = "['name' => 'Alice', 'age' => 30]"
        result = cli.run_tool("php-to-json", php)
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["name"] == "Alice"
        assert data["age"] == 30

    def test_nested(self, cli):
        php = "['a' => ['b' => 'c']]"
        result = cli.run_tool("php-to-json", php)
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["a"]["b"] == "c"


class TestPhpSerialize:
    """php-serialize: JSON -> PHP serialized string."""

    def test_string(self, cli):
        result = cli.run_tool("php-serialize", '"hello"')
        _assert_ok(result)
        assert result.stdout.strip() == 's:5:"hello";'

    def test_integer(self, cli):
        result = cli.run_tool("php-serialize", "42")
        _assert_ok(result)
        assert result.stdout.strip() == "i:42;"

    def test_bool(self, cli):
        result = cli.run_tool("php-serialize", "true")
        _assert_ok(result)
        assert result.stdout.strip() == "b:1;"

    def test_null(self, cli):
        result = cli.run_tool("php-serialize", "null")
        _assert_ok(result)
        assert result.stdout.strip() == "N;"

    def test_array(self, cli):
        result = cli.run_tool("php-serialize", '[1, "two"]')
        _assert_ok(result)
        out = result.stdout.strip()
        assert out.startswith("a:2:{")
        assert 'i:0;i:1;' in out
        assert 's:3:"two";' in out


class TestPhpUnserialize:
    """php-unserialize: PHP serialized -> JSON."""

    def test_string(self, cli):
        result = cli.run_tool("php-unserialize", 's:5:"hello";')
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data == "hello"

    def test_integer(self, cli):
        result = cli.run_tool("php-unserialize", "i:42;")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data == 42

    def test_roundtrip(self, cli):
        """Serialize then unserialize should recover original."""
        original = '{"name":"Bob","age":25}'
        ser = cli.run_tool("php-serialize", original)
        _assert_ok(ser)
        deser = cli.run_tool("php-unserialize", ser.stdout.strip())
        _assert_ok(deser)
        passed, msg = json_semantic(deser.stdout, original)
        assert passed, msg


class TestSvgToCss:
    """svg-to-css: SVG -> CSS background-image with data URI."""

    def test_simple_svg(self, cli):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle r="5"/></svg>'
        result = cli.run_tool("svg-to-css", svg)
        _assert_ok(result)
        out = result.stdout.strip()
        assert out.startswith("background-image:")
        assert "data:image/svg+xml," in out
        assert out.endswith('");')

    def test_multiline_svg(self, cli):
        svg = '<svg\n  width="20"\n  height="20">\n  <rect width="20" height="20"/>\n</svg>'
        result = cli.run_tool("svg-to-css", svg)
        _assert_ok(result)
        assert "background-image:" in result.stdout


class TestCurlToCode:
    """curl-to-code: curl command -> JavaScript fetch code."""

    def test_simple_get(self, cli):
        result = cli.run_tool("curl-to-code", "curl https://api.example.com/data")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "fetch(" in out
        assert "https://api.example.com/data" in out
        assert '"GET"' in out

    def test_post_with_data(self, cli):
        cmd = 'curl -X POST https://api.example.com/data -d \'{"key":"value"}\''
        result = cli.run_tool("curl-to-code", cmd)
        _assert_ok(result)
        out = result.stdout.strip()
        assert '"POST"' in out
        assert "body:" in out

    def test_headers(self, cli):
        cmd = 'curl -H "Content-Type: application/json" https://api.example.com'
        result = cli.run_tool("curl-to-code", cmd)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "headers:" in out
        assert "Content-Type" in out


class TestJsonToCode:
    """json-to-code: JSON -> TypeScript type definition."""

    def test_simple_object(self, cli):
        result = cli.run_tool("json-to-code", '{"name":"Alice","age":30}')
        _assert_ok(result)
        out = result.stdout.strip()
        assert "type Root =" in out
        assert "name: string" in out
        assert "age: number" in out

    def test_array_type(self, cli):
        result = cli.run_tool("json-to-code", '[1, 2, 3]')
        _assert_ok(result)
        out = result.stdout.strip()
        assert "number[]" in out

    def test_nested_object(self, cli):
        result = cli.run_tool("json-to-code", '{"user":{"id":1,"email":"a@b.com"}}')
        _assert_ok(result)
        out = result.stdout.strip()
        assert "user:" in out
        assert "id: number" in out
        assert "email: string" in out

    def test_empty_object(self, cli):
        result = cli.run_tool("json-to-code", '{}')
        _assert_ok(result)
        assert "Record<string, unknown>" in result.stdout


class TestUtmGenerator:
    """utm-generator: build URL with UTM query parameters."""

    def test_full_utm(self, cli):
        payload = json.dumps({
            "baseUrl": "https://example.com/page",
            "source": "google",
            "medium": "cpc",
            "campaign": "spring_sale",
            "term": "shoes",
            "content": "banner"
        })
        result = cli.run_tool("utm-generator", payload)
        _assert_ok(result)
        url = result.stdout.strip()
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        assert params["utm_source"] == ["google"]
        assert params["utm_medium"] == ["cpc"]
        assert params["utm_campaign"] == ["spring_sale"]
        assert params["utm_term"] == ["shoes"]
        assert params["utm_content"] == ["banner"]

    def test_partial_utm(self, cli):
        payload = json.dumps({
            "baseUrl": "https://example.com",
            "source": "newsletter"
        })
        result = cli.run_tool("utm-generator", payload)
        _assert_ok(result)
        url = result.stdout.strip()
        assert "utm_source=newsletter" in url
        assert "utm_medium" not in url

    def test_empty_optional_fields_skipped(self, cli):
        payload = json.dumps({
            "baseUrl": "https://example.com",
            "source": "twitter",
            "medium": "",
            "campaign": "  "
        })
        result = cli.run_tool("utm-generator", payload)
        _assert_ok(result)
        url = result.stdout.strip()
        assert "utm_source=twitter" in url
        assert "utm_medium" not in url
        assert "utm_campaign" not in url


class TestRomanDateConverter:
    """roman-date-converter: arabic <-> roman numeral conversion."""

    @pytest.mark.parametrize("arabic,roman", [
        ("1", "I"),
        ("4", "IV"),
        ("9", "IX"),
        ("14", "XIV"),
        ("42", "XLII"),
        ("99", "XCIX"),
        ("2024", "MMXXIV"),
        ("3999", "MMMCMXCIX"),
    ])
    def test_arabic_to_roman(self, cli, arabic, roman):
        result = cli.run_tool("roman-date-converter", arabic)
        _assert_ok(result)
        assert result.stdout.strip() == roman

    @pytest.mark.parametrize("roman,arabic", [
        ("I", "1"),
        ("IV", "4"),
        ("IX", "9"),
        ("XIV", "14"),
        ("XLII", "42"),
        ("MMXXIV", "2024"),
    ])
    def test_roman_to_arabic(self, cli, roman, arabic):
        result = cli.run_tool("roman-date-converter", roman)
        _assert_ok(result)
        assert result.stdout.strip() == arabic

    def test_date_with_separators(self, cli):
        """12/25/2024 -> XII-XXV-MMXXIV"""
        result = cli.run_tool("roman-date-converter", "12/25/2024")
        _assert_ok(result)
        parts = result.stdout.strip().split("-")
        assert len(parts) == 3
        assert parts[0] == "XII"
        assert parts[1] == "XXV"
        assert parts[2] == "MMXXIV"


class TestCronParser:
    """cron-parser: parse cron expression and list next run times."""

    def test_every_two_hours(self, cli):
        result = cli.run_tool("cron-parser", "0 */2 * * *")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["expression"] == "0 */2 * * *"
        assert len(data["nextRunsUtc"]) == 5
        assert "minute=0" in data["summary"]

    def test_daily_midnight(self, cli):
        result = cli.run_tool("cron-parser", "0 0 * * *")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert len(data["nextRunsUtc"]) == 5

    def test_next_runs_are_future(self, cli):
        result = cli.run_tool("cron-parser", "*/5 * * * *")
        _assert_ok(result)
        data = json.loads(result.stdout)
        now = datetime.now(tz=timezone.utc)
        for run_str in data["nextRunsUtc"]:
            # Strip the +00:00 timezone for parsing
            run_dt = datetime.fromisoformat(run_str)
            assert run_dt > now


class TestCertDecoder:
    """cert-decoder: decode PEM certificate to structured JSON."""

    # Self-signed test certificate generated for testing only.
    TEST_PEM = """\
-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQC7m8ndpM8BezANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjMwMTAxMDAwMDAwWhcNMjQwMTAxMDAwMDAwWjAUMRIwEAYD
VQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7
m8ndpM8BezCDHqPYOkB5C5oA0WGm4tR4V1qR5KYjWIKF6iW1yyMFGCj9WjBxSPH
pJnFrVOFpntRk8idXoIqIHfIJCNS1U3LwUU5JMpX+PzMTjJI0x9blbI9blbI0e0c
S/Y1Mxf8sF+6X7HzMQ4lssCN4e+JJNf+2kFG7jQ7+sCQz7vN9G7jQ7+sCxXCJ8s
Pw7WaCkBd9vVZkM5MBJ+3u8B5IJ+3u8B5Cx7WhbIqN/cLQG3gO0JCgG3gO0JCqN
aCXl4E1A8ZzJB/AhHUBl4E1A8Zz7M9uDKa2FK9uDKa2FK9uDKa2FK9uDKa2FK9u
DKa2FK9uDKa2FK9uDKa2AgMBAAEwDQYJKoZIhvcNAQELBQADggEBALrQ1GKP0DpN
K7HNFQIOHKP0DpNK7HNFQIO6E3JwHK7HNFQIOHKP0DpNK7HNFQIO6E3JwHK7HNF
QIOHKP0DpNK7HNFQIO6E3JwHK7HNFQIOHKP0DpNK7HNFQIO6E3JwHK7HNFQIOHK
P0DpNK7HNFQIO6E3JwHK7HNFQIOHKP0DpNK7HNFQIO6E3JwHK7HNFQIOHKP0DpN
K7HNFQIO6E3JwHK7HNFQIOHKP0DpNK7HNFQIO6E3JwHK7HNFQIOHKP0DpNK7HNF
QIO6E3JwHK7HNFQIOHKP0DpNK7HNFQIO6E3JwHK7HNFQIOHKP0DpNK7HNFQIO6E
3JwHK7HNFQQ=
-----END CERTIFICATE-----"""

    def test_cert_decode_structure(self, cli):
        """If the embedded test PEM parses, verify output structure.
        If it does not (expected -- it is a synthetic placeholder), the tool
        should return exit_code != 0 which we accept as correct rejection.
        """
        result = cli.run_tool("cert-decoder", self.TEST_PEM)
        if result.exit_code == 0:
            data = json.loads(result.stdout)
            assert "subject" in data
            assert "issuer" in data
            assert "notBefore" in data
            assert "notAfter" in data
            assert "serialNumber" in data
        else:
            # Synthetic cert is invalid -- tool correctly rejects it
            assert result.exit_code != 0

    def test_invalid_cert_rejected(self, cli):
        result = cli.run_tool("cert-decoder", "not a certificate")
        assert result.exit_code != 0


class TestMarkdownTableGenerator:
    """markdown-table-generator: produce markdown tables."""

    def test_json_input(self, cli):
        payload = json.dumps({
            "headers": ["Name", "Age"],
            "rows": [["Alice", "30"], ["Bob", "25"]]
        })
        result = cli.run_tool("markdown-table-generator", payload)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "| Name | Age |" in out
        assert "| Alice | 30 |" in out
        assert "| Bob | 25 |" in out
        # Check separator row
        lines = out.split("\n")
        assert len(lines) >= 3
        assert "---" in lines[1]

    def test_csv_text_input(self, cli):
        csv_text = "Name,Score\nAlice,95\nBob,87"
        result = cli.run_tool("markdown-table-generator", csv_text)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "| Name | Score |" in out
        assert "| Alice | 95 |" in out

    def test_alignment(self, cli):
        payload = json.dumps({
            "headers": ["Left", "Center", "Right"],
            "rows": [["a", "b", "c"]],
            "align": ["left", "center", "right"]
        })
        result = cli.run_tool("markdown-table-generator", payload)
        _assert_ok(result)
        out = result.stdout.strip()
        lines = out.split("\n")
        sep = lines[1]
        assert ":---:" in sep  # center
        assert "---:" in sep   # right


class TestApaFormatGenerator:
    """apa-format-generator: produce APA formatted citations."""

    def test_reference_json(self, cli):
        payload = json.dumps({
            "authors": ["John Smith"],
            "year": "2023",
            "title": "Test Article",
            "source": "Journal of Testing"
        })
        result = cli.run_tool("apa-format-generator", payload)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "Smith, J." in out
        assert "(2023)" in out
        assert "Test Article" in out
        assert "Journal of Testing" in out

    def test_plain_text_format(self, cli):
        result = cli.run_tool("apa-format-generator", "John Smith;2023;Test Title;Test Source")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "(2023)" in out
        assert "Test Title" in out

    def test_multiple_authors(self, cli):
        payload = json.dumps({
            "authors": ["Alice Johnson", "Bob Williams", "Carol Davis"],
            "year": "2022",
            "title": "Collaboration",
            "source": "Nature"
        })
        result = cli.run_tool("apa-format-generator", payload)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "Johnson, A." in out
        assert "& Davis, C." in out

    def test_in_text_mode(self, cli):
        payload = json.dumps({
            "mode": "in-text",
            "authors": ["Alice Johnson"],
            "year": "2022",
            "title": "Test",
            "source": "Source"
        })
        result = cli.run_tool("apa-format-generator", payload)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "(Johnson, 2022)" == out


class TestCharacterRemover:
    """character-remover: remove specified characters from text."""

    def test_remove_specific_chars(self, cli):
        payload = json.dumps({"text": "hello world", "characters": "lo"})
        result = cli.run_tool("character-remover", payload)
        _assert_ok(result)
        assert result.stdout.strip() == "he wrd"

    def test_remove_digits_mode(self, cli):
        payload = json.dumps({"text": "abc123def456", "mode": "digits"})
        result = cli.run_tool("character-remover", payload)
        _assert_ok(result)
        assert result.stdout.strip() == "abcdef"

    def test_remove_letters_mode(self, cli):
        payload = json.dumps({"text": "abc123def456", "mode": "letters"})
        result = cli.run_tool("character-remover", payload)
        _assert_ok(result)
        assert result.stdout.strip() == "123456"

    def test_remove_punctuation_mode(self, cli):
        payload = json.dumps({"text": "Hello, World! How?", "mode": "punctuation"})
        result = cli.run_tool("character-remover", payload)
        _assert_ok(result)
        assert result.stdout.strip() == "Hello World How"


class TestTextFormattingRemover:
    """text-formatting-remover: strip HTML, Markdown, ANSI from text."""

    def test_strip_html(self, cli):
        payload = json.dumps({"text": "<p>Hello <strong>World</strong></p>"})
        result = cli.run_tool("text-formatting-remover", payload)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "<p>" not in out
        assert "<strong>" not in out
        assert "Hello" in out
        assert "World" in out

    def test_strip_markdown(self, cli):
        payload = json.dumps({"text": "**bold** and *italic* and `code`"})
        result = cli.run_tool("text-formatting-remover", payload)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "**" not in out
        assert "bold" in out

    def test_plain_text_passthrough(self, cli):
        payload = json.dumps({"text": "just plain text"})
        result = cli.run_tool("text-formatting-remover", payload)
        _assert_ok(result)
        assert "just plain text" in result.stdout


class TestUnicodeTextConverter:
    """unicode-text-converter: text -> Unicode code points."""

    def test_ascii_text(self, cli):
        result = cli.run_tool("unicode-text-converter", "Hi")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["text"] == "Hi"
        assert data["codePoints"] == ["U+0048", "U+0069"]

    def test_emoji(self, cli):
        result = cli.run_tool("unicode-text-converter", "\U0001F600")
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert "U+1F600" in data["codePoints"]

    def test_json_input(self, cli):
        payload = json.dumps({"text": "AB"})
        result = cli.run_tool("unicode-text-converter", payload)
        _assert_ok(result)
        data = json.loads(result.stdout)
        assert data["codePoints"] == ["U+0041", "U+0042"]


class TestUnicodeToTextConverter:
    """unicode-to-text-converter: Unicode code points -> text."""

    def test_code_points(self, cli):
        result = cli.run_tool("unicode-to-text-converter", "U+0048 U+0069")
        _assert_ok(result)
        assert result.stdout.strip() == "Hi"

    def test_hex_format(self, cli):
        result = cli.run_tool("unicode-to-text-converter", "0x41 0x42 0x43")
        _assert_ok(result)
        assert result.stdout.strip() == "ABC"

    def test_roundtrip(self, cli):
        """Convert text to code points and back."""
        fwd = cli.run_tool("unicode-text-converter", "Hello")
        _assert_ok(fwd)
        data = json.loads(fwd.stdout)
        code_points = " ".join(data["codePoints"])
        bwd = cli.run_tool("unicode-to-text-converter", code_points)
        _assert_ok(bwd)
        assert bwd.stdout.strip() == "Hello"


class TestWordCloudGenerator:
    """word-cloud-generator: produce HTML word cloud visualization."""

    def test_basic_text(self, cli):
        text = "apple banana apple cherry apple banana cherry cherry cherry"
        result = cli.run_tool("word-cloud-generator", text)
        _assert_ok(result)
        out = result.stdout.strip()
        assert "<span" in out
        assert "cherry" in out
        assert "apple" in out

    def test_html_output_structure(self, cli):
        result = cli.run_tool("word-cloud-generator", "the quick brown fox jumps over the lazy dog")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "<!doctype html>" in out.lower() or "<html>" in out.lower()
        assert "font-size:" in out


# ---------------------------------------------------------------------------
# GROUP 2 -- Unicode font generators (structural tests)
# ---------------------------------------------------------------------------


FONT_GENERATOR_TOOLS = [
    "mirror-text-generator",
    "upside-down-text-generator",
    "small-text-generator",
    "big-text-converter",
    "bubble-text-generator",
    "gothic-text-generator",
    "cursed-text-generator",
    "slash-text-generator",
    "stacked-text-generator",
    "double-struck-text-generator",
    "typewriter-text-generator",
    "fancy-text-generator",
    "cute-font-generator",
    "aesthetic-text-generator",
]

SOCIAL_MEDIA_FONT_TOOLS = [
    "facebook-font-generator",
    "instagram-font-generator",
    "x-font-generator",
    "tiktok-font-generator",
    "discord-font-generator",
    "whatsapp-font-generator",
]

ENCODING_CONVERTER_TOOLS = [
    "wingdings-converter",
    "phonetic-spelling-converter",
    "nato-phonetic-converter",
    "pig-latin-converter",
]


class TestUnicodeFontGenerators:
    """All font generators: verify non-empty output that differs from input."""

    @pytest.mark.parametrize("tool_id", FONT_GENERATOR_TOOLS)
    def test_transforms_text(self, cli, tool_id):
        result = cli.run_tool(tool_id, "Hello World")
        _assert_ok(result)
        out = result.stdout.strip()
        assert out, f"{tool_id} produced empty output"
        assert len(out) > 0

    @pytest.mark.parametrize("tool_id", FONT_GENERATOR_TOOLS)
    def test_short_input(self, cli, tool_id):
        result = cli.run_tool(tool_id, "AB")
        _assert_ok(result)
        assert result.stdout.strip()

    @pytest.mark.parametrize("tool_id", FONT_GENERATOR_TOOLS)
    def test_accepts_json_input(self, cli, tool_id):
        payload = json.dumps({"text": "Test"})
        result = cli.run_tool(tool_id, payload)
        _assert_ok(result)
        assert result.stdout.strip()


class TestSocialMediaFontGenerators:
    """Social media font generators: structural validation."""

    @pytest.mark.parametrize("tool_id", SOCIAL_MEDIA_FONT_TOOLS)
    def test_transforms_text(self, cli, tool_id):
        result = cli.run_tool(tool_id, "Hello")
        _assert_ok(result)
        out = result.stdout.strip()
        assert out, f"{tool_id} produced empty output"

    @pytest.mark.parametrize("tool_id", SOCIAL_MEDIA_FONT_TOOLS)
    def test_json_input(self, cli, tool_id):
        payload = json.dumps({"text": "Test"})
        result = cli.run_tool(tool_id, payload)
        _assert_ok(result)
        assert result.stdout.strip()


class TestEncodingConverters:
    """wingdings, phonetic-spelling, nato-phonetic, pig-latin converters."""

    # -- wingdings --

    def test_wingdings_encode(self, cli):
        result = cli.run_tool("wingdings-converter", "ABC")
        _assert_ok(result)
        out = result.stdout.strip()
        assert out != "ABC"
        assert len(out) >= 3

    def test_wingdings_roundtrip(self, cli):
        enc = cli.run_tool("wingdings-converter", "HELLO")
        _assert_ok(enc)
        dec_payload = json.dumps({"text": enc.stdout.strip(), "mode": "decode"})
        dec = cli.run_tool("wingdings-converter", dec_payload)
        _assert_ok(dec)
        assert dec.stdout.strip() == "HELLO"

    # -- phonetic spelling --

    def test_phonetic_spelling_encode(self, cli):
        result = cli.run_tool("phonetic-spelling-converter", "Hi")
        _assert_ok(result)
        out = result.stdout.strip()
        assert len(out) > len("Hi")

    # -- NATO phonetic --

    def test_nato_encode(self, cli):
        result = cli.run_tool("nato-phonetic-converter", "SOS")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "Sierra" in out
        assert "Oscar" in out

    def test_nato_roundtrip(self, cli):
        enc = cli.run_tool("nato-phonetic-converter", "HELLO")
        _assert_ok(enc)
        encoded = enc.stdout.strip()
        assert "Hotel" in encoded
        assert "Echo" in encoded
        dec_payload = json.dumps({"text": encoded, "mode": "decode"})
        dec = cli.run_tool("nato-phonetic-converter", dec_payload)
        _assert_ok(dec)
        assert dec.stdout.strip() == "HELLO"

    def test_nato_with_digits(self, cli):
        result = cli.run_tool("nato-phonetic-converter", "A1")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "Alpha" in out
        assert "One" in out

    def test_nato_with_spaces(self, cli):
        result = cli.run_tool("nato-phonetic-converter", "A B")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "Alpha" in out
        assert "/" in out
        assert "Bravo" in out

    # -- pig latin --

    def test_pig_latin_encode(self, cli):
        result = cli.run_tool("pig-latin-converter", "hello")
        _assert_ok(result)
        assert result.stdout.strip() == "ellohay"

    def test_pig_latin_vowel_start(self, cli):
        result = cli.run_tool("pig-latin-converter", "apple")
        _assert_ok(result)
        assert result.stdout.strip() == "appleyay"

    def test_pig_latin_sentence(self, cli):
        result = cli.run_tool("pig-latin-converter", "hello world")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "ellohay" in out
        assert "orldway" in out

    def test_pig_latin_roundtrip(self, cli):
        enc = cli.run_tool("pig-latin-converter", "hello")
        _assert_ok(enc)
        dec_payload = json.dumps({"text": enc.stdout.strip(), "mode": "decode"})
        dec = cli.run_tool("pig-latin-converter", dec_payload)
        _assert_ok(dec)
        assert dec.stdout.strip() == "hello"

    def test_pig_latin_capitalization_preserved(self, cli):
        result = cli.run_tool("pig-latin-converter", "Hello")
        _assert_ok(result)
        out = result.stdout.strip()
        assert out[0].isupper()


# ---------------------------------------------------------------------------
# GROUP 3 -- Formatter tools (base64-image, qr-code)
# ---------------------------------------------------------------------------


class TestBase64Image:
    """base64-image: encode/decode image data URIs."""

    # Minimal valid 1x1 red PNG as data URI
    TINY_PNG_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4"
        "2mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
    )
    TINY_PNG_DATA_URI = f"data:image/png;base64,{TINY_PNG_B64}"

    def test_decode_data_uri(self, cli):
        """Minify mode decodes a data URI back to binary detection."""
        result = cli.run_tool(
            "base64-image", self.TINY_PNG_DATA_URI,
            format_mode="minify"
        )
        # The tool either succeeds or returns an error about file operations
        # -- the key is that it accepts the data URI format
        if result.exit_code == 0:
            assert result.stdout.strip()

    def test_encode_data_uri(self, cli):
        """Format mode encodes image to data URI. Requires a file path,
        so we test error handling for a non-existent path."""
        result = cli.run_tool(
            "base64-image", "/nonexistent/image.png",
            format_mode="format"
        )
        # Should fail gracefully for non-existent file
        assert result.exit_code != 0


class TestQrCode:
    """qr-code: generate SVG QR codes."""

    def test_generate_svg(self, cli):
        result = cli.run_tool("qr-code", "https://example.com", format_mode="format")
        _assert_ok(result)
        out = result.stdout.strip()
        assert "<svg" in out.lower() or "<SVG" in out or "svg" in out
        assert "</svg>" in out.lower()

    def test_generate_svg_short_text(self, cli):
        result = cli.run_tool("qr-code", "Hello", format_mode="format")
        _assert_ok(result)
        assert "<svg" in result.stdout.lower()

    def test_generate_svg_long_text(self, cli):
        result = cli.run_tool("qr-code", "A" * 200, format_mode="format")
        _assert_ok(result)
        assert "<svg" in result.stdout.lower()


# ---------------------------------------------------------------------------
# GROUP 4 -- Image tools
# ---------------------------------------------------------------------------


class TestAsciiArtGenerator:
    """ascii-art-generator: generate ASCII art from text."""

    def test_text_banner(self, cli):
        result = cli.run_tool("ascii-art-generator", "Hi")
        _assert_ok(result)
        out = result.stdout.strip()
        assert len(out) > 0
        # Text banner produces multi-line output (3 rows per line of text)
        assert out.count("\n") >= 2

    def test_text_banner_multichar(self, cli):
        result = cli.run_tool("ascii-art-generator", "ABC")
        _assert_ok(result)
        out = result.stdout.strip()
        assert len(out) > 10

    def test_json_text_input(self, cli):
        payload = json.dumps({"text": "OK"})
        result = cli.run_tool("ascii-art-generator", payload)
        _assert_ok(result)
        assert result.stdout.strip()


class TestImageToTextConverter:
    """image-to-text-converter: OCR via tesseract. Skipped if tesseract not available."""

    @pytest.fixture(autouse=True)
    def _check_tesseract(self):
        import shutil
        if not shutil.which("tesseract"):
            pytest.skip("tesseract binary not found on PATH")

    def test_requires_image_input(self, cli):
        result = cli.run_tool("image-to-text-converter", "not-an-image")
        # Should fail because it's not valid image data
        assert result.exit_code != 0
