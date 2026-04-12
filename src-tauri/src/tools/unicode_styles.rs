use regex::Regex;
use serde::Deserialize;

use super::text_transforms::UnicodeTextInput;

pub(crate) fn parse_style_text_input(input: &str, tool_name: &str) -> Result<String, String> {
    if input.trim_start().starts_with('{') {
        let payload = serde_json::from_str::<UnicodeTextInput>(input)
            .map_err(|error| format!("invalid {tool_name} input JSON: {error}"))?;
        Ok(payload.text)
    } else {
        Ok(input.to_string())
    }
}

pub(crate) fn map_bold_char(ch: char) -> char {
    if ch.is_ascii_uppercase() {
        return char::from_u32(0x1D400 + (ch as u32 - 'A' as u32)).unwrap_or(ch);
    }
    if ch.is_ascii_lowercase() {
        return char::from_u32(0x1D41A + (ch as u32 - 'a' as u32)).unwrap_or(ch);
    }
    if ch.is_ascii_digit() {
        return char::from_u32(0x1D7CE + (ch as u32 - '0' as u32)).unwrap_or(ch);
    }
    ch
}

pub(crate) fn run_bold_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "bold text generator")?;
    Ok(text.chars().map(map_bold_char).collect::<String>())
}

pub(crate) fn map_italic_char(ch: char) -> char {
    if ch == 'h' {
        return 'ℎ';
    }
    if ch == 'H' {
        return '𝐻';
    }
    if ch.is_ascii_uppercase() {
        return char::from_u32(0x1D434 + (ch as u32 - 'A' as u32)).unwrap_or(ch);
    }
    if ch.is_ascii_lowercase() {
        return char::from_u32(0x1D44E + (ch as u32 - 'a' as u32)).unwrap_or(ch);
    }
    ch
}

pub(crate) fn run_italic_text_converter(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "italic text converter")?;
    Ok(text.chars().map(map_italic_char).collect::<String>())
}

pub(crate) fn apply_combining_mark(text: &str, mark: char) -> String {
    let mut output = String::new();
    for ch in text.chars() {
        if ch == '\n' || ch == '\r' {
            output.push(ch);
            continue;
        }
        if ch.is_whitespace() {
            output.push(ch);
            continue;
        }
        output.push(ch);
        output.push(mark);
    }
    output
}

pub(crate) fn run_underline_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "underline text generator")?;
    Ok(apply_combining_mark(&text, '\u{0332}'))
}

pub(crate) fn run_strikethrough_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "strikethrough text generator")?;
    Ok(apply_combining_mark(&text, '\u{0336}'))
}

pub(crate) fn map_small_text_char(ch: char) -> char {
    match ch {
        'a' | 'A' => 'ᴀ',
        'b' | 'B' => 'ʙ',
        'c' | 'C' => 'ᴄ',
        'd' | 'D' => 'ᴅ',
        'e' | 'E' => 'ᴇ',
        'f' | 'F' => 'ꜰ',
        'g' | 'G' => 'ɢ',
        'h' | 'H' => 'ʜ',
        'i' | 'I' => 'ɪ',
        'j' | 'J' => 'ᴊ',
        'k' | 'K' => 'ᴋ',
        'l' | 'L' => 'ʟ',
        'm' | 'M' => 'ᴍ',
        'n' | 'N' => 'ɴ',
        'o' | 'O' => 'ᴏ',
        'p' | 'P' => 'ᴘ',
        'q' | 'Q' => 'ǫ',
        'r' | 'R' => 'ʀ',
        's' | 'S' => 'ꜱ',
        't' | 'T' => 'ᴛ',
        'u' | 'U' => 'ᴜ',
        'v' | 'V' => 'ᴠ',
        'w' | 'W' => 'ᴡ',
        'x' | 'X' => 'ˣ',
        'y' | 'Y' => 'ʏ',
        'z' | 'Z' => 'ᴢ',
        '0' => '⁰',
        '1' => '¹',
        '2' => '²',
        '3' => '³',
        '4' => '⁴',
        '5' => '⁵',
        '6' => '⁶',
        '7' => '⁷',
        '8' => '⁸',
        '9' => '⁹',
        _ => ch,
    }
}

pub(crate) fn run_small_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "small text generator")?;
    Ok(text.chars().map(map_small_text_char).collect::<String>())
}

