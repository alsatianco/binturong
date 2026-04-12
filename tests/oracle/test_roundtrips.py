"""Roundtrip consistency tests for bidirectional tools.

For each bidirectional tool, verify that decode(encode(x)) == x.
This catches bugs where encoding works but decoding does not round-trip.
"""

import pytest


# ---------------------------------------------------------------------------
# Parametrised roundtrip data
# ---------------------------------------------------------------------------
# Each entry: (tool_id, input_text, encode_mode, decode_mode, indent)
#
# ``indent`` is only used by caesar-cipher (as the shift value).

ROUNDTRIP_CASES = [
    # ---- base64 ----
    pytest.param("base64", "Hello, World!", "format", "minify", None,
                 id="base64-ascii"),
    pytest.param("base64", "cafe\u0301 n\u0303 u\u0308ber", "format", "minify", None,
                 id="base64-unicode"),
    pytest.param("base64", "The quick brown fox", "format", "minify", None,
                 id="base64-multi-word"),
    pytest.param("base64", "x = 1 + 2 * (3 / 4) & 5 @ 6 # 7", "format", "minify", None,
                 id="base64-special-chars"),
    pytest.param("base64", "0123456789!?.,;:", "format", "minify", None,
                 id="base64-numbers-punctuation"),

    # ---- url ----
    pytest.param("url", "Hello, World!", "format", "minify", None,
                 id="url-ascii"),
    pytest.param("url", "cafe\u0301 n\u0303 u\u0308ber", "format", "minify", None,
                 id="url-unicode"),
    pytest.param("url", "key=value&foo=bar baz", "format", "minify", None,
                 id="url-special-chars"),
    pytest.param("url", "The quick brown fox", "format", "minify", None,
                 id="url-multi-word"),
    pytest.param("url", "100% of $5 is @price", "format", "minify", None,
                 id="url-numbers-punctuation"),

    # ---- html-entity ----
    pytest.param("html-entity", "Hello, World!", "format", "minify", None,
                 id="html-entity-ascii"),
    pytest.param("html-entity", '<div class="test">a & b</div>', "format", "minify", None,
                 id="html-entity-special-chars"),
    pytest.param("html-entity", "The quick brown fox", "format", "minify", None,
                 id="html-entity-multi-word"),
    pytest.param("html-entity", "Tom & Jerry's \"show\" < > end", "format", "minify", None,
                 id="html-entity-all-five"),
    pytest.param("html-entity", "1 < 2 & 3 > 0", "format", "minify", None,
                 id="html-entity-numbers-punctuation"),

    # ---- utf8 (encode bytes / decode bytes) ----
    pytest.param("utf8", "Hello, World!", "format", "minify", None,
                 id="utf8-ascii"),
    pytest.param("utf8", "cafe\u0301 n\u0303 u\u0308ber", "format", "minify", None,
                 id="utf8-unicode"),
    pytest.param("utf8", "The quick brown fox", "format", "minify", None,
                 id="utf8-multi-word"),
    pytest.param("utf8", "!@#$%^&*()", "format", "minify", None,
                 id="utf8-special-chars"),
    pytest.param("utf8", "0123456789", "format", "minify", None,
                 id="utf8-numbers"),

    # ---- binary-code ----
    pytest.param("binary-code", "Hello, World!", "format", "minify", None,
                 id="binary-code-ascii"),
    pytest.param("binary-code", "cafe\u0301 n\u0303 u\u0308ber", "format", "minify", None,
                 id="binary-code-unicode"),
    pytest.param("binary-code", "The quick brown fox", "format", "minify", None,
                 id="binary-code-multi-word"),
    pytest.param("binary-code", "a!b@c#d$e%", "format", "minify", None,
                 id="binary-code-special-chars"),
    pytest.param("binary-code", "0123456789", "format", "minify", None,
                 id="binary-code-numbers"),

    # ---- morse-code ----
    # Morse only supports uppercase letters, digits, and certain punctuation.
    pytest.param("morse-code", "HELLO WORLD", "format", "minify", None,
                 id="morse-code-ascii"),
    pytest.param("morse-code", "HELLO WORLD 123", "format", "minify", None,
                 id="morse-code-alphanumeric"),
    pytest.param("morse-code", "THE QUICK BROWN FOX", "format", "minify", None,
                 id="morse-code-multi-word"),
    pytest.param("morse-code", "SOS", "format", "minify", None,
                 id="morse-code-sos"),
    pytest.param("morse-code", "TEST 456 789", "format", "minify", None,
                 id="morse-code-numbers"),

    # ---- backslash-escape (escape / unescape) ----
    pytest.param("backslash-escape", "Hello, World!", "format", "minify", None,
                 id="backslash-escape-ascii"),
    pytest.param("backslash-escape", "cafe\u0301 n\u0303 u\u0308ber", "format", "minify", None,
                 id="backslash-escape-unicode"),
    pytest.param("backslash-escape", "The quick brown fox", "format", "minify", None,
                 id="backslash-escape-multi-word"),
    pytest.param("backslash-escape", 'path\\to\\file "quoted"', "format", "minify", None,
                 id="backslash-escape-special-chars"),
    pytest.param("backslash-escape", "line1, line2; 3 & 4!", "format", "minify", None,
                 id="backslash-escape-numbers-punctuation"),

    # ---- quote-helper (quote / unquote) ----
    pytest.param("quote-helper", "Hello, World!", "format", "minify", None,
                 id="quote-helper-ascii"),
    pytest.param("quote-helper", "cafe\u0301 n\u0303 u\u0308ber", "format", "minify", None,
                 id="quote-helper-unicode"),
    pytest.param("quote-helper", "The quick brown fox", "format", "minify", None,
                 id="quote-helper-multi-word"),
    pytest.param("quote-helper", 'say "hello" to them', "format", "minify", None,
                 id="quote-helper-special-chars"),
    pytest.param("quote-helper", "price is $9.99 (100%)", "format", "minify", None,
                 id="quote-helper-numbers-punctuation"),

    # ---- json-stringify (stringify / unstringify) ----
    pytest.param("json-stringify", "Hello, World!", "format", "minify", None,
                 id="json-stringify-ascii"),
    pytest.param("json-stringify", "cafe\u0301 n\u0303 u\u0308ber", "format", "minify", None,
                 id="json-stringify-unicode"),
    pytest.param("json-stringify", "The quick brown fox", "format", "minify", None,
                 id="json-stringify-multi-word"),
    pytest.param("json-stringify", 'key: "value", other: \\path', "format", "minify", None,
                 id="json-stringify-special-chars"),
    pytest.param("json-stringify", "count = 42; ratio = 3.14!", "format", "minify", None,
                 id="json-stringify-numbers-punctuation"),

    # ---- caesar-cipher (encrypt / decrypt) with shift=3 ----
    pytest.param("caesar-cipher", "Hello, World!", "format", "minify", 3,
                 id="caesar-cipher-shift3-ascii"),
    pytest.param("caesar-cipher", "The quick brown fox", "format", "minify", 3,
                 id="caesar-cipher-shift3-multi-word"),
    pytest.param("caesar-cipher", "abcXYZ 123!?", "format", "minify", 3,
                 id="caesar-cipher-shift3-mixed"),
    pytest.param("caesar-cipher", "Pack my box with five dozen liquor jugs",
                 "format", "minify", 3,
                 id="caesar-cipher-shift3-pangram"),
    pytest.param("caesar-cipher", "ZzAa wrap around", "format", "minify", 3,
                 id="caesar-cipher-shift3-wrap"),

    # ---- caesar-cipher with shift=13 ----
    pytest.param("caesar-cipher", "Hello, World!", "format", "minify", 13,
                 id="caesar-cipher-shift13-ascii"),
    pytest.param("caesar-cipher", "The quick brown fox", "format", "minify", 13,
                 id="caesar-cipher-shift13-multi-word"),
    pytest.param("caesar-cipher", "abcXYZ 123!?", "format", "minify", 13,
                 id="caesar-cipher-shift13-mixed"),
    pytest.param("caesar-cipher", "ZzAa wrap around", "format", "minify", 13,
                 id="caesar-cipher-shift13-wrap"),
    pytest.param("caesar-cipher", "0123456789 +-*/", "format", "minify", 13,
                 id="caesar-cipher-shift13-non-alpha"),
]


