use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, ImageFormat, Rgb, RgbImage};
use regex::Regex;
use resvg::{tiny_skia, usvg};
use serde::Deserialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use std::time::Duration;

use super::unicode_styles::big_block_glyph;

pub(crate) fn detect_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.len() >= 8 && bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        return "image/png";
    }
    if bytes.len() >= 3 && bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return "image/jpeg";
    }
    if bytes.len() >= 6 && (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) {
        return "image/gif";
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "image/webp";
    }

    let trimmed_utf8 = String::from_utf8_lossy(bytes);
    if trimmed_utf8.trim_start().starts_with("<svg") || trimmed_utf8.contains("<svg") {
        return "image/svg+xml";
    }

    "image/png"
}

pub(crate) fn normalize_image_base64_payload(input: &str) -> Result<(String, String), String> {
    let trimmed = input.trim();
    if let Some(payload) = trimmed.strip_prefix("IMAGE_BASE64:") {
        if let Some((mime, encoded)) = payload.split_once(";base64,") {
            let normalized_mime = mime.trim();
            let normalized_encoded = encoded.trim();
            base64::engine::general_purpose::STANDARD
                .decode(normalized_encoded)
                .map_err(|error| format!("invalid image Base64 payload: {error}"))?;
            let mime = if normalized_mime.is_empty() {
                "image/png".to_string()
            } else {
                normalized_mime.to_string()
            };
            return Ok((mime, normalized_encoded.to_string()));
        }

        let encoded = payload.trim();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|error| format!("invalid image Base64 payload: {error}"))?;
        return Ok((detect_image_mime(&bytes).to_string(), encoded.to_string()));
    }

    if let Some(data_uri_payload) = trimmed.strip_prefix("data:") {
        let (metadata, encoded) = data_uri_payload
            .split_once(',')
            .ok_or_else(|| "invalid data URI format".to_string())?;
        if !metadata.to_lowercase().contains(";base64") {
            return Err("data URI must contain ';base64' payload".to_string());
        }
        let mime = metadata
            .split(';')
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("image/png")
            .to_string();
        let normalized_encoded = encoded.trim();
        base64::engine::general_purpose::STANDARD
            .decode(normalized_encoded)
            .map_err(|error| format!("invalid image Base64 payload: {error}"))?;
        return Ok((mime, normalized_encoded.to_string()));
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(trimmed)
        .map_err(|error| format!("invalid image Base64 payload: {error}"))?;
    Ok((detect_image_mime(&bytes).to_string(), trimmed.to_string()))
}

pub(crate) fn base64_encode_image_data_uri(input: &str) -> Result<String, String> {
    let (mime, encoded) = normalize_image_base64_payload(input)?;
    Ok(format!("data:{mime};base64,{encoded}"))
}

pub(crate) fn base64_decode_image_data_uri(input: &str) -> Result<String, String> {
    let (_, encoded) = normalize_image_base64_payload(input)?;
    Ok(encoded)
}


pub(crate) fn decode_image_payload_bytes(input: &str) -> Result<Vec<u8>, String> {
    let (_, encoded) = normalize_image_base64_payload(input)?;
    base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| format!("invalid image payload: {error}"))
}

pub(crate) fn encode_data_uri(bytes: &[u8], mime: &str) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:{mime};base64,{encoded}")
}

pub(crate) fn flatten_image_for_jpeg(image: &DynamicImage) -> RgbImage {
    let rgba = image.to_rgba8();
    let mut rgb = RgbImage::new(rgba.width(), rgba.height());
    for (x, y, pixel) in rgba.enumerate_pixels() {
        let alpha = pixel[3] as u16;
        let red = ((pixel[0] as u16 * alpha) + (255u16 * (255 - alpha))) / 255;
        let green = ((pixel[1] as u16 * alpha) + (255u16 * (255 - alpha))) / 255;
        let blue = ((pixel[2] as u16 * alpha) + (255u16 * (255 - alpha))) / 255;
        rgb.put_pixel(x, y, Rgb([red as u8, green as u8, blue as u8]));
    }
    rgb
}

pub(crate) fn encode_dynamic_image(image: &DynamicImage, format: ImageFormat) -> Result<Vec<u8>, String> {
    let mut cursor = Cursor::new(Vec::<u8>::new());
    image
        .write_to(&mut cursor, format)
        .map_err(|error| format!("failed to encode image: {error}"))?;
    Ok(cursor.into_inner())
}