pub(crate) fn map_subscript_char(ch: char) -> char {
    match ch {
        'a' | 'A' => 'ₐ',
        'e' | 'E' => 'ₑ',
        'h' | 'H' => 'ₕ',
        'i' | 'I' => 'ᵢ',
        'j' | 'J' => 'ⱼ',
        'k' | 'K' => 'ₖ',
        'l' | 'L' => 'ₗ',
        'm' | 'M' => 'ₘ',
        'n' | 'N' => 'ₙ',
        'o' | 'O' => 'ₒ',
        'p' | 'P' => 'ₚ',
        'r' | 'R' => 'ᵣ',
        's' | 'S' => 'ₛ',
        't' | 'T' => 'ₜ',
        'u' | 'U' => 'ᵤ',
        'v' | 'V' => 'ᵥ',
        'x' | 'X' => 'ₓ',
        '0' => '₀',
        '1' => '₁',
        '2' => '₂',
        '3' => '₃',
        '4' => '₄',
        '5' => '₅',
        '6' => '₆',
        '7' => '₇',
        '8' => '₈',
        '9' => '₉',
        '+' => '₊',
        '-' => '₋',
        '=' => '₌',
        '(' => '₍',
        ')' => '₎',
        _ => ch,
    }
}

pub(crate) fn run_subscript_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "subscript generator")?;
    Ok(text.chars().map(map_subscript_char).collect::<String>())
}

pub(crate) fn map_superscript_char(ch: char) -> char {
    match ch {
        'a' | 'A' => 'ᵃ',
        'b' | 'B' => 'ᵇ',
        'c' | 'C' => 'ᶜ',
        'd' | 'D' => 'ᵈ',
        'e' | 'E' => 'ᵉ',
        'f' | 'F' => 'ᶠ',
        'g' | 'G' => 'ᵍ',
        'h' | 'H' => 'ᴴ',
        'i' | 'I' => 'ⁱ',
        'j' | 'J' => 'ʲ',
        'k' | 'K' => 'ᵏ',
        'l' | 'L' => 'ˡ',
        'm' | 'M' => 'ᵐ',
        'n' | 'N' => 'ⁿ',
        'o' | 'O' => 'ᴼ',
        'p' | 'P' => 'ᵖ',
        'q' | 'Q' => 'ᵠ',
        'r' | 'R' => 'ʳ',
        's' | 'S' => 'ˢ',
        't' | 'T' => 'ᵗ',
        'u' | 'U' => 'ᵘ',
        'v' | 'V' => 'ᵛ',
        'w' | 'W' => 'ʷ',
        'x' | 'X' => 'ˣ',
        'y' | 'Y' => 'ʸ',
        'z' | 'Z' => 'ᶻ',
        '0' => '⁰',
        '1' => '¹',
        '2' => '²',
        '3' => '³',
        '4' => '⁴',
        '5' => '⁵',
        '6' => '⁶',
        '7' => '⁷',
        '8' => '⁸',
        '9' => '⁹',
        '+' => '⁺',
        '-' => '⁻',
        '=' => '⁼',
        '(' => '⁽',
        ')' => '⁾',
        _ => ch,
    }
}

pub(crate) fn run_superscript_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "superscript generator")?;
    Ok(text.chars().map(map_superscript_char).collect::<String>())
}

pub(crate) fn map_wide_char(ch: char) -> char {
    if ch == ' ' {
        return '\u{3000}';
    }
    if ('!'..='~').contains(&ch) {
        let mapped = ch as u32 + 0xFEE0;
        return char::from_u32(mapped).unwrap_or(ch);
    }
    ch
}

pub(crate) fn run_wide_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "wide text generator")?;
    Ok(text.chars().map(map_wide_char).collect::<String>())
}

pub(crate) fn map_double_struck_char(ch: char) -> char {
    match ch {
        'C' => 'ℂ',
        'H' => 'ℍ',
        'N' => 'ℕ',
        'P' => 'ℙ',
        'Q' => 'ℚ',
        'R' => 'ℝ',
        'Z' => 'ℤ',
        _ if ch.is_ascii_uppercase() => {
            char::from_u32(0x1D538 + (ch as u32 - 'A' as u32)).unwrap_or(ch)
        }
        _ if ch.is_ascii_lowercase() => {
            char::from_u32(0x1D552 + (ch as u32 - 'a' as u32)).unwrap_or(ch)
        }
        _ if ch.is_ascii_digit() => {
            char::from_u32(0x1D7D8 + (ch as u32 - '0' as u32)).unwrap_or(ch)
        }
        _ => ch,
    }
}

