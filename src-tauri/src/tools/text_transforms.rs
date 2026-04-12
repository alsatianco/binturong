use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

use super::converters::decode_xml_entities;
use super::encoders::html_entity_encode;

pub(crate) fn tokenize_words(input: &str) -> Vec<String> {
    static CAMEL_SPLIT_RE: OnceLock<Regex> = OnceLock::new();
    let camel_spaced = CAMEL_SPLIT_RE
        .get_or_init(|| Regex::new(r"([a-z0-9])([A-Z])").expect("valid camel split regex"))
        .replace_all(input, "$1 $2")
        .to_string();
    camel_spaced
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(|token| token.to_lowercase())
        .collect::<Vec<_>>()
}

pub(crate) fn to_sentence_case_preserving_punctuation(text: &str) -> String {
    let lower = text.to_lowercase();
    let mut capitalize_next_letter = true;
    let mut output = String::with_capacity(lower.len());

    for ch in lower.chars() {
        if ch.is_alphabetic() {
            if capitalize_next_letter {
                for upper in ch.to_uppercase() {
                    output.push(upper);
                }
                capitalize_next_letter = false;
            } else {
                output.push(ch);
            }
            continue;
        }

        output.push(ch);
        if matches!(ch, '.' | '!' | '?' | '\n') {
            capitalize_next_letter = true;
        }
    }

    output
}

pub(crate) fn to_title_like_case_preserving_punctuation(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut word_started = false;

    for ch in text.chars() {
        if ch.is_alphabetic() {
            if word_started {
                for lower in ch.to_lowercase() {
                    output.push(lower);
                }
            } else {
                for upper in ch.to_uppercase() {
                    output.push(upper);
                }
                word_started = true;
            }
            continue;
        }

        output.push(ch);
        word_started = ch.is_alphanumeric();
    }

    output
}

pub(crate) fn to_alternating_case_preserving_punctuation(text: &str) -> String {
    let lower = text.to_lowercase();
    let mut should_uppercase = false;
    let mut output = String::with_capacity(lower.len());

    for ch in lower.chars() {
        if ch.is_alphabetic() {
            if should_uppercase {
                for upper in ch.to_uppercase() {
                    output.push(upper);
                }
            } else {
                output.push(ch);
            }
            should_uppercase = !should_uppercase;
            continue;
        }

        output.push(ch);
        should_uppercase = false;
    }

    output
}

