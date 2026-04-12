use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use base64::Engine;
use rand::RngCore;
use regex::Regex;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

use super::converters::decode_query_component;

pub(crate) fn stringify_json_text(input: &str) -> Result<String, String> {
    serde_json::to_string(input).map_err(|error| format!("failed to stringify text: {error}"))
}

pub(crate) fn unstringify_json_text(input: &str) -> Result<String, String> {
    serde_json::from_str::<String>(input)
        .map_err(|error| format!("failed to unstringify JSON text: {error}"))
}


pub(crate) fn url_encode(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.as_bytes() {
        let ch = *byte as char;
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~') {
            encoded.push(ch);
        } else {
            encoded.push_str(&format!("%{:02X}", byte));
        }
    }
    encoded
}

pub(crate) fn url_decode(input: &str) -> String {
    decode_query_component(input)
}

pub(crate) fn html_entity_encode(input: &str) -> String {
    let mut encoded = String::new();
    for ch in input.chars() {
        match ch {
            '&' => encoded.push_str("&amp;"),
            '<' => encoded.push_str("&lt;"),
            '>' => encoded.push_str("&gt;"),
            '"' => encoded.push_str("&quot;"),
            '\'' => encoded.push_str("&#39;"),
            _ => encoded.push(ch),
        }
    }
    encoded
}

pub(crate) fn html_entity_decode(input: &str) -> String {
    let mut decoded = input
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&");

    static NUMERIC_ENTITY_RE: OnceLock<Regex> = OnceLock::new();
    let numeric_re = NUMERIC_ENTITY_RE.get_or_init(|| Regex::new(r"&#(\d+);").expect("valid numeric html entity regex"));
    decoded = numeric_re
        .replace_all(&decoded, |captures: &regex::Captures| {
            let numeric = captures
                .get(1)
                .map(|value| value.as_str())
                .unwrap_or_default();
            let code_point = numeric.parse::<u32>().ok();
            code_point
                .and_then(char::from_u32)
                .map(|value| value.to_string())
                .unwrap_or_else(|| captures.get(0).map(|value| value.as_str()).unwrap_or_default().to_string())
        })
        .to_string();

    decoded
}

pub(crate) fn base64_encode_text(input: &str) -> String {
    base64::engine::general_purpose::STANDARD.encode(input.as_bytes())
}

pub(crate) fn base64_decode_text(input: &str) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(input.trim())
        .map_err(|error| format!("invalid Base64 input: {error}"))?;
    String::from_utf8(bytes).map_err(|error| format!("decoded bytes are not valid UTF-8: {error}"))
}

