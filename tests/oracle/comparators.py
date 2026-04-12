"""Smart comparison strategies for oracle testing.

Each comparator returns (passed: bool, message: str).
On success message is empty; on failure it contains a human-readable diff.
"""

import csv
import io
import json
import difflib

import yaml


def stripped_match(actual: str, expected: str) -> tuple[bool, str]:
    a = actual.strip()
    e = expected.strip()
    if a == e:
        return True, ""
    diff = "\n".join(
        difflib.unified_diff(
            e.splitlines(), a.splitlines(),
            fromfile="expected", tofile="actual", lineterm="",
        )
    )
    return False, diff


def json_semantic(actual: str, expected: str) -> tuple[bool, str]:
    try:
        a = json.loads(actual)
    except json.JSONDecodeError as exc:
        return False, f"actual is not valid JSON: {exc}\n---\n{actual[:500]}"
    try:
        e = json.loads(expected)
    except json.JSONDecodeError as exc:
        return False, f"expected is not valid JSON: {exc}\n---\n{expected[:500]}"
    if a == e:
        return True, ""
    return False, (
        f"JSON objects differ:\n"
        f"  expected: {json.dumps(e, indent=2, ensure_ascii=False)[:800]}\n"
        f"  actual:   {json.dumps(a, indent=2, ensure_ascii=False)[:800]}"
    )


def yaml_semantic(actual: str, expected: str) -> tuple[bool, str]:
    try:
        a = yaml.safe_load(actual)
    except yaml.YAMLError as exc:
        return False, f"actual is not valid YAML: {exc}"
    try:
        e = yaml.safe_load(expected)
    except yaml.YAMLError as exc:
        return False, f"expected is not valid YAML: {exc}"
    if a == e:
        return True, ""
    return False, f"YAML objects differ:\n  expected: {e!r}\n  actual:   {a!r}"


def csv_semantic(actual: str, expected: str) -> tuple[bool, str]:
    def parse(text):
        reader = csv.reader(io.StringIO(text.strip()))
        return list(reader)

    a_rows = parse(actual)
    e_rows = parse(expected)
    if a_rows == e_rows:
        return True, ""
    # Show first difference
    for i, (ar, er) in enumerate(zip(a_rows, e_rows)):
        if ar != er:
            return False, f"CSV row {i} differs:\n  expected: {er}\n  actual:   {ar}"
    if len(a_rows) != len(e_rows):
        return False, f"CSV row count differs: expected {len(e_rows)}, got {len(a_rows)}"
    return False, "CSV content differs (unknown reason)"


def lines_match(actual: str, expected: str) -> tuple[bool, str]:
    a_lines = [l.rstrip() for l in actual.strip().splitlines()]
    e_lines = [l.rstrip() for l in expected.strip().splitlines()]
    if a_lines == e_lines:
        return True, ""
    diff = "\n".join(
        difflib.unified_diff(
            e_lines, a_lines,
            fromfile="expected", tofile="actual", lineterm="",
        )
    )
    return False, diff