pub(crate) fn to_inverse_case_preserving_punctuation(text: &str) -> String {
    let mut output = String::with_capacity(text.len());

    for ch in text.chars() {
        if ch.is_lowercase() {
            for upper in ch.to_uppercase() {
                output.push(upper);
            }
        } else if ch.is_uppercase() {
            for lower in ch.to_lowercase() {
                output.push(lower);
            }
        } else {
            output.push(ch);
        }
    }

    output
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CaseConverterInput {
    text: Option<String>,
    mode: Option<String>,
}

pub(crate) fn apply_case_mode(text: &str, mode: &str) -> String {
    let words = tokenize_words(text);
    match mode {
        "sentence" => to_sentence_case_preserving_punctuation(text),
        "title" | "capitalized" => to_title_like_case_preserving_punctuation(text),
        "upper" | "uppercase" => text.to_uppercase(),
        "lower" | "lowercase" => text.to_lowercase(),
        "alternating" => to_alternating_case_preserving_punctuation(text),
        "inverse" => to_inverse_case_preserving_punctuation(text),
        "camel" | "camelcase" => {
            if words.is_empty() {
                return String::new();
            }
            let mut output = String::new();
            output.push_str(&words[0]);
            for word in words.iter().skip(1) {
                let mut chars = word.chars();
                if let Some(first) = chars.next() {
                    output.push_str(&format!(
                        "{}{}",
                        first.to_uppercase(),
                        chars.collect::<String>()
                    ));
                }
            }
            output
        }
        "pascal" | "pascalcase" => words
            .iter()
            .map(|word| {
                let mut chars = word.chars();
                if let Some(first) = chars.next() {
                    format!("{}{}", first.to_uppercase(), chars.collect::<String>())
                } else {
                    String::new()
                }
            })
            .collect::<String>(),
        "snake" | "snake_case" => words.join("_"),
        "kebab" | "kebab-case" => words.join("-"),
        "constant" | "constant_case" => words.join("_").to_uppercase(),
        "dot" | "dot.case" => words.join("."),
        "path" | "path/case" => words.join("/"),
        _ => text.to_string(),
    }
}

pub(crate) fn run_case_converter(input: &str) -> Result<String, String> {
    let (text, mode) = if input.trim_start().starts_with('{') {
        let payload: CaseConverterInput =
            serde_json::from_str(input).map_err(|error| format!("invalid case converter input JSON: {error}"))?;
        (
            payload.text.unwrap_or_default(),
            payload.mode.unwrap_or_else(|| "lower".to_string()),
        )
    } else {
        (input.to_string(), "lower".to_string())
    };
    Ok(apply_case_mode(&text, &mode.to_lowercase()))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LineSortInput {
    text: String,
    mode: Option<String>,
    reverse: Option<bool>,
    dedupe: Option<bool>,
}

pub(crate) fn run_line_sort_dedupe(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<LineSortInput>(input)
            .map_err(|error| format!("invalid line sort input JSON: {error}"))?
    } else {
        LineSortInput {
            text: input.to_string(),
            mode: Some("alpha".to_string()),
            reverse: Some(false),
            dedupe: Some(false),
        }
    };

    let mut lines = payload
        .text
        .lines()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let raw_mode = payload.mode.unwrap_or_else(|| "alpha".to_string()).to_lowercase();

    // Support combined mode strings from button UI, e.g. "alpha-dedupe", "numeric-dedupe",
    // "length-dedupe", "reverse-alpha", "shuffle". The "-dedupe" suffix enables dedup,
    // overriding the separate `dedupe` field.
    let has_dedupe_suffix = raw_mode.ends_with("-dedupe");
    let dedupe = has_dedupe_suffix || payload.dedupe.unwrap_or(false);
    let sort_mode = if has_dedupe_suffix {
        raw_mode.trim_end_matches("-dedupe")
    } else {
        raw_mode.as_str()
    };
    let reverse = payload.reverse.unwrap_or(false);

    match sort_mode {
        "numeric" => lines.sort_by(|left, right| {
            let left_number = left.trim().parse::<f64>().unwrap_or(f64::NAN);
            let right_number = right.trim().parse::<f64>().unwrap_or(f64::NAN);
            left_number
                .partial_cmp(&right_number)
                .unwrap_or(std::cmp::Ordering::Equal)
        }),
        "length" => lines.sort_by_key(|line| line.chars().count()),
        _ => lines.sort_by_key(|line| line.to_lowercase()),
    }

    if reverse {
        lines.reverse();
    }
    if dedupe {
        lines.dedup();
    }

    Ok(lines.join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SortWordsInput {
    text: String,
    reverse: Option<bool>,
    unique: Option<bool>,
}

pub(crate) fn run_sort_words(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<SortWordsInput>(input)
            .map_err(|error| format!("invalid sort words input JSON: {error}"))?
    } else {
        SortWordsInput {
            text: input.to_string(),
            reverse: Some(false),
            unique: Some(false),
        }
    };

    let mut words = payload
        .text
        .split_whitespace()
        .map(str::to_string)
        .collect::<Vec<_>>();
    words.sort_by_key(|word| word.to_lowercase());
    if payload.reverse.unwrap_or(false) {
        words.reverse();
    }
    if payload.unique.unwrap_or(false) {
        words.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
    }
    Ok(words.join(" "))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NumberSorterInput {
    /// The numbers field (legacy JSON input format).
    numbers: Option<String>,
    /// The text field (generic converter mode format from button UI).
    text: Option<String>,
    /// Legacy field name for sort direction.
    order: Option<String>,
    /// Generic converter mode field name for sort direction.
    mode: Option<String>,
}

pub(crate) fn run_number_sorter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<NumberSorterInput>(input)
            .map_err(|error| format!("invalid number sorter input JSON: {error}"))?
    } else {
        NumberSorterInput {
            numbers: None,
            text: Some(input.to_string()),
            order: Some("asc".to_string()),
            mode: None,
        }
    };

    // Accept either `text` (generic converter mode) or `numbers` (legacy), fallback to empty.
    let numbers_str = payload
        .text
        .or(payload.numbers)
        .unwrap_or_default();
    // Accept either `mode` (generic converter mode) or `order` (legacy), default to "asc".
    let direction = payload
        .mode
        .or(payload.order)
        .unwrap_or_else(|| "asc".to_string());

    let mut numbers = numbers_str
        .split(|ch: char| ch == ',' || ch == ';' || ch.is_whitespace())
        .filter(|token| !token.is_empty())
        .map(|token| {
            token
                .trim()
                .parse::<f64>()
                .map_err(|error| format!("invalid number '{token}': {error}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    numbers.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));

    if direction.eq_ignore_ascii_case("desc") {
        numbers.reverse();
    }

    Ok(numbers
        .iter()
        .map(|value| {
            if value.fract() == 0.0 {
                format!("{}", *value as i64)
            } else {
                value.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DuplicateWordInput {
    text: String,
    case_sensitive: Option<bool>,
}

pub(crate) fn run_duplicate_word_finder(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<DuplicateWordInput>(input)
            .map_err(|error| format!("invalid duplicate finder input JSON: {error}"))?
    } else {
        DuplicateWordInput {
            text: input.to_string(),
            case_sensitive: Some(false),
        }
    };

    let case_sensitive = payload.case_sensitive.unwrap_or(false);
    static DUPLICATE_WORD_RE: OnceLock<Regex> = OnceLock::new();
    let word_regex = DUPLICATE_WORD_RE.get_or_init(|| Regex::new(r"[A-Za-z0-9']+").expect("valid duplicate word regex"));
    let mut counts = std::collections::BTreeMap::<String, usize>::new();
    for word_match in word_regex.find_iter(&payload.text) {
        let word = word_match.as_str();
        let key = if case_sensitive {
            word.to_string()
        } else {
            word.to_lowercase()
        };
        *counts.entry(key).or_insert(0) += 1;
    }

    let duplicates = counts
        .into_iter()
        .filter(|(_, count)| *count > 1)
        .map(|(word, count)| serde_json::json!({ "word": word, "count": count }))
        .collect::<Vec<_>>();
    let output = serde_json::json!({
        "duplicates": duplicates,
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize duplicate finder output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextReplaceInput {
    text: String,
    find: String,
    replace: Option<String>,
    regex: Option<bool>,
    case_sensitive: Option<bool>,
}

pub(crate) fn run_text_replace(input: &str) -> Result<String, String> {
    let payload = serde_json::from_str::<TextReplaceInput>(input)
        .map_err(|error| format!("invalid text replace input JSON: {error}"))?;
    let replacement = payload.replace.unwrap_or_default();
    if payload.find.is_empty() {
        return Err("find pattern cannot be empty".to_string());
    }

    let regex_mode = payload.regex.unwrap_or(false);
    let case_sensitive = payload.case_sensitive.unwrap_or(true);
    if regex_mode {
        let pattern = if case_sensitive {
            payload.find
        } else {
            format!("(?i){}", payload.find)
        };
        let regex = Regex::new(&pattern).map_err(|error| format!("invalid regex pattern: {error}"))?;
        return Ok(regex
            .replace_all(&payload.text, replacement.as_str())
            .to_string());
    }

    if case_sensitive {
        return Ok(payload.text.replace(&payload.find, &replacement));
    }

    let regex = Regex::new(&format!("(?i){}", regex::escape(&payload.find)))
        .map_err(|error| format!("invalid search pattern: {error}"))?;
    Ok(regex
        .replace_all(&payload.text, replacement.as_str())
        .to_string())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterRemoverInput {
    text: String,
    characters: Option<String>,
    mode: Option<String>,
}

pub(crate) fn run_character_remover(input: &str) -> Result<String, String> {
    let payload = serde_json::from_str::<CharacterRemoverInput>(input)
        .map_err(|error| format!("invalid character remover input JSON: {error}"))?;
    if let Some(characters) = payload.characters.filter(|value| !value.is_empty()) {
        let filtered = payload
            .text
            .chars()
            .filter(|ch| !characters.contains(*ch))
            .collect::<String>();
        return Ok(filtered);
    }

    let mode = payload.mode.unwrap_or_else(|| "digits".to_string()).to_lowercase();
    let filtered = payload
        .text
        .chars()
        .filter(|ch| match mode.as_str() {
            "digits" => !ch.is_ascii_digit(),
            "letters" => !ch.is_alphabetic(),
            "punctuation" => !ch.is_ascii_punctuation(),
            "non-ascii" => ch.is_ascii(),
            _ => true,
        })
        .collect::<String>();
    Ok(filtered)
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WhitespaceRemoverInput {
    text: String,
    mode: Option<String>,
}

pub(crate) fn run_whitespace_remover(input: &str) -> Result<String, String> {
    let payload = serde_json::from_str::<WhitespaceRemoverInput>(input)
        .map_err(|error| format!("invalid whitespace remover input JSON: {error}"))?;
    let mode = payload.mode.unwrap_or_else(|| "trim".to_string()).to_lowercase();
    match mode.as_str() {
        "all" => Ok(payload
            .text
            .chars()
            .filter(|ch| !ch.is_whitespace())
            .collect::<String>()),
        "extra" => {
            static WHITESPACE_COLLAPSE_RE: OnceLock<Regex> = OnceLock::new();
            let collapsed = WHITESPACE_COLLAPSE_RE
                .get_or_init(|| Regex::new(r"\s+").expect("valid whitespace collapse regex"))
                .replace_all(&payload.text, " ")
                .to_string();
            Ok(collapsed.trim().to_string())
        }
        _ => Ok(payload.text.trim().to_string()),
    }
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LineBreakRemoverInput {
    text: String,
    /// Legacy field kept for backward compatibility (CLI / oracle tests).
    replace_with_space: Option<bool>,
    /// Mode field used by the frontend button mechanism.
    /// Accepted values: "replace-with-space" (default), "remove".
    mode: Option<String>,
}

pub(crate) fn run_line_break_remover(input: &str) -> Result<String, String> {
    let payload = serde_json::from_str::<LineBreakRemoverInput>(input)
        .map_err(|error| format!("invalid line break remover input JSON: {error}"))?;

    // Determine whether to replace line breaks with spaces.
    // Priority: `mode` field > `replaceWithSpace` field > default (true).
    let replace = if let Some(ref mode) = payload.mode {
        mode != "remove"
    } else {
        payload.replace_with_space.unwrap_or(true)
    };

    if replace {
        Ok(payload
            .text
            .replace("\r\n", "\n")
            .split('\n')
            .filter(|segment| !segment.is_empty())
            .collect::<Vec<_>>()
            .join(" "))
    } else {
        Ok(payload.text.replace('\n', "").replace('\r', ""))
    }
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextFormattingRemoverInput {
    text: String,
}

pub(crate) fn run_text_formatting_remover(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<TextFormattingRemoverInput>(input)
            .map_err(|error| format!("invalid text formatting remover input JSON: {error}"))?
    } else {
        TextFormattingRemoverInput {
            text: input.to_string(),
        }
    };
    static ANSI_RE: OnceLock<Regex> = OnceLock::new();
    static HTML_TAG_RE: OnceLock<Regex> = OnceLock::new();
    static MARKDOWN_RE: OnceLock<Regex> = OnceLock::new();
    static WHITESPACE_RE: OnceLock<Regex> = OnceLock::new();
    let ansi = ANSI_RE.get_or_init(|| Regex::new(r"\x1B\[[0-9;]*[A-Za-z]").expect("valid ansi regex"));
    let html = HTML_TAG_RE.get_or_init(|| Regex::new(r"(?is)<[^>]+>").expect("valid html strip regex"));
    let markdown = MARKDOWN_RE.get_or_init(|| Regex::new(r"(?m)^#{1,6}\s*|\*\*|__|~~|`|[*_>-]").expect("valid markdown strip regex"));
    let whitespace = WHITESPACE_RE.get_or_init(|| Regex::new(r"\s+").expect("valid whitespace regex"));

    let mut text = ansi.replace_all(&payload.text, "").to_string();
    text = html.replace_all(&text, " ").to_string();
    text = markdown.replace_all(&text, "").to_string();
    text = whitespace.replace_all(&text, " ").to_string();
    Ok(text.trim().to_string())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoveUnderscoresInput {
    text: String,
    collapse_spaces: Option<bool>,
    trim: Option<bool>,
}

pub(crate) fn run_remove_underscores(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<RemoveUnderscoresInput>(input)
            .map_err(|error| format!("invalid remove underscores input JSON: {error}"))?
    } else {
        RemoveUnderscoresInput {
            text: input.to_string(),
            collapse_spaces: Some(false),
            trim: Some(false),
        }
    };

    let mut output = payload.text.replace('_', " ");
    if payload.collapse_spaces.unwrap_or(false) {
        static SPACE_COLLAPSE_RE: OnceLock<Regex> = OnceLock::new();
        let collapse = SPACE_COLLAPSE_RE.get_or_init(|| Regex::new(r"[ \t\x0B\x0C]+").expect("valid space collapse regex"));
        output = collapse.replace_all(&output, " ").to_string();
    }
    if payload.trim.unwrap_or(false) {
        output = output.trim().to_string();
    }
    Ok(output)
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EmDashRemoverInput {
    text: String,
    mode: Option<String>,
    replacement: Option<String>,
}

pub(crate) fn run_em_dash_remover(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<EmDashRemoverInput>(input)
            .map_err(|error| format!("invalid em dash remover input JSON: {error}"))?
    } else {
        EmDashRemoverInput {
            text: input.to_string(),
            mode: Some("hyphen".to_string()),
            replacement: None,
        }
    };

    let replacement = if let Some(custom) = payload.replacement {
        custom
    } else {
        match payload
            .mode
            .unwrap_or_else(|| "hyphen".to_string())
            .to_lowercase()
            .as_str()
        {
            "remove" => String::new(),
            "space" => " ".to_string(),
            "hyphen" => "-".to_string(),
            _ => "-".to_string(),
        }
    };

    Ok(payload
        .text
        .replace("&mdash;", replacement.as_str())
        .replace("&ndash;", replacement.as_str())
        .replace('—', replacement.as_str())
        .replace('–', replacement.as_str())
        .replace('-', replacement.as_str()))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlainTextConverterInput {
    text: String,
    preserve_line_breaks: Option<bool>,
}

pub(crate) fn strip_text_formatting(value: &str) -> String {
    static STRIP_ANSI_RE: OnceLock<Regex> = OnceLock::new();
    static STRIP_HTML_RE: OnceLock<Regex> = OnceLock::new();
    static STRIP_MARKDOWN_RE: OnceLock<Regex> = OnceLock::new();
    let ansi = STRIP_ANSI_RE.get_or_init(|| Regex::new(r"\x1B\[[0-9;]*[A-Za-z]").expect("valid ansi regex"));
    let html = STRIP_HTML_RE.get_or_init(|| Regex::new(r"(?is)<[^>]+>").expect("valid html strip regex"));
    let markdown = STRIP_MARKDOWN_RE.get_or_init(|| Regex::new(r"(?m)^#{1,6}\s*|\*\*|__|~~|`|[*_>-]").expect("valid markdown strip regex"));

    let mut text = ansi.replace_all(value, "").to_string();
    text = decode_xml_entities(&text).replace("&nbsp;", " ");
    text = html.replace_all(&text, " ").to_string();
    markdown.replace_all(&text, "").to_string()
}

pub(crate) fn run_plain_text_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<PlainTextConverterInput>(input)
            .map_err(|error| format!("invalid plain text converter input JSON: {error}"))?
    } else {
        PlainTextConverterInput {
            text: input.to_string(),
            preserve_line_breaks: Some(false),
        }
    };

    let text = strip_text_formatting(&payload.text);
    if payload.preserve_line_breaks.unwrap_or(false) {
        static PER_LINE_WS_RE: OnceLock<Regex> = OnceLock::new();
        let collapse = PER_LINE_WS_RE.get_or_init(|| Regex::new(r"[ \t\x0B\x0C]+").expect("valid per-line whitespace regex"));
        let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
        let lines = normalized
            .lines()
            .map(|line| collapse.replace_all(line, " ").trim().to_string())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>();
        return Ok(lines.join("\n"));
    }

    static PLAIN_WS_RE: OnceLock<Regex> = OnceLock::new();
    let whitespace = PLAIN_WS_RE.get_or_init(|| Regex::new(r"\s+").expect("valid whitespace regex"));
    Ok(whitespace.replace_all(&text, " ").trim().to_string())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepeatTextGeneratorInput {
    #[serde(alias = "_items")]
    text: Option<String>,
    count: Option<usize>,
    separator: Option<String>,
}

/// Map user-friendly separator names to actual separator strings.
pub(crate) fn resolve_separator(name: &str) -> &str {
    match name {
        "newline" => "\n",
        "space" => " ",
        "comma" => ",",
        "dash" => "-",
        _ => name,
    }
}

pub(crate) fn run_repeat_text_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<RepeatTextGeneratorInput>(input)
            .map_err(|error| format!("invalid repeat text input JSON: {error}"))?
    } else {
        RepeatTextGeneratorInput {
            text: Some(input.to_string()),
            count: Some(2),
            separator: Some(String::new()),
        }
    };

    let text = payload.text.unwrap_or_default();
    if text.is_empty() {
        return Err("text to repeat cannot be empty".to_string());
    }

    let count = payload.count.unwrap_or(2);
    if count > 10_000 {
        return Err("repeat count cannot exceed 10000".to_string());
    }
    if count == 0 {
        return Ok(String::new());
    }

    let sep = payload.separator.as_deref().unwrap_or_default();
    let resolved_sep = resolve_separator(sep);

    Ok(std::iter::repeat(text.as_str())
        .take(count)
        .collect::<Vec<_>>()
        .join(resolved_sep))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReverseTextGeneratorInput {
    text: String,
}

pub(crate) fn run_reverse_text_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<ReverseTextGeneratorInput>(input)
            .map_err(|error| format!("invalid reverse text input JSON: {error}"))?
    } else {
        ReverseTextGeneratorInput {
            text: input.to_string(),
        }
    };

    Ok(payload.text.chars().rev().collect::<String>())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnicodeTextInput {
    pub(crate) text: String,
}

pub(crate) fn map_upside_down_char(ch: char) -> char {
    match ch {
        'a' | 'A' => 'ɐ',
        'b' | 'B' => 'q',
        'c' | 'C' => 'ɔ',
        'd' | 'D' => 'p',
        'e' | 'E' => 'ǝ',
        'f' | 'F' => 'ɟ',
        'g' | 'G' => 'ƃ',
        'h' | 'H' => 'ɥ',
        'i' | 'I' => 'ᴉ',
        'j' | 'J' => 'ɾ',
        'k' | 'K' => 'ʞ',
        'l' | 'L' => 'l',
        'm' | 'M' => 'ɯ',
        'n' | 'N' => 'u',
        'o' | 'O' => 'o',
        'p' | 'P' => 'd',
        'q' | 'Q' => 'b',
        'r' | 'R' => 'ɹ',
        's' | 'S' => 's',
        't' | 'T' => 'ʇ',
        'u' | 'U' => 'n',
        'v' | 'V' => 'ʌ',
        'w' | 'W' => 'ʍ',
        'x' | 'X' => 'x',
        'y' | 'Y' => 'ʎ',
        'z' | 'Z' => 'z',
        '1' => '⇂',
        '2' => 'ᄅ',
        '3' => 'Ɛ',
        '4' => 'ㄣ',
        '5' => 'ϛ',
        '6' => '9',
        '7' => 'ㄥ',
        '8' => '8',
        '9' => '6',
        '0' => '0',
        '.' => '˙',
        ',' => '\'',
        '\'' => ',',
        '"' => '„',
        '!' => '¡',
        '?' => '¿',
        '(' => ')',
        ')' => '(',
        '[' => ']',
        ']' => '[',
        '{' => '}',
        '}' => '{',
        '<' => '>',
        '>' => '<',
        '_' => '‾',
        ';' => '؛',
        _ => ch,
    }
}

pub(crate) fn run_upside_down_text_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<UnicodeTextInput>(input)
            .map_err(|error| format!("invalid upside down input JSON: {error}"))?
    } else {
        UnicodeTextInput {
            text: input.to_string(),
        }
    };

    Ok(payload
        .text
        .chars()
        .rev()
        .map(map_upside_down_char)
        .collect::<String>())
}

pub(crate) fn map_mirror_char(ch: char) -> char {
    match ch {
        'a' | 'A' => 'ɒ',
        'b' | 'B' => 'd',
        'c' | 'C' => 'ↄ',
        'd' | 'D' => 'b',
        'e' | 'E' => 'ɘ',
        'j' | 'J' => 'ɟ',
        'p' | 'P' => 'q',
        'q' | 'Q' => 'p',
        's' | 'S' => 'ƨ',
        'z' | 'Z' => 'Ƹ',
        '(' => ')',
        ')' => '(',
        '[' => ']',
        ']' => '[',
        '{' => '}',
        '}' => '{',
        '<' => '>',
        '>' => '<',
        '/' => '\\',
        '\\' => '/',
        _ => ch,
    }
}

pub(crate) fn run_mirror_text_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<UnicodeTextInput>(input)
            .map_err(|error| format!("invalid mirror text input JSON: {error}"))?
    } else {
        UnicodeTextInput {
            text: input.to_string(),
        }
    };

    Ok(payload
        .text
        .chars()
        .rev()
        .map(map_mirror_char)
        .collect::<String>())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InvisibleTextGeneratorInput {
    text: Option<String>,
    length: Option<usize>,
    character: Option<String>,
}

pub(crate) fn run_invisible_text_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<InvisibleTextGeneratorInput>(input)
            .map_err(|error| format!("invalid invisible text input JSON: {error}"))?
    } else {
        InvisibleTextGeneratorInput {
            text: if input.is_empty() {
                None
            } else {
                Some(input.to_string())
            },
            length: if input.is_empty() { Some(10) } else { None },
            character: Some("zwsp".to_string()),
        }
    };

    let invisible_char = match payload
        .character
        .unwrap_or_else(|| "zwsp".to_string())
        .to_lowercase()
        .as_str()
    {
        "zwsp" | "zero-width-space" => '\u{200B}',
        "zwnj" | "zero-width-non-joiner" => '\u{200C}',
        "zwj" | "zero-width-joiner" => '\u{200D}',
        "wj" | "word-joiner" => '\u{2060}',
        "bom" => '\u{FEFF}',
        _ => '\u{200B}',
    };

    let count = payload
        .text
        .as_deref()
        .map(|text| text.chars().count())
        .unwrap_or_else(|| payload.length.unwrap_or(10));
    if count > 100_000 {
        return Err("invisible text length cannot exceed 100000".to_string());
    }

    Ok(std::iter::repeat(invisible_char)
        .take(count)
        .collect::<String>())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SentenceCounterInput {
    text: String,
    words_per_minute: Option<f64>,
}

pub(crate) fn run_sentence_counter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<SentenceCounterInput>(input)
            .map_err(|error| format!("invalid sentence counter input JSON: {error}"))?
    } else {
        SentenceCounterInput {
            text: input.to_string(),
            words_per_minute: Some(200.0),
        }
    };

    static COUNTER_WORD_RE: OnceLock<Regex> = OnceLock::new();
    static SENTENCE_RE: OnceLock<Regex> = OnceLock::new();
    static PARAGRAPH_RE: OnceLock<Regex> = OnceLock::new();
    let word_regex = COUNTER_WORD_RE.get_or_init(|| Regex::new(r"[\p{L}\p{N}']+").expect("valid sentence counter word regex"));
    let sentence_regex = SENTENCE_RE.get_or_init(|| Regex::new(r"[^.!?]+[.!?]*").expect("valid sentence counter sentence regex"));
    let paragraph_regex = PARAGRAPH_RE.get_or_init(|| Regex::new(r"(?:\r?\n){2,}").expect("valid paragraph split regex"));

    let words = word_regex.find_iter(&payload.text).count();
    let sentences = sentence_regex
        .find_iter(&payload.text)
        .map(|part| part.as_str().trim())
        .filter(|part| !part.is_empty())
        .count();
    let paragraphs = paragraph_regex
        .split(&payload.text)
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .count();
    let characters = payload.text.chars().count();
    let characters_no_spaces = payload
        .text
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .count();
    let words_per_minute = payload.words_per_minute.unwrap_or(200.0).clamp(50.0, 1000.0);
    let reading_minutes = if words == 0 {
        0.0
    } else {
        words as f64 / words_per_minute
    };
    let reading_seconds = (reading_minutes * 60.0).ceil() as u64;

    let output = serde_json::json!({
        "characters": characters,
        "charactersNoSpaces": characters_no_spaces,
        "words": words,
        "sentences": sentences,
        "paragraphs": paragraphs,
        "readingTime": {
            "minutesAt200Wpm": (reading_minutes * 100.0).round() / 100.0,
            "secondsAt200Wpm": reading_seconds
        }
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize sentence counter output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WordFrequencyCounterInput {
    text: String,
    case_sensitive: Option<bool>,
    min_word_length: Option<usize>,
    sort: Option<String>,
    limit: Option<usize>,
}


#[derive(Debug, Clone)]
pub(crate) struct WordFrequencyItem {
    word: String,
    count: usize,
}

pub(crate) fn collect_word_frequencies(text: &str, case_sensitive: bool, min_word_length: usize) -> Vec<WordFrequencyItem> {
    static WORD_FREQ_RE: OnceLock<Regex> = OnceLock::new();
    let word_regex = WORD_FREQ_RE.get_or_init(|| Regex::new(r"[\p{L}\p{N}']+").expect("valid word frequency regex"));
    let mut counts = HashMap::<String, usize>::new();
    for found in word_regex.find_iter(text) {
        let raw = found.as_str();
        if raw.chars().count() < min_word_length {
            continue;
        }
        let key = if case_sensitive {
            raw.to_string()
        } else {
            raw.to_lowercase()
        };
        *counts.entry(key).or_insert(0) += 1;
    }

    let mut items = counts
        .into_iter()
        .map(|(word, count)| WordFrequencyItem { word, count })
        .collect::<Vec<_>>();
    items.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.word.cmp(&b.word)));
    items
}

pub(crate) fn run_word_frequency_counter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<WordFrequencyCounterInput>(input)
            .map_err(|error| format!("invalid word frequency input JSON: {error}"))?
    } else {
        WordFrequencyCounterInput {
            text: input.to_string(),
            case_sensitive: Some(false),
            min_word_length: Some(1),
            sort: Some("count-desc".to_string()),
            limit: Some(100),
        }
    };

    let mut items = collect_word_frequencies(
        &payload.text,
        payload.case_sensitive.unwrap_or(false),
        payload.min_word_length.unwrap_or(1).clamp(1, 64),
    );
    match payload
        .sort
        .unwrap_or_else(|| "count-desc".to_string())
        .to_lowercase()
        .as_str()
    {
        "alpha" => items.sort_by(|a, b| a.word.cmp(&b.word).then_with(|| b.count.cmp(&a.count))),
        "count-asc" => items.sort_by(|a, b| a.count.cmp(&b.count).then_with(|| a.word.cmp(&b.word))),
        _ => items.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.word.cmp(&b.word))),
    }

    let total_words = items.iter().map(|item| item.count).sum::<usize>();
    let unique_words = items.len();
    let limit = payload.limit.unwrap_or(100).clamp(1, 1000);
    items.truncate(limit);

    let output = serde_json::json!({
        "totalWords": total_words,
        "uniqueWords": unique_words,
        "items": items
            .iter()
            .map(|item| serde_json::json!({
                "word": item.word,
                "count": item.count
            }))
            .collect::<Vec<_>>()
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize word frequency output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WordCloudGeneratorInput {
    text: String,
    max_words: Option<usize>,
    min_word_length: Option<usize>,
    case_sensitive: Option<bool>,
    palette: Option<Vec<String>>,
    font_family: Option<String>,
}

pub(crate) fn sanitize_css_token(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '#' | ',' | '.' | '%' | '(' | ')' | '-' | ' ' | '\'' | '"' | '/'))
        .collect::<String>()
}

pub(crate) fn run_word_cloud_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<WordCloudGeneratorInput>(input)
            .map_err(|error| format!("invalid word cloud input JSON: {error}"))?
    } else {
        WordCloudGeneratorInput {
            text: input.to_string(),
            max_words: Some(40),
            min_word_length: Some(2),
            case_sensitive: Some(false),
            palette: None,
            font_family: None,
        }
    };

    let max_words = payload.max_words.unwrap_or(40).clamp(1, 200);
    let mut items = collect_word_frequencies(
        &payload.text,
        payload.case_sensitive.unwrap_or(false),
        payload.min_word_length.unwrap_or(2).clamp(1, 64),
    );
    if items.is_empty() {
        return Err("word cloud requires at least one word".to_string());
    }
    items.truncate(max_words);

    let palette = payload
        .palette
        .unwrap_or_else(|| {
            vec![
                "#0f172a".to_string(),
                "#2563eb".to_string(),
                "#059669".to_string(),
                "#b45309".to_string(),
                "#dc2626".to_string(),
            ]
        })
        .into_iter()
        .map(|color| sanitize_css_token(&color))
        .filter(|color| !color.is_empty())
        .collect::<Vec<_>>();
    let palette = if palette.is_empty() {
        vec!["#0f172a".to_string()]
    } else {
        palette
    };

    let font_family = sanitize_css_token(
        payload
            .font_family
            .as_deref()
            .unwrap_or("'Trebuchet MS', 'Segoe UI', sans-serif"),
    );
    let font_family = if font_family.is_empty() {
        "'Trebuchet MS', 'Segoe UI', sans-serif".to_string()
    } else {
        font_family
    };

    let max_count = items.first().map(|item| item.count).unwrap_or(1) as f32;
    let min_count = items.last().map(|item| item.count).unwrap_or(1) as f32;
    let rotations = [0, -10, 8, 0, -6, 6];
    let spans = items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let weight = if (max_count - min_count).abs() < f32::EPSILON {
                0.5
            } else {
                (item.count as f32 - min_count) / (max_count - min_count)
            };
            let font_size = 18.0 + (weight * 34.0);
            let color = &palette[index % palette.len()];
            let rotation = rotations[index % rotations.len()];
            let label = html_entity_encode(&item.word);
            format!(
                "<span style=\"display:inline-block;font-size:{:.1}px;line-height:1;color:{};font-family:{};font-weight:700;transform:rotate({}deg);margin:4px 8px;\">{}</span>",
                font_size, color, font_family, rotation, label
            )
        })
        .collect::<Vec<_>>()
        .join("");

    Ok(format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"></head><body style=\"margin:0;padding:12px;background:#f8fafc;\"><div style=\"display:flex;flex-wrap:wrap;align-items:center;justify-content:center;min-height:220px;background:radial-gradient(circle at top,#e2e8f0,#f8fafc 55%);border-radius:12px;padding:16px;\">{}</div></body></html>",
        spans
    ))
}



