"""Oracle tests for text manipulation and Unicode generator tools.

Each test computes an expected result using a pure-Python oracle, then runs
the same input through the CLI binary and compares the two.
"""

import json
import re
import math

import pytest

from comparators import stripped_match, json_semantic, lines_match


# ---------------------------------------------------------------------------
# Python oracle helpers
# ---------------------------------------------------------------------------

def oracle_tokenize_words(text: str) -> list[str]:
    """Mirror the Rust ``tokenize_words`` function.

    1. Split on camelCase boundaries: ``([a-z0-9])([A-Z])`` -> ``$1 $2``
    2. Split on non-alphanumeric characters
    3. Lowercase all tokens
    """
    camel_spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    tokens = re.split(r"[^A-Za-z0-9]+", camel_spaced)
    return [t.lower() for t in tokens if t]


def oracle_case_convert(text: str, mode: str) -> str:
    words = oracle_tokenize_words(text)
    if mode in ("lower", "lowercase"):
        return text.lower()
    if mode in ("upper", "uppercase"):
        return text.upper()
    if mode in ("title", "capitalized"):
        return _title_preserve(text)
    if mode == "sentence":
        return _sentence_preserve(text)
    if mode == "alternating":
        return _alternating_preserve(text)
    if mode == "inverse":
        return _inverse_preserve(text)
    if mode in ("camel", "camelcase"):
        if not words:
            return ""
        out = words[0]
        for w in words[1:]:
            out += w[:1].upper() + w[1:]
        return out
    if mode in ("pascal", "pascalcase"):
        return "".join(w[:1].upper() + w[1:] for w in words)
    if mode in ("snake", "snake_case"):
        return "_".join(words)
    if mode in ("kebab", "kebab-case"):
        return "-".join(words)
    if mode in ("constant", "constant_case"):
        return "_".join(words).upper()
    if mode in ("dot", "dot.case"):
        return ".".join(words)
    if mode in ("path", "path/case"):
        return "/".join(words)
    return text


def _sentence_preserve(text: str) -> str:
    lower = text.lower()
    capitalize_next = True
    out = []
    for ch in lower:
        if ch.isalpha():
            if capitalize_next:
                out.append(ch.upper())
                capitalize_next = False
            else:
                out.append(ch)
        else:
            out.append(ch)
            if ch in ".!?\n":
                capitalize_next = True
    return "".join(out)


def _title_preserve(text: str) -> str:
    out = []
    word_started = False
    for ch in text:
        if ch.isalpha():
            if word_started:
                out.append(ch.lower())
            else:
                out.append(ch.upper())
                word_started = True
        else:
            out.append(ch)
            word_started = ch.isalnum()
    return "".join(out)


def _alternating_preserve(text: str) -> str:
    lower = text.lower()
    should_upper = False
    out = []
    for ch in lower:
        if ch.isalpha():
            if should_upper:
                out.append(ch.upper())
            else:
                out.append(ch)
            should_upper = not should_upper
        else:
            out.append(ch)
            should_upper = False
    return "".join(out)


def _inverse_preserve(text: str) -> str:
    out = []
    for ch in text:
        if ch.islower():
            out.append(ch.upper())
        elif ch.isupper():
            out.append(ch.lower())
        else:
            out.append(ch)
    return "".join(out)


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


def oracle_italic(text: str) -> str:
    out = []
    for ch in text:
        if ch == "h":
            out.append("\u210E")
        elif ch == "H":
            out.append("\U0001D43B")  # 0x1D434 + 7
        elif "A" <= ch <= "Z":
            out.append(chr(0x1D434 + (ord(ch) - ord("A"))))
        elif "a" <= ch <= "z":
            out.append(chr(0x1D44E + (ord(ch) - ord("a"))))
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


def oracle_wide(text: str) -> str:
    out = []
    for ch in text:
        if ch == " ":
            out.append("\u3000")
        elif "!" <= ch <= "~":
            out.append(chr(ord(ch) + 0xFEE0))
        else:
            out.append(ch)
    return "".join(out)


