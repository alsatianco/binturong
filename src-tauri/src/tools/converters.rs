use base64::Engine;
use regex::Regex;
use std::collections::BTreeSet;
use std::io::{Cursor, Read};
use std::sync::OnceLock;

pub(crate) fn convert_json_to_yaml(input: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("invalid JSON: {error}"))?;
    serde_yaml::to_string(&value)
        .map(|output| output.trim().to_string())
        .map_err(|error| format!("failed to convert JSON to YAML: {error}"))
}

pub(crate) fn convert_yaml_to_json(input: &str) -> Result<String, String> {
    let value: serde_yaml::Value =
        serde_yaml::from_str(input).map_err(|error| format!("invalid YAML: {error}"))?;
    serde_json::to_string_pretty(&value)
        .map_err(|error| format!("failed to convert YAML to JSON: {error}"))
}

pub(crate) fn convert_json_to_csv(input: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("invalid JSON: {error}"))?;
    let records = value
        .as_array()
        .ok_or_else(|| "JSON to CSV expects a top-level array".to_string())?;

    if records.is_empty() {
        return Ok(String::new());
    }

    let mut headers = BTreeSet::new();
    for record in records {
        let object = record
            .as_object()
            .ok_or_else(|| "JSON to CSV expects an array of objects".to_string())?;
        for key in object.keys() {
            headers.insert(key.to_string());
        }
    }
    let ordered_headers: Vec<String> = headers.into_iter().collect();

    let mut writer = csv::WriterBuilder::new()
        .has_headers(true)
        .from_writer(Vec::new());
    writer
        .write_record(&ordered_headers)
        .map_err(|error| format!("failed to write CSV header: {error}"))?;

    for record in records {
        let object = record
            .as_object()
            .ok_or_else(|| "JSON to CSV expects an array of objects".to_string())?;
        let row = ordered_headers
            .iter()
            .map(|header| {
                object
                    .get(header)
                    .map_or_else(|| "".to_string(), json_value_to_csv_cell)
            })
            .collect::<Vec<_>>();
        writer
            .write_record(row)
            .map_err(|error| format!("failed to write CSV row: {error}"))?;
    }

    let bytes = writer
        .into_inner()
        .map_err(|error| format!("failed to finalize CSV: {error}"))?;
    String::from_utf8(bytes).map_err(|error| format!("failed to build UTF-8 CSV: {error}"))
}

pub(crate) fn json_value_to_csv_cell(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => String::new(),
        serde_json::Value::Bool(boolean) => boolean.to_string(),
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::String(string) => string.clone(),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            serde_json::to_string(value).unwrap_or_default()
        }
    }
}

pub(crate) fn convert_csv_to_json(input: &str) -> Result<String, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(input.as_bytes());

    let headers = reader
        .headers()
        .map_err(|error| format!("invalid CSV headers: {error}"))?
        .iter()
        .map(|header| header.to_string())
        .collect::<Vec<_>>();

    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|error| format!("invalid CSV record: {error}"))?;
        let mut object = serde_json::Map::new();
        for (index, value) in record.iter().enumerate() {
            let key = headers
                .get(index)
                .cloned()
                .unwrap_or_else(|| format!("column_{index}"));
            object.insert(key, serde_json::Value::String(value.to_string()));
        }
        rows.push(serde_json::Value::Object(object));
    }

    serde_json::to_string_pretty(&rows)
        .map_err(|error| format!("failed to convert CSV to JSON: {error}"))
}


pub(crate) fn convert_json_to_php_array(input: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("invalid JSON: {error}"))?;
    Ok(json_to_php_array_syntax(&value, 0))
}

pub(crate) fn json_to_php_array_syntax(value: &serde_json::Value, level: usize) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(boolean) => {
            if *boolean {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::String(string) => format!("'{}'", escape_php_string(string)),
        serde_json::Value::Array(array) => {
            if array.is_empty() {
                return "[]".to_string();
            }

            let indentation = "  ".repeat(level + 1);
            let closing_indentation = "  ".repeat(level);
            let mut lines = Vec::new();
            for item in array {
                lines.push(format!(
                    "{}{},",
                    indentation,
                    json_to_php_array_syntax(item, level + 1)
                ));
            }
            format!("[\n{}\n{}]", lines.join("\n"), closing_indentation)
        }
        serde_json::Value::Object(object) => {
            if object.is_empty() {
                return "[]".to_string();
            }

            let indentation = "  ".repeat(level + 1);
            let closing_indentation = "  ".repeat(level);
            let mut lines = Vec::new();
            for (key, item) in object {
                lines.push(format!(
                    "{}'{}' => {},",
                    indentation,
                    escape_php_string(key),
                    json_to_php_array_syntax(item, level + 1)
                ));
            }
            format!("[\n{}\n{}]", lines.join("\n"), closing_indentation)
        }
    }
}