#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApaFormatInput {
    mode: Option<String>,
    authors: Option<Vec<String>>,
    authors_text: Option<String>,
    year: Option<String>,
    title: Option<String>,
    source: Option<String>,
    journal: Option<String>,
    publisher: Option<String>,
    volume: Option<String>,
    issue: Option<String>,
    pages: Option<String>,
    doi: Option<String>,
    url: Option<String>,
}

pub(crate) fn format_apa_author(author: &str) -> String {
    let trimmed = author.trim();
    if trimmed.contains(',') {
        return trimmed.to_string();
    }
    let parts = trimmed.split_whitespace().collect::<Vec<_>>();
    if parts.is_empty() {
        return "Unknown".to_string();
    }
    if parts.len() == 1 {
        return parts[0].to_string();
    }
    let last_name = parts[parts.len() - 1];
    let initials = parts[..parts.len() - 1]
        .iter()
        .filter_map(|part| part.chars().next())
        .map(|ch| format!("{}.", ch.to_ascii_uppercase()))
        .collect::<Vec<_>>()
        .join(" ");
    format!("{last_name}, {initials}")
}

pub(crate) fn apa_last_name(author: &str) -> String {
    let trimmed = author.trim();
    if trimmed.contains(',') {
        return trimmed
            .split(',')
            .next()
            .map(str::trim)
            .unwrap_or(trimmed)
            .to_string();
    }
    trimmed
        .split_whitespace()
        .last()
        .unwrap_or(trimmed)
        .to_string()
}

