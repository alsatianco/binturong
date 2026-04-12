use regex::Regex;
use serde::Serialize;
use std::sync::OnceLock;

pub(crate) fn format_json(input: &str, indent_size: usize) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("invalid JSON: {error}"))?;
    let indent = vec![b' '; indent_size];
    let formatter = serde_json::ser::PrettyFormatter::with_indent(&indent);
    let mut output = Vec::new();
    let mut serializer = serde_json::Serializer::with_formatter(&mut output, formatter);
    value
        .serialize(&mut serializer)
        .map_err(|error| format!("failed to format JSON: {error}"))?;
    String::from_utf8(output).map_err(|error| format!("invalid UTF-8 output: {error}"))
}

pub(crate) fn minify_json(input: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(input).map_err(|error| format!("invalid JSON: {error}"))?;
    serde_json::to_string(&value).map_err(|error| format!("failed to minify JSON: {error}"))
}

pub(crate) fn split_html_tokens(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_tag = false;

    for ch in input.chars() {
        match ch {
            '<' => {
                if !current.trim().is_empty() {
                    tokens.push(current.trim().to_string());
                }
                current.clear();
                current.push(ch);
                in_tag = true;
            }
            '>' => {
                current.push(ch);
                tokens.push(current.trim().to_string());
                current.clear();
                in_tag = false;
            }
            _ => {
                current.push(ch);
                if !in_tag && (ch == '\n' || ch == '\r') {
                    let fragment = current.trim();
                    if !fragment.is_empty() {
                        tokens.push(fragment.to_string());
                    }
                    current.clear();
                }
            }
        }
    }

    if !current.trim().is_empty() {
        tokens.push(current.trim().to_string());
    }

    tokens
}

pub(crate) fn is_void_html_tag(token: &str) -> bool {
    const VOID_TAGS: &[&str] = &[
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    ];

    if !token.starts_with('<') || token.starts_with("</") {
        return false;
    }

    let body = token
        .trim_start_matches('<')
        .trim_end_matches('>')
        .trim_end_matches('/')
        .trim();
    let tag_name = body
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_lowercase();

    VOID_TAGS.iter().any(|void_tag| void_tag == &tag_name)
}

pub(crate) fn format_html(input: &str, indent_size: usize) -> String {
    let mut formatted_lines = Vec::new();
    let mut indent_level = 0usize;
    let indent_unit = " ".repeat(indent_size);
    let tokens = split_html_tokens(input);

    for token in tokens {
        let normalized = token.trim();
        if normalized.is_empty() {
            continue;
        }

        let is_closing = normalized.starts_with("</");
        let is_comment_or_directive =
            normalized.starts_with("<!--") || normalized.starts_with("<!") || normalized.starts_with("<?");
        let is_opening = normalized.starts_with('<') && !is_closing;
        let self_closing = normalized.ends_with("/>") || is_void_html_tag(normalized);

        if is_closing {
            indent_level = indent_level.saturating_sub(1);
        }

        let line_indent = indent_unit.repeat(indent_level);
        if is_opening || is_closing || is_comment_or_directive {
            formatted_lines.push(format!("{line_indent}{normalized}"));
        } else {
            let collapsed = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
            if !collapsed.is_empty() {
                formatted_lines.push(format!("{line_indent}{collapsed}"));
            }
        }

        if is_opening && !self_closing && !is_comment_or_directive {
            indent_level += 1;
        }
    }

    formatted_lines.join("\n")
}

pub(crate) fn minify_html(input: &str) -> String {
    let mut content = input.split_whitespace().collect::<Vec<_>>().join(" ");
    static INTER_TAG_WS_RE: OnceLock<Regex> = OnceLock::new();
    let inter_tag_whitespace = INTER_TAG_WS_RE.get_or_init(|| Regex::new(r">\s+<").expect("valid html inter-tag regex"));
    content = inter_tag_whitespace.replace_all(&content, "><").to_string();
    content.trim().to_string()
}

pub(crate) fn strip_stylesheet_comments(input: &str, is_scss: bool) -> String {
    let mut output = String::new();
    let chars: Vec<char> = input.chars().collect();
    let mut index = 0usize;
    let mut in_string: Option<char> = None;
    let mut escaped = false;

    while index < chars.len() {
        let current = chars[index];

        if let Some(quote) = in_string {
            output.push(current);
            if current == quote && !escaped {
                in_string = None;
            }
            escaped = current == '\\' && !escaped;
            index += 1;
            continue;
        }

        if current == '"' || current == '\'' {
            in_string = Some(current);
            escaped = false;
            output.push(current);
            index += 1;
            continue;
        }

        if current == '/' && index + 1 < chars.len() {
            let next = chars[index + 1];
            if next == '*' {
                index += 2;
                while index + 1 < chars.len() && !(chars[index] == '*' && chars[index + 1] == '/') {
                    index += 1;
                }
                index = (index + 2).min(chars.len());
                continue;
            }

            if is_scss && next == '/' {
                index += 2;
                while index < chars.len() && chars[index] != '\n' && chars[index] != '\r' {
                    index += 1;
                }
                continue;
            }
        }

        output.push(current);
        index += 1;
    }

    output
}