@pytest.mark.parametrize(
    "tool_id,input_text,encode_mode,decode_mode,indent",
    ROUNDTRIP_CASES,
)
def test_roundtrip(cli, tool_id, input_text, encode_mode, decode_mode, indent):
    """Verify that decode(encode(input)) == input for a bidirectional tool."""
    encoded = cli.run_tool(
        tool_id, input_text, format_mode=encode_mode, indent=indent,
    )
    assert encoded.exit_code == 0, (
        f"encode failed for {tool_id}: {encoded.stderr}"
    )

    decoded = cli.run_tool(
        tool_id, encoded.stdout.strip(), format_mode=decode_mode, indent=indent,
    )
    assert decoded.exit_code == 0, (
        f"decode failed for {tool_id}: {decoded.stderr}"
    )

    # Morse-code always decodes to uppercase, so normalise for comparison.
    actual = decoded.stdout.strip()
    expected = input_text.strip()
    if tool_id == "morse-code":
        expected = expected.upper()

    assert actual == expected, (
        f"Roundtrip failed for {tool_id}:\n"
        f"  input:   {input_text!r}\n"
        f"  encoded: {encoded.stdout.strip()!r}\n"
        f"  decoded: {actual!r}"
    )


# ---------------------------------------------------------------------------
# ROT13 self-inverse property
# ---------------------------------------------------------------------------
# ROT13 is its own inverse: applying it twice yields the original text.
# We test this separately because ROT13 does not have distinct encode/decode
# modes -- both directions use the same transform.

ROT13_SELF_INVERSE_CASES = [
    pytest.param("Hello, World!", id="rot13-ascii"),
    pytest.param("cafe\u0301 n\u0303 u\u0308ber", id="rot13-unicode"),
    pytest.param("The quick brown fox", id="rot13-multi-word"),
    pytest.param("ABCxyz 123 !@#$%", id="rot13-special-chars"),
    pytest.param("0123456789.,;:!?", id="rot13-numbers-punctuation"),
    pytest.param("AaBbYyZz", id="rot13-boundary-chars"),
    pytest.param("Pack my box with five dozen liquor jugs",
                 id="rot13-pangram"),
]


@pytest.mark.parametrize("input_text", ROT13_SELF_INVERSE_CASES)
def test_rot13_self_inverse(cli, input_text):
    """Applying ROT13 twice must return the original text."""
    first = cli.run_tool("rot13", input_text, format_mode="format")
    assert first.exit_code == 0, f"first ROT13 pass failed: {first.stderr}"

    # The intermediate result must differ from the original (for alphabetic
    # input) -- but we do not assert that here because non-alpha chars are
    # unchanged and the input *could* be entirely non-alpha.

    second = cli.run_tool("rot13", first.stdout.strip(), format_mode="format")
    assert second.exit_code == 0, f"second ROT13 pass failed: {second.stderr}"

    assert second.stdout.strip() == input_text.strip(), (
        f"ROT13 self-inverse failed:\n"
        f"  input:       {input_text!r}\n"
        f"  after rot13: {first.stdout.strip()!r}\n"
        f"  after 2x:    {second.stdout.strip()!r}"
    )