pub(crate) fn join_apa_authors(authors: &[String]) -> String {
    let formatted = authors
        .iter()
        .map(|author| format_apa_author(author))
        .collect::<Vec<_>>();
    match formatted.len() {
        0 => "Unknown Author".to_string(),
        1 => formatted[0].clone(),
        2 => format!("{} & {}", formatted[0], formatted[1]),
        _ => {
            let mut head = formatted[..formatted.len() - 1].join(", ");
            head.push_str(", & ");
            head.push_str(&formatted[formatted.len() - 1]);
            head
        }
    }
}

pub(crate) fn format_apa_reference(payload: &ApaFormatInput, authors: &[String], year: &str) -> String {
    let authors_part = join_apa_authors(authors);
    let title = payload
        .title
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Untitled");
    let source = payload
        .source
        .as_ref()
        .or(payload.journal.as_ref())
        .or(payload.publisher.as_ref())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Unknown Source".to_string());

    let mut reference = format!("{authors_part} ({year}). {title}. {source}");
    if let Some(volume) = payload.volume.as_deref().filter(|value| !value.trim().is_empty()) {
        reference.push_str(&format!(", {volume}"));
    }
    if let Some(issue) = payload.issue.as_deref().filter(|value| !value.trim().is_empty()) {
        reference.push_str(&format!("({issue})"));
    }
    if let Some(pages) = payload.pages.as_deref().filter(|value| !value.trim().is_empty()) {
        reference.push_str(&format!(", {pages}"));
    }
    reference.push('.');

    if let Some(doi) = payload.doi.as_deref().filter(|value| !value.trim().is_empty()) {
        let doi_value = doi.trim();
        if doi_value.starts_with("http://") || doi_value.starts_with("https://") {
            reference.push(' ');
            reference.push_str(doi_value);
        } else {
            reference.push_str(&format!(" https://doi.org/{doi_value}"));
        }
    } else if let Some(url) = payload.url.as_deref().filter(|value| !value.trim().is_empty()) {
        reference.push(' ');
        reference.push_str(url.trim());
    }
    reference
}

