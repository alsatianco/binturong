use base64::Engine;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, TimeZone, Utc};
use cron::Schedule;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::OnceLock;
use url::Url;
use x509_parser::prelude::parse_x509_certificate;

pub(crate) fn parse_url_to_json(input: &str) -> Result<String, String> {
    let parsed_url = Url::parse(input).or_else(|_| Url::parse(&format!("https://{input}")))
        .map_err(|error| format!("invalid URL: {error}"))?;

    let mut query_map = serde_json::Map::new();
    for (key, value) in parsed_url.query_pairs() {
        let key = key.to_string();
        let value = value.to_string();
        if let Some(existing) = query_map.get_mut(&key) {
            match existing {
                serde_json::Value::Array(array) => array.push(serde_json::Value::String(value)),
                current => {
                    *current = serde_json::Value::Array(vec![
                        current.clone(),
                        serde_json::Value::String(value),
                    ]);
                }
            }
        } else {
            query_map.insert(key, serde_json::Value::String(value));
        }
    }

    let mut output = serde_json::Map::new();
    output.insert("scheme".to_string(), serde_json::Value::String(parsed_url.scheme().to_string()));
    output.insert(
        "host".to_string(),
        parsed_url
            .host_str()
            .map(|host| serde_json::Value::String(host.to_string()))
            .unwrap_or(serde_json::Value::Null),
    );
    output.insert(
        "port".to_string(),
        parsed_url
            .port()
            .map(|port| serde_json::Value::Number(serde_json::Number::from(port)))
            .unwrap_or(serde_json::Value::Null),
    );
    output.insert("path".to_string(), serde_json::Value::String(parsed_url.path().to_string()));
    output.insert(
        "query".to_string(),
        parsed_url
            .query()
            .map(|query| serde_json::Value::String(query.to_string()))
            .unwrap_or(serde_json::Value::Null),
    );
    output.insert(
        "fragment".to_string(),
        parsed_url
            .fragment()
            .map(|fragment| serde_json::Value::String(fragment.to_string()))
            .unwrap_or(serde_json::Value::Null),
    );
    output.insert("queryParams".to_string(), serde_json::Value::Object(query_map));

    serde_json::to_string_pretty(&serde_json::Value::Object(output))
        .map_err(|error| format!("failed to serialize URL parse output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UtmInput {
    base_url: String,
    source: Option<String>,
    medium: Option<String>,
    campaign: Option<String>,
    term: Option<String>,
    content: Option<String>,
}

pub(crate) fn generate_utm_url(input: &str) -> Result<String, String> {
    let payload: UtmInput =
        serde_json::from_str(input).map_err(|error| format!("invalid UTM input JSON: {error}"))?;
    let mut url = Url::parse(&payload.base_url)
        .map_err(|error| format!("invalid baseUrl in UTM payload: {error}"))?;
    {
        let mut query_pairs = url.query_pairs_mut();
        if let Some(source) = payload.source.filter(|value| !value.trim().is_empty()) {
            query_pairs.append_pair("utm_source", &source);
        }
        if let Some(medium) = payload.medium.filter(|value| !value.trim().is_empty()) {
            query_pairs.append_pair("utm_medium", &medium);
        }
        if let Some(campaign) = payload.campaign.filter(|value| !value.trim().is_empty()) {
            query_pairs.append_pair("utm_campaign", &campaign);
        }
        if let Some(term) = payload.term.filter(|value| !value.trim().is_empty()) {
            query_pairs.append_pair("utm_term", &term);
        }
        if let Some(content) = payload.content.filter(|value| !value.trim().is_empty()) {
            query_pairs.append_pair("utm_content", &content);
        }
    }
    Ok(url.to_string())
}

pub(crate) fn slugify_text(input: &str) -> String {
    let lowercase = input.trim().to_lowercase();
    let mut slug = String::new();
    let mut last_was_hyphen = false;

    for ch in lowercase.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_was_hyphen = false;
        } else if !last_was_hyphen {
            slug.push('-');
            last_was_hyphen = true;
        }
    }

    slug.trim_matches('-').to_string()
}