pub(crate) fn encode_jpeg_image(image: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    let rgb = flatten_image_for_jpeg(image);
    let mut output = Vec::<u8>::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut output, quality);
    encoder
        .encode_image(&DynamicImage::ImageRgb8(rgb))
        .map_err(|error| format!("failed to encode JPEG: {error}"))?;
    Ok(output)
}

pub(crate) enum ImageOutputTarget {
    Png,
    Jpeg,
    WebP,
}

pub(crate) fn convert_image_payload(input: &str, target: ImageOutputTarget) -> Result<String, String> {
    let bytes = decode_image_payload_bytes(input)?;
    let image = image::load_from_memory(&bytes)
        .map_err(|error| format!("failed to decode input image: {error}"))?;
    let (mime, output_bytes) = match target {
        ImageOutputTarget::Png => ("image/png", encode_dynamic_image(&image, ImageFormat::Png)?),
        ImageOutputTarget::Jpeg => ("image/jpeg", encode_jpeg_image(&image, 90)?),
        ImageOutputTarget::WebP => ("image/webp", encode_dynamic_image(&image, ImageFormat::WebP)?),
    };
    Ok(encode_data_uri(&output_bytes, mime))
}

pub(crate) fn run_jpg_to_png_converter(input: &str) -> Result<String, String> {
    convert_image_payload(input, ImageOutputTarget::Png)
}

pub(crate) fn run_png_to_jpg_converter(input: &str) -> Result<String, String> {
    convert_image_payload(input, ImageOutputTarget::Jpeg)
}

pub(crate) fn run_jpg_to_webp_converter(input: &str) -> Result<String, String> {
    convert_image_payload(input, ImageOutputTarget::WebP)
}

pub(crate) fn run_webp_to_jpg_converter(input: &str) -> Result<String, String> {
    convert_image_payload(input, ImageOutputTarget::Jpeg)
}

pub(crate) fn run_png_to_webp_converter(input: &str) -> Result<String, String> {
    convert_image_payload(input, ImageOutputTarget::WebP)
}