pub(crate) fn format_apa_in_text(authors: &[String], year: &str) -> String {
    let last_names = authors
        .iter()
        .map(|author| apa_last_name(author))
        .collect::<Vec<_>>();
    let citation_authors = match last_names.len() {
        0 => "Unknown".to_string(),
        1 => last_names[0].clone(),
        2 => format!("{} & {}", last_names[0], last_names[1]),
        _ => format!("{} et al.", last_names[0]),
    };
    format!("({citation_authors}, {year})")
}

pub(crate) fn run_apa_format_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<ApaFormatInput>(input)
            .map_err(|error| format!("invalid APA format input JSON: {error}"))?
    } else {
        let parts = input
            .split(';')
            .map(|part| part.trim().to_string())
            .collect::<Vec<_>>();
        if parts.len() < 4 {
            return Err(
                "APA formatter plain input must be 'authors;year;title;source'".to_string(),
            );
        }
        ApaFormatInput {
            mode: Some("reference".to_string()),
            authors: Some(
                parts[0]
                    .split('&')
                    .map(|author| author.trim().to_string())
                    .filter(|author| !author.is_empty())
                    .collect::<Vec<_>>(),
            ),
            authors_text: None,
            year: Some(parts[1].clone()),
            title: Some(parts[2].clone()),
            source: Some(parts[3].clone()),
            journal: None,
            publisher: None,
            volume: None,
            issue: None,
            pages: None,
            doi: None,
            url: None,
        }
    };

    let mut authors = payload.authors.clone().unwrap_or_default();
    if authors.is_empty() {
        authors = payload
            .authors_text
            .as_deref()
            .unwrap_or("")
            .split(';')
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
    }
    if authors.is_empty() {
        authors.push("Unknown Author".to_string());
    }

    let year = payload
        .year
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("n.d.");
    let reference = format_apa_reference(&payload, &authors, year);
    let in_text = format_apa_in_text(&authors, year);

    match payload
        .mode
        .as_deref()
        .unwrap_or("reference")
        .to_ascii_lowercase()
        .as_str()
    {
        "in-text" | "intext" => Ok(in_text),
        "both" => Ok(format!("Reference:\n{reference}\n\nIn-text:\n{in_text}")),
        _ => Ok(reference),
    }
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownTableInput {
    headers: Option<Vec<String>>,
    rows: Option<Vec<Vec<String>>>,
    align: Option<Vec<String>>,
    text: Option<String>,
    delimiter: Option<String>,
}