pub(crate) fn markdown_to_html_preview(input: &str) -> String {
    let mut html_lines = Vec::new();
    let mut in_list = false;
    static BOLD_RE: OnceLock<Regex> = OnceLock::new();
    static ITALIC_RE: OnceLock<Regex> = OnceLock::new();
    static LINK_RE: OnceLock<Regex> = OnceLock::new();
    let bold_re = BOLD_RE.get_or_init(|| Regex::new(r"\*\*(.*?)\*\*").expect("valid markdown bold regex"));
    let italic_re = ITALIC_RE.get_or_init(|| Regex::new(r"\*(.*?)\*").expect("valid markdown italic regex"));
    let link_re = LINK_RE.get_or_init(|| Regex::new(r"\[(.*?)\]\((.*?)\)").expect("valid markdown link regex"));

    for raw_line in input.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            if in_list {
                html_lines.push("</ul>".to_string());
                in_list = false;
            }
            continue;
        }

        // Apply inline formatting (bold, italic, links) with HTML escaping
        let render_inline = |text: &str| -> String {
            let escaped = text
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            link_re
                .replace_all(
                    &italic_re.replace_all(
                        &bold_re.replace_all(&escaped, "<strong>$1</strong>"),
                        "<em>$1</em>",
                    ),
                    "<a href=\"$2\">$1</a>",
                )
                .to_string()
        };

        if let Some(content) = line.strip_prefix("# ") {
            if in_list {
                html_lines.push("</ul>".to_string());
                in_list = false;
            }
            html_lines.push(format!("<h1>{}</h1>", render_inline(content)));
            continue;
        }
        if let Some(content) = line.strip_prefix("## ") {
            if in_list {
                html_lines.push("</ul>".to_string());
                in_list = false;
            }
            html_lines.push(format!("<h2>{}</h2>", render_inline(content)));
            continue;
        }
        if let Some(content) = line.strip_prefix("- ") {
            if !in_list {
                html_lines.push("<ul>".to_string());
                in_list = true;
            }
            html_lines.push(format!("<li>{}</li>", render_inline(content)));
            continue;
        }

        if in_list {
            html_lines.push("</ul>".to_string());
            in_list = false;
        }
        html_lines.push(format!("<p>{}</p>", render_inline(line)));
    }

    if in_list {
        html_lines.push("</ul>".to_string());
    }

    html_lines.join("\n")
}


pub(crate) fn decode_base64url_segment(segment: &str) -> Result<Vec<u8>, String> {
    let mut normalized = segment.replace('-', "+").replace('_', "/");
    while normalized.len() % 4 != 0 {
        normalized.push('=');
    }
    base64::engine::general_purpose::STANDARD
        .decode(normalized)
        .map_err(|error| format!("invalid base64url segment: {error}"))
}