pub(crate) fn escape_php_string(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

pub(crate) fn convert_php_array_to_json(input: &str) -> Result<String, String> {
    let mut parser = PhpArrayParser::new(input);
    let value = parser.parse_value()?;
    parser.skip_whitespace();
    if !parser.is_eof() {
        return Err("unexpected trailing PHP input".to_string());
    }
    serde_json::to_string_pretty(&value)
        .map_err(|error| format!("failed to convert PHP array to JSON: {error}"))
}

pub(crate) fn serialize_php_from_json(input: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("invalid JSON: {error}"))?;
    Ok(serialize_php_value(&value))
}

pub(crate) fn serialize_php_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "N;".to_string(),
        serde_json::Value::Bool(boolean) => format!("b:{};", if *boolean { 1 } else { 0 }),
        serde_json::Value::Number(number) => {
            if let Some(integer) = number.as_i64() {
                format!("i:{};", integer)
            } else {
                format!("d:{};", number)
            }
        }
        serde_json::Value::String(string) => {
            format!("s:{}:\"{}\";", string.as_bytes().len(), string)
        }
        serde_json::Value::Array(array) => {
            let mut serialized_entries = String::new();
            for (index, item) in array.iter().enumerate() {
                serialized_entries.push_str(&format!("i:{};", index));
                serialized_entries.push_str(&serialize_php_value(item));
            }
            format!("a:{}:{{{}}}", array.len(), serialized_entries)
        }
        serde_json::Value::Object(object) => {
            let mut serialized_entries = String::new();
            for (key, item) in object {
                serialized_entries.push_str(&format!("s:{}:\"{}\";", key.as_bytes().len(), key));
                serialized_entries.push_str(&serialize_php_value(item));
            }
            format!("a:{}:{{{}}}", object.len(), serialized_entries)
        }
    }
}

pub(crate) fn unserialize_php_to_json(input: &str) -> Result<String, String> {
    let mut parser = PhpSerializedParser::new(input);
    let value = parser.parse_value()?;
    parser.skip_whitespace();
    if !parser.is_eof() {
        return Err("unexpected trailing serialized input".to_string());
    }
    serde_json::to_string_pretty(&value)
        .map_err(|error| format!("failed to convert unserialized value to JSON: {error}"))
}


#[derive(Debug)]
pub(crate) struct PhpArrayParser<'a> {
    input: &'a str,
    index: usize,
}