pub(crate) fn sanitize_table_cell(value: &str) -> String {
    value.replace('|', "\\|").replace('\n', " ").trim().to_string()
}

pub(crate) fn parse_table_text_rows(text: &str, delimiter: &str) -> Vec<Vec<String>> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| {
            line.split(delimiter)
                .map(|cell| sanitize_table_cell(cell))
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>()
}

pub(crate) fn run_markdown_table_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<MarkdownTableInput>(input)
            .map_err(|error| format!("invalid markdown table input JSON: {error}"))?
    } else {
        MarkdownTableInput {
            headers: None,
            rows: None,
            align: None,
            text: Some(input.to_string()),
            delimiter: Some(",".to_string()),
        }
    };

    let delimiter = payload.delimiter.as_deref().unwrap_or(",");
    let mut headers = payload.headers.unwrap_or_default();
    let mut rows = payload.rows.unwrap_or_default();

    if let Some(text_rows_source) = payload.text.as_deref().filter(|value| !value.trim().is_empty()) {
        let parsed_rows = parse_table_text_rows(text_rows_source, delimiter);
        if !parsed_rows.is_empty() {
            if headers.is_empty() {
                headers = parsed_rows[0].clone();
                rows.extend(parsed_rows.into_iter().skip(1));
            } else {
                rows.extend(parsed_rows);
            }
        }
    }

    let mut column_count = headers.len();
    for row in &rows {
        column_count = column_count.max(row.len());
    }
    if column_count == 0 {
        return Err("markdown table generator requires headers or rows".to_string());
    }

    if headers.len() < column_count {
        for index in headers.len()..column_count {
            headers.push(format!("Column {}", index + 1));
        }
    }
    headers = headers
        .into_iter()
        .map(|value| sanitize_table_cell(&value))
        .collect::<Vec<_>>();
    rows = rows
        .into_iter()
        .map(|row| {
            let mut normalized = row
                .into_iter()
                .map(|value| sanitize_table_cell(&value))
                .collect::<Vec<_>>();
            if normalized.len() < column_count {
                normalized.resize(column_count, String::new());
            }
            normalized
        })
        .collect::<Vec<_>>();

    let alignments = payload.align.unwrap_or_default();
    let separator_cells = (0..column_count)
        .map(|index| {
            let align = alignments
                .get(index)
                .map(|value| value.to_ascii_lowercase())
                .unwrap_or_else(|| "left".to_string());
            match align.as_str() {
                "center" => ":---:".to_string(),
                "right" => "---:".to_string(),
                _ => ":---".to_string(),
            }
        })
        .collect::<Vec<_>>();

    let mut lines = Vec::<String>::new();
    lines.push(format!("| {} |", headers.join(" | ")));
    lines.push(format!("| {} |", separator_cells.join(" | ")));
    for row in rows {
        lines.push(format!("| {} |", row.join(" | ")));
    }
    Ok(lines.join("\n"))
}