pub(crate) fn run_double_struck_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "double struck text generator")?;
    Ok(text
        .chars()
        .map(map_double_struck_char)
        .collect::<String>())
}

pub(crate) fn map_bubble_char(ch: char) -> char {
    if ch.is_ascii_uppercase() {
        return char::from_u32(0x24B6 + (ch as u32 - 'A' as u32)).unwrap_or(ch);
    }
    if ch.is_ascii_lowercase() {
        return char::from_u32(0x24D0 + (ch as u32 - 'a' as u32)).unwrap_or(ch);
    }
    if ch == '0' {
        return '⓪';
    }
    if ('1'..='9').contains(&ch) {
        return char::from_u32(0x2460 + (ch as u32 - '1' as u32)).unwrap_or(ch);
    }
    ch
}

pub(crate) fn run_bubble_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "bubble text generator")?;
    Ok(text.chars().map(map_bubble_char).collect::<String>())
}

pub(crate) fn map_gothic_char(ch: char) -> char {
    match ch {
        'C' => 'ℭ',
        'H' => 'ℌ',
        'I' => 'ℑ',
        'R' => 'ℜ',
        'Z' => 'ℨ',
        _ if ch.is_ascii_uppercase() => {
            char::from_u32(0x1D504 + (ch as u32 - 'A' as u32)).unwrap_or(ch)
        }
        _ if ch.is_ascii_lowercase() => {
            char::from_u32(0x1D51E + (ch as u32 - 'a' as u32)).unwrap_or(ch)
        }
        _ => ch,
    }
}

pub(crate) fn run_gothic_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "gothic text generator")?;
    Ok(text.chars().map(map_gothic_char).collect::<String>())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CursedTextInput {
    text: String,
    intensity: Option<usize>,
}

pub(crate) fn run_cursed_text_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<CursedTextInput>(input)
            .map_err(|error| format!("invalid cursed text input JSON: {error}"))?
    } else {
        CursedTextInput {
            text: input.to_string(),
            intensity: Some(2),
        }
    };

    let intensity = payload.intensity.unwrap_or(2).clamp(1, 10);
    let above_marks = [
        '\u{030d}', '\u{030e}', '\u{0304}', '\u{0305}', '\u{033f}', '\u{0311}', '\u{0306}',
        '\u{0310}', '\u{0352}', '\u{0357}', '\u{0351}', '\u{0307}', '\u{0308}', '\u{030a}',
    ];
    let middle_marks = ['\u{0315}', '\u{031b}', '\u{0340}', '\u{0341}', '\u{0358}', '\u{0321}', '\u{0322}', '\u{0327}', '\u{0328}', '\u{0334}', '\u{0335}', '\u{0336}'];
    let below_marks = ['\u{0316}', '\u{0317}', '\u{0318}', '\u{0319}', '\u{031c}', '\u{031d}', '\u{031e}', '\u{031f}', '\u{0320}', '\u{0324}', '\u{0325}', '\u{0329}', '\u{032a}', '\u{032b}', '\u{032c}', '\u{032d}', '\u{032e}', '\u{032f}', '\u{0330}', '\u{0331}', '\u{0332}', '\u{0333}'];

    let mut output = String::new();
    for (index, ch) in payload.text.chars().enumerate() {
        output.push(ch);
        if ch.is_whitespace() {
            continue;
        }
        for step in 0..intensity {
            output.push(above_marks[(index + step) % above_marks.len()]);
        }
        for step in 0..(intensity / 2 + 1) {
            output.push(middle_marks[(index + step) % middle_marks.len()]);
        }
        for step in 0..intensity {
            output.push(below_marks[(index + step) % below_marks.len()]);
        }
    }
    Ok(output)
}

pub(crate) fn run_slash_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "slash text generator")?;
    Ok(apply_combining_mark(&text, '\u{0338}'))
}