impl<'a> PhpArrayParser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, index: 0 }
    }

    fn is_eof(&self) -> bool {
        self.index >= self.input.len()
    }

    fn remaining(&self) -> &'a str {
        &self.input[self.index..]
    }

    fn skip_whitespace(&mut self) {
        while let Some(ch) = self.peek_char() {
            if ch.is_whitespace() {
                self.index += ch.len_utf8();
            } else {
                break;
            }
        }
    }

    fn peek_char(&self) -> Option<char> {
        self.remaining().chars().next()
    }

    fn consume_char(&mut self) -> Option<char> {
        let ch = self.peek_char()?;
        self.index += ch.len_utf8();
        Some(ch)
    }

    fn parse_value(&mut self) -> Result<serde_json::Value, String> {
        self.skip_whitespace();
        let remaining = self.remaining();

        if remaining.starts_with("array(") {
            self.index += "array(".len();
            return self.parse_array_with_closer(')');
        }

        match self.peek_char() {
            Some('[') => {
                self.consume_char();
                self.parse_array_with_closer(']')
            }
            Some('\'') | Some('"') => self.parse_string().map(serde_json::Value::String),
            Some(ch) if ch.is_ascii_digit() || ch == '-' => self.parse_number(),
            Some(_) => self.parse_identifier_or_literal(),
            None => Err("unexpected end of input while parsing PHP value".to_string()),
        }
    }

    fn parse_array_with_closer(&mut self, closer: char) -> Result<serde_json::Value, String> {
        self.skip_whitespace();
        if self.peek_char() == Some(closer) {
            self.consume_char();
            return Ok(serde_json::Value::Array(Vec::new()));
        }

        let mut entries = Vec::<(Option<serde_json::Value>, serde_json::Value)>::new();
        loop {
            self.skip_whitespace();
            let first = self.parse_value()?;
            self.skip_whitespace();

            if self.remaining().starts_with("=>") {
                self.index += 2;
                let value = self.parse_value()?;
                entries.push((Some(first), value));
            } else {
                entries.push((None, first));
            }

            self.skip_whitespace();
            match self.peek_char() {
                Some(',') => {
                    self.consume_char();
                    self.skip_whitespace();
                    if self.peek_char() == Some(closer) {
                        self.consume_char();
                        break;
                    }
                }
                Some(ch) if ch == closer => {
                    self.consume_char();
                    break;
                }
                Some(ch) => {
                    return Err(format!("unexpected token '{ch}' inside PHP array"));
                }
                None => return Err("unexpected end of input while parsing PHP array".to_string()),
            }
        }

        let has_keys = entries.iter().any(|(key, _)| key.is_some());
        if !has_keys {
            return Ok(serde_json::Value::Array(
                entries.into_iter().map(|(_, value)| value).collect(),
            ));
        }

        let mut object = serde_json::Map::new();
        for (position, (key, value)) in entries.into_iter().enumerate() {
            let key_value = key.unwrap_or_else(|| serde_json::Value::String(position.to_string()));
            let key_string = match key_value {
                serde_json::Value::String(string) => string,
                serde_json::Value::Number(number) => number.to_string(),
                serde_json::Value::Bool(boolean) => {
                    if boolean {
                        "1".to_string()
                    } else {
                        "0".to_string()
                    }
                }
                serde_json::Value::Null => String::new(),
                other => other.to_string(),
            };
            object.insert(key_string, value);
        }

        Ok(serde_json::Value::Object(object))
    }

    fn parse_string(&mut self) -> Result<String, String> {
        let quote = self
            .consume_char()
            .ok_or_else(|| "unexpected end while parsing PHP string".to_string())?;
        let mut output = String::new();
        let mut escaped = false;

        loop {
            let ch = self
                .consume_char()
                .ok_or_else(|| "unterminated PHP string literal".to_string())?;
            if escaped {
                output.push(match ch {
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    other => other,
                });
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == quote {
                break;
            }
            output.push(ch);
        }

        Ok(output)
    }

    fn parse_number(&mut self) -> Result<serde_json::Value, String> {
        let start = self.index;
        let mut saw_decimal = false;
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() || ch == '-' || ch == '+' {
                self.consume_char();
                continue;
            }
            if ch == '.' {
                saw_decimal = true;
                self.consume_char();
                continue;
            }
            break;
        }
        let raw = &self.input[start..self.index];
        if saw_decimal {
            let parsed = raw
                .parse::<f64>()
                .map_err(|error| format!("invalid PHP float '{raw}': {error}"))?;
            let number = serde_json::Number::from_f64(parsed)
                .ok_or_else(|| format!("invalid float value '{raw}'"))?;
            Ok(serde_json::Value::Number(number))
        } else {
            let parsed = raw
                .parse::<i64>()
                .map_err(|error| format!("invalid PHP integer '{raw}': {error}"))?;
            Ok(serde_json::Value::Number(serde_json::Number::from(parsed)))
        }
    }

    fn parse_identifier_or_literal(&mut self) -> Result<serde_json::Value, String> {
        let start = self.index;
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_alphanumeric() || ch == '_' {
                self.consume_char();
            } else {
                break;
            }
        }
        let raw = &self.input[start..self.index];
        match raw.to_lowercase().as_str() {
            "true" => Ok(serde_json::Value::Bool(true)),
            "false" => Ok(serde_json::Value::Bool(false)),
            "null" => Ok(serde_json::Value::Null),
            _ if !raw.is_empty() => Ok(serde_json::Value::String(raw.to_string())),
            _ => Err("expected PHP identifier or literal".to_string()),
        }
    }
}


#[derive(Debug)]
pub(crate) struct PhpSerializedParser<'a> {
    input: &'a str,
    index: usize,
}

