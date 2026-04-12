use binturong_lib::tools::{run_converter_tool, run_formatter_tool};
use binturong_lib::tool_registry::ToolRegistry;
use clap::{Parser, Subcommand};
use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

#[derive(Debug, Parser)]
#[command(
    name = "binturong-cli",
    version,
    about = "Run Binturong tools from stdin/stdout"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// List all available tool IDs and names.
    List,
    /// Run a tool using text input from --input, --file, or stdin.
    Run {
        /// Tool ID (for example: json-format, base64, slugify-url).
        #[arg(long = "tool", short = 't')]
        tool_id: String,

        /// Output format/direction for formatter tools (format|minify etc.).
        #[arg(long = "format", alias = "mode", default_value = "format")]
        format: String,

        /// Formatter indent size (formatter tools only).
        #[arg(long)]
        indent: Option<usize>,

        /// Input text. If omitted, --file or stdin is used.
        #[arg(long)]
        input: Option<String>,

        /// Read input from file.
        #[arg(long = "file", alias = "input-file")]
        file: Option<PathBuf>,

        /// Write output to file instead of stdout.
        #[arg(long = "output", alias = "output-file")]
        output: Option<PathBuf>,
    },
}

fn read_input(input: Option<String>, input_file: Option<PathBuf>) -> Result<String, String> {
    if let Some(value) = input {
        return Ok(value);
    }

    if let Some(path) = input_file {
        return fs::read_to_string(&path)
            .map_err(|error| format!("failed to read input file {}: {error}", path.display()));
    }

    let mut stdin = String::new();
    io::stdin()
        .read_to_string(&mut stdin)
        .map_err(|error| format!("failed to read stdin: {error}"))?;

    if stdin.is_empty() {
        return Err("no input provided (use --input, --input-file, or stdin)".to_string());
    }

    Ok(stdin)
}

fn write_output(output: &str, output_file: Option<PathBuf>) -> Result<(), String> {
    if let Some(path) = output_file {
        fs::write(&path, output)
            .map_err(|error| format!("failed to write output file {}: {error}", path.display()))?;
        return Ok(());
    }

    let mut stdout = io::stdout();
    stdout
        .write_all(output.as_bytes())
        .map_err(|error| format!("failed to write stdout: {error}"))?;
    Ok(())
}

fn run_tool(tool_id: String, input: String, format: String, indent: Option<usize>) -> Result<String, String> {
    match run_formatter_tool(tool_id.clone(), input.clone(), format, indent) {
        Ok(output) => Ok(output),
        Err(formatter_error)
            if formatter_error.starts_with("unsupported formatter tool id") =>
        {
            run_converter_tool(tool_id, input)
        }
        Err(formatter_error) => {
            // The formatter may reject empty input before checking the tool id.
            // When that happens for a converter tool, the "input cannot be empty"
            // error masks the "unsupported formatter tool id" fallthrough.
            // Try the converter as a second chance - it has its own allow-list for
            // empty input (random-string, password-generator, etc.).
            match run_converter_tool(tool_id, input) {
                Ok(output) => Ok(output),
                Err(converter_error)
                    if converter_error.starts_with("unsupported converter tool id") =>
                {
                    // Neither formatter nor converter recognized the tool id.
                    // Return the original formatter error for known formatter tools,
                    // or a clear "unknown tool" message.
                    Err(formatter_error)
                }
                converter_result => converter_result,
            }
        }
    }
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::List => ToolRegistry::with_builtin_tools()
            .map_err(|error| format!("failed to initialize tool registry: {error}"))
            .and_then(|registry| {
                let mut lines = Vec::new();
                for tool in registry.list() {
                    lines.push(format!("{}\t{}", tool.id, tool.name));
                }
                Ok(lines.join("\n"))
            })
            .and_then(|output| {
                write_output(&format!("{output}\n"), None)?;
                Ok(String::new())
            }),
        Commands::Run {
            tool_id,
            format,
            indent,
            input,
            file,
            output: output_file,
        } => read_input(input, file)
            .and_then(|value| run_tool(tool_id, value, format, indent))
            .and_then(|tool_output| {
                write_output(&tool_output, output_file)?;
                Ok(String::new())
            }),
    };

    match result {
        Ok(_) => ExitCode::SUCCESS,
        Err(error) => {
            let _ = writeln!(io::stderr(), "error: {error}");
            ExitCode::FAILURE
        }
    }
}