pub(crate) fn run_stacked_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "stacked text generator")?;
    let stacked_lines = text
        .lines()
        .map(|line| {
            line.chars()
                .map(|ch| ch.to_string())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .collect::<Vec<_>>();
    Ok(stacked_lines.join("\n\n"))
}

pub(crate) fn big_block_glyph(ch: char) -> [String; 3] {
    if ch.is_whitespace() {
        return ["   ".to_string(), "   ".to_string(), "   ".to_string()];
    }
    let upper = ch.to_uppercase().to_string();
    [
        upper.repeat(3),
        format!("{upper} {upper}"),
        upper.repeat(3),
    ]
}

pub(crate) fn run_big_text_converter(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "big text converter")?;
    let blocks = text
        .lines()
        .map(|line| {
            let mut rows = vec![String::new(), String::new(), String::new()];
            for ch in line.chars() {
                let glyph = big_block_glyph(ch);
                for row_index in 0..3 {
                    if !rows[row_index].is_empty() {
                        rows[row_index].push(' ');
                    }
                    rows[row_index].push_str(&glyph[row_index]);
                }
            }
            rows.join("\n")
        })
        .collect::<Vec<_>>();
    Ok(blocks.join("\n\n"))
}

pub(crate) fn map_typewriter_char(ch: char) -> char {
    if ch.is_ascii_uppercase() {
        return char::from_u32(0x1D670 + (ch as u32 - 'A' as u32)).unwrap_or(ch);
    }
    if ch.is_ascii_lowercase() {
        return char::from_u32(0x1D68A + (ch as u32 - 'a' as u32)).unwrap_or(ch);
    }
    if ch.is_ascii_digit() {
        return char::from_u32(0x1D7F6 + (ch as u32 - '0' as u32)).unwrap_or(ch);
    }
    ch
}

pub(crate) fn run_typewriter_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "typewriter text generator")?;
    Ok(text.chars().map(map_typewriter_char).collect::<String>())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FancyTextInput {
    text: String,
    style: Option<String>,
}

pub(crate) fn run_fancy_text_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<FancyTextInput>(input)
            .map_err(|error| format!("invalid fancy text input JSON: {error}"))?
    } else {
        FancyTextInput {
            text: input.to_string(),
            style: None,
        }
    };

    let text = &payload.text;

    if let Some(ref style_value) = payload.style {
        let style = style_value.to_lowercase();
        let mapped = text
            .chars()
            .map(|ch| match style.as_str() {
                "bold" => map_bold_char(ch),
                "italic" => map_italic_char(ch),
                "bubble" => map_bubble_char(ch),
                "gothic" => map_gothic_char(ch),
                "small" => map_small_text_char(ch),
                "superscript" => map_superscript_char(ch),
                _ => map_double_struck_char(ch),
            })
            .collect::<String>();
        Ok(mapped)
    } else {
        let styles: &[(&str, fn(char) -> char)] = &[
            ("Double-Struck", map_double_struck_char as fn(char) -> char),
            ("Bold", map_bold_char),
            ("Italic", map_italic_char),
            ("Gothic", map_gothic_char),
            ("Bubble", map_bubble_char),
            ("Small", map_small_text_char),
            ("Superscript", map_superscript_char),
        ];
        let mut lines = Vec::new();
        for (label, mapper) in styles {
            let styled: String = text.chars().map(mapper).collect();
            lines.push(format!("{label}: {styled}"));
        }
        Ok(lines.join("\n"))
    }
}

pub(crate) fn run_cute_font_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "cute font generator")?;
    let bubble = text.chars().map(map_bubble_char).collect::<String>();
    let separated = bubble
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ୨୧ ");
    Ok(format!("ʚ♡ɞ {} ʚ♡ɞ", separated))
}

