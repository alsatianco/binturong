use assert_cmd::Command;
use binturong_lib::tools::{run_converter_tool, run_formatter_tool};
use std::fs;
use tempfile::NamedTempFile;

fn run_cli_stdout(args: &[&str], stdin: Option<&str>) -> String {
    let mut cmd = Command::cargo_bin("binturong-cli").expect("cli binary");
    cmd.args(args);
    if let Some(value) = stdin {
        cmd.write_stdin(value);
    }

    let output = cmd.assert().success().get_output().stdout.clone();
    String::from_utf8(output).expect("utf8 stdout")
}

#[test]
fn formatter_cli_matches_shared_core_output() {
    let input = "{\"project\":\"binturong\",\"ok\":true}";
    let expected = run_formatter_tool(
        "json-format".to_string(),
        input.to_string(),
        "format".to_string(),
        Some(2),
    )
    .expect("formatter output");

    let actual = run_cli_stdout(
        &["run", "--tool", "json-format", "--format", "format", "--input", input],
        None,
    );

    assert_eq!(actual.trim(), expected.trim());
}

#[test]
fn converter_cli_matches_shared_core_output() {
    let input = "Hello, Binturong CLI 2026!";
    let expected = run_converter_tool("slugify-url".to_string(), input.to_string())
        .expect("converter output");

    let actual = run_cli_stdout(
        &["run", "--tool", "slugify-url", "--input", input],
        None,
    );

    assert_eq!(actual.trim(), expected.trim());
}

#[test]
fn stdin_cli_flow_matches_shared_core_output() {
    let input = "Hello";
    let expected = run_converter_tool("ascii-to-hex".to_string(), input.to_string())
        .expect("converter output");

    let actual = run_cli_stdout(&["run", "--tool", "ascii-to-hex"], Some(input));

    assert_eq!(actual.trim(), expected.trim());
}

#[test]
fn output_file_cli_flow_matches_shared_core_output() {
    let input = "encode me";
    let expected = run_formatter_tool(
        "base64".to_string(),
        input.to_string(),
        "format".to_string(),
        None,
    )
    .expect("formatter output");

    let output_file = NamedTempFile::new().expect("temp file");
    let output_path = output_file.path().to_string_lossy().to_string();

    let mut cmd = Command::cargo_bin("binturong-cli").expect("cli binary");
    cmd.args([
        "run",
        "--tool",
        "base64",
        "--format",
        "format",
        "--input",
        input,
        "--output",
        output_path.as_str(),
    ]);
    cmd.assert().success();

    let actual = fs::read_to_string(output_path).expect("read output file");
    assert_eq!(actual.trim(), expected.trim());
}