pub(crate) fn run_webp_to_png_converter(input: &str) -> Result<String, String> {
    convert_image_payload(input, ImageOutputTarget::Png)
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SvgToPngInput {
    svg: String,
    width: Option<u32>,
    height: Option<u32>,
}

pub(crate) fn decode_svg_input(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.starts_with("<svg") || trimmed.contains("<svg") {
        return Ok(trimmed.to_string());
    }

    if trimmed.starts_with("IMAGE_BASE64:") || trimmed.starts_with("data:") {
        let (mime, encoded) = normalize_image_base64_payload(trimmed)?;
        if !mime.to_ascii_lowercase().contains("svg") {
            return Err("svg-to-png expects SVG input payload".to_string());
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|error| format!("invalid SVG base64 payload: {error}"))?;
        return String::from_utf8(bytes).map_err(|error| format!("invalid SVG UTF-8 content: {error}"));
    }

    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(trimmed) {
        if let Ok(svg_text) = String::from_utf8(bytes) {
            if svg_text.contains("<svg") {
                return Ok(svg_text);
            }
        }
    }

    Err("svg-to-png expects raw SVG text or IMAGE_BASE64 SVG payload".to_string())
}

pub(crate) fn run_svg_to_png_converter(input: &str) -> Result<String, String> {
    let (svg_text, requested_width, requested_height) = if input.trim_start().starts_with('{') {
        let payload = serde_json::from_str::<SvgToPngInput>(input)
            .map_err(|error| format!("invalid svg-to-png input JSON: {error}"))?;
        let svg = decode_svg_input(&payload.svg)?;
        (svg, payload.width, payload.height)
    } else {
        (decode_svg_input(input)?, None, None)
    };

    let options = usvg::Options::default();
    let tree = usvg::Tree::from_str(&svg_text, &options)
        .map_err(|error| format!("failed to parse SVG: {error}"))?;
    let source_size = tree.size().to_int_size();
    let target_width = requested_width.unwrap_or(source_size.width()).clamp(1, 8192);
    let target_height = requested_height.unwrap_or(source_size.height()).clamp(1, 8192);

    let mut pixmap = tiny_skia::Pixmap::new(target_width, target_height)
        .ok_or_else(|| "failed to allocate rasterization surface".to_string())?;
    let scale_x = target_width as f32 / source_size.width() as f32;
    let scale_y = target_height as f32 / source_size.height() as f32;
    let transform = tiny_skia::Transform::from_scale(scale_x, scale_y);
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    let png_bytes = pixmap
        .encode_png()
        .map_err(|error| format!("failed to encode PNG output: {error}"))?;
    Ok(encode_data_uri(&png_bytes, "image/png"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OcrInput {
    image: Option<String>,
    language: Option<String>,
    download_missing_language: Option<bool>,
    psm: Option<u8>,
    oem: Option<u8>,
}

pub(crate) fn parse_ocr_languages(language_spec: &str) -> Result<Vec<String>, String> {
    let mut languages = Vec::<String>::new();
    static OCR_LANG_RE: OnceLock<Regex> = OnceLock::new();
    let language_token = OCR_LANG_RE.get_or_init(|| Regex::new(r"^[A-Za-z0-9_]+$").expect("valid OCR language regex"));
    for token in language_spec.split('+') {
        let trimmed = token.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !language_token.is_match(trimmed) {
            return Err(format!("invalid OCR language token: {trimmed}"));
        }
        if !languages.iter().any(|entry| entry == trimmed) {
            languages.push(trimmed.to_string());
        }
    }
    if languages.is_empty() {
        return Err("OCR language cannot be empty".to_string());
    }
    Ok(languages)
}

pub(crate) fn tessdata_download_url(language: &str) -> String {
    format!(
        "https://github.com/tesseract-ocr/tessdata_best/raw/main/{language}.traineddata"
    )
}

pub(crate) fn ocr_tessdata_dir() -> PathBuf {
    if let Ok(configured) = std::env::var("BINTURONG_TESSDATA_DIR") {
        return PathBuf::from(configured);
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".binturong").join("tessdata");
    }
    std::env::temp_dir().join("binturong").join("tessdata")
}

pub(crate) fn download_tesseract_language(language: &str, destination: &Path) -> Result<(), String> {
    let url = tessdata_download_url(language);
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|error| format!("failed to configure HTTP client: {error}"))?;
    let response = client
        .get(&url)
        .send()
        .map_err(|error| format!("failed to download OCR language '{language}': {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "failed to download OCR language '{language}': HTTP {}",
            response.status()
        ));
    }
    let bytes = response
        .bytes()
        .map_err(|error| format!("failed to read OCR language payload: {error}"))?;
    fs::write(destination, &bytes)
        .map_err(|error| format!("failed to write OCR language file '{}': {error}", destination.display()))
}

pub(crate) fn ensure_ocr_languages(
    language_spec: &str,
    allow_download: bool,
) -> Result<(Vec<String>, PathBuf), String> {
    let languages = parse_ocr_languages(language_spec)?;
    let tessdata_dir = ocr_tessdata_dir();
    if allow_download {
        fs::create_dir_all(&tessdata_dir)
            .map_err(|error| format!("failed to create tessdata directory: {error}"))?;
        let mut downloaded = Vec::<String>::new();
        for language in &languages {
            let file_path = tessdata_dir.join(format!("{language}.traineddata"));
            if !file_path.exists() {
                download_tesseract_language(language, &file_path)?;
                downloaded.push(language.to_string());
            }
        }
        return Ok((downloaded, tessdata_dir));
    }

    Ok((Vec::new(), tessdata_dir))
}

pub(crate) fn run_image_to_text_converter(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<OcrInput>(input)
            .map_err(|error| format!("invalid OCR input JSON: {error}"))?
    } else {
        OcrInput {
            image: Some(input.to_string()),
            language: Some("eng".to_string()),
            download_missing_language: Some(false),
            psm: None,
            oem: None,
        }
    };

    let image_input = payload
        .image
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "OCR input requires an image payload".to_string())?;
    let language = payload.language.unwrap_or_else(|| "eng".to_string());
    let allow_download = payload.download_missing_language.unwrap_or(false);
    let (downloaded_languages, tessdata_dir) = ensure_ocr_languages(&language, allow_download)?;

    let image_bytes = decode_image_payload_bytes(image_input)?;
    let temp_file_name = format!(
        "binturong-ocr-{}-{}.png",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    );
    let temp_file_path = std::env::temp_dir().join(temp_file_name);
    fs::write(&temp_file_path, &image_bytes)
        .map_err(|error| format!("failed to write OCR temp image: {error}"))?;

    let mut command = Command::new("tesseract");
    command.arg(&temp_file_path).arg("stdout").arg("-l").arg(&language);
    if allow_download {
        command.arg("--tessdata-dir").arg(&tessdata_dir);
    }
    if let Some(psm) = payload.psm {
        command.arg("--psm").arg(psm.to_string());
    }
    if let Some(oem) = payload.oem {
        command.arg("--oem").arg(oem.to_string());
    }

    let output = command.output().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "tesseract binary not found. Install Tesseract OCR and ensure 'tesseract' is on PATH."
                .to_string()
        } else {
            format!("failed to launch tesseract: {error}")
        }
    })?;
    let _ = fs::remove_file(&temp_file_path);
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("tesseract failed with status {}", output.status)
        } else {
            format!("tesseract failed: {stderr}")
        });
    }

    let text = String::from_utf8(output.stdout)
        .map_err(|error| format!("OCR output was not valid UTF-8: {error}"))?;
    let response = serde_json::json!({
        "language": language,
        "downloadedLanguages": downloaded_languages,
        "text": text.trim_end_matches('\n')
    });
    serde_json::to_string_pretty(&response)
        .map_err(|error| format!("failed to serialize OCR output: {error}"))
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AsciiArtInput {
    image: Option<String>,
    text: Option<String>,
    width: Option<u32>,
    charset: Option<String>,
    invert: Option<bool>,
}