pub(crate) fn minify_stylesheet(input: &str, is_scss: bool) -> String {
    let mut content = strip_stylesheet_comments(input, is_scss);
    static STYLESHEET_WS_RE: OnceLock<Regex> = OnceLock::new();
    let collapse_whitespace = STYLESHEET_WS_RE.get_or_init(|| Regex::new(r"\s+").expect("valid whitespace regex"));
    content = collapse_whitespace.replace_all(&content, " ").to_string();

    static STYLESHEET_COMPACT_RES: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    let compact_pairs = STYLESHEET_COMPACT_RES.get_or_init(|| {
        vec![
            (Regex::new(r"\s*\{\s*").expect("valid stylesheet compact regex"), "{"),
            (Regex::new(r"\s*\}\s*").expect("valid stylesheet compact regex"), "}"),
            (Regex::new(r"\s*;\s*").expect("valid stylesheet compact regex"), ";"),
            (Regex::new(r"\s*:\s*").expect("valid stylesheet compact regex"), ":"),
            (Regex::new(r"\s*,\s*").expect("valid stylesheet compact regex"), ","),
            (Regex::new(r"\s*>\s*").expect("valid stylesheet compact regex"), ">"),
            (Regex::new(r"\s*\+\s*").expect("valid stylesheet compact regex"), "+"),
            (Regex::new(r"\s*~\s*").expect("valid stylesheet compact regex"), "~"),
            (Regex::new(r"\s*\(\s*").expect("valid stylesheet compact regex"), "("),
            (Regex::new(r"\s*\)\s*").expect("valid stylesheet compact regex"), ")"),
        ]
    });

    for (matcher, replacement) in compact_pairs {
        content = matcher.replace_all(&content, *replacement).to_string();
    }

    content.trim().to_string()
}

pub(crate) fn format_stylesheet(input: &str, indent_size: usize, is_scss: bool) -> String {
    let minified = minify_stylesheet(input, is_scss);
    if minified.is_empty() {
        return String::new();
    }

    let mut output = String::new();
    let indent_unit = " ".repeat(indent_size);
    let mut indent_level = 0usize;
    let mut in_string: Option<char> = None;
    let mut escaped = false;

    for ch in minified.chars() {
        if let Some(quote) = in_string {
            output.push(ch);
            if ch == quote && !escaped {
                in_string = None;
            }
            escaped = ch == '\\' && !escaped;
            continue;
        }

        if ch == '"' || ch == '\'' {
            in_string = Some(ch);
            escaped = false;
            output.push(ch);
            continue;
        }

        match ch {
            '{' => {
                output.push_str(" {\n");
                indent_level += 1;
                output.push_str(&indent_unit.repeat(indent_level));
            }
            ';' => {
                output.push_str(";\n");
                output.push_str(&indent_unit.repeat(indent_level));
            }
            '}' => {
                while output.ends_with(' ') || output.ends_with('\n') {
                    output.pop();
                }
                indent_level = indent_level.saturating_sub(1);
                output.push('\n');
                output.push_str(&indent_unit.repeat(indent_level));
                output.push('}');
                output.push('\n');
                output.push_str(&indent_unit.repeat(indent_level));
            }
            _ => {
                output.push(ch);
            }
        }
    }

    output.trim().to_string()
}

pub(crate) fn strip_script_comments(input: &str) -> String {
    let mut output = String::new();
    let chars: Vec<char> = input.chars().collect();
    let mut index = 0usize;
    let mut in_string: Option<char> = None;
    let mut escaped = false;

    while index < chars.len() {
        let current = chars[index];

        if let Some(quote) = in_string {
            output.push(current);
            if current == quote && !escaped {
                in_string = None;
            }
            escaped = current == '\\' && !escaped;
            index += 1;
            continue;
        }

        if current == '"' || current == '\'' || current == '`' {
            in_string = Some(current);
            escaped = false;
            output.push(current);
            index += 1;
            continue;
        }

        if current == '/' && index + 1 < chars.len() {
            let next = chars[index + 1];
            if next == '*' {
                index += 2;
                while index + 1 < chars.len() && !(chars[index] == '*' && chars[index + 1] == '/') {
                    index += 1;
                }
                index = (index + 2).min(chars.len());
                continue;
            }

            if next == '/' {
                index += 2;
                while index < chars.len() && chars[index] != '\n' && chars[index] != '\r' {
                    index += 1;
                }
                continue;
            }
        }

        output.push(current);
        index += 1;
    }

    output
}

