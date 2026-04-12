"""Oracle tests for non-deterministic tools (random generators, UUID/ULID).

Unlike deterministic tools, these produce unpredictable output. Instead of
computing an expected value in Python, each test validates the *structure*,
*format*, and *constraints* of the output (length, charset, value range, etc.).
Every tool is invoked multiple times to confirm it reliably produces output
without crashing.

NOTE: Most random generator tools accept empty input at the Rust tool level,
but the CLI's `read_input` function rejects empty stdin. Additionally, the CLI
dispatches to run_formatter_tool first; since these aren't formatters, the
formatter rejects non-empty-but-trimmed-to-empty input before falling through.
Sending "{}" (empty JSON object) works because it passes CLI input validation,
the formatter rejects it with "unsupported formatter tool id", and the converter
parses {} as valid config with all defaults.
"""

import json
import re
import string

import pytest

# Empty JSON object - used as default input for converter tools that accept
# empty/default configuration. See module docstring for why "" doesn't work.
EMPTY_CONFIG = "{}"


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def assert_exit_ok(result, tool_id: str):
    """Assert the CLI exited successfully."""
    assert result.exit_code == 0, (
        f"{tool_id} exited {result.exit_code}: {result.stderr}"
    )


def output(result) -> str:
    """Return stripped stdout from a CliResult."""
    return result.stdout.strip()


VALID_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

UUID_V4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# Crockford Base32 alphabet used by ULID
CROCKFORD_BASE32 = set("0123456789ABCDEFGHJKMNPQRSTVWXYZ")


# ===================================================================
# 1. random-string
# ===================================================================

class TestRandomString:

    @pytest.mark.category_b
    def test_default_generates_16_char_alphanumeric(self, cli):
        """Default invocation produces a 16-char alphanumeric string."""
        for _ in range(3):
            result = cli.run_tool("random-string", EMPTY_CONFIG)
            assert_exit_ok(result, "random-string")
            out = output(result)
            assert len(out) == 16, (
                f"Expected 16 chars, got {len(out)}: {out!r}"
            )
            assert out.isalnum(), (
                f"Expected alphanumeric, got non-alnum chars: {out!r}"
            )

    @pytest.mark.category_b
    def test_custom_length(self, cli):
        """Specifying a custom length via JSON input."""
        for length in (1, 8, 32, 64, 128):
            result = cli.run_tool(
                "random-string",
                json.dumps({"length": length, "charset": "alphanumeric"}),
            )
            assert_exit_ok(result, "random-string")
            out = output(result)
            assert len(out) == length, (
                f"Expected {length} chars, got {len(out)}: {out!r}"
            )
            assert out.isalnum(), (
                f"Expected alphanumeric, got: {out!r}"
            )

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Two invocations should (almost certainly) produce different values."""
        results = set()
        for _ in range(5):
            result = cli.run_tool("random-string", EMPTY_CONFIG)
            assert_exit_ok(result, "random-string")
            results.add(output(result))
        assert len(results) > 1, "All 5 random-string outputs were identical"


# ===================================================================
# 2. password-generator
# ===================================================================

class TestPasswordGenerator:

    @pytest.mark.category_b
    def test_default_password_meets_requirements(self, cli):
        """Default password is >= 16 chars with upper, lower, digit, special."""
        for _ in range(3):
            result = cli.run_tool("password-generator", EMPTY_CONFIG)
            assert_exit_ok(result, "password-generator")
            pw = output(result)
            assert len(pw) >= 16, (
                f"Expected >= 16 chars, got {len(pw)}: {pw!r}"
            )
            assert re.search(r"[A-Z]", pw), (
                f"Password missing uppercase letter: {pw!r}"
            )
            assert re.search(r"[a-z]", pw), (
                f"Password missing lowercase letter: {pw!r}"
            )
            assert re.search(r"[0-9]", pw), (
                f"Password missing digit: {pw!r}"
            )
            assert re.search(r"[^A-Za-z0-9]", pw), (
                f"Password missing special character: {pw!r}"
            )

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Successive passwords should differ."""
        results = set()
        for _ in range(5):
            result = cli.run_tool("password-generator", EMPTY_CONFIG)
            assert_exit_ok(result, "password-generator")
            results.add(output(result))
        assert len(results) > 1, "All 5 password-generator outputs were identical"