pub(crate) fn run_aesthetic_text_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "aesthetic text generator")?;
    let mut output_lines = Vec::new();
    for line in text.lines() {
        let wide_upper = line
            .to_uppercase()
            .chars()
            .map(map_wide_char)
            .collect::<Vec<_>>();
        let mut formatted = String::new();
        for (index, ch) in wide_upper.iter().enumerate() {
            formatted.push(*ch);
            if index + 1 < wide_upper.len() {
                formatted.push(' ');
            }
        }
        output_lines.push(formatted);
    }
    Ok(output_lines.join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnicodeTextConverterInput {
    text: String,
}

pub(crate) fn run_unicode_text_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<UnicodeTextConverterInput>(input)
            .map_err(|error| format!("invalid unicode text converter input JSON: {error}"))?
    } else {
        UnicodeTextConverterInput {
            text: input.to_string(),
        }
    };

    let code_points = payload
        .text
        .chars()
        .map(|ch| format!("U+{:04X}", ch as u32))
        .collect::<Vec<_>>();
    let scalar_values = payload
        .text
        .chars()
        .map(|ch| format!("{:X}", ch as u32))
        .collect::<Vec<_>>()
        .join(" ");
    let json_escaped =
        serde_json::to_string(&payload.text).map_err(|error| format!("failed to escape JSON text: {error}"))?;
    let rust_escaped = payload
        .text
        .chars()
        .map(|ch| format!("\\u{{{:X}}}", ch as u32))
        .collect::<Vec<_>>()
        .join("");

    let output = serde_json::json!({
        "text": payload.text,
        "codePoints": code_points,
        "hexScalars": scalar_values,
        "jsonEscaped": json_escaped,
        "rustEscaped": rust_escaped
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize unicode text converter output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnicodeToTextConverterInput {
    value: String,
}

pub(crate) fn parse_unicode_token(token: &str) -> Option<char> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return None;
    }

    let cleaned = trimmed
        .trim_start_matches("U+")
        .trim_start_matches("u+")
        .trim_start_matches("0x")
        .trim_start_matches("\\u{")
        .trim_start_matches("\\u")
        .trim_end_matches('}')
        .trim();
    if cleaned.is_empty() {
        return None;
    }

    let hex = u32::from_str_radix(cleaned, 16)
        .ok()
        .or_else(|| cleaned.parse::<u32>().ok())?;
    char::from_u32(hex)
}

pub(crate) fn run_unicode_to_text_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<UnicodeToTextConverterInput>(input)
            .map_err(|error| format!("invalid unicode to text input JSON: {error}"))?
    } else {
        UnicodeToTextConverterInput {
            value: input.to_string(),
        }
    };

    let raw = payload.value.trim();
    if raw.starts_with('"') && raw.ends_with('"') {
        let decoded = serde_json::from_str::<String>(raw)
            .map_err(|error| format!("invalid JSON string input: {error}"))?;
        return Ok(decoded);
    }

    let tokens = Regex::new(r"[,\s]+")
        .expect("valid unicode to text token regex")
        .split(raw)
        .filter(|token| !token.trim().is_empty())
        .collect::<Vec<_>>();
    if tokens.is_empty() {
        return Err("no unicode code points provided".to_string());
    }

    let mut output = String::new();
    for token in tokens {
        if let Some(ch) = parse_unicode_token(token) {
            output.push(ch);
        } else {
            return Err(format!("invalid unicode code point token: {token}"));
        }
    }
    Ok(output)
}

pub(crate) fn run_facebook_font_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "facebook font generator")?;
    Ok(text.chars().map(map_bold_char).collect::<String>())
}

pub(crate) fn run_instagram_font_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "instagram font generator")?;
    Ok(format!(
        "✦ {} ✦",
        text.chars().map(map_bubble_char).collect::<String>()
    ))
}

pub(crate) fn run_x_font_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "x font generator")?;
    Ok(text
        .chars()
        .map(map_double_struck_char)
        .collect::<String>())
}

pub(crate) fn run_tiktok_font_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "tiktok font generator")?;
    let wide_upper = text
        .to_uppercase()
        .chars()
        .map(map_wide_char)
        .collect::<Vec<_>>();
    let mut output = String::new();
    for (index, ch) in wide_upper.iter().enumerate() {
        output.push(*ch);
        if index + 1 < wide_upper.len() {
            output.push(' ');
        }
    }
    Ok(output)
}

pub(crate) fn run_discord_font_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "discord font generator")?;
    Ok(text.chars().map(map_typewriter_char).collect::<String>())
}