_SUBSCRIPT_MAP = {
    "a": "\u2090", "A": "\u2090",
    "e": "\u2091", "E": "\u2091",
    "h": "\u2095", "H": "\u2095",
    "i": "\u1D62", "I": "\u1D62",
    "j": "\u2C7C", "J": "\u2C7C",
    "k": "\u2096", "K": "\u2096",
    "l": "\u2097", "L": "\u2097",
    "m": "\u2098", "M": "\u2098",
    "n": "\u2099", "N": "\u2099",
    "o": "\u2092", "O": "\u2092",
    "p": "\u209A", "P": "\u209A",
    "r": "\u1D63", "R": "\u1D63",
    "s": "\u209B", "S": "\u209B",
    "t": "\u209C", "T": "\u209C",
    "u": "\u1D64", "U": "\u1D64",
    "v": "\u1D65", "V": "\u1D65",
    "x": "\u2093", "X": "\u2093",
    "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083",
    "4": "\u2084", "5": "\u2085", "6": "\u2086", "7": "\u2087",
    "8": "\u2088", "9": "\u2089",
    "+": "\u208A", "-": "\u208B", "=": "\u208C",
    "(": "\u208D", ")": "\u208E",
}


_SUPERSCRIPT_MAP = {
    "a": "\u1D43", "A": "\u1D43",
    "b": "\u1D47", "B": "\u1D47",
    "c": "\u1D9C", "C": "\u1D9C",
    "d": "\u1D48", "D": "\u1D48",
    "e": "\u1D49", "E": "\u1D49",
    "f": "\u1DA0", "F": "\u1DA0",
    "g": "\u1D4D", "G": "\u1D4D",
    "h": "\u1D34", "H": "\u1D34",
    "i": "\u2071", "I": "\u2071",
    "j": "\u02B2", "J": "\u02B2",
    "k": "\u1D4F", "K": "\u1D4F",
    "l": "\u02E1", "L": "\u02E1",
    "m": "\u1D50", "M": "\u1D50",
    "n": "\u207F", "N": "\u207F",
    "o": "\u1D3C", "O": "\u1D3C",
    "p": "\u1D56", "P": "\u1D56",
    "q": "\u1D60", "Q": "\u1D60",
    "r": "\u02B3", "R": "\u02B3",
    "s": "\u02E2", "S": "\u02E2",
    "t": "\u1D57", "T": "\u1D57",
    "u": "\u1D58", "U": "\u1D58",
    "v": "\u1D5B", "V": "\u1D5B",
    "w": "\u02B7", "W": "\u02B7",
    "x": "\u02E3", "X": "\u02E3",
    "y": "\u02B8", "Y": "\u02B8",
    "z": "\u1DBB", "Z": "\u1DBB",
    "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3",
    "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077",
    "8": "\u2078", "9": "\u2079",
    "+": "\u207A", "-": "\u207B", "=": "\u207C",
    "(": "\u207D", ")": "\u207E",
}


def oracle_subscript(text: str) -> str:
    return "".join(_SUBSCRIPT_MAP.get(ch, ch) for ch in text)


def oracle_superscript(text: str) -> str:
    return "".join(_SUPERSCRIPT_MAP.get(ch, ch) for ch in text)


def oracle_sentence_counter(text: str, wpm: float = 200.0) -> dict:
    """Mirror the Rust ``run_sentence_counter``."""
    word_re = re.compile(r"[\w']+", re.UNICODE)
    # The Rust regex uses \p{L}\p{N}' -- we approximate with a simpler approach
    # but use the exact same regex as Rust for accuracy.
    word_re = re.compile(r"(?:[\w'])+")
    # Actually the Rust regex is r"[\p{L}\p{N}']+"
    # In Python \w already covers letters+digits+underscore; Rust does not include _.
    # Let's use a faithful re-implementation:
    word_re = re.compile(r"[^\W_](?:[^\W_]|')*", re.UNICODE)
    # That still isn't perfect.  Let's just count exactly like Rust:
    # Rust: r"[\p{L}\p{N}']+" -- matches sequences of (letter | digit | apostrophe).
    word_re = re.compile(r"[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF']+")
    # For our ASCII test inputs this is sufficient.

    sentence_re = re.compile(r"[^.!?]+[.!?]*")
    paragraph_re = re.compile(r"(?:\r?\n){2,}")

    words = len(word_re.findall(text))
    sentences = len([m.group().strip() for m in sentence_re.finditer(text) if m.group().strip()])
    paragraphs = len([p.strip() for p in paragraph_re.split(text) if p.strip()])
    characters = len(text)
    characters_no_spaces = sum(1 for ch in text if not ch.isspace())

    wpm = max(50.0, min(1000.0, wpm))
    if words == 0:
        reading_minutes = 0.0
    else:
        reading_minutes = words / wpm
    reading_seconds = math.ceil(reading_minutes * 60.0)

    return {
        "characters": characters,
        "charactersNoSpaces": characters_no_spaces,
        "words": words,
        "sentences": sentences,
        "paragraphs": paragraphs,
        "readingTime": {
            "minutesAt200Wpm": round(reading_minutes * 100.0) / 100.0,
            "secondsAt200Wpm": reading_seconds,
        },
    }


