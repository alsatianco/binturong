use base64::Engine;
use chrono::{TimeZone, Utc};
use md5::Md5;
use qrcode::render::svg;
use qrcode::QrCode;
use rand::seq::SliceRandom;
use rand::Rng;
use resvg::{tiny_skia, usvg};
use serde::Deserialize;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use sha3::Keccak256;
use ulid::Ulid;
use uuid::Uuid;

use super::analyzers::parse_datetime_to_utc;
use super::image_tools::normalize_image_base64_payload;

pub(crate) fn generate_uuid_ulid_values() -> String {
    let uuid = Uuid::new_v4();
    let ulid = Ulid::new();
    serde_json::json!({
        "uuidV4": uuid.to_string(),
        "ulid": ulid.to_string(),
    })
    .to_string()
}

pub(crate) fn decode_uuid_or_ulid(input: &str) -> Result<String, String> {
    if let Ok(uuid) = Uuid::parse_str(input.trim()) {
        let bytes_hex = uuid
            .as_bytes()
            .iter()
            .map(|byte| format!("{byte:02X}"))
            .collect::<Vec<_>>()
            .join("");
        let output = serde_json::json!({
            "type": "uuid",
            "value": uuid.to_string(),
            "version": uuid.get_version_num(),
            "variant": format!("{:?}", uuid.get_variant()),
            "simple": uuid.simple().to_string(),
            "bytesHex": bytes_hex,
        });
        return serde_json::to_string_pretty(&output)
            .map_err(|error| format!("failed to serialize UUID output: {error}"));
    }

    if let Ok(ulid) = Ulid::from_string(input.trim()) {
        let timestamp_ms = ulid.timestamp_ms() as i64;
        let datetime = Utc
            .timestamp_millis_opt(timestamp_ms)
            .single()
            .ok_or_else(|| "ULID timestamp is out of range".to_string())?;
        let output = serde_json::json!({
            "type": "ulid",
            "value": ulid.to_string(),
            "timestampMs": timestamp_ms,
            "timestampIsoUtc": datetime.to_rfc3339(),
        });
        return serde_json::to_string_pretty(&output)
            .map_err(|error| format!("failed to serialize ULID output: {error}"));
    }

    Err("input is neither a valid UUID nor ULID".to_string())
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RandomStringInput {
    length: Option<usize>,
    count: Option<usize>,
    charset: Option<String>,
    custom_charset: Option<String>,
}

pub(crate) fn resolve_charset(payload: &RandomStringInput) -> Result<Vec<char>, String> {
    if let Some(custom) = payload.custom_charset.as_ref().filter(|value| !value.is_empty()) {
        return Ok(custom.chars().collect::<Vec<_>>());
    }

    let charset = payload
        .charset
        .as_deref()
        .unwrap_or("alphanumeric")
        .trim()
        .to_lowercase();
    let resolved = match charset.as_str() {
        "alpha" | "letters" => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "numeric" | "numbers" => "0123456789",
        "hex" => "0123456789abcdef",
        "symbols" => "!@#$%^&*()-_=+[]{};:,.<>/?",
        _ => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    };
    Ok(resolved.chars().collect::<Vec<_>>())
}

pub(crate) fn generate_random_string(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        RandomStringInput {
            length: Some(16),
            count: Some(1),
            charset: Some("alphanumeric".to_string()),
            custom_charset: None,
        }
    } else {
        serde_json::from_str::<RandomStringInput>(input)
            .map_err(|error| format!("invalid random string input JSON: {error}"))?
    };

    let length = payload.length.unwrap_or(16).clamp(1, 512);
    let count = payload.count.unwrap_or(1).clamp(1, 100);
    let charset = resolve_charset(&payload)?;
    if charset.is_empty() {
        return Err("character set cannot be empty".to_string());
    }

    let mut rng = rand::thread_rng();
    let mut generated = Vec::with_capacity(count);
    for _ in 0..count {
        let mut value = String::with_capacity(length);
        for _ in 0..length {
            let index = rng.gen_range(0..charset.len());
            value.push(charset[index]);
        }
        generated.push(value);
    }

    Ok(generated.join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PasswordInput {
    length: Option<usize>,
    count: Option<usize>,
    include_lowercase: Option<bool>,
    include_uppercase: Option<bool>,
    include_numbers: Option<bool>,
    include_symbols: Option<bool>,
}

pub(crate) fn generate_password(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        PasswordInput {
            length: Some(20),
            count: Some(1),
            include_lowercase: Some(true),
            include_uppercase: Some(true),
            include_numbers: Some(true),
            include_symbols: Some(true),
        }
    } else {
        serde_json::from_str::<PasswordInput>(input)
            .map_err(|error| format!("invalid password generator input JSON: {error}"))?
    };

    let length = payload.length.unwrap_or(20).clamp(4, 256);
    let count = payload.count.unwrap_or(1).clamp(1, 50);
    let include_lowercase = payload.include_lowercase.unwrap_or(true);
    let include_uppercase = payload.include_uppercase.unwrap_or(true);
    let include_numbers = payload.include_numbers.unwrap_or(true);
    let include_symbols = payload.include_symbols.unwrap_or(true);

    let mut categories: Vec<Vec<char>> = Vec::new();
    if include_lowercase {
        categories.push("abcdefghijklmnopqrstuvwxyz".chars().collect());
    }
    if include_uppercase {
        categories.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ".chars().collect());
    }
    if include_numbers {
        categories.push("0123456789".chars().collect());
    }
    if include_symbols {
        categories.push("!@#$%^&*()-_=+[]{};:,.<>/?".chars().collect());
    }
    if categories.is_empty() {
        return Err("at least one character class must be enabled".to_string());
    }

    let pool = categories
        .iter()
        .flat_map(|bucket| bucket.iter().copied())
        .collect::<Vec<_>>();
    let mut rng = rand::thread_rng();
    let mut outputs = Vec::with_capacity(count);
    for _ in 0..count {
        let mut password = Vec::with_capacity(length);
        for category in &categories {
            let index = rng.gen_range(0..category.len());
            password.push(category[index]);
        }
        while password.len() < length {
            let index = rng.gen_range(0..pool.len());
            password.push(pool[index]);
        }
        password.shuffle(&mut rng);
        outputs.push(password.into_iter().collect::<String>());
    }

    Ok(outputs.join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LoremInput {
    mode: Option<String>,
    count: Option<usize>,
}

pub(crate) fn lorem_words_source() -> &'static [&'static str] {
    &[
        "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
        "integer", "porta", "metus", "quis", "nibh", "efficitur", "euismod", "proin",
        "facilisis", "massa", "vitae", "ultrices", "dictum", "phasellus", "rhoncus", "urna",
        "vel", "augue", "tincidunt", "interdum", "morbi", "ornare", "sapien", "at", "erat",
        "iaculis", "sagittis", "nullam", "gravida", "lectus", "nec", "hendrerit", "vulputate",
    ]
}

pub(crate) fn generate_lorem_ipsum(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        LoremInput {
            mode: Some("paragraphs".to_string()),
            count: Some(2),
        }
    } else {
        serde_json::from_str::<LoremInput>(input)
            .map_err(|error| format!("invalid lorem generator input JSON: {error}"))?
    };

    let mode = payload.mode.unwrap_or_else(|| "paragraphs".to_string()).to_lowercase();
    let count = payload.count.unwrap_or(2).clamp(1, 100);
    let words = lorem_words_source();
    let mut rng = rand::thread_rng();

    match mode.as_str() {
        "words" => {
            let mut output = Vec::with_capacity(count);
            for _ in 0..count {
                let index = rng.gen_range(0..words.len());
                output.push(words[index].to_string());
            }
            Ok(output.join(" "))
        }
        "sentences" => {
            let mut sentences = Vec::with_capacity(count);
            for _ in 0..count {
                let sentence_length = rng.gen_range(8..=16);
                let mut sentence_words = Vec::with_capacity(sentence_length);
                for _ in 0..sentence_length {
                    let index = rng.gen_range(0..words.len());
                    sentence_words.push(words[index].to_string());
                }
                if let Some(first) = sentence_words.first_mut() {
                    let mut chars = first.chars();
                    if let Some(ch) = chars.next() {
                        *first = format!("{}{}", ch.to_uppercase(), chars.collect::<String>());
                    }
                }
                sentences.push(format!("{}.", sentence_words.join(" ")));
            }
            Ok(sentences.join(" "))
        }
        _ => {
            let mut paragraphs = Vec::with_capacity(count);
            for _ in 0..count {
                let sentence_count = rng.gen_range(3..=5);
                let paragraph_input = serde_json::json!({
                    "mode": "sentences",
                    "count": sentence_count,
                });
                let paragraph = generate_lorem_ipsum(&paragraph_input.to_string())?;
                paragraphs.push(paragraph);
            }
            Ok(paragraphs.join("\n\n"))
        }
    }
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RandomNumberInput {
    min: Option<f64>,
    max: Option<f64>,
    count: Option<usize>,
    integer: Option<bool>,
    unique: Option<bool>,
}

pub(crate) fn generate_random_number(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        RandomNumberInput {
            min: Some(0.0),
            max: Some(100.0),
            count: Some(1),
            integer: Some(true),
            unique: Some(false),
        }
    } else {
        serde_json::from_str::<RandomNumberInput>(input)
            .map_err(|error| format!("invalid random number input JSON: {error}"))?
    };

    let min = payload.min.unwrap_or(0.0);
    let max = payload.max.unwrap_or(100.0);
    if !min.is_finite() || !max.is_finite() {
        return Err("min and max must be finite numbers".to_string());
    }
    if max < min {
        return Err("max must be greater than or equal to min".to_string());
    }

    let count = payload.count.unwrap_or(1).clamp(1, 500);
    let integer = payload.integer.unwrap_or(true);
    let unique = payload.unique.unwrap_or(false);
    let mut rng = rand::thread_rng();

    if integer {
        let min_int = min.ceil() as i64;
        let max_int = max.floor() as i64;
        if max_int < min_int {
            return Err("integer range is empty after rounding min/max".to_string());
        }

        if unique {
            let range_size = (max_int - min_int + 1) as usize;
            if count > range_size {
                return Err("count exceeds unique values available in range".to_string());
            }
            let mut values = (min_int..=max_int).collect::<Vec<_>>();
            values.shuffle(&mut rng);
            return Ok(values
                .into_iter()
                .take(count)
                .map(|value| value.to_string())
                .collect::<Vec<_>>()
                .join("\n"));
        }

        return Ok((0..count)
            .map(|_| rng.gen_range(min_int..=max_int).to_string())
            .collect::<Vec<_>>()
            .join("\n"));
    }

    Ok((0..count)
        .map(|_| {
            let value = rng.gen_range(min..=max);
            format!("{value:.6}")
        })
        .collect::<Vec<_>>()
        .join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RandomLetterInput {
    count: Option<usize>,
    uppercase: Option<bool>,
    lowercase: Option<bool>,
}

pub(crate) fn generate_random_letter(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        RandomLetterInput {
            count: Some(1),
            uppercase: Some(true),
            lowercase: Some(true),
        }
    } else {
        serde_json::from_str::<RandomLetterInput>(input)
            .map_err(|error| format!("invalid random letter input JSON: {error}"))?
    };

    let count = payload.count.unwrap_or(1).clamp(1, 500);
    let uppercase = payload.uppercase.unwrap_or(true);
    let lowercase = payload.lowercase.unwrap_or(true);

    let mut pool = Vec::new();
    if uppercase {
        pool.extend("ABCDEFGHIJKLMNOPQRSTUVWXYZ".chars());
    }
    if lowercase {
        pool.extend("abcdefghijklmnopqrstuvwxyz".chars());
    }
    if pool.is_empty() {
        return Err("at least one of uppercase/lowercase must be enabled".to_string());
    }

    let mut rng = rand::thread_rng();
    Ok((0..count)
        .map(|_| {
            let index = rng.gen_range(0..pool.len());
            pool[index].to_string()
        })
        .collect::<Vec<_>>()
        .join(""))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RandomDateInput {
    start: Option<String>,
    end: Option<String>,
    count: Option<usize>,
    format: Option<String>,
}

pub(crate) fn generate_random_date(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        RandomDateInput {
            start: Some("2020-01-01".to_string()),
            end: Some("2030-12-31".to_string()),
            count: Some(1),
            format: Some("%Y-%m-%d".to_string()),
        }
    } else {
        serde_json::from_str::<RandomDateInput>(input)
            .map_err(|error| format!("invalid random date input JSON: {error}"))?
    };

    let start = parse_datetime_to_utc(payload.start.as_deref().unwrap_or("2020-01-01"))?;
    let end = parse_datetime_to_utc(payload.end.as_deref().unwrap_or("2030-12-31"))?;
    if end < start {
        return Err("end date must be after start date".to_string());
    }

    let count = payload.count.unwrap_or(1).clamp(1, 200);
    let format = payload
        .format
        .as_deref()
        .unwrap_or("%Y-%m-%d");
    let start_seconds = start.timestamp();
    let end_seconds = end.timestamp();
    let mut rng = rand::thread_rng();

    Ok((0..count)
        .map(|_| {
            let seconds = rng.gen_range(start_seconds..=end_seconds);
            Utc.timestamp_opt(seconds, 0)
                .single()
                .map(|datetime| datetime.format(format).to_string())
                .unwrap_or_else(|| "invalid datetime".to_string())
        })
        .collect::<Vec<_>>()
        .join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RandomMonthInput {
    count: Option<usize>,
    output: Option<String>,
}

pub(crate) fn generate_random_month(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        RandomMonthInput {
            count: Some(1),
            output: Some("name".to_string()),
        }
    } else {
        serde_json::from_str::<RandomMonthInput>(input)
            .map_err(|error| format!("invalid random month input JSON: {error}"))?
    };

    let count = payload.count.unwrap_or(1).clamp(1, 200);
    let output_mode = payload.output.unwrap_or_else(|| "name".to_string()).to_lowercase();
    let months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    let mut rng = rand::thread_rng();

    Ok((0..count)
        .map(|_| {
            let month = rng.gen_range(1..=12);
            if output_mode == "number" {
                month.to_string()
            } else {
                months[month - 1].to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RandomIpInput {
    count: Option<usize>,
    version: Option<String>,
}

pub(crate) fn generate_random_ip(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        RandomIpInput {
            count: Some(1),
            version: Some("both".to_string()),
        }
    } else {
        serde_json::from_str::<RandomIpInput>(input)
            .map_err(|error| format!("invalid random IP input JSON: {error}"))?
    };

    let count = payload.count.unwrap_or(1).clamp(1, 200);
    let version = payload.version.unwrap_or_else(|| "both".to_string()).to_lowercase();
    let mut rng = rand::thread_rng();

    let output = (0..count)
        .map(|_| {
            let pick_ipv4 = match version.as_str() {
                "ipv4" => true,
                "ipv6" => false,
                _ => rng.gen_bool(0.5),
            };
            if pick_ipv4 {
                format!(
                    "{}.{}.{}.{}",
                    rng.gen_range(0..=255),
                    rng.gen_range(0..=255),
                    rng.gen_range(0..=255),
                    rng.gen_range(0..=255)
                )
            } else {
                (0..8)
                    .map(|_| format!("{:x}", rng.gen_range(0..=0xFFFF)))
                    .collect::<Vec<_>>()
                    .join(":")
            }
        })
        .collect::<Vec<_>>();
    Ok(output.join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RandomChoiceInput {
    items: Option<Vec<String>>,
    count: Option<usize>,
    unique: Option<bool>,
}

pub(crate) fn generate_random_choice(input: &str) -> Result<String, String> {
    let payload = if input.trim().is_empty() {
        RandomChoiceInput {
            items: Some(vec!["alpha".to_string(), "beta".to_string(), "gamma".to_string()]),
            count: Some(1),
            unique: Some(false),
        }
    } else if input.trim_start().starts_with('{') {
        serde_json::from_str::<RandomChoiceInput>(input)
            .map_err(|error| format!("invalid random choice input JSON: {error}"))?
    } else {
        let items = input
            .lines()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>();
        RandomChoiceInput {
            items: Some(items),
            count: Some(1),
            unique: Some(false),
        }
    };

    let mut items = payload.items.unwrap_or_default();
    if items.is_empty() {
        return Err("items cannot be empty".to_string());
    }
    let count = payload.count.unwrap_or(1).clamp(1, 200);
    let unique = payload.unique.unwrap_or(false);
    let mut rng = rand::thread_rng();

    if unique {
        if count > items.len() {
            return Err("count exceeds number of available unique choices".to_string());
        }
        items.shuffle(&mut rng);
        return Ok(items.into_iter().take(count).collect::<Vec<_>>().join("\n"));
    }

    Ok((0..count)
        .map(|_| {
            let index = rng.gen_range(0..items.len());
            items[index].clone()
        })
        .collect::<Vec<_>>()
        .join("\n"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HashInput {
    algorithm: Option<String>,
    text: Option<String>,
    file_base64: Option<String>,
}

pub(crate) fn hash_bytes(algorithm: &str, bytes: &[u8]) -> Result<String, String> {
    let normalized = algorithm.trim().to_lowercase();
    let hash_hex = match normalized.as_str() {
        "md5" => format!("{:x}", Md5::digest(bytes)),
        "sha1" | "sha-1" => format!("{:x}", Sha1::digest(bytes)),
        "sha256" | "sha-256" => format!("{:x}", Sha256::digest(bytes)),
        "sha512" | "sha-512" => format!("{:x}", Sha512::digest(bytes)),
        "keccak256" | "keccak-256" => format!("{:x}", Keccak256::digest(bytes)),
        _ => {
            return Err(
                "unsupported hash algorithm (use md5, sha1, sha256, sha512, or keccak256)"
                    .to_string(),
            )
        }
    };
    Ok(hash_hex)
}

/// Compute all supported hash digests for the given bytes.
pub(crate) fn hash_all_algorithms(bytes: &[u8]) -> serde_json::Value {
    serde_json::json!({
        "bytes": bytes.len(),
        "hashes": [
            { "algorithm": "MD5",        "length": 16, "hash": format!("{:x}", Md5::digest(bytes)) },
            { "algorithm": "SHA-1",      "length": 20, "hash": format!("{:x}", Sha1::digest(bytes)) },
            { "algorithm": "SHA-256",    "length": 32, "hash": format!("{:x}", Sha256::digest(bytes)) },
            { "algorithm": "SHA-512",    "length": 64, "hash": format!("{:x}", Sha512::digest(bytes)) },
            { "algorithm": "Keccak-256", "length": 32, "hash": format!("{:x}", Keccak256::digest(bytes)) },
        ]
    })
}

pub(crate) fn run_hash_generator(input: &str) -> Result<String, String> {
    // File input: FILE_BASE64:... prefix
    if let Some(file_payload) = input.strip_prefix("FILE_BASE64:") {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(file_payload.trim())
            .map_err(|error| format!("invalid file base64 payload: {error}"))?;
        let output = hash_all_algorithms(&bytes);
        return serde_json::to_string_pretty(&output)
            .map_err(|error| format!("failed to serialize hash output: {error}"));
    }

    // JSON input with optional algorithm or file_base64 fields
    if input.trim_start().starts_with('{') {
        let payload: HashInput =
            serde_json::from_str(input).map_err(|error| format!("invalid hash input JSON: {error}"))?;
        let bytes = if let Some(file_base64) = payload.file_base64 {
            base64::engine::general_purpose::STANDARD
                .decode(file_base64.trim())
                .map_err(|error| format!("invalid fileBase64 payload: {error}"))?
        } else {
            payload.text.unwrap_or_default().into_bytes()
        };

        // If a specific algorithm was requested, return single hash (CLI backwards compat)
        if let Some(algorithm) = payload.algorithm {
            let hash = hash_bytes(&algorithm, &bytes)?;
            let output = serde_json::json!({
                "algorithm": algorithm.to_lowercase(),
                "inputType": "text",
                "bytes": bytes.len(),
                "hash": hash,
            });
            return serde_json::to_string_pretty(&output)
                .map_err(|error| format!("failed to serialize hash output: {error}"));
        }

        let output = hash_all_algorithms(&bytes);
        return serde_json::to_string_pretty(&output)
            .map_err(|error| format!("failed to serialize hash output: {error}"));
    }

    // Plain text input: default to sha256 for CLI compatibility.
    let hash = hash_bytes("sha256", input.as_bytes())?;
    let output = serde_json::json!({
        "algorithm": "sha256",
        "inputType": "text",
        "bytes": input.as_bytes().len(),
        "hash": hash,
    });
    serde_json::to_string_pretty(&output)
        .map_err(|error| format!("failed to serialize hash output: {error}"))
}


pub(crate) fn generate_qr_svg(input: &str) -> Result<String, String> {
    let code = QrCode::new(input.as_bytes())
        .map_err(|error| format!("failed to generate QR code: {error}"))?;
    Ok(code
        .render::<svg::Color>()
        .min_dimensions(256, 256)
        .build())
}

pub(crate) fn decode_qr_content(input: &str) -> Result<String, String> {
    let (mime, encoded) = normalize_image_base64_payload(input)?;
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| format!("invalid QR image payload: {error}"))?;
    let dynamic_image = if mime.to_ascii_lowercase().contains("svg") {
        let svg_text = String::from_utf8(image_bytes)
            .map_err(|error| format!("invalid SVG QR payload UTF-8: {error}"))?;
        let options = usvg::Options::default();
        let tree = usvg::Tree::from_str(&svg_text, &options)
            .map_err(|error| format!("failed to parse SVG QR input: {error}"))?;
        let source_size = tree.size().to_int_size();
        let mut pixmap = tiny_skia::Pixmap::new(source_size.width(), source_size.height())
            .ok_or_else(|| "failed to allocate QR SVG rasterization surface".to_string())?;
        resvg::render(&tree, tiny_skia::Transform::identity(), &mut pixmap.as_mut());
        let rasterized_png = pixmap
            .encode_png()
            .map_err(|error| format!("failed to encode rasterized SVG: {error}"))?;
        image::load_from_memory(&rasterized_png)
            .map_err(|error| format!("failed to decode rasterized SVG bytes: {error}"))?
    } else {
        image::load_from_memory(&image_bytes)
            .map_err(|error| format!("failed to decode image bytes: {error}"))?
    };
    let grayscale = dynamic_image.to_luma8();
    let mut prepared = rqrr::PreparedImage::prepare(grayscale);
    let grids = prepared.detect_grids();
    for grid in grids {
        if let Ok((_, content)) = grid.decode() {
            return Ok(content);
        }
    }
    Err("no QR code detected in image".to_string())
}