pub(crate) fn minify_script(input: &str) -> String {
    let mut content = strip_script_comments(input);
    static SCRIPT_WS_RE: OnceLock<Regex> = OnceLock::new();
    let collapse_whitespace = SCRIPT_WS_RE.get_or_init(|| Regex::new(r"\s+").expect("valid script whitespace regex"));
    content = collapse_whitespace.replace_all(&content, " ").to_string();

    static SCRIPT_COMPACT_RES: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    let compact_pairs = SCRIPT_COMPACT_RES.get_or_init(|| {
        vec![
            (Regex::new(r"\s*\{\s*").expect("valid script compact regex"), "{"),
            (Regex::new(r"\s*\}\s*").expect("valid script compact regex"), "}"),
            (Regex::new(r"\s*;\s*").expect("valid script compact regex"), ";"),
            (Regex::new(r"\s*:\s*").expect("valid script compact regex"), ":"),
            (Regex::new(r"\s*,\s*").expect("valid script compact regex"), ","),
            (Regex::new(r"\s*\(\s*").expect("valid script compact regex"), "("),
            (Regex::new(r"\s*\)\s*").expect("valid script compact regex"), ")"),
            (Regex::new(r"\s*=\s*").expect("valid script compact regex"), "="),
            (Regex::new(r"\s*\+\s*").expect("valid script compact regex"), "+"),
            (Regex::new(r"\s*-\s*").expect("valid script compact regex"), "-"),
            (Regex::new(r"\s*\*\s*").expect("valid script compact regex"), "*"),
            (Regex::new(r"\s*/\s*").expect("valid script compact regex"), "/"),
            (Regex::new(r"\s*<\s*").expect("valid script compact regex"), "<"),
            (Regex::new(r"\s*>\s*").expect("valid script compact regex"), ">"),
        ]
    });

    for (matcher, replacement) in compact_pairs {
        content = matcher.replace_all(&content, *replacement).to_string();
    }

    content.trim().to_string()
}

pub(crate) fn format_script(input: &str, indent_size: usize) -> String {
    let minified = minify_script(input);
    if minified.is_empty() {
        return String::new();
    }

    let mut output = String::new();
    let indent_unit = " ".repeat(indent_size);
    let mut indent_level = 0usize;
    let mut in_string: Option<char> = None;
    let mut escaped = false;

    for ch in minified.chars() {
        if let Some(quote) = in_string {
            output.push(ch);
            if ch == quote && !escaped {
                in_string = None;
            }
            escaped = ch == '\\' && !escaped;
            continue;
        }

        if ch == '"' || ch == '\'' || ch == '`' {
            in_string = Some(ch);
            escaped = false;
            output.push(ch);
            continue;
        }

        match ch {
            '{' => {
                output.push_str(" {\n");
                indent_level += 1;
                output.push_str(&indent_unit.repeat(indent_level));
            }
            ';' => {
                output.push_str(";\n");
                output.push_str(&indent_unit.repeat(indent_level));
            }
            '}' => {
                while output.ends_with(' ') || output.ends_with('\n') {
                    output.pop();
                }
                indent_level = indent_level.saturating_sub(1);
                output.push('\n');
                output.push_str(&indent_unit.repeat(indent_level));
                output.push('}');
                output.push('\n');
                output.push_str(&indent_unit.repeat(indent_level));
            }
            _ => output.push(ch),
        }
    }

    output.trim().to_string()
}