def oracle_word_frequency(text: str, case_sensitive: bool = False,
                          min_word_length: int = 1) -> dict:
    """Mirror the Rust ``run_word_frequency_counter``."""
    word_re = re.compile(r"[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF']+")
    counts: dict[str, int] = {}
    for m in word_re.finditer(text):
        raw = m.group()
        if len(raw) < min_word_length:
            continue
        key = raw if case_sensitive else raw.lower()
        counts[key] = counts.get(key, 0) + 1

    items = [{"word": w, "count": c} for w, c in counts.items()]
    # Sort by count descending, then word ascending
    items.sort(key=lambda x: (-x["count"], x["word"]))
    total = sum(c for c in counts.values())
    unique = len(counts)
    return {
        "totalWords": total,
        "uniqueWords": unique,
        "items": items[:100],
    }


def oracle_duplicate_words(text: str, case_sensitive: bool = False) -> dict:
    """Mirror the Rust ``run_duplicate_word_finder``."""
    word_re = re.compile(r"[A-Za-z0-9']+")
    counts: dict[str, int] = {}
    for m in word_re.finditer(text):
        word = m.group()
        key = word if case_sensitive else word.lower()
        counts[key] = counts.get(key, 0) + 1

    duplicates = sorted(
        [{"word": w, "count": c} for w, c in counts.items() if c > 1],
        key=lambda x: x["word"],
    )
    return {"duplicates": duplicates}


# ---------------------------------------------------------------------------
# 1. case-converter
# ---------------------------------------------------------------------------