impl<'a> PhpSerializedParser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, index: 0 }
    }

    fn is_eof(&self) -> bool {
        self.index >= self.input.len()
    }

    fn remaining(&self) -> &'a str {
        &self.input[self.index..]
    }

    fn peek_char(&self) -> Option<char> {
        self.remaining().chars().next()
    }

    fn consume_char(&mut self) -> Option<char> {
        let ch = self.peek_char()?;
        self.index += ch.len_utf8();
        Some(ch)
    }

    fn skip_whitespace(&mut self) {
        while let Some(ch) = self.peek_char() {
            if ch.is_whitespace() {
                self.index += ch.len_utf8();
            } else {
                break;
            }
        }
    }

    fn consume_exact(&mut self, expected: char) -> Result<(), String> {
        let got = self
            .consume_char()
            .ok_or_else(|| format!("expected '{expected}' but reached end of input"))?;
        if got != expected {
            return Err(format!("expected '{expected}' but got '{got}'"));
        }
        Ok(())
    }

    fn read_until(&mut self, delimiter: char) -> Result<String, String> {
        let start = self.index;
        while let Some(ch) = self.peek_char() {
            if ch == delimiter {
                let raw = self.input[start..self.index].to_string();
                self.consume_char();
                return Ok(raw);
            }
            self.consume_char();
        }
        Err(format!(
            "expected delimiter '{delimiter}' while parsing serialized PHP"
        ))
    }

    fn parse_value(&mut self) -> Result<serde_json::Value, String> {
        self.skip_whitespace();
        let value_type = self
            .consume_char()
            .ok_or_else(|| "unexpected end of serialized input".to_string())?;
        match value_type {
            'N' => {
                self.consume_exact(';')?;
                Ok(serde_json::Value::Null)
            }
            'b' => {
                self.consume_exact(':')?;
                let raw = self.read_until(';')?;
                match raw.as_str() {
                    "1" => Ok(serde_json::Value::Bool(true)),
                    "0" => Ok(serde_json::Value::Bool(false)),
                    _ => Err(format!("invalid serialized bool value: {raw}")),
                }
            }
            'i' => {
                self.consume_exact(':')?;
                let raw = self.read_until(';')?;
                let parsed = raw
                    .parse::<i64>()
                    .map_err(|error| format!("invalid serialized integer '{raw}': {error}"))?;
                Ok(serde_json::Value::Number(serde_json::Number::from(parsed)))
            }
            'd' => {
                self.consume_exact(':')?;
                let raw = self.read_until(';')?;
                let parsed = raw
                    .parse::<f64>()
                    .map_err(|error| format!("invalid serialized float '{raw}': {error}"))?;
                let number = serde_json::Number::from_f64(parsed)
                    .ok_or_else(|| format!("invalid serialized float '{raw}'"))?;
                Ok(serde_json::Value::Number(number))
            }
            's' => {
                self.consume_exact(':')?;
                let length_raw = self.read_until(':')?;
                let _declared_length: usize = length_raw.parse().map_err(|error| {
                    format!("invalid serialized string length '{length_raw}': {error}")
                })?;
                self.consume_exact('"')?;
                let content = self.read_until('"')?;
                self.consume_exact(';')?;
                Ok(serde_json::Value::String(content))
            }
            'a' => {
                self.consume_exact(':')?;
                let length_raw = self.read_until(':')?;
                let item_count: usize = length_raw.parse().map_err(|error| {
                    format!("invalid serialized array length '{length_raw}': {error}")
                })?;
                self.consume_exact('{')?;

                let mut keyed_entries = Vec::new();
                for _ in 0..item_count {
                    let key = self.parse_value()?;
                    let value = self.parse_value()?;
                    keyed_entries.push((key, value));
                }
                self.consume_exact('}')?;

                let mut is_indexed_array = true;
                let mut max_index = 0usize;
                for (expected_index, (key, _)) in keyed_entries.iter().enumerate() {
                    match key.as_i64() {
                        Some(index) if index >= 0 => {
                            max_index = max_index.max(index as usize);
                            if index as usize != expected_index {
                                is_indexed_array = false;
                            }
                        }
                        _ => {
                            is_indexed_array = false;
                        }
                    }
                }

                if is_indexed_array && max_index + 1 == keyed_entries.len() {
                    return Ok(serde_json::Value::Array(
                        keyed_entries.into_iter().map(|(_, value)| value).collect(),
                    ));
                }

                let mut object = serde_json::Map::new();
                for (key, value) in keyed_entries {
                    let key_string = match key {
                        serde_json::Value::String(string) => string,
                        serde_json::Value::Number(number) => number.to_string(),
                        serde_json::Value::Bool(boolean) => {
                            if boolean {
                                "1".to_string()
                            } else {
                                "0".to_string()
                            }
                        }
                        serde_json::Value::Null => String::new(),
                        other => other.to_string(),
                    };
                    object.insert(key_string, value);
                }
                Ok(serde_json::Value::Object(object))
            }
            other => Err(format!("unsupported serialized value type: {other}")),
        }
    }
}