pub(crate) fn run_whatsapp_font_generator(input: &str) -> Result<String, String> {
    let text = parse_style_text_input(input, "whatsapp font generator")?;
    Ok(text.chars().map(map_italic_char).collect::<String>())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModeTextInput {
    text: String,
    mode: Option<String>,
}

pub(crate) fn nato_word_for_char(ch: char) -> Option<&'static str> {
    match ch.to_ascii_uppercase() {
        'A' => Some("Alpha"),
        'B' => Some("Bravo"),
        'C' => Some("Charlie"),
        'D' => Some("Delta"),
        'E' => Some("Echo"),
        'F' => Some("Foxtrot"),
        'G' => Some("Golf"),
        'H' => Some("Hotel"),
        'I' => Some("India"),
        'J' => Some("Juliett"),
        'K' => Some("Kilo"),
        'L' => Some("Lima"),
        'M' => Some("Mike"),
        'N' => Some("November"),
        'O' => Some("Oscar"),
        'P' => Some("Papa"),
        'Q' => Some("Quebec"),
        'R' => Some("Romeo"),
        'S' => Some("Sierra"),
        'T' => Some("Tango"),
        'U' => Some("Uniform"),
        'V' => Some("Victor"),
        'W' => Some("Whiskey"),
        'X' => Some("X-ray"),
        'Y' => Some("Yankee"),
        'Z' => Some("Zulu"),
        '0' => Some("Zero"),
        '1' => Some("One"),
        '2' => Some("Two"),
        '3' => Some("Three"),
        '4' => Some("Four"),
        '5' => Some("Five"),
        '6' => Some("Six"),
        '7' => Some("Seven"),
        '8' => Some("Eight"),
        '9' => Some("Nine"),
        _ => None,
    }
}

pub(crate) fn char_for_nato_word(token: &str) -> Option<char> {
    match token.to_ascii_lowercase().as_str() {
        "alpha" => Some('A'),
        "bravo" => Some('B'),
        "charlie" => Some('C'),
        "delta" => Some('D'),
        "echo" => Some('E'),
        "foxtrot" => Some('F'),
        "golf" => Some('G'),
        "hotel" => Some('H'),
        "india" => Some('I'),
        "juliett" | "juliet" => Some('J'),
        "kilo" => Some('K'),
        "lima" => Some('L'),
        "mike" => Some('M'),
        "november" => Some('N'),
        "oscar" => Some('O'),
        "papa" => Some('P'),
        "quebec" => Some('Q'),
        "romeo" => Some('R'),
        "sierra" => Some('S'),
        "tango" => Some('T'),
        "uniform" => Some('U'),
        "victor" => Some('V'),
        "whiskey" => Some('W'),
        "x-ray" | "xray" => Some('X'),
        "yankee" => Some('Y'),
        "zulu" => Some('Z'),
        "zero" => Some('0'),
        "one" => Some('1'),
        "two" => Some('2'),
        "three" => Some('3'),
        "four" => Some('4'),
        "five" => Some('5'),
        "six" => Some('6'),
        "seven" => Some('7'),
        "eight" => Some('8'),
        "nine" => Some('9'),
        _ => None,
    }
}