pub(crate) fn convert_unix_time(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    let digits_only = trimmed
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect::<String>();

    let utc_datetime = if digits_only.len() == 10 || digits_only.len() == 13 {
        let raw_timestamp = digits_only
            .parse::<i64>()
            .map_err(|error| format!("invalid unix timestamp: {error}"))?;
        let (seconds, nanos) = if digits_only.len() == 13 {
            let secs = raw_timestamp / 1000;
            let sub_ms = (raw_timestamp % 1000).abs() as u32;
            (secs, sub_ms * 1_000_000)
        } else {
            (raw_timestamp, 0u32)
        };
        Utc.timestamp_opt(seconds, nanos)
            .single()
            .ok_or_else(|| "unix timestamp is out of range".to_string())?
    } else {
        parse_datetime_to_utc(trimmed)?
    };

    let seconds = utc_datetime.timestamp();
    let milliseconds = utc_datetime.timestamp_millis();
    let local = utc_datetime.with_timezone(&Local);

    let output = serde_json::json!({
        "seconds": seconds,
        "milliseconds": milliseconds,
        "utcIso": utc_datetime.to_rfc3339(),
        "localIso": local.to_rfc3339(),
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize unix time output: {error}"))
}

pub(crate) fn parse_datetime_to_utc(input: &str) -> Result<DateTime<Utc>, String> {
    if let Ok(parsed) = DateTime::parse_from_rfc3339(input) {
        return Ok(parsed.with_timezone(&Utc));
    }

    let naive_datetime_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
    ];
    for format in naive_datetime_formats {
        if let Ok(parsed) = NaiveDateTime::parse_from_str(input, format) {
            let local = Local
                .from_local_datetime(&parsed)
                .single()
                .or_else(|| Local.from_local_datetime(&parsed).earliest())
                .ok_or_else(|| "datetime is ambiguous in local timezone".to_string())?;
            return Ok(local.with_timezone(&Utc));
        }
    }

    let date_formats = ["%Y-%m-%d", "%Y/%m/%d"];
    for format in date_formats {
        if let Ok(parsed_date) = NaiveDate::parse_from_str(input, format) {
            let parsed = parsed_date
                .and_hms_opt(0, 0, 0)
                .ok_or_else(|| "failed to build datetime from date".to_string())?;
            let local = Local
                .from_local_datetime(&parsed)
                .single()
                .or_else(|| Local.from_local_datetime(&parsed).earliest())
                .ok_or_else(|| "date is ambiguous in local timezone".to_string())?;
            return Ok(local.with_timezone(&Utc));
        }
    }

    Err("unsupported datetime format (try unix timestamp, RFC3339, or YYYY-MM-DD HH:MM:SS)".to_string())
}

pub(crate) fn decode_jwt_token(input: &str) -> Result<String, String> {
    let segments = input.trim().split('.').collect::<Vec<_>>();
    if segments.len() != 3 {
        return Err("JWT must contain exactly 3 segments".to_string());
    }

    let header_bytes = decode_base64url_segment(segments[0])?;
    let payload_bytes = decode_base64url_segment(segments[1])?;
    let header_value: serde_json::Value = serde_json::from_slice(&header_bytes)
        .map_err(|error| format!("invalid JWT header JSON: {error}"))?;
    let payload_value: serde_json::Value = serde_json::from_slice(&payload_bytes)
        .map_err(|error| format!("invalid JWT payload JSON: {error}"))?;

    let exp_claim = payload_value
        .get("exp")
        .and_then(serde_json::Value::as_i64);
    let current_unix = Utc::now().timestamp();
    let is_expired = exp_claim.map(|exp| exp <= current_unix);

    let output = serde_json::json!({
        "header": header_value,
        "payload": payload_value,
        "signature": segments[2],
        "isExpired": is_expired,
        "currentUnix": current_unix,
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize JWT debug output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RegexTesterInput {
    pattern: String,
    text: String,
    flags: Option<String>,
    replace: Option<String>,
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RegexMatchOutput {
    matched: String,
    start: usize,
    end: usize,
    groups: Vec<Option<String>>,
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RegexTesterOutput {
    matches: Vec<RegexMatchOutput>,
    replaced_text: Option<String>,
}

pub(crate) fn run_regex_tester(input: &str) -> Result<String, String> {
    let payload: RegexTesterInput =
        serde_json::from_str(input).map_err(|error| format!("invalid regex tester input JSON: {error}"))?;
    if payload.pattern.trim().is_empty() {
        return Err("regex pattern cannot be empty".to_string());
    }

    let flags = payload.flags.unwrap_or_default();
    let mut prefix = String::new();
    if flags.contains('i') {
        prefix.push_str("(?i)");
    }
    if flags.contains('m') {
        prefix.push_str("(?m)");
    }
    if flags.contains('s') {
        prefix.push_str("(?s)");
    }
    if flags.contains('x') {
        prefix.push_str("(?x)");
    }
    if flags.contains('U') {
        prefix.push_str("(?U)");
    }

    let pattern = format!("{prefix}{}", payload.pattern);
    let regex = Regex::new(&pattern).map_err(|error| format!("invalid regex pattern: {error}"))?;

    let matches = regex
        .captures_iter(&payload.text)
        .filter_map(|captures| {
            captures.get(0).map(|full_match| {
                let groups = (1..captures.len())
                    .map(|index| captures.get(index).map(|value| value.as_str().to_string()))
                    .collect::<Vec<_>>();
                RegexMatchOutput {
                    matched: full_match.as_str().to_string(),
                    start: full_match.start(),
                    end: full_match.end(),
                    groups,
                }
            })
        })
        .collect::<Vec<_>>();

    let replaced_text = payload.replace.map(|replacement| {
        regex
            .replace_all(&payload.text, replacement.as_str())
            .to_string()
    });
    let output = RegexTesterOutput {
        matches,
        replaced_text,
    };
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize regex tester output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextDiffInput {
    left: String,
    right: String,
    ignore_whitespace: Option<bool>,
    ignore_case: Option<bool>,
}

pub(crate) fn normalize_diff_line(input: &str, ignore_whitespace: bool, ignore_case: bool) -> String {
    let mut normalized = if ignore_whitespace {
        input.split_whitespace().collect::<String>()
    } else {
        input.to_string()
    };
    if ignore_case {
        normalized = normalized.to_lowercase();
    }
    normalized
}

pub(crate) fn run_text_diff(input: &str) -> Result<String, String> {
    let payload: TextDiffInput =
        serde_json::from_str(input).map_err(|error| format!("invalid text diff input JSON: {error}"))?;
    let ignore_whitespace = payload.ignore_whitespace.unwrap_or(false);
    let ignore_case = payload.ignore_case.unwrap_or(false);

    let left_lines = payload.left.lines().collect::<Vec<_>>();
    let right_lines = payload.right.lines().collect::<Vec<_>>();
    let normalized_left = left_lines
        .iter()
        .map(|line| normalize_diff_line(line, ignore_whitespace, ignore_case))
        .collect::<Vec<_>>();
    let normalized_right = right_lines
        .iter()
        .map(|line| normalize_diff_line(line, ignore_whitespace, ignore_case))
        .collect::<Vec<_>>();

    let mut lcs = vec![vec![0usize; normalized_right.len() + 1]; normalized_left.len() + 1];
    for left_index in (0..normalized_left.len()).rev() {
        for right_index in (0..normalized_right.len()).rev() {
            if normalized_left[left_index] == normalized_right[right_index] {
                lcs[left_index][right_index] = lcs[left_index + 1][right_index + 1] + 1;
            } else {
                lcs[left_index][right_index] =
                    lcs[left_index + 1][right_index].max(lcs[left_index][right_index + 1]);
            }
        }
    }

    let mut left_index = 0usize;
    let mut right_index = 0usize;
    let mut diff_lines: Vec<String> = vec!["--- left".to_string(), "+++ right".to_string()];
    while left_index < left_lines.len() && right_index < right_lines.len() {
        if normalized_left[left_index] == normalized_right[right_index] {
            diff_lines.push(format!("  {}", left_lines[left_index]));
            left_index += 1;
            right_index += 1;
        } else if lcs[left_index + 1][right_index] >= lcs[left_index][right_index + 1] {
            diff_lines.push(format!("- {}", left_lines[left_index]));
            left_index += 1;
        } else {
            diff_lines.push(format!("+ {}", right_lines[right_index]));
            right_index += 1;
        }
    }

    while left_index < left_lines.len() {
        diff_lines.push(format!("- {}", left_lines[left_index]));
        left_index += 1;
    }
    while right_index < right_lines.len() {
        diff_lines.push(format!("+ {}", right_lines[right_index]));
        right_index += 1;
    }

    Ok(diff_lines.join("\n"))
}

pub(crate) fn inspect_string_details(input: &str) -> Result<String, String> {
    let characters = input.chars().collect::<Vec<_>>();
    let code_points = characters
        .iter()
        .enumerate()
        .map(|(index, ch)| {
            let mut utf8_buffer = [0u8; 4];
            let encoded = ch.encode_utf8(&mut utf8_buffer);
            let utf8_hex = encoded
                .as_bytes()
                .iter()
                .map(|byte| format!("{byte:02X}"))
                .collect::<Vec<_>>()
                .join(" ");

            serde_json::json!({
                "index": index,
                "char": ch.to_string(),
                "codePoint": format!("U+{:04X}", *ch as u32),
                "utf8Hex": utf8_hex,
            })
        })
        .collect::<Vec<_>>();

    let output = serde_json::json!({
        "characters": characters.len(),
        "bytes": input.as_bytes().len(),
        "lines": input.lines().count(),
        "words": input.split_whitespace().count(),
        "isAscii": input.is_ascii(),
        "codePoints": code_points,
    });

    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize string inspector output: {error}"))
}

pub(crate) fn parse_cron_schedule(input: &str) -> Result<String, String> {
    let fields = input.split_whitespace().collect::<Vec<_>>();
    let normalized_expression = if fields.len() == 5 {
        format!("0 {input}")
    } else {
        input.to_string()
    };

    let schedule = Schedule::from_str(&normalized_expression)
        .map_err(|error| format!("invalid cron expression: {error}"))?;
    let next_runs = schedule
        .upcoming(Utc)
        .take(5)
        .map(|datetime| datetime.to_rfc3339())
        .collect::<Vec<_>>();

    let summary = if fields.len() >= 5 {
        format!(
            "minute={}, hour={}, dayOfMonth={}, month={}, dayOfWeek={}",
            fields[0], fields[1], fields[2], fields[3], fields[4]
        )
    } else {
        "cron expression parsed".to_string()
    };

    let output = serde_json::json!({
        "expression": input,
        "normalizedExpression": normalized_expression,
        "summary": summary,
        "nextRunsUtc": next_runs,
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize cron parser output: {error}"))
}


#[derive(Debug, Clone, Copy)]
pub(crate) struct RgbColor {
    r: u8,
    g: u8,
    b: u8,
}

pub(crate) fn parse_hex_color(input: &str) -> Option<RgbColor> {
    let trimmed = input.trim().trim_start_matches('#');
    if trimmed.len() == 3 && trimmed.chars().all(|ch| ch.is_ascii_hexdigit()) {
        let r = u8::from_str_radix(&trimmed[0..1].repeat(2), 16).ok()?;
        let g = u8::from_str_radix(&trimmed[1..2].repeat(2), 16).ok()?;
        let b = u8::from_str_radix(&trimmed[2..3].repeat(2), 16).ok()?;
        return Some(RgbColor { r, g, b });
    }
    if trimmed.len() == 6 && trimmed.chars().all(|ch| ch.is_ascii_hexdigit()) {
        let r = u8::from_str_radix(&trimmed[0..2], 16).ok()?;
        let g = u8::from_str_radix(&trimmed[2..4], 16).ok()?;
        let b = u8::from_str_radix(&trimmed[4..6], 16).ok()?;
        return Some(RgbColor { r, g, b });
    }
    None
}

pub(crate) fn parse_rgb_color(input: &str) -> Option<RgbColor> {
    static RGB_RE: OnceLock<Regex> = OnceLock::new();
    let matcher = RGB_RE.get_or_init(|| {
        Regex::new(r"(?i)^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$")
            .expect("valid rgb parse regex")
    });
    let captures = matcher.captures(input.trim())?;
    let r = captures.get(1)?.as_str().parse::<u16>().ok()?;
    let g = captures.get(2)?.as_str().parse::<u16>().ok()?;
    let b = captures.get(3)?.as_str().parse::<u16>().ok()?;
    if r > 255 || g > 255 || b > 255 {
        return None;
    }
    Some(RgbColor {
        r: r as u8,
        g: g as u8,
        b: b as u8,
    })
}

pub(crate) fn parse_hsl_color(input: &str) -> Option<RgbColor> {
    static HSL_RE: OnceLock<Regex> = OnceLock::new();
    let matcher = HSL_RE.get_or_init(|| {
        Regex::new(
            r"(?i)^hsl\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$",
        )
        .expect("valid hsl parse regex")
    });
    let captures = matcher.captures(input.trim())?;
    let h = captures.get(1)?.as_str().parse::<f64>().ok()?;
    let s = captures.get(2)?.as_str().parse::<f64>().ok()? / 100.0;
    let l = captures.get(3)?.as_str().parse::<f64>().ok()? / 100.0;
    if !(0.0..=1.0).contains(&s) || !(0.0..=1.0).contains(&l) {
        return None;
    }
    Some(hsl_to_rgb(h, s, l))
}

pub(crate) fn rgb_to_hsl(color: RgbColor) -> (f64, f64, f64) {
    let r = color.r as f64 / 255.0;
    let g = color.g as f64 / 255.0;
    let b = color.b as f64 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;
    let lightness = (max + min) / 2.0;
    if delta == 0.0 {
        return (0.0, 0.0, lightness);
    }

    let saturation = delta / (1.0 - (2.0 * lightness - 1.0).abs());
    let hue = if (max - r).abs() < f64::EPSILON {
        60.0 * (((g - b) / delta) % 6.0)
    } else if (max - g).abs() < f64::EPSILON {
        60.0 * (((b - r) / delta) + 2.0)
    } else {
        60.0 * (((r - g) / delta) + 4.0)
    };
    let normalized_hue = if hue < 0.0 { hue + 360.0 } else { hue };
    (normalized_hue, saturation, lightness)
}

pub(crate) fn hsl_to_rgb(h: f64, s: f64, l: f64) -> RgbColor {
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let x = c * (1.0 - (((h / 60.0) % 2.0) - 1.0).abs());
    let m = l - c / 2.0;

    let (r1, g1, b1) = match h {
        h if (0.0..60.0).contains(&h) => (c, x, 0.0),
        h if (60.0..120.0).contains(&h) => (x, c, 0.0),
        h if (120.0..180.0).contains(&h) => (0.0, c, x),
        h if (180.0..240.0).contains(&h) => (0.0, x, c),
        h if (240.0..300.0).contains(&h) => (x, 0.0, c),
        _ => (c, 0.0, x),
    };

    RgbColor {
        r: ((r1 + m) * 255.0).round().clamp(0.0, 255.0) as u8,
        g: ((g1 + m) * 255.0).round().clamp(0.0, 255.0) as u8,
        b: ((b1 + m) * 255.0).round().clamp(0.0, 255.0) as u8,
    }
}

pub(crate) fn convert_color_formats(input: &str) -> Result<String, String> {
    let rgb = parse_hex_color(input)
        .or_else(|| parse_rgb_color(input))
        .or_else(|| parse_hsl_color(input))
        .ok_or_else(|| "unsupported color format (use HEX, rgb(), or hsl())".to_string())?;

    let (h, s, l) = rgb_to_hsl(rgb);
    let output = serde_json::json!({
        "hex": format!("#{:02X}{:02X}{:02X}", rgb.r, rgb.g, rgb.b),
        "rgb": format!("rgb({}, {}, {})", rgb.r, rgb.g, rgb.b),
        "hsl": format!("hsl({:.0}, {:.0}%, {:.0}%)", h, s * 100.0, l * 100.0),
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize color converter output: {error}"))
}

pub(crate) fn decode_certificate_details(input: &str) -> Result<String, String> {
    let certificate_bytes = if let Some(base64_payload) = input.strip_prefix("DER_BASE64:") {
        base64::engine::general_purpose::STANDARD
            .decode(base64_payload.trim())
            .map_err(|error| format!("invalid DER base64 payload: {error}"))?
    } else if input.contains("-----BEGIN CERTIFICATE-----") {
        let (_, pem) = x509_parser::pem::parse_x509_pem(input.as_bytes())
            .map_err(|error| format!("invalid PEM certificate: {error}"))?;
        pem.contents
    } else {
        base64::engine::general_purpose::STANDARD
            .decode(input.trim())
            .map_err(|error| format!("invalid certificate input: {error}"))?
    };

    let (_, certificate) = parse_x509_certificate(&certificate_bytes)
        .map_err(|error| format!("invalid X.509 certificate: {error}"))?;
    let output = serde_json::json!({
        "version": format!("{}", certificate.version()),
        "serialNumber": certificate.raw_serial_as_string(),
        "subject": format!("{}", certificate.subject()),
        "issuer": format!("{}", certificate.issuer()),
        "notBefore": certificate.validity().not_before.to_rfc2822(),
        "notAfter": certificate.validity().not_after.to_rfc2822(),
        "signatureAlgorithm": certificate.signature_algorithm.algorithm.to_id_string(),
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize certificate decode output: {error}"))
}

