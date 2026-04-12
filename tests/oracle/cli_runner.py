"""Thin wrapper around the binturong-cli binary for oracle testing."""

import subprocess
from dataclasses import dataclass


@dataclass
class CliResult:
    stdout: str
    stderr: str
    exit_code: int


class CliRunner:
    def __init__(self, binary_path: str):
        self.binary_path = binary_path

    def run_tool(
        self,
        tool_id: str,
        input_text: str,
        *,
        format_mode: str | None = None,
        indent: int | None = None,
        timeout: float = 30.0,
    ) -> CliResult:
        args = [self.binary_path, "run", "--tool", tool_id]
        if format_mode is not None:
            args.extend(["--format", format_mode])
        if indent is not None:
            args.extend(["--indent", str(indent)])

        # Always pipe input via stdin to avoid shell argument escaping issues
        # (e.g., inputs starting with '-' confuse clap's argument parser).
        # The CLI rejects empty stdin, so send a space for empty input -
        # the Rust tool functions trim input, so " " becomes "" internally.
        stdin_text = input_text if input_text else " "
        proc = subprocess.run(
            args,
            input=stdin_text,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return CliResult(
            stdout=proc.stdout,
            stderr=proc.stderr,
            exit_code=proc.returncode,
        )

    def list_tools(self, timeout: float = 10.0) -> list[str]:
        proc = subprocess.run(
            [self.binary_path, "list"],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        assert proc.returncode == 0, f"list failed: {proc.stderr}"
        return [line.split("\t")[0] for line in proc.stdout.strip().split("\n") if line]