pub(crate) fn minify_graphql(input: &str) -> String {
    let mut lines = Vec::new();
    for raw_line in input.lines() {
        let line = if let Some((before_comment, _)) = raw_line.split_once('#') {
            before_comment
        } else {
            raw_line
        };
        if !line.trim().is_empty() {
            lines.push(line.trim().to_string());
        }
    }

    let mut content = lines.join(" ");
    static GRAPHQL_WS_RE: OnceLock<Regex> = OnceLock::new();
    let collapse_whitespace = GRAPHQL_WS_RE.get_or_init(|| Regex::new(r"\s+").expect("valid graphql whitespace regex"));
    content = collapse_whitespace.replace_all(&content, " ").to_string();

    static GRAPHQL_COMPACT_RES: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    let compact_pairs = GRAPHQL_COMPACT_RES.get_or_init(|| {
        vec![
            (Regex::new(r"\s*\{\s*").expect("valid graphql compact regex"), "{"),
            (Regex::new(r"\s*\}\s*").expect("valid graphql compact regex"), "}"),
            (Regex::new(r"\s*\(\s*").expect("valid graphql compact regex"), "("),
            (Regex::new(r"\s*\)\s*").expect("valid graphql compact regex"), ")"),
            (Regex::new(r"\s*:\s*").expect("valid graphql compact regex"), ":"),
            (Regex::new(r"\s*,\s*").expect("valid graphql compact regex"), ","),
        ]
    });

    for (matcher, replacement) in compact_pairs {
        content = matcher.replace_all(&content, *replacement).to_string();
    }

    content.trim().to_string()
}

pub(crate) fn format_graphql(input: &str, indent_size: usize) -> String {
    let minified = minify_graphql(input);
    if minified.is_empty() {
        return String::new();
    }

    let mut output = String::new();
    let indent_unit = " ".repeat(indent_size);
    let mut indent_level = 0usize;

    for ch in minified.chars() {
        match ch {
            '{' => {
                output.push_str(" {\n");
                indent_level += 1;
                output.push_str(&indent_unit.repeat(indent_level));
            }
            '}' => {
                while output.ends_with(' ') || output.ends_with('\n') {
                    output.pop();
                }
                indent_level = indent_level.saturating_sub(1);
                output.push('\n');
                output.push_str(&indent_unit.repeat(indent_level));
                output.push('}');
                output.push('\n');
                output.push_str(&indent_unit.repeat(indent_level));
            }
            ',' => {
                output.push(',');
                output.push('\n');
                output.push_str(&indent_unit.repeat(indent_level));
            }
            _ => output.push(ch),
        }
    }

    output.trim().to_string()
}

pub(crate) fn replace_erb_blocks_with_placeholders(input: &str) -> (String, Vec<String>) {
    static ERB_BLOCK_RE: OnceLock<Regex> = OnceLock::new();
    let matcher = ERB_BLOCK_RE.get_or_init(|| Regex::new(r"(?s)<%.*?%>").expect("valid erb matcher regex"));
    let mut blocks = Vec::new();
    let mut next_index = 0usize;

    let replaced = matcher
        .replace_all(input, |captures: &regex::Captures| {
            let full = captures.get(0).expect("regex capture").as_str().to_string();
            blocks.push(full);
            let placeholder = format!("__ERB_BLOCK_{next_index}__");
            next_index += 1;
            placeholder
        })
        .to_string();

    (replaced, blocks)
}

pub(crate) fn restore_erb_blocks(input: &str, blocks: &[String]) -> String {
    let mut restored = input.to_string();
    for (index, block) in blocks.iter().enumerate() {
        let placeholder = format!("__ERB_BLOCK_{index}__");
        restored = restored.replace(&placeholder, block);
    }
    restored
}

pub(crate) fn format_erb(input: &str, indent_size: usize) -> String {
    let (placeholder_html, blocks) = replace_erb_blocks_with_placeholders(input);
    let formatted = format_html(&placeholder_html, indent_size);
    restore_erb_blocks(&formatted, &blocks)
}

pub(crate) fn minify_erb(input: &str) -> String {
    let (placeholder_html, blocks) = replace_erb_blocks_with_placeholders(input);
    let minified = minify_html(&placeholder_html);
    restore_erb_blocks(&minified, &blocks)
}

pub(crate) fn format_xml(input: &str, indent_size: usize) -> String {
    let mut formatted_lines = Vec::new();
    let mut indent_level = 0usize;
    let indent_unit = " ".repeat(indent_size);
    let tokens = split_html_tokens(input);

    for token in tokens {
        let normalized = token.trim();
        if normalized.is_empty() {
            continue;
        }

        let is_closing = normalized.starts_with("</");
        let is_comment_or_directive =
            normalized.starts_with("<!--") || normalized.starts_with("<!") || normalized.starts_with("<?");
        let is_opening = normalized.starts_with('<') && !is_closing;
        let self_closing = normalized.ends_with("/>");

        if is_closing {
            indent_level = indent_level.saturating_sub(1);
        }

        let line_indent = indent_unit.repeat(indent_level);
        if is_opening || is_closing || is_comment_or_directive {
            formatted_lines.push(format!("{line_indent}{normalized}"));
        } else {
            let collapsed = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
            if !collapsed.is_empty() {
                formatted_lines.push(format!("{line_indent}{collapsed}"));
            }
        }

        if is_opening && !self_closing && !is_comment_or_directive {
            indent_level += 1;
        }
    }

    formatted_lines.join("\n")
}