# ===================================================================
# 3. lorem-ipsum
# ===================================================================

class TestLoremIpsum:

    @pytest.mark.category_b
    def test_generates_latin_text(self, cli):
        """Output should contain Latin-like words typical of lorem ipsum."""
        for _ in range(2):
            result = cli.run_tool("lorem-ipsum", EMPTY_CONFIG)
            assert_exit_ok(result, "lorem-ipsum")
            out = output(result)
            # The generator may not always start with "Lorem ipsum" - it
            # generates random Latin-like text.  Just check it contains
            # recognizable lorem vocabulary.
            out_lower = out.lower()
            lorem_words = {"lorem", "ipsum", "sit", "amet", "vel", "et",
                           "nullam", "morbi", "elit", "massa", "nec"}
            found = [w for w in lorem_words if w in out_lower]
            assert len(found) >= 2, (
                f"Expected Latin-like lorem text, got: {out[:120]!r}"
            )

    @pytest.mark.category_b
    def test_contains_words(self, cli):
        """Output should contain multiple words of alphabetic text."""
        result = cli.run_tool("lorem-ipsum", EMPTY_CONFIG)
        assert_exit_ok(result, "lorem-ipsum")
        out = output(result)
        words = out.split()
        assert len(words) >= 10, (
            f"Expected at least 10 words, got {len(words)}"
        )

    @pytest.mark.category_b
    def test_proper_length(self, cli):
        """Output should have a reasonable length (not trivially short)."""
        result = cli.run_tool("lorem-ipsum", EMPTY_CONFIG)
        assert_exit_ok(result, "lorem-ipsum")
        out = output(result)
        assert len(out) >= 50, (
            f"Expected >= 50 chars of lorem ipsum, got {len(out)}"
        )


# ===================================================================
# 4. random-number
# ===================================================================

class TestRandomNumber:

    @pytest.mark.category_b
    def test_default_produces_integer(self, cli):
        """Default invocation produces a valid integer."""
        for _ in range(3):
            result = cli.run_tool("random-number", EMPTY_CONFIG)
            assert_exit_ok(result, "random-number")
            out = output(result)
            try:
                int(out)
            except ValueError:
                pytest.fail(f"Expected an integer, got: {out!r}")

    @pytest.mark.category_b
    def test_range_min_max(self, cli):
        """Specifying min/max constrains the output value."""
        for _ in range(10):
            result = cli.run_tool(
                "random-number",
                json.dumps({"min": 1, "max": 100}),
            )
            assert_exit_ok(result, "random-number")
            out = output(result)
            value = int(out)
            assert 1 <= value <= 100, (
                f"Expected 1 <= value <= 100, got {value}"
            )

    @pytest.mark.category_b
    def test_negative_range(self, cli):
        """Negative min/max range should work correctly."""
        for _ in range(10):
            result = cli.run_tool(
                "random-number",
                json.dumps({"min": -50, "max": -1}),
            )
            assert_exit_ok(result, "random-number")
            value = int(output(result))
            assert -50 <= value <= -1, (
                f"Expected -50 <= value <= -1, got {value}"
            )

    @pytest.mark.category_b
    def test_single_value_range(self, cli):
        """When min == max, output should always be that value."""
        for _ in range(3):
            result = cli.run_tool(
                "random-number",
                json.dumps({"min": 42, "max": 42}),
            )
            assert_exit_ok(result, "random-number")
            assert int(output(result)) == 42

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Over several runs with a wide range, we expect variety."""
        results = set()
        for _ in range(10):
            result = cli.run_tool(
                "random-number",
                json.dumps({"min": 1, "max": 1000000}),
            )
            assert_exit_ok(result, "random-number")
            results.add(output(result))
        assert len(results) > 1, "All 10 random-number outputs were identical"


# ===================================================================
# 5. random-letter
# ===================================================================

class TestRandomLetter:

    @pytest.mark.category_b
    def test_produces_single_alpha_char(self, cli):
        """Output should be a single alphabetic character."""
        for _ in range(5):
            result = cli.run_tool("random-letter", EMPTY_CONFIG)
            assert_exit_ok(result, "random-letter")
            out = output(result)
            assert len(out) == 1, (
                f"Expected 1 char, got {len(out)}: {out!r}"
            )
            assert out.isalpha(), (
                f"Expected alphabetic char, got: {out!r}"
            )

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Over many runs we should see more than one distinct letter."""
        results = set()
        for _ in range(20):
            result = cli.run_tool("random-letter", EMPTY_CONFIG)
            assert_exit_ok(result, "random-letter")
            results.add(output(result))
        assert len(results) > 1, "All 20 random-letter outputs were identical"