class TestCaseConverter:

    @pytest.mark.parametrize("text,mode,expected_fn", [
        ("hello world", "camel", lambda t: oracle_case_convert(t, "camel")),
        ("hello world", "pascal", lambda t: oracle_case_convert(t, "pascal")),
        ("hello world", "snake", lambda t: oracle_case_convert(t, "snake")),
        ("hello world", "kebab", lambda t: oracle_case_convert(t, "kebab")),
        ("hello world", "constant", lambda t: oracle_case_convert(t, "constant")),
        ("hello world", "dot", lambda t: oracle_case_convert(t, "dot")),
        ("hello world", "path", lambda t: oracle_case_convert(t, "path")),
        ("hello world", "upper", lambda t: oracle_case_convert(t, "upper")),
        ("hello world", "lower", lambda t: oracle_case_convert(t, "lower")),
        ("hello world", "title", lambda t: oracle_case_convert(t, "title")),
    ])
    def test_basic_modes(self, cli, text, mode, expected_fn):
        expected = expected_fn(text)
        inp = json.dumps({"text": text, "mode": mode})
        result = cli.run_tool("case-converter", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    @pytest.mark.parametrize("text", [
        "helloWorld",
        "hello_world",
        "HELLO-WORLD",
        "HelloWorld",
    ])
    def test_tokenization_snake(self, cli, text):
        """Tokenization should normalize various naming conventions."""
        expected = oracle_case_convert(text, "snake")
        inp = json.dumps({"text": text, "mode": "snake"})
        result = cli.run_tool("case-converter", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    @pytest.mark.parametrize("text,mode,expected", [
        ("Hello Binturong", "snake_case", "hello_binturong"),
        ("HeLLo, WoRLD! 123", "lower", "hello, world! 123"),
        ("HeLLo, WoRLD! 123", "upper", "HELLO, WORLD! 123"),
        ("hELLO, wORLD! this IS fine. ok? yes: maybe", "sentence",
         "Hello, world! This is fine. Ok? Yes: maybe"),
        ("hELLO, wORLD! keep-this: punctuation.", "capitalized",
         "Hello, World! Keep-This: Punctuation."),
        ("hello, world!", "alternating", "hElLo, wOrLd!"),
        ("Hello, World! 123", "inverse", "hELLO, wORLD! 123"),
    ])
    def test_known_vectors(self, cli, text, mode, expected):
        """Cases taken from the Rust test suite."""
        inp = json.dumps({"text": text, "mode": mode})
        result = cli.run_tool("case-converter", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_plain_text_defaults_to_lower(self, cli):
        result = cli.run_tool("case-converter", "HI THERE")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hi there")
        assert ok, diff


# ---------------------------------------------------------------------------
# 2. line-sort-dedupe
# ---------------------------------------------------------------------------

class TestLineSortDedupe:

    def test_alpha_sort(self, cli):
        text = "cherry\napple\nbanana"
        inp = json.dumps({"text": text, "mode": "alpha", "reverse": False, "dedupe": False})
        result = cli.run_tool("line-sort-dedupe", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        expected = "\n".join(sorted(text.split("\n"), key=str.lower))
        ok, diff = lines_match(result.stdout, expected)
        assert ok, diff

    def test_alpha_reverse(self, cli):
        text = "cherry\napple\nbanana"
        inp = json.dumps({"text": text, "mode": "alpha", "reverse": True, "dedupe": False})
        result = cli.run_tool("line-sort-dedupe", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        expected = "\n".join(sorted(text.split("\n"), key=str.lower, reverse=True))
        ok, diff = lines_match(result.stdout, expected)
        assert ok, diff

    def test_alpha_dedupe(self, cli):
        text = "b\na\na"
        inp = json.dumps({"text": text, "mode": "alpha", "dedupe": True})
        result = cli.run_tool("line-sort-dedupe", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        # Rust does sort then dedup (adjacent only), which for sorted data removes all dupes
        ok, diff = lines_match(result.stdout, "a\nb")
        assert ok, diff

    def test_length_sort(self, cli):
        text = "bb\naaa\nc"
        inp = json.dumps({"text": text, "mode": "length"})
        result = cli.run_tool("line-sort-dedupe", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        lines = text.split("\n")
        lines.sort(key=lambda l: len(l))
        ok, diff = lines_match(result.stdout, "\n".join(lines))
        assert ok, diff

    def test_numeric_sort(self, cli):
        text = "10\n2\n30\n1"
        inp = json.dumps({"text": text, "mode": "numeric"})
        result = cli.run_tool("line-sort-dedupe", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = lines_match(result.stdout, "1\n2\n10\n30")
        assert ok, diff

    def test_plain_text_defaults(self, cli):
        result = cli.run_tool("line-sort-dedupe", "cherry\napple\nbanana")
        assert result.exit_code == 0
        ok, diff = lines_match(result.stdout, "apple\nbanana\ncherry")
        assert ok, diff


# ---------------------------------------------------------------------------
# 3. sort-words
# ---------------------------------------------------------------------------

class TestSortWords:

    @pytest.mark.parametrize("text,expected", [
        ("banana apple cherry", "apple banana cherry"),
        ("Zebra alpha Beta", "alpha Beta Zebra"),
    ])
    def test_basic(self, cli, text, expected):
        result = cli.run_tool("sort-words", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_oracle(self, cli):
        text = "delta ALPHA charlie bravo"
        words = text.split()
        words.sort(key=str.lower)
        expected = " ".join(words)
        result = cli.run_tool("sort-words", text)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_json_with_reverse(self, cli):
        inp = json.dumps({"text": "cat apple bird", "reverse": True})
        result = cli.run_tool("sort-words", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "cat bird apple")
        assert ok, diff


# ---------------------------------------------------------------------------
# 4. number-sorter
# ---------------------------------------------------------------------------

class TestNumberSorter:

    def test_ascending(self, cli):
        result = cli.run_tool("number-sorter", "5 3 8 1 4")
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = lines_match(result.stdout, "1\n3\n4\n5\n8")
        assert ok, diff

    def test_descending(self, cli):
        inp = json.dumps({"numbers": "4,1,3", "order": "desc"})
        result = cli.run_tool("number-sorter", inp)
        assert result.exit_code == 0
        ok, diff = lines_match(result.stdout, "4\n3\n1")
        assert ok, diff

    def test_float_numbers(self, cli):
        result = cli.run_tool("number-sorter", "3.5 1.2 2.8")
        assert result.exit_code == 0
        ok, diff = lines_match(result.stdout, "1.2\n2.8\n3.5")
        assert ok, diff

    def test_comma_separated(self, cli):
        result = cli.run_tool("number-sorter", "10,2,30")
        assert result.exit_code == 0
        ok, diff = lines_match(result.stdout, "2\n10\n30")
        assert ok, diff


# ---------------------------------------------------------------------------
# 5. text-replace
# ---------------------------------------------------------------------------

class TestTextReplace:

    def test_simple_replace(self, cli):
        inp = json.dumps({"text": "hello world", "find": "world", "replace": "Python"})
        expected = "hello Python"
        result = cli.run_tool("text-replace", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_multiple_occurrences(self, cli):
        inp = json.dumps({"text": "a b a b a", "find": "a", "replace": "x"})
        expected = "x b x b x"
        result = cli.run_tool("text-replace", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_replace_with_empty(self, cli):
        inp = json.dumps({"text": "hello world", "find": " world", "replace": ""})
        result = cli.run_tool("text-replace", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hello")
        assert ok, diff

    def test_case_insensitive(self, cli):
        inp = json.dumps({
            "text": "Hello HELLO hello",
            "find": "hello",
            "replace": "hi",
            "caseSensitive": False,
        })
        result = cli.run_tool("text-replace", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hi hi hi")
        assert ok, diff

    def test_known_vector(self, cli):
        inp = json.dumps({"text": "hello world", "find": "world", "replace": "binturong"})
        result = cli.run_tool("text-replace", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hello binturong")
        assert ok, diff


# ---------------------------------------------------------------------------
# 6. whitespace-remover
# ---------------------------------------------------------------------------

class TestWhitespaceRemover:

    def test_mode_all(self, cli):
        text = "  hello   world  "
        inp = json.dumps({"text": text, "mode": "all"})
        expected = "".join(ch for ch in text if not ch.isspace())
        result = cli.run_tool("whitespace-remover", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_mode_extra(self, cli):
        inp = json.dumps({"text": "  hello   world  ", "mode": "extra"})
        result = cli.run_tool("whitespace-remover", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hello world")
        assert ok, diff

    def test_mode_trim(self, cli):
        inp = json.dumps({"text": "  hello world  ", "mode": "trim"})
        result = cli.run_tool("whitespace-remover", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hello world")
        assert ok, diff


# ---------------------------------------------------------------------------
# 7. line-break-remover
# ---------------------------------------------------------------------------

class TestLineBreakRemover:

    def test_replace_with_space(self, cli):
        inp = json.dumps({"text": "a\nb\nc", "replaceWithSpace": True})
        result = cli.run_tool("line-break-remover", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, "a b c")
        assert ok, diff

    def test_replace_without_space(self, cli):
        inp = json.dumps({"text": "a\nb\nc", "replaceWithSpace": False})
        result = cli.run_tool("line-break-remover", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "abc")
        assert ok, diff

    def test_empty_lines_filtered(self, cli):
        """Empty lines are filtered when replacing with space."""
        inp = json.dumps({"text": "a\n\nb", "replaceWithSpace": True})
        result = cli.run_tool("line-break-remover", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "a b")
        assert ok, diff


# ---------------------------------------------------------------------------
# 8. reverse-text-generator
# ---------------------------------------------------------------------------

class TestReverseTextGenerator:

    @pytest.mark.parametrize("text", [
        "hello",
        "Binturong",
        "abc 123",
        "",
    ])
    def test_oracle(self, cli, text):
        if not text:
            # CLI rejects empty input
            return
        expected = text[::-1]
        result = cli.run_tool("reverse-text-generator", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_known_vector(self, cli):
        result = cli.run_tool("reverse-text-generator", "Binturong")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "gnorutniB")
        assert ok, diff


# ---------------------------------------------------------------------------
# 9. bold-text-generator
# ---------------------------------------------------------------------------

class TestBoldTextGenerator:

    @pytest.mark.parametrize("text", [
        "Hello",
        "abc",
        "XYZ",
        "Test 123!",
    ])
    def test_oracle(self, cli, text):
        expected = oracle_bold(text)
        result = cli.run_tool("bold-text-generator", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_known_vector(self, cli):
        """Ab3 -> mathematical bold A, bold b, bold 3."""
        result = cli.run_tool("bold-text-generator", "Ab3")
        assert result.exit_code == 0
        # Bold A=U+1D400, bold b=U+1D41B, bold 3=U+1D7CE+3=U+1D7D1
        ok, diff = stripped_match(result.stdout, "\U0001D400\U0001D41B\U0001D7D1")
        assert ok, diff

    def test_passthrough(self, cli):
        """Non-alphanumeric characters pass through unchanged."""
        result = cli.run_tool("bold-text-generator", "!@#")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "!@#")
        assert ok, diff


# ---------------------------------------------------------------------------
# 10. italic-text-converter
# ---------------------------------------------------------------------------

class TestItalicTextConverter:

    def test_known_vector(self, cli):
        """Abh -> italic A, italic b, planck h."""
        result = cli.run_tool("italic-text-converter", "Abh")
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        expected = "\U0001D434\U0001D44F\u210E"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_oracle(self, cli):
        text = "Hello"
        expected = oracle_italic(text)
        result = cli.run_tool("italic-text-converter", text)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_h_special_case(self, cli):
        """Lowercase h maps to U+210E (Planck constant)."""
        result = cli.run_tool("italic-text-converter", "h")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "\u210E")
        assert ok, diff

    def test_passthrough(self, cli):
        result = cli.run_tool("italic-text-converter", "123 !")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "123 !")
        assert ok, diff


# ---------------------------------------------------------------------------
# 11. underline-text-generator
# ---------------------------------------------------------------------------

class TestUnderlineTextGenerator:

    @pytest.mark.parametrize("text", [
        "ab",
        "hello world",
        "A B C",
    ])
    def test_oracle(self, cli, text):
        expected = oracle_combining(text, "\u0332")
        result = cli.run_tool("underline-text-generator", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_known_vector(self, cli):
        result = cli.run_tool("underline-text-generator", "ab")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "a\u0332b\u0332")
        assert ok, diff


# ---------------------------------------------------------------------------
# 12. strikethrough-text-generator
# ---------------------------------------------------------------------------

class TestStrikethroughTextGenerator:

    @pytest.mark.parametrize("text", [
        "ab",
        "hello world",
    ])
    def test_oracle(self, cli, text):
        expected = oracle_combining(text, "\u0336")
        result = cli.run_tool("strikethrough-text-generator", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_known_vector(self, cli):
        result = cli.run_tool("strikethrough-text-generator", "ab")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "a\u0336b\u0336")
        assert ok, diff


# ---------------------------------------------------------------------------
# 13. wide-text-generator
# ---------------------------------------------------------------------------

class TestWideTextGenerator:

    @pytest.mark.parametrize("text", [
        "ABC 12",
        "hello!",
        "A B",
    ])
    def test_oracle(self, cli, text):
        expected = oracle_wide(text)
        result = cli.run_tool("wide-text-generator", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_known_vector(self, cli):
        result = cli.run_tool("wide-text-generator", "ABC 12")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "\uFF21\uFF22\uFF23\u3000\uFF11\uFF12")
        assert ok, diff


# ---------------------------------------------------------------------------
# 14. subscript-generator
# ---------------------------------------------------------------------------

class TestSubscriptGenerator:

    @pytest.mark.parametrize("text,expected", [
        ("ten2", "\u209C\u2091\u2099\u2082"),
        ("H2O", "\u2095\u2082\u2092"),
        ("0123", "\u2080\u2081\u2082\u2083"),
        ("(a+b)", "\u208D\u2090\u208Ab\u208E"),  # 'b' has no subscript -> passthrough
    ])
    def test_known_vectors(self, cli, text, expected):
        result = cli.run_tool("subscript-generator", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_oracle(self, cli):
        text = "ax=5"
        expected = oracle_subscript(text)
        result = cli.run_tool("subscript-generator", text)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_unmapped_passthrough(self, cli):
        """Characters without subscript mapping pass through."""
        text = "bcd"
        # b, c, d have no subscript in the Rust map
        result = cli.run_tool("subscript-generator", text)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "bcd")
        assert ok, diff


# ---------------------------------------------------------------------------
# 15. superscript-generator
# ---------------------------------------------------------------------------

class TestSuperscriptGenerator:

    @pytest.mark.parametrize("text,expected", [
        ("H2O", "\u1D34\u00B2\u1D3C"),
        ("abc", "\u1D43\u1D47\u1D9C"),
        ("0+1", "\u2070\u207A\u00B9"),
    ])
    def test_known_vectors(self, cli, text, expected):
        result = cli.run_tool("superscript-generator", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_oracle(self, cli):
        text = "n2"
        expected = oracle_superscript(text)
        result = cli.run_tool("superscript-generator", text)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff


# ---------------------------------------------------------------------------
# 16. sentence-counter
# ---------------------------------------------------------------------------

class TestSentenceCounter:

    def test_basic(self, cli):
        text = "One. Two three!\n\nFour?"
        result = cli.run_tool("sentence-counter", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        actual = json.loads(result.stdout)
        assert actual["sentences"] == 3
        assert actual["words"] == 4
        assert actual["paragraphs"] == 2

    def test_oracle(self, cli):
        text = "Hello world. This is a test!"
        expected = oracle_sentence_counter(text)
        result = cli.run_tool("sentence-counter", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        assert actual["words"] == expected["words"]
        assert actual["sentences"] == expected["sentences"]
        assert actual["characters"] == expected["characters"]
        assert actual["charactersNoSpaces"] == expected["charactersNoSpaces"]

    def test_single_sentence(self, cli):
        text = "Just one sentence."
        result = cli.run_tool("sentence-counter", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        assert actual["sentences"] == 1
        assert actual["words"] == 3
        assert actual["paragraphs"] == 1

    def test_reading_time(self, cli):
        text = "word " * 200  # 200 words
        text = text.strip()
        result = cli.run_tool("sentence-counter", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        assert actual["words"] == 200
        assert actual["readingTime"]["minutesAt200Wpm"] == 1.0
        assert actual["readingTime"]["secondsAt200Wpm"] == 60


# ---------------------------------------------------------------------------
# 17. word-frequency-counter
# ---------------------------------------------------------------------------

class TestWordFrequencyCounter:

    def test_basic(self, cli):
        text = "apple banana apple pear banana apple"
        result = cli.run_tool("word-frequency-counter", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        actual = json.loads(result.stdout)
        assert actual["totalWords"] == 6
        assert actual["uniqueWords"] == 3
        # apple should be first with count 3
        items = actual["items"]
        assert items[0]["word"] == "apple"
        assert items[0]["count"] == 3

    def test_oracle(self, cli):
        text = "the cat sat on the mat the cat"
        expected = oracle_word_frequency(text)
        result = cli.run_tool("word-frequency-counter", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        assert actual["totalWords"] == expected["totalWords"]
        assert actual["uniqueWords"] == expected["uniqueWords"]
        # Compare items (sorted the same way)
        for a_item, e_item in zip(actual["items"], expected["items"]):
            assert a_item["word"] == e_item["word"]
            assert a_item["count"] == e_item["count"]

    def test_case_insensitive(self, cli):
        text = "Hello hello HELLO"
        result = cli.run_tool("word-frequency-counter", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        assert actual["totalWords"] == 3
        assert actual["uniqueWords"] == 1
        assert actual["items"][0]["word"] == "hello"
        assert actual["items"][0]["count"] == 3


# ---------------------------------------------------------------------------
# 18. repeat-text-generator
# ---------------------------------------------------------------------------

class TestRepeatTextGenerator:

    def test_json_input(self, cli):
        inp = json.dumps({"text": "abc", "count": 3})
        result = cli.run_tool("repeat-text-generator", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, "abcabcabc")
        assert ok, diff

    def test_separator(self, cli):
        inp = json.dumps({"text": "go", "count": 3, "separator": "-"})
        result = cli.run_tool("repeat-text-generator", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "go-go-go")
        assert ok, diff

    def test_plain_text_defaults_to_2(self, cli):
        result = cli.run_tool("repeat-text-generator", "hi")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hihi")
        assert ok, diff

    def test_count_zero(self, cli):
        inp = json.dumps({"text": "abc", "count": 0})
        result = cli.run_tool("repeat-text-generator", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "")
        assert ok, diff

    def test_newline_separator(self, cli):
        inp = json.dumps({"text": "line", "count": 3, "separator": "\n"})
        result = cli.run_tool("repeat-text-generator", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "line\nline\nline")
        assert ok, diff


# ---------------------------------------------------------------------------
# 19. duplicate-word-finder
# ---------------------------------------------------------------------------

class TestDuplicateWordFinder:

    def test_basic(self, cli):
        text = "one two one three two"
        result = cli.run_tool("duplicate-word-finder", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        actual = json.loads(result.stdout)
        duplicates = actual["duplicates"]
        words_found = {d["word"]: d["count"] for d in duplicates}
        assert words_found["one"] == 2
        assert words_found["two"] == 2
        assert "three" not in words_found

    def test_oracle(self, cli):
        text = "hello world hello test world world"
        expected = oracle_duplicate_words(text)
        result = cli.run_tool("duplicate-word-finder", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        actual_dups = {d["word"]: d["count"] for d in actual["duplicates"]}
        expected_dups = {d["word"]: d["count"] for d in expected["duplicates"]}
        assert actual_dups == expected_dups

    def test_no_duplicates(self, cli):
        text = "alpha beta gamma"
        result = cli.run_tool("duplicate-word-finder", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        assert actual["duplicates"] == []

    def test_case_insensitive_default(self, cli):
        text = "Hello hello HELLO"
        result = cli.run_tool("duplicate-word-finder", text)
        assert result.exit_code == 0
        actual = json.loads(result.stdout)
        dups = actual["duplicates"]
        assert len(dups) == 1
        assert dups[0]["word"] == "hello"
        assert dups[0]["count"] == 3


# ---------------------------------------------------------------------------
# 20. remove-underscores
# ---------------------------------------------------------------------------

class TestRemoveUnderscores:

    @pytest.mark.parametrize("text,expected", [
        ("hello_world", "hello world"),
        ("hello_world__again", "hello world  again"),
        ("no_underscores_here_", "no underscores here "),
    ])
    def test_oracle(self, cli, text, expected):
        result = cli.run_tool("remove-underscores", text)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_no_underscores(self, cli):
        result = cli.run_tool("remove-underscores", "hello world")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hello world")
        assert ok, diff

    def test_json_with_collapse(self, cli):
        inp = json.dumps({"text": "a__b___c", "collapseSpaces": True, "trim": True})
        result = cli.run_tool("remove-underscores", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "a b c")
        assert ok, diff


# ---------------------------------------------------------------------------
# 21. em-dash-remover
# ---------------------------------------------------------------------------

class TestEmDashRemover:

    def test_hyphen_mode(self, cli):
        text = "alpha\u2014beta\u2013gamma"
        inp = json.dumps({"text": text, "mode": "hyphen"})
        expected = "alpha-beta-gamma"
        result = cli.run_tool("em-dash-remover", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        ok, diff = stripped_match(result.stdout, expected)
        assert ok, diff

    def test_space_mode(self, cli):
        text = "alpha\u2014beta\u2013gamma"
        inp = json.dumps({"text": text, "mode": "space"})
        result = cli.run_tool("em-dash-remover", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "alpha beta gamma")
        assert ok, diff

    def test_remove_mode(self, cli):
        text = "alpha\u2014beta"
        inp = json.dumps({"text": text, "mode": "remove"})
        result = cli.run_tool("em-dash-remover", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "alphabeta")
        assert ok, diff

    def test_html_entities(self, cli):
        text = "x&mdash;y&ndash;z"
        inp = json.dumps({"text": text, "mode": "hyphen"})
        result = cli.run_tool("em-dash-remover", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "x-y-z")
        assert ok, diff

    def test_plain_text_defaults_to_hyphen(self, cli):
        text = "a\u2014b"
        result = cli.run_tool("em-dash-remover", text)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "a-b")
        assert ok, diff


# ---------------------------------------------------------------------------
# 22. plain-text-converter
# ---------------------------------------------------------------------------

class TestPlainTextConverter:

    def test_html_stripping(self, cli):
        inp = json.dumps({"text": "<b>bold</b> and <i>italic</i>"})
        result = cli.run_tool("plain-text-converter", inp)
        assert result.exit_code == 0, f"stderr: {result.stderr}"
        # HTML tags replaced with space, then whitespace collapsed
        assert "bold" in result.stdout.strip()
        assert "italic" in result.stdout.strip()
        assert "<b>" not in result.stdout

    def test_known_vector(self, cli):
        inp = json.dumps({"text": "# Title\n**Bold** <b>tag</b> &amp; more"})
        result = cli.run_tool("plain-text-converter", inp)
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "Title Bold tag & more")
        assert ok, diff

    def test_plain_text_passthrough(self, cli):
        result = cli.run_tool("plain-text-converter", "hello world")
        assert result.exit_code == 0
        ok, diff = stripped_match(result.stdout, "hello world")
        assert ok, diff

    def test_preserve_line_breaks(self, cli):
        inp = json.dumps({
            "text": "Line one\nLine two",
            "preserveLineBreaks": True,
        })
        result = cli.run_tool("plain-text-converter", inp)
        assert result.exit_code == 0
        assert "Line one" in result.stdout
        assert "Line two" in result.stdout