pub(crate) fn run_nato_phonetic_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<ModeTextInput>(input)
            .map_err(|error| format!("invalid nato converter input JSON: {error}"))?
    } else {
        ModeTextInput {
            text: input.to_string(),
            mode: Some("encode".to_string()),
        }
    };

    match payload
        .mode
        .unwrap_or_else(|| "encode".to_string())
        .to_lowercase()
        .as_str()
    {
        "decode" => {
            let mut output = String::new();
            for token in Regex::new(r"[,\s]+")
                .expect("valid nato decode split regex")
                .split(payload.text.trim())
                .filter(|token| !token.is_empty())
            {
                if token == "/" || token == "|" {
                    output.push(' ');
                    continue;
                }
                if let Some(ch) = char_for_nato_word(token) {
                    output.push(ch);
                } else {
                    return Err(format!("invalid NATO token: {token}"));
                }
            }
            Ok(output)
        }
        _ => Ok(payload
            .text
            .chars()
            .map(|ch| {
                if ch.is_whitespace() {
                    "/".to_string()
                } else if let Some(word) = nato_word_for_char(ch) {
                    word.to_string()
                } else {
                    ch.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join(" ")),
    }
}

pub(crate) fn capitalize_first(value: &str) -> String {
    let mut chars = value.chars();
    let first = chars.next();
    match first {
        Some(ch) => format!("{}{}", ch.to_uppercase(), chars.collect::<String>()),
        None => String::new(),
    }
}

pub(crate) fn is_vowel(ch: char) -> bool {
    matches!(ch.to_ascii_lowercase(), 'a' | 'e' | 'i' | 'o' | 'u')
}

pub(crate) fn pig_latin_encode_word(word: &str) -> String {
    if word.is_empty() {
        return String::new();
    }
    let is_capitalized = word.chars().next().map(|ch| ch.is_uppercase()).unwrap_or(false);
    let lower = word.to_lowercase();
    let chars = lower.chars().collect::<Vec<_>>();
    let mut split_index = 0usize;
    while split_index < chars.len() && !is_vowel(chars[split_index]) {
        split_index += 1;
    }

    let encoded = if split_index == 0 {
        format!("{lower}yay")
    } else if split_index >= chars.len() {
        format!("{lower}ay")
    } else {
        format!(
            "{}{}ay",
            chars[split_index..].iter().collect::<String>(),
            chars[..split_index].iter().collect::<String>()
        )
    };
    if is_capitalized {
        capitalize_first(&encoded)
    } else {
        encoded
    }
}

pub(crate) fn pig_latin_decode_word(word: &str) -> String {
    if word.len() < 2 {
        return word.to_string();
    }
    let is_capitalized = word.chars().next().map(|ch| ch.is_uppercase()).unwrap_or(false);
    let lower = word.to_lowercase();
    let decoded = if let Some(core) = lower.strip_suffix("yay") {
        core.to_string()
    } else if let Some(core) = lower.strip_suffix("ay") {
        let mut split_byte = core.len();
        for (index, ch) in core.char_indices().rev() {
            if is_vowel(ch) {
                break;
            }
            split_byte = index;
        }
        format!("{}{}", &core[split_byte..], &core[..split_byte])
    } else {
        lower
    };
    if is_capitalized {
        capitalize_first(&decoded)
    } else {
        decoded
    }
}

pub(crate) fn run_pig_latin_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<ModeTextInput>(input)
            .map_err(|error| format!("invalid pig latin input JSON: {error}"))?
    } else {
        ModeTextInput {
            text: input.to_string(),
            mode: Some("encode".to_string()),
        }
    };

    let word_regex = Regex::new(r"^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$")
        .expect("valid pig latin token regex");
    let decode_mode = payload
        .mode
        .unwrap_or_else(|| "encode".to_string())
        .eq_ignore_ascii_case("decode");
    Ok(payload
        .text
        .split_whitespace()
        .map(|token| {
            if let Some(caps) = word_regex.captures(token) {
                let prefix = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let core = caps.get(2).map(|m| m.as_str()).unwrap_or("");
                let suffix = caps.get(3).map(|m| m.as_str()).unwrap_or("");
                let converted = if decode_mode {
                    pig_latin_decode_word(core)
                } else {
                    pig_latin_encode_word(core)
                };
                format!("{prefix}{converted}{suffix}")
            } else {
                token.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" "))
}

const WINGDINGS_SYMBOLS: [char; 26] = [
    '✌', '☝', '✍', '☞', '☜', '☟', '☺', '☹', '☠', '⚐', '✈', '✉', '☼', '❄', '✞', '☯', '☪',
    '☮', '☢', '♈', '♉', '♊', '♋', '♌', '♍', '♎',
];

pub(crate) fn wingdings_symbol_for_char(ch: char) -> Option<char> {
    if ch.is_ascii_alphabetic() {
        let index = ch.to_ascii_uppercase() as usize - 'A' as usize;
        return Some(WINGDINGS_SYMBOLS[index]);
    }
    None
}

pub(crate) fn char_for_wingdings_symbol(symbol: char) -> Option<char> {
    WINGDINGS_SYMBOLS
        .iter()
        .position(|entry| *entry == symbol)
        .map(|index| (b'A' + index as u8) as char)
}

pub(crate) fn run_wingdings_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<ModeTextInput>(input)
            .map_err(|error| format!("invalid wingdings input JSON: {error}"))?
    } else {
        ModeTextInput {
            text: input.to_string(),
            mode: Some("encode".to_string()),
        }
    };

    match payload
        .mode
        .unwrap_or_else(|| "encode".to_string())
        .to_lowercase()
        .as_str()
    {
        "decode" => Ok(payload
            .text
            .chars()
            .map(|ch| char_for_wingdings_symbol(ch).unwrap_or(ch))
            .collect::<String>()),
        _ => Ok(payload
            .text
            .chars()
            .map(|ch| wingdings_symbol_for_char(ch).unwrap_or(ch))
            .collect::<String>()),
    }
}