pub(crate) fn minify_xml(input: &str) -> String {
    minify_html(input)
}

pub(crate) fn minify_sql(input: &str) -> String {
    static SQL_WS_RE: OnceLock<Regex> = OnceLock::new();
    let collapse_whitespace = SQL_WS_RE.get_or_init(|| Regex::new(r"\s+").expect("valid sql whitespace regex"));
    let mut content = collapse_whitespace.replace_all(input, " ").to_string();

    static SQL_COMPACT_RES: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    let compact_pairs = SQL_COMPACT_RES.get_or_init(|| {
        vec![
            (Regex::new(r"\s*,\s*").expect("valid sql compact regex"), ","),
            (Regex::new(r"\s*\(\s*").expect("valid sql compact regex"), "("),
            (Regex::new(r"\s*\)\s*").expect("valid sql compact regex"), ")"),
            (Regex::new(r"\s*=\s*").expect("valid sql compact regex"), "="),
        ]
    });
    for (matcher, replacement) in compact_pairs {
        content = matcher.replace_all(&content, *replacement).to_string();
    }
    content.trim().to_string()
}

pub(crate) fn format_sql(input: &str, indent_size: usize) -> String {
    let minified = minify_sql(input);

    static SQL_KEYWORD_RES: OnceLock<Vec<(Regex, String)>> = OnceLock::new();
    let keyword_pairs = SQL_KEYWORD_RES.get_or_init(|| {
        let upper_keywords = [
            "select", "from", "where", "group by", "order by", "having", "limit",
            "insert into", "values", "update", "set", "delete from",
            "inner join", "left join", "right join", "full join", "join", "on", "and", "or",
        ];
        upper_keywords
            .iter()
            .map(|keyword| {
                let re = Regex::new(&format!(r"(?i)\b{}\b", regex::escape(keyword)))
                    .expect("valid sql keyword regex");
                (re, keyword.to_uppercase())
            })
            .collect()
    });

    let mut sql = minified;
    for (matcher, replacement) in keyword_pairs {
        sql = matcher.replace_all(&sql, replacement.as_str()).to_string();
    }

    static SQL_CLAUSE_RES: OnceLock<Vec<(Regex, String)>> = OnceLock::new();
    let clause_pairs = SQL_CLAUSE_RES.get_or_init(|| {
        let clause_keywords = [
            "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT",
            "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM",
            "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "JOIN", "ON",
        ];
        clause_keywords
            .iter()
            .map(|clause| {
                let re = Regex::new(&format!(r"\s+{}\b", regex::escape(clause)))
                    .expect("valid sql clause regex");
                (re, format!("\n{clause}"))
            })
            .collect()
    });

    for (matcher, replacement) in clause_pairs {
        sql = matcher.replace_all(&sql, replacement.as_str()).to_string();
    }

    let indentation = " ".repeat(indent_size);
    let mut lines = Vec::new();
    for line in sql.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with("AND ") || trimmed.starts_with("OR ") {
            lines.push(format!("{indentation}{trimmed}"));
        } else {
            lines.push(trimmed.to_string());
        }
    }

    lines.join("\n")
}

pub(crate) fn format_markdown(input: &str) -> String {
    let mut lines = Vec::new();
    let mut previous_blank = false;

    for raw_line in input.lines() {
        let line = raw_line.trim_end();
        if line.is_empty() {
            if !previous_blank {
                lines.push(String::new());
            }
            previous_blank = true;
            continue;
        }

        lines.push(line.to_string());
        previous_blank = false;
    }

    lines.join("\n").trim().to_string()
}

pub(crate) fn minify_markdown(input: &str) -> String {
    input
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn format_yaml(input: &str) -> Result<String, String> {
    let value: serde_yaml::Value =
        serde_yaml::from_str(input).map_err(|error| format!("invalid YAML: {error}"))?;
    let formatted = serde_yaml::to_string(&value)
        .map_err(|error| format!("failed to format YAML: {error}"))?;
    Ok(formatted.trim().to_string())
}

pub(crate) fn minify_yaml(input: &str) -> Result<String, String> {
    let formatted = format_yaml(input)?;
    let mut lines = Vec::new();
    let mut previous_blank = false;
    for raw_line in formatted.lines() {
        let line = raw_line.trim_end();
        if line.is_empty() {
            if !previous_blank {
                lines.push(String::new());
            }
            previous_blank = true;
            continue;
        }
        lines.push(line.to_string());
        previous_blank = false;
    }
    Ok(lines.join("\n").trim().to_string())
}