pub(crate) fn render_text_ascii_banner(text: &str) -> String {
    text.lines()
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
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub(crate) fn render_image_ascii_art(
    image_bytes: &[u8],
    width: u32,
    charset: &str,
    invert: bool,
) -> Result<String, String> {
    let image = image::load_from_memory(image_bytes)
        .map_err(|error| format!("failed to decode ASCII art image input: {error}"))?;
    let grayscale = image.to_luma8();
    let source_width = grayscale.width().max(1);
    let source_height = grayscale.height().max(1);
    let target_width = width.clamp(8, 400);
    let target_height = (((source_height as f32 / source_width as f32) * target_width as f32) * 0.55)
        .max(1.0)
        .round() as u32;
    let resized = image::imageops::resize(
        &grayscale,
        target_width,
        target_height.max(1),
        image::imageops::FilterType::Triangle,
    );

    let charset_chars = charset.chars().collect::<Vec<_>>();
    if charset_chars.len() < 2 {
        return Err("ASCII art charset must contain at least two characters".to_string());
    }

    let mut lines = Vec::<String>::new();
    for y in 0..resized.height() {
        let mut line = String::new();
        for x in 0..resized.width() {
            let brightness = resized.get_pixel(x, y).0[0] as f32 / 255.0;
            let mut index = (brightness * (charset_chars.len() - 1) as f32).round() as usize;
            if invert {
                index = charset_chars.len() - 1 - index;
            }
            line.push(charset_chars[index]);
        }
        lines.push(line);
    }
    Ok(lines.join("\n"))
}

pub(crate) fn run_ascii_art_generator(input: &str) -> Result<String, String> {
    let payload = if input.trim_start().starts_with('{') {
        serde_json::from_str::<AsciiArtInput>(input)
            .map_err(|error| format!("invalid ASCII art input JSON: {error}"))?
    } else {
        AsciiArtInput {
            image: if input.starts_with("IMAGE_BASE64:") || input.starts_with("data:image/") {
                Some(input.to_string())
            } else {
                None
            },
            text: if input.starts_with("IMAGE_BASE64:") || input.starts_with("data:image/") {
                None
            } else {
                Some(input.to_string())
            },
            width: Some(80),
            charset: None,
            invert: Some(false),
        }
    };

    let width = payload.width.unwrap_or(80);
    let charset = payload
        .charset
        .as_deref()
        .filter(|value| !value.is_empty())
        .unwrap_or("@%#*+=-:. ");
    let invert = payload.invert.unwrap_or(false);

    if let Some(image_payload) = payload.image.as_deref().filter(|value| !value.trim().is_empty()) {
        let image_bytes = decode_image_payload_bytes(image_payload)?;
        return render_image_ascii_art(&image_bytes, width, charset, invert);
    }
    if let Some(text_input) = payload.text.as_deref() {
        return Ok(render_text_ascii_banner(text_input));
    }

    Err("ASCII art generator expects `image` or `text` input".to_string())
}

