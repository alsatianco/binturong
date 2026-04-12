"""Shared pytest fixtures for oracle tests."""

import os
import pytest
from cli_runner import CliRunner

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


@pytest.fixture(scope="session")
def cli():
    binary = os.environ.get(
        "BINTURONG_CLI",
        os.path.join(ROOT, "src-tauri", "target", "debug", "binturong-cli"),
    )
    if not os.path.isfile(binary):
        # Try release build
        release = os.path.join(ROOT, "src-tauri", "target", "release", "binturong-cli")
        if os.path.isfile(release):
            binary = release
        else:
            pytest.fail(
                f"CLI binary not found at {binary}. "
                "Build it first: cd src-tauri && cargo build --bin binturong-cli"
            )
    return CliRunner(binary)