pub(crate) fn phonetic_name_for_char(ch: char) -> Option<&'static str> {
    match ch.to_ascii_uppercase() {
        'A' => Some("AY"),
        'B' => Some("BEE"),
        'C' => Some("SEE"),
        'D' => Some("DEE"),
        'E' => Some("EE"),
        'F' => Some("EF"),
        'G' => Some("JEE"),
        'H' => Some("AITCH"),
        'I' => Some("EYE"),
        'J' => Some("JAY"),
        'K' => Some("KAY"),
        'L' => Some("EL"),
        'M' => Some("EM"),
        'N' => Some("EN"),
        'O' => Some("OH"),
        'P' => Some("PEE"),
        'Q' => Some("CUE"),
        'R' => Some("AR"),
        'S' => Some("ESS"),
        'T' => Some("TEE"),
        'U' => Some("YOU"),
        'V' => Some("VEE"),
        'W' => Some("DOUBLE-U"),
        'X' => Some("EX"),
        'Y' => Some("WHY"),
        'Z' => Some("ZEE"),
        '0' => Some("ZERO"),
        '1' => Some("ONE"),
        '2' => Some("TWO"),
        '3' => Some("THREE"),
        '4' => Some("FOUR"),
        '5' => Some("FIVE"),
        '6' => Some("SIX"),
        '7' => Some("SEVEN"),
        '8' => Some("EIGHT"),
        '9' => Some("NINE"),
        _ => None,
    }
}

pub(crate) fn char_for_phonetic_name(token: &str) -> Option<char> {
    match token.to_ascii_uppercase().as_str() {
        "AY" => Some('A'),
        "BEE" => Some('B'),
        "SEE" => Some('C'),
        "DEE" => Some('D'),
        "EE" => Some('E'),
        "EF" => Some('F'),
        "JEE" => Some('G'),
        "AITCH" => Some('H'),
        "EYE" => Some('I'),
        "JAY" => Some('J'),
        "KAY" => Some('K'),
        "EL" => Some('L'),
        "EM" => Some('M'),
        "EN" => Some('N'),
        "OH" => Some('O'),
        "PEE" => Some('P'),
        "CUE" => Some('Q'),
        "AR" => Some('R'),
        "ESS" => Some('S'),
        "TEE" => Some('T'),
        "YOU" => Some('U'),
        "VEE" => Some('V'),
        "DOUBLE-U" | "DOUBLEU" => Some('W'),
        "EX" => Some('X'),
        "WHY" => Some('Y'),
        "ZEE" | "ZED" => Some('Z'),
        "ZERO" => Some('0'),
        "ONE" => Some('1'),
        "TWO" => Some('2'),
        "THREE" => Some('3'),
        "FOUR" => Some('4'),
        "FIVE" => Some('5'),
        "SIX" => Some('6'),
        "SEVEN" => Some('7'),
        "EIGHT" => Some('8'),
        "NINE" => Some('9'),
        _ => None,
    }
}

pub(crate) fn run_phonetic_spelling_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<ModeTextInput>(input)
            .map_err(|error| format!("invalid phonetic spelling input JSON: {error}"))?
    } else {
        ModeTextInput {
            text: input.to_string(),
            mode: Some("encode".to_string()),
        }
    };

    match payload
        .mode
        .unwrap_or_else(|| "encode".to_string())
        .to_lowercase()
        .as_str()
    {
        "decode" => {
            let mut output = String::new();
            for token in Regex::new(r"[,\s]+")
                .expect("valid phonetic decode split regex")
                .split(payload.text.trim())
                .filter(|token| !token.is_empty())
            {
                if token == "/" || token == "|" {
                    output.push(' ');
                    continue;
                }
                if let Some(ch) = char_for_phonetic_name(token) {
                    output.push(ch);
                } else {
                    return Err(format!("invalid phonetic token: {token}"));
                }
            }
            Ok(output)
        }
        _ => Ok(payload
            .text
            .chars()
            .map(|ch| {
                if ch.is_whitespace() {
                    "/".to_string()
                } else if let Some(name) = phonetic_name_for_char(ch) {
                    name.to_string()
                } else {
                    ch.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join(" ")),
    }
}