pub(crate) fn convert_html_to_jsx(input: &str) -> String {
    let mut jsx = input.to_string();

    static CLASS_ATTR_RE: OnceLock<Regex> = OnceLock::new();
    let class_attr = CLASS_ATTR_RE.get_or_init(|| Regex::new(r#"(?i)\bclass="#).expect("valid class regex"));
    jsx = class_attr.replace_all(&jsx, "className=").to_string();

    static FOR_ATTR_RE: OnceLock<Regex> = OnceLock::new();
    let for_attr = FOR_ATTR_RE.get_or_init(|| Regex::new(r#"(?i)\bfor="#).expect("valid for regex"));
    jsx = for_attr.replace_all(&jsx, "htmlFor=").to_string();

    static SELF_CLOSING_RE: OnceLock<Regex> = OnceLock::new();
    let self_closing = SELF_CLOSING_RE.get_or_init(|| {
        Regex::new(r"(?i)<(br|hr|img|input|meta|link)([^>/]*?)>")
            .expect("valid self-closing regex")
    });
    jsx = self_closing.replace_all(&jsx, "<$1$2 />").to_string();

    jsx
}

pub(crate) fn convert_html_to_markdown(input: &str) -> String {
    let mut markdown = input.to_string();

    static HEADING_RES: OnceLock<Vec<(Regex, String)>> = OnceLock::new();
    let heading_pairs = HEADING_RES.get_or_init(|| {
        (1..=6)
            .rev()
            .map(|level| {
                let re = Regex::new(&format!(r"(?is)<h{0}[^>]*>(.*?)</h{0}>", level))
                    .expect("valid heading regex");
                let prefix = "#".repeat(level);
                (re, format!("{prefix} $1\n\n"))
            })
            .collect()
    });
    for (heading_re, replacement) in heading_pairs {
        markdown = heading_re.replace_all(&markdown, replacement.as_str()).to_string();
    }

    static STRONG_RE: OnceLock<Regex> = OnceLock::new();
    let strong_re = STRONG_RE.get_or_init(|| {
        Regex::new(r"(?is)<(strong|b)[^>]*>(.*?)</(strong|b)>").expect("valid strong regex")
    });
    markdown = strong_re.replace_all(&markdown, "**$2**").to_string();

    static EM_RE: OnceLock<Regex> = OnceLock::new();
    let em_re = EM_RE.get_or_init(|| {
        Regex::new(r"(?is)<(em|i)[^>]*>(.*?)</(em|i)>").expect("valid em regex")
    });
    markdown = em_re.replace_all(&markdown, "*$2*").to_string();

    static MD_LINK_RE: OnceLock<Regex> = OnceLock::new();
    let link_re = MD_LINK_RE.get_or_init(|| {
        Regex::new("(?is)<a[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>").expect("valid link regex")
    });
    markdown = link_re.replace_all(&markdown, "[$2]($1)").to_string();

    static LI_RE: OnceLock<Regex> = OnceLock::new();
    let li_re = LI_RE.get_or_init(|| Regex::new(r"(?is)<li[^>]*>(.*?)</li>").expect("valid li regex"));
    markdown = li_re.replace_all(&markdown, "- $1\n").to_string();

    static BLOCK_RE: OnceLock<Regex> = OnceLock::new();
    let paragraph_re = BLOCK_RE.get_or_init(|| {
        Regex::new(r"(?is)</?(p|div|section|article|main|ul|ol)[^>]*>").expect("valid block regex")
    });
    markdown = paragraph_re.replace_all(&markdown, "\n").to_string();

    static STRIP_TAG_RE: OnceLock<Regex> = OnceLock::new();
    let tag_re = STRIP_TAG_RE.get_or_init(|| Regex::new(r"(?is)<[^>]+>").expect("valid strip tag regex"));
    markdown = tag_re.replace_all(&markdown, "").to_string();

    static COLLAPSE_LINES_RE: OnceLock<Regex> = OnceLock::new();
    let collapse_lines = COLLAPSE_LINES_RE.get_or_init(|| Regex::new(r"\n{3,}").expect("valid collapse lines regex"));
    markdown = collapse_lines.replace_all(&markdown, "\n\n").to_string();

    markdown.trim().to_string()
}

pub(crate) fn decode_docx_base64_payload(input: &str) -> Result<Vec<u8>, String> {
    const PREFIX: &str = "DOCX_BASE64:";
    if !input.starts_with(PREFIX) {
        return Err("word-to-markdown expects DOCX_BASE64 payload from dropped .docx file".to_string());
    }

    let payload = &input[PREFIX.len()..];
    base64::engine::general_purpose::STANDARD
        .decode(payload)
        .map_err(|error| format!("invalid base64 docx payload: {error}"))
}

pub(crate) fn convert_word_to_markdown(input: &str) -> Result<String, String> {
    let bytes = decode_docx_base64_payload(input)?;
    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|error| format!("failed to read DOCX archive: {error}"))?;
    let mut document_xml_file = archive
        .by_name("word/document.xml")
        .map_err(|error| format!("DOCX missing word/document.xml: {error}"))?;

    let mut document_xml = String::new();
    document_xml_file
        .read_to_string(&mut document_xml)
        .map_err(|error| format!("failed to read DOCX XML: {error}"))?;

    static DOCX_TEXT_RE: OnceLock<Regex> = OnceLock::new();
    let text_re = DOCX_TEXT_RE.get_or_init(|| Regex::new(r#"(?s)<w:t[^>]*>(.*?)</w:t>"#).expect("valid w:t regex"));
    let mut markdown_paragraphs = Vec::new();
    for paragraph_xml in document_xml.split("</w:p>") {
        let mut paragraph_text = String::new();
        for capture in text_re.captures_iter(paragraph_xml) {
            let raw = capture.get(1).map(|match_| match_.as_str()).unwrap_or_default();
            paragraph_text.push_str(&decode_xml_entities(raw));
        }
        let normalized = paragraph_text.trim();
        if !normalized.is_empty() {
            markdown_paragraphs.push(normalized.to_string());
        }
    }

    Ok(markdown_paragraphs.join("\n\n"))
}

pub(crate) fn decode_xml_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

pub(crate) fn encode_svg_for_data_uri(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.bytes() {
        let ch = byte as char;
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~' | '/' | ':') {
            encoded.push(ch);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

pub(crate) fn convert_svg_to_css(input: &str) -> String {
    let svg = input.split_whitespace().collect::<Vec<_>>().join(" ");
    let encoded = encode_svg_for_data_uri(svg.trim());
    format!("background-image: url(\"data:image/svg+xml,{}\");", encoded)
}

pub(crate) fn convert_curl_to_javascript_fetch(input: &str) -> String {
    let parsed_tokens = shell_words::split(input).unwrap_or_else(|_| {
        input
            .split_whitespace()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
    });
    let mut tokens = parsed_tokens.as_slice();
    if tokens.first().is_some_and(|token| token == "curl") {
        tokens = &tokens[1..];
    }

    let mut method = "GET".to_string();
    let mut url = String::new();
    let mut headers = Vec::<(String, String)>::new();
    let mut body: Option<String> = None;

    let mut index = 0usize;
    while index < tokens.len() {
        let token = &tokens[index];
        match token.as_str() {
            "-X" | "--request" => {
                if let Some(next) = tokens.get(index + 1) {
                    method = next.to_uppercase();
                    index += 1;
                }
            }
            "-H" | "--header" => {
                if let Some(next) = tokens.get(index + 1) {
                    if let Some((name, value)) = next.split_once(':') {
                        headers.push((name.trim().to_string(), value.trim().to_string()));
                    }
                    index += 1;
                }
            }
            "-d" | "--data" | "--data-raw" | "--data-binary" => {
                if let Some(next) = tokens.get(index + 1) {
                    body = Some(next.to_string());
                    if method == "GET" {
                        method = "POST".to_string();
                    }
                    index += 1;
                }
            }
            _ if token.starts_with("http://") || token.starts_with("https://") => {
                url = token.to_string();
            }
            _ => {}
        }
        index += 1;
    }

    if url.is_empty() {
        url = "https://example.com".to_string();
    }

    let mut lines = Vec::new();
    lines.push(format!("const response = await fetch(\"{}\", {{", url));
    lines.push(format!("  method: \"{}\",", method));
    if !headers.is_empty() {
        lines.push("  headers: {".to_string());
        for (name, value) in headers {
            lines.push(format!("    \"{}\": \"{}\",", name, value));
        }
        lines.push("  },".to_string());
    }
    if let Some(body) = body {
        lines.push(format!("  body: \"{}\",", body.replace('"', "\\\"")));
    }
    lines.push("});".to_string());
    lines.push("const data = await response.text();".to_string());
    lines.push("console.log(data);".to_string());
    lines.join("\n")
}

pub(crate) fn convert_json_to_typescript_code(input: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("invalid JSON: {error}"))?;
    let root_type = typescript_type_inline(&value, 0);
    Ok(format!("type Root = {};\n", root_type))
}

pub(crate) fn typescript_type_inline(value: &serde_json::Value, level: usize) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(_) => "boolean".to_string(),
        serde_json::Value::Number(_) => "number".to_string(),
        serde_json::Value::String(_) => "string".to_string(),
        serde_json::Value::Array(array) => {
            if array.is_empty() {
                return "unknown[]".to_string();
            }
            let element_type = typescript_type_inline(&array[0], level + 1);
            format!("{element_type}[]")
        }
        serde_json::Value::Object(object) => {
            if object.is_empty() {
                return "Record<string, unknown>".to_string();
            }

            let indentation = "  ".repeat(level + 1);
            let closing_indentation = "  ".repeat(level);
            let mut lines = Vec::new();
            for (key, field_value) in object {
                let ts_type = typescript_type_inline(field_value, level + 1);
                lines.push(format!("{}{}: {};", indentation, key, ts_type));
            }
            format!("{{\n{}\n{}}}", lines.join("\n"), closing_indentation)
        }
    }
}

pub(crate) fn decode_query_component(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = Vec::<u8>::with_capacity(bytes.len());
    let mut index = 0usize;

    while index < bytes.len() {
        match bytes[index] {
            b'+' => {
                output.push(b' ');
                index += 1;
            }
            b'%' if index + 2 < bytes.len() => {
                let hex = &input[index + 1..index + 3];
                if let Ok(value) = u8::from_str_radix(hex, 16) {
                    output.push(value);
                    index += 3;
                } else {
                    output.push(bytes[index]);
                    index += 1;
                }
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&output).to_string()
}

pub(crate) fn convert_query_string_to_json(input: &str) -> Result<String, String> {
    let query_part = if let Some((_, after_question_mark)) = input.split_once('?') {
        after_question_mark
    } else {
        input
    };

    let mut object = serde_json::Map::new();
    for segment in query_part.split('&').filter(|segment| !segment.is_empty()) {
        let (raw_key, raw_value) = segment
            .split_once('=')
            .map_or((segment, ""), |(key, value)| (key, value));
        let key = decode_query_component(raw_key);
        let value = decode_query_component(raw_value);

        if let Some(existing) = object.get_mut(&key) {
            match existing {
                serde_json::Value::Array(array) => {
                    array.push(serde_json::Value::String(value));
                }
                current => {
                    *current = serde_json::Value::Array(vec![
                        current.clone(),
                        serde_json::Value::String(value),
                    ]);
                }
            }
        } else {
            object.insert(key, serde_json::Value::String(value));
        }
    }

    serde_json::to_string_pretty(&serde_json::Value::Object(object))
        .map_err(|error| format!("failed to convert query string to JSON: {error}"))
}

pub(crate) fn detect_delimiter(input: &str) -> &'static str {
    let candidates = [",", "\t", "|", ";", "\n"];
    let mut selected = "\n";
    let mut max_hits = 0usize;

    for delimiter in candidates {
        let hits = input.matches(delimiter).count();
        if hits > max_hits {
            max_hits = hits;
            selected = delimiter;
        }
    }

    selected
}

pub(crate) fn convert_delimiter_to_newline_list(input: &str) -> String {
    let delimiter = detect_delimiter(input);
    input
        .split(delimiter)
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

pub(crate) fn parse_number_with_base(input: &str) -> Result<u64, String> {
    let normalized = input.trim().replace('_', "");
    if normalized.starts_with("0b") || normalized.starts_with("0B") {
        return u64::from_str_radix(&normalized[2..], 2)
            .map_err(|error| format!("invalid binary input: {error}"));
    }
    if normalized.starts_with("0o") || normalized.starts_with("0O") {
        return u64::from_str_radix(&normalized[2..], 8)
            .map_err(|error| format!("invalid octal input: {error}"));
    }
    if normalized.starts_with("0x") || normalized.starts_with("0X") {
        return u64::from_str_radix(&normalized[2..], 16)
            .map_err(|error| format!("invalid hexadecimal input: {error}"));
    }

    if normalized.chars().all(|ch| ch == '0' || ch == '1') && normalized.len() > 1 {
        return u64::from_str_radix(&normalized, 2)
            .map_err(|error| format!("invalid binary input: {error}"));
    }

    if normalized.chars().all(|ch| ch.is_ascii_hexdigit())
        && normalized.chars().any(|ch| ch.is_ascii_alphabetic())
    {
        return u64::from_str_radix(&normalized, 16)
            .map_err(|error| format!("invalid hexadecimal input: {error}"));
    }

    normalized
        .parse::<u64>()
        .map_err(|error| format!("invalid decimal input: {error}"))
}

pub(crate) fn convert_number_base(input: &str) -> Result<String, String> {
    let decimal = parse_number_with_base(input)?;
    Ok(format!(
        "binary: {}\noctal: {}\ndecimal: {}\nhex: {}",
        format!("{decimal:b}"),
        format!("{decimal:o}"),
        decimal,
        format!("{decimal:X}")
    ))
}

pub(crate) fn convert_hex_to_ascii(input: &str) -> Result<String, String> {
    let mut normalized = input
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>();
    normalized = normalized
        .strip_prefix("0x")
        .or_else(|| normalized.strip_prefix("0X"))
        .unwrap_or(&normalized)
        .to_string();

    if normalized.len() % 2 != 0 {
        return Err("hex input must have an even number of characters".to_string());
    }
    if !normalized.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err("hex input contains non-hex characters".to_string());
    }

    let mut bytes = Vec::with_capacity(normalized.len() / 2);
    for index in (0..normalized.len()).step_by(2) {
        let byte = u8::from_str_radix(&normalized[index..index + 2], 16)
            .map_err(|error| format!("invalid hex byte at position {index}: {error}"))?;
        bytes.push(byte);
    }

    String::from_utf8(bytes).map_err(|error| format!("invalid UTF-8 bytes: {error}"))
}

pub(crate) fn convert_ascii_to_hex(input: &str) -> String {
    input
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join("")
}

pub(crate) fn to_roman_numeral(value: u32) -> Result<String, String> {
    if value == 0 || value > 3999 {
        return Err("roman numeral conversion supports values 1..3999".to_string());
    }

    let map = [
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    ];
    let mut remaining = value;
    let mut output = String::new();
    for (arabic, roman) in map {
        while remaining >= arabic {
            output.push_str(roman);
            remaining -= arabic;
        }
    }
    Ok(output)
}

pub(crate) fn from_roman_numeral(input: &str) -> Result<u32, String> {
    let normalized = input.trim().to_uppercase();
    if normalized.is_empty() {
        return Err("roman numeral input cannot be empty".to_string());
    }

    let map = |ch: char| -> Option<u32> {
        match ch {
            'I' => Some(1),
            'V' => Some(5),
            'X' => Some(10),
            'L' => Some(50),
            'C' => Some(100),
            'D' => Some(500),
            'M' => Some(1000),
            _ => None,
        }
    };

    let chars: Vec<char> = normalized.chars().collect();
    let mut total = 0u32;
    let mut index = 0usize;
    while index < chars.len() {
        let current = map(chars[index])
            .ok_or_else(|| format!("invalid roman numeral character: {}", chars[index]))?;
        if index + 1 < chars.len() {
            let next = map(chars[index + 1])
                .ok_or_else(|| format!("invalid roman numeral character: {}", chars[index + 1]))?;
            if current < next {
                total += next - current;
                index += 2;
                continue;
            }
        }
        total += current;
        index += 1;
    }

    Ok(total)
}

pub(crate) fn convert_roman_date(input: &str) -> Result<String, String> {
    let has_digit = input.chars().any(|ch| ch.is_ascii_digit());
    if has_digit {
        let components = input
            .split(|ch: char| !ch.is_ascii_digit())
            .filter(|segment| !segment.is_empty())
            .map(|segment| {
                segment
                    .parse::<u32>()
                    .map_err(|error| format!("invalid date number '{segment}': {error}"))
                    .and_then(to_roman_numeral)
            })
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(components.join("-"));
    }

    let components = input
        .split(|ch: char| !matches!(ch.to_ascii_uppercase(), 'I' | 'V' | 'X' | 'L' | 'C' | 'D' | 'M'))
        .filter(|segment| !segment.is_empty())
        .map(|segment| from_roman_numeral(segment).map(|value| value.to_string()))
        .collect::<Result<Vec<_>, _>>()?;

    if components.is_empty() {
        return Err("roman date input did not contain recognizable components".to_string());
    }

    Ok(components.join("-"))
}