# ===================================================================
# 6. random-date
# ===================================================================

class TestRandomDate:

    @pytest.mark.category_b
    def test_valid_date_format(self, cli):
        """Output should match a recognizable date format (YYYY-MM-DD)."""
        date_pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")
        for _ in range(3):
            result = cli.run_tool("random-date", EMPTY_CONFIG)
            assert_exit_ok(result, "random-date")
            out = output(result)
            assert date_pattern.match(out), (
                f"Expected YYYY-MM-DD format, got: {out!r}"
            )

    @pytest.mark.category_b
    def test_date_components_in_range(self, cli):
        """Year, month, day values should be plausible."""
        for _ in range(3):
            result = cli.run_tool("random-date", EMPTY_CONFIG)
            assert_exit_ok(result, "random-date")
            out = output(result)
            parts = out.split("-")
            year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
            assert 1 <= year <= 9999, f"Year out of range: {year}"
            assert 1 <= month <= 12, f"Month out of range: {month}"
            assert 1 <= day <= 31, f"Day out of range: {day}"

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Random dates should vary across invocations."""
        results = set()
        for _ in range(5):
            result = cli.run_tool("random-date", EMPTY_CONFIG)
            assert_exit_ok(result, "random-date")
            results.add(output(result))
        assert len(results) > 1, "All 5 random-date outputs were identical"


# ===================================================================
# 7. random-month
# ===================================================================

class TestRandomMonth:

    @pytest.mark.category_b
    def test_produces_valid_month_name(self, cli):
        """Output should be one of the 12 English month names."""
        for _ in range(5):
            result = cli.run_tool("random-month", EMPTY_CONFIG)
            assert_exit_ok(result, "random-month")
            out = output(result)
            assert out in VALID_MONTHS, (
                f"Expected a valid month name, got: {out!r}"
            )

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Over many runs we should see more than one distinct month."""
        results = set()
        for _ in range(20):
            result = cli.run_tool("random-month", EMPTY_CONFIG)
            assert_exit_ok(result, "random-month")
            results.add(output(result))
        assert len(results) > 1, "All 20 random-month outputs were identical"


# ===================================================================
# 8. random-ip
# ===================================================================