pub(crate) fn escape_backslashes(input: &str) -> String {
    let mut escaped = String::new();
    for ch in input.chars() {
        match ch {
            '\\' => escaped.push_str("\\\\"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            '"' => escaped.push_str("\\\""),
            '\'' => escaped.push_str("\\'"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

pub(crate) fn unescape_backslashes(input: &str) -> Result<String, String> {
    let chars: Vec<char> = input.chars().collect();
    let mut index = 0usize;
    let mut output = String::new();

    while index < chars.len() {
        let current = chars[index];
        if current != '\\' {
            output.push(current);
            index += 1;
            continue;
        }

        if index + 1 >= chars.len() {
            return Err("input ends with an incomplete escape sequence".to_string());
        }

        let next = chars[index + 1];
        match next {
            'n' => output.push('\n'),
            'r' => output.push('\r'),
            't' => output.push('\t'),
            '\\' => output.push('\\'),
            '"' => output.push('"'),
            '\'' => output.push('\''),
            '`' => output.push('`'),
            'u' => {
                if index + 5 >= chars.len() {
                    return Err("unicode escape must include exactly four hex digits".to_string());
                }
                let hex = chars[index + 2..index + 6].iter().collect::<String>();
                let code_point = u32::from_str_radix(&hex, 16)
                    .map_err(|error| format!("invalid unicode escape \\u{hex}: {error}"))?;
                let character = char::from_u32(code_point)
                    .ok_or_else(|| format!("invalid unicode scalar value: {hex}"))?;
                output.push(character);
                index += 6;
                continue;
            }
            other => return Err(format!("unsupported escape sequence: \\{other}")),
        }
        index += 2;
    }

    Ok(output)
}

pub(crate) fn quote_text(input: &str) -> String {
    let escaped = input.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

pub(crate) fn unquote_text(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.len() < 2 {
        return Ok(trimmed.to_string());
    }

    let first = trimmed.chars().next().unwrap_or_default();
    let last = trimmed.chars().last().unwrap_or_default();
    if first != last || !matches!(first, '"' | '\'' | '`') {
        return Ok(trimmed.to_string());
    }

    let inner = &trimmed[1..trimmed.len() - 1];
    unescape_backslashes(inner)
}

pub(crate) fn encode_utf8_bytes(input: &str) -> String {
    input
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn decode_utf8_bytes(input: &str) -> Result<String, String> {
    let normalized = input
        .replace(',', " ")
        .replace("0x", "")
        .replace("0X", "")
        .trim()
        .to_string();

    if normalized.is_empty() {
        return Err("UTF-8 byte input cannot be empty".to_string());
    }

    let hex_chunks = if normalized.contains(char::is_whitespace) {
        normalized
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>()
    } else {
        let compact = normalized.chars().filter(|ch| !ch.is_whitespace()).collect::<String>();
        if compact.len() % 2 != 0 {
            return Err("UTF-8 hex input must have an even number of characters".to_string());
        }
        (0..compact.len())
            .step_by(2)
            .map(|index| compact[index..index + 2].to_string())
            .collect::<Vec<_>>()
    };

    let mut bytes = Vec::with_capacity(hex_chunks.len());
    for chunk in hex_chunks {
        let value = u8::from_str_radix(chunk.trim(), 16)
            .map_err(|error| format!("invalid UTF-8 byte '{chunk}': {error}"))?;
        bytes.push(value);
    }

    String::from_utf8(bytes).map_err(|error| format!("decoded bytes are not valid UTF-8: {error}"))
}

pub(crate) fn encode_binary_text(input: &str) -> String {
    input
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:08b}"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn decode_binary_text(input: &str) -> Result<String, String> {
    let normalized = input.trim();
    if normalized.is_empty() {
        return Err("binary input cannot be empty".to_string());
    }

    let chunks = if normalized.contains(char::is_whitespace) {
        normalized
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>()
    } else {
        if normalized.len() % 8 != 0 {
            return Err("binary input length must be a multiple of 8 bits".to_string());
        }
        (0..normalized.len())
            .step_by(8)
            .map(|index| normalized[index..index + 8].to_string())
            .collect::<Vec<_>>()
    };

    let mut bytes = Vec::with_capacity(chunks.len());
    for chunk in chunks {
        if !chunk.chars().all(|ch| matches!(ch, '0' | '1')) {
            return Err(format!("binary chunk contains non-binary characters: {chunk}"));
        }
        if chunk.len() != 8 {
            return Err(format!("binary chunk must be exactly 8 bits: {chunk}"));
        }
        let value = u8::from_str_radix(&chunk, 2)
            .map_err(|error| format!("invalid binary chunk '{chunk}': {error}"))?;
        bytes.push(value);
    }

    String::from_utf8(bytes).map_err(|error| format!("binary bytes are not valid UTF-8: {error}"))
}

pub(crate) fn morse_char_to_code(ch: char) -> Option<&'static str> {
    match ch {
        'A' => Some(".-"),
        'B' => Some("-..."),
        'C' => Some("-.-."),
        'D' => Some("-.."),
        'E' => Some("."),
        'F' => Some("..-."),
        'G' => Some("--."),
        'H' => Some("...."),
        'I' => Some(".."),
        'J' => Some(".---"),
        'K' => Some("-.-"),
        'L' => Some(".-.."),
        'M' => Some("--"),
        'N' => Some("-."),
        'O' => Some("---"),
        'P' => Some(".--."),
        'Q' => Some("--.-"),
        'R' => Some(".-."),
        'S' => Some("..."),
        'T' => Some("-"),
        'U' => Some("..-"),
        'V' => Some("...-"),
        'W' => Some(".--"),
        'X' => Some("-..-"),
        'Y' => Some("-.--"),
        'Z' => Some("--.."),
        '0' => Some("-----"),
        '1' => Some(".----"),
        '2' => Some("..---"),
        '3' => Some("...--"),
        '4' => Some("....-"),
        '5' => Some("....."),
        '6' => Some("-...."),
        '7' => Some("--..."),
        '8' => Some("---.."),
        '9' => Some("----."),
        '.' => Some(".-.-.-"),
        ',' => Some("--..--"),
        '?' => Some("..--.."),
        '!' => Some("-.-.--"),
        '\'' => Some(".----."),
        '"' => Some(".-..-."),
        '/' => Some("-..-."),
        '(' => Some("-.--."),
        ')' => Some("-.--.-"),
        '&' => Some(".-..."),
        ':' => Some("---..."),
        ';' => Some("-.-.-."),
        '=' => Some("-...-"),
        '+' => Some(".-.-."),
        '-' => Some("-....-"),
        '_' => Some("..--.-"),
        '@' => Some(".--.-."),
        _ => None,
    }
}

pub(crate) fn morse_code_to_char(code: &str) -> Option<char> {
    match code {
        ".-" => Some('A'),
        "-..." => Some('B'),
        "-.-." => Some('C'),
        "-.." => Some('D'),
        "." => Some('E'),
        "..-." => Some('F'),
        "--." => Some('G'),
        "...." => Some('H'),
        ".." => Some('I'),
        ".---" => Some('J'),
        "-.-" => Some('K'),
        ".-.." => Some('L'),
        "--" => Some('M'),
        "-." => Some('N'),
        "---" => Some('O'),
        ".--." => Some('P'),
        "--.-" => Some('Q'),
        ".-." => Some('R'),
        "..." => Some('S'),
        "-" => Some('T'),
        "..-" => Some('U'),
        "...-" => Some('V'),
        ".--" => Some('W'),
        "-..-" => Some('X'),
        "-.--" => Some('Y'),
        "--.." => Some('Z'),
        "-----" => Some('0'),
        ".----" => Some('1'),
        "..---" => Some('2'),
        "...--" => Some('3'),
        "....-" => Some('4'),
        "....." => Some('5'),
        "-...." => Some('6'),
        "--..." => Some('7'),
        "---.." => Some('8'),
        "----." => Some('9'),
        ".-.-.-" => Some('.'),
        "--..--" => Some(','),
        "..--.." => Some('?'),
        "-.-.--" => Some('!'),
        ".----." => Some('\''),
        ".-..-." => Some('"'),
        "-..-." => Some('/'),
        "-.--." => Some('('),
        "-.--.-" => Some(')'),
        ".-..." => Some('&'),
        "---..." => Some(':'),
        "-.-.-." => Some(';'),
        "-...-" => Some('='),
        ".-.-." => Some('+'),
        "-....-" => Some('-'),
        "..--.-" => Some('_'),
        ".--.-." => Some('@'),
        _ => None,
    }
}

pub(crate) fn encode_morse_text(input: &str) -> Result<String, String> {
    let mut tokens = Vec::new();
    let mut previous_was_space = false;

    for ch in input.chars() {
        if ch.is_whitespace() {
            if !previous_was_space && !tokens.is_empty() {
                tokens.push("/".to_string());
            }
            previous_was_space = true;
            continue;
        }

        let code = morse_char_to_code(ch.to_ascii_uppercase())
            .ok_or_else(|| format!("unsupported Morse character: {ch}"))?;
        tokens.push(code.to_string());
        previous_was_space = false;
    }

    Ok(tokens.join(" "))
}

pub(crate) fn decode_morse_text(input: &str) -> Result<String, String> {
    let mut output = String::new();
    for token in input.split_whitespace() {
        if token == "/" {
            output.push(' ');
            continue;
        }
        let ch = morse_code_to_char(token)
            .ok_or_else(|| format!("invalid Morse token: {token}"))?;
        output.push(ch);
    }
    Ok(output)
}

pub(crate) fn apply_rot13(input: &str) -> String {
    input
        .chars()
        .map(|ch| match ch {
            'a'..='z' => (((ch as u8 - b'a' + 13) % 26) + b'a') as char,
            'A'..='Z' => (((ch as u8 - b'A' + 13) % 26) + b'A') as char,
            _ => ch,
        })
        .collect()
}

pub(crate) fn apply_caesar_cipher(input: &str, shift: i8) -> String {
    let normalized_shift = shift.rem_euclid(26) as u8;
    input
        .chars()
        .map(|ch| match ch {
            'a'..='z' => (((ch as u8 - b'a' + normalized_shift) % 26) + b'a') as char,
            'A'..='Z' => (((ch as u8 - b'A' + normalized_shift) % 26) + b'A') as char,
            _ => ch,
        })
        .collect()
}


#[derive(Deserialize)]
pub(crate) struct AesPayload {
    pub(crate) text: String,
    pub(crate) key: String,
}

/// Encrypt plaintext with AES-256-GCM.
///
/// Key derivation: SHA-256(passphrase) → 32-byte key.
/// Output: base64(nonce[12] || ciphertext+tag)
pub(crate) fn aes256_encrypt(plaintext: &str, passphrase: &str) -> Result<String, String> {
    let key_bytes = Sha256::digest(passphrase.as_bytes());
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| format!("failed to create cipher: {e}"))?;

    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| "encryption failed".to_string())?;

    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(base64::engine::general_purpose::STANDARD.encode(&combined))
}

/// Decrypt AES-256-GCM ciphertext.
///
/// Expects base64(nonce[12] || ciphertext+tag).
pub(crate) fn aes256_decrypt(encoded: &str, passphrase: &str) -> Result<String, String> {
    let combined = base64::engine::general_purpose::STANDARD
        .decode(encoded.trim())
        .map_err(|e| format!("invalid Base64 input: {e}"))?;

    if combined.len() < 13 {
        return Err("ciphertext is too short (must contain nonce + data)".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let key_bytes = Sha256::digest(passphrase.as_bytes());
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| format!("failed to create cipher: {e}"))?;

    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "decryption failed - wrong passphrase or corrupted data".to_string())?;

    String::from_utf8(plaintext)
        .map_err(|_| "decrypted data is not valid UTF-8".to_string())
}