class TestRandomIp:

    @pytest.mark.category_b
    def test_valid_ip_format(self, cli):
        """Output should be a valid IPv4 or IPv6 address."""
        ipv4_pattern = re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$")
        ipv6_pattern = re.compile(r"^[0-9a-f:]+$", re.IGNORECASE)
        for _ in range(3):
            result = cli.run_tool("random-ip", EMPTY_CONFIG)
            assert_exit_ok(result, "random-ip")
            out = output(result)
            ipv4_match = ipv4_pattern.match(out)
            ipv6_match = ipv6_pattern.match(out) and ":" in out
            assert ipv4_match or ipv6_match, (
                f"Expected IPv4 (N.N.N.N) or IPv6 format, got: {out!r}"
            )
            if ipv4_match:
                for i in range(1, 5):
                    octet = int(ipv4_match.group(i))
                    assert 0 <= octet <= 255, (
                        f"Octet {i} out of range (0-255): {octet} in {out!r}"
                    )

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Random IPs should vary across invocations."""
        results = set()
        for _ in range(5):
            result = cli.run_tool("random-ip", EMPTY_CONFIG)
            assert_exit_ok(result, "random-ip")
            results.add(output(result))
        assert len(results) > 1, "All 5 random-ip outputs were identical"


# ===================================================================
# 9. random-choice
# ===================================================================

class TestRandomChoice:

    @pytest.mark.category_b
    def test_picks_from_input_list(self, cli):
        """Output should be one of the newline-separated input choices."""
        choices = ["apple", "banana", "cherry", "date", "elderberry"]
        input_text = "\n".join(choices)
        for _ in range(5):
            result = cli.run_tool("random-choice", input_text)
            assert_exit_ok(result, "random-choice")
            out = output(result)
            assert out in choices, (
                f"Expected one of {choices}, got: {out!r}"
            )

    @pytest.mark.category_b
    def test_single_choice(self, cli):
        """With only one choice, output must be that choice."""
        for _ in range(3):
            result = cli.run_tool("random-choice", "only-option")
            assert_exit_ok(result, "random-choice")
            assert output(result) == "only-option"

    @pytest.mark.category_b
    def test_outputs_vary(self, cli):
        """Over many picks from a list, we should see variety."""
        choices = ["red", "green", "blue", "yellow", "purple"]
        input_text = "\n".join(choices)
        results = set()
        for _ in range(20):
            result = cli.run_tool("random-choice", input_text)
            assert_exit_ok(result, "random-choice")
            results.add(output(result))
        assert len(results) > 1, "All 20 random-choice outputs were identical"


# ===================================================================
# 10. uuid-ulid
# ===================================================================

class TestUuidUlid:

    @pytest.mark.category_b
    def test_format_generates_valid_uuid(self, cli):
        """Format mode should produce output containing a valid UUID v4."""
        for _ in range(3):
            result = cli.run_tool("uuid-ulid", "", format_mode="format")
            assert_exit_ok(result, "uuid-ulid")
            out = output(result)
            # The output should contain a UUID somewhere (8-4-4-4-12 hex)
            uuid_match = re.search(
                r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
                out,
                re.IGNORECASE,
            )
            assert uuid_match, (
                f"No UUID pattern found in format output: {out!r}"
            )

    @pytest.mark.category_b
    def test_format_generates_valid_ulid(self, cli):
        """Format mode should produce output containing a valid ULID."""
        for _ in range(3):
            result = cli.run_tool("uuid-ulid", "", format_mode="format")
            assert_exit_ok(result, "uuid-ulid")
            out = output(result)
            # ULID is 26 chars of Crockford Base32
            ulid_match = re.search(
                r"[0-9A-Z]{26}",
                out.upper(),
            )
            assert ulid_match, (
                f"No 26-char ULID pattern found in format output: {out!r}"
            )
            # Verify all chars are valid Crockford Base32
            ulid_str = ulid_match.group(0)
            invalid_chars = set(ulid_str) - CROCKFORD_BASE32
            assert not invalid_chars, (
                f"ULID contains invalid Crockford Base32 chars: {invalid_chars} "
                f"in {ulid_str!r}"
            )

    @pytest.mark.category_b
    def test_format_outputs_vary(self, cli):
        """Successive UUIDs/ULIDs should differ."""
        results = set()
        for _ in range(5):
            result = cli.run_tool("uuid-ulid", "", format_mode="format")
            assert_exit_ok(result, "uuid-ulid")
            results.add(output(result))
        assert len(results) > 1, "All 5 uuid-ulid format outputs were identical"

    @pytest.mark.category_b
    def test_minify_decodes_known_uuid(self, cli):
        """Minify mode should decode a known UUID and return structured info."""
        known_uuid = "550e8400-e29b-41d4-a716-446655440000"
        result = cli.run_tool("uuid-ulid", known_uuid, format_mode="minify")
        assert_exit_ok(result, "uuid-ulid")
        out = output(result)
        # The output should contain information about the UUID
        # Expect version info (v4 or version 4) or structured data
        assert len(out) > 0, "Minify output was empty"
        # The decoded output should reference version or contain the UUID
        out_lower = out.lower()
        assert ("version" in out_lower or "v4" in out_lower
                or "uuid" in out_lower or "4" in out_lower), (
            f"Expected version/UUID info in decode output: {out!r}"
        )

    @pytest.mark.category_b
    def test_minify_decodes_known_ulid(self, cli):
        """Minify mode should decode a known ULID and return structured info."""
        # A valid ULID (26 chars, Crockford Base32)
        known_ulid = "01ARZ3NDEKTSV4RRFFQ69G5FAV"
        result = cli.run_tool("uuid-ulid", known_ulid, format_mode="minify")
        assert_exit_ok(result, "uuid-ulid")
        out = output(result)
        assert len(out) > 0, "Minify output was empty"
        # Decoded output should contain timestamp or structural info
        out_lower = out.lower()
        assert ("timestamp" in out_lower or "time" in out_lower
                or "ulid" in out_lower or "date" in out_lower
                or "20" in out  # year prefix in timestamp
                ), (
            f"Expected timestamp/ULID info in decode output: {out!r}"
        )

    @pytest.mark.category_b
    def test_roundtrip_generate_then_decode(self, cli):
        """Generate a UUID via format mode, then decode it via minify mode."""
        gen_result = cli.run_tool("uuid-ulid", "", format_mode="format")
        assert_exit_ok(gen_result, "uuid-ulid")
        gen_out = output(gen_result)

        # Extract the UUID from the generated output
        uuid_match = re.search(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            gen_out,
            re.IGNORECASE,
        )
        assert uuid_match, f"No UUID found in format output: {gen_out!r}"

        # Decode the extracted UUID
        decode_result = cli.run_tool(
            "uuid-ulid", uuid_match.group(0), format_mode="minify",
        )
        assert_exit_ok(decode_result, "uuid-ulid")
        decode_out = output(decode_result)
        assert len(decode_out) > 0, "Decode of generated UUID produced empty output"


# ===================================================================
# 11. invisible-text-generator
# ===================================================================

class TestInvisibleTextGenerator:

    # Zero-width characters commonly used for invisible text encoding
    ZERO_WIDTH_CHARS = {"\u200b", "\u200c", "\u200d", "\ufeff"}

    @pytest.mark.category_b
    def test_output_contains_zero_width_chars(self, cli):
        """Output should contain zero-width characters."""
        for _ in range(2):
            result = cli.run_tool("invisible-text-generator", "hello world")
            assert_exit_ok(result, "invisible-text-generator")
            raw_out = result.stdout  # don't strip - zero-width chars matter
            has_zw = any(ch in raw_out for ch in self.ZERO_WIDTH_CHARS)
            assert has_zw, (
                f"Expected zero-width characters in output, "
                f"got bytes: {raw_out.encode('utf-8')!r}"
            )

    @pytest.mark.category_b
    def test_output_length_gte_input_length(self, cli):
        """Output (in bytes or chars) should be >= input length."""
        input_text = "secret message"
        result = cli.run_tool("invisible-text-generator", input_text)
        assert_exit_ok(result, "invisible-text-generator")
        raw_out = result.stdout
        # Compare byte lengths since zero-width chars are multi-byte in UTF-8
        assert len(raw_out.encode("utf-8")) >= len(input_text.encode("utf-8")), (
            f"Output byte length ({len(raw_out.encode('utf-8'))}) "
            f"< input byte length ({len(input_text.encode('utf-8'))})"
        )

    @pytest.mark.category_b
    def test_different_length_inputs_produce_different_outputs(self, cli):
        """Inputs of different lengths should produce different invisible outputs."""
        result_a = cli.run_tool("invisible-text-generator", "hi")
        assert_exit_ok(result_a, "invisible-text-generator")
        result_b = cli.run_tool("invisible-text-generator", "hello world")
        assert_exit_ok(result_b, "invisible-text-generator")
        assert result_a.stdout != result_b.stdout, (
            "Different-length inputs produced identical invisible text output"
        )

    @pytest.mark.category_b
    def test_empty_input(self, cli):
        """Empty input should not crash the tool."""
        result = cli.run_tool("invisible-text-generator", EMPTY_CONFIG)
        assert_exit_ok(result, "invisible-text-generator")
