use base64::Engine;
use binturong_lib::clipboard_detection::detect_content;
use binturong_lib::tools::{run_converter_tool, run_formatter_tool};
use binturong_lib::tool_registry::ToolRegistry;
use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use serde::Serialize;
use std::io::Cursor;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PerfMetric {
    metric: String,
    target_ms: f64,
    measured_ms: f64,
    pass: bool,
    notes: String,
}

fn ms(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

fn p95_ms(samples: &[Duration]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }

    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    let index = (((sorted.len() as f64) * 0.95).ceil() as usize)
        .saturating_sub(1)
        .min(sorted.len().saturating_sub(1));
    ms(sorted[index])
}

fn create_json_payload(target_bytes: usize) -> String {
    let mut index = 0_usize;
    let mut fields = Vec::new();
    while fields.join(",").len() < target_bytes {
        fields.push(format!("\"key{index}\":\"value{index}\""));
        index += 1;
    }
    format!("{{{}}}", fields.join(","))
}

fn create_image_payload(width: u32, height: u32) -> Result<String, String> {
    let mut image = RgbaImage::new(width, height);
    for y in 0..height {
        for x in 0..width {
            let r = (x % 255) as u8;
            let g = (y % 255) as u8;
            let b = ((x + y) % 255) as u8;
            image.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }

    let dynamic = DynamicImage::ImageRgba8(image);
    let mut png = Vec::new();
    dynamic
        .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
        .map_err(|error| format!("failed to encode PNG payload: {error}"))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(png);
    Ok(format!("IMAGE_BASE64:image/png;base64,{encoded}"))
}

fn benchmark_search(registry: &ToolRegistry) -> PerfMetric {
    let queries = ["j", "js", "json", "json f", "json fo", "json format"];
    let mut samples = Vec::new();

    for _ in 0..400 {
        for query in queries {
            let started = Instant::now();
            let _ = registry.ranked_search(query, &[], &[]);
            samples.push(started.elapsed());
        }
    }

    let p95 = p95_ms(&samples);
    let max = samples.iter().copied().max().map(ms).unwrap_or(0.0);
    PerfMetric {
        metric: "Search results update per keystroke".to_string(),
        target_ms: 50.0,
        measured_ms: p95,
        pass: p95 <= 50.0,
        notes: format!("p95 measured; max observed {max:.2}ms"),
    }
}

fn benchmark_clipboard_detection(registry: &ToolRegistry) -> PerfMetric {
    let input = r#"{
  "name": "binturong",
  "items": [1,2,3,4],
  "nested": {"a": "alpha", "b": "beta"},
  "url": "https://example.com/path?foo=bar&baz=qux"
}"#;
    let mut samples = Vec::new();
    for _ in 0..250 {
        let started = Instant::now();
        let _ = detect_content(registry, input);
        samples.push(started.elapsed());
    }

    let p95 = p95_ms(&samples);
    let max = samples.iter().copied().max().map(ms).unwrap_or(0.0);
    PerfMetric {
        metric: "Smart clipboard detection".to_string(),
        target_ms: 200.0,
        measured_ms: p95,
        pass: p95 <= 200.0,
        notes: format!("p95 measured; max observed {max:.2}ms"),
    }
}

fn benchmark_formatter_typical_input() -> PerfMetric {
    let input = create_json_payload(8 * 1024);
    let mut samples = Vec::new();

    for _ in 0..250 {
        let started = Instant::now();
        let _ = run_formatter_tool(
            "json-format".to_string(),
            input.clone(),
            "format".to_string(),
            Some(2),
        );
        samples.push(started.elapsed());
    }

    let p95 = p95_ms(&samples);
    let max = samples.iter().copied().max().map(ms).unwrap_or(0.0);
    PerfMetric {
        metric: "Formatter/encoder on typical input (<10KB)".to_string(),
        target_ms: 50.0,
        measured_ms: p95,
        pass: p95 <= 50.0,
        notes: format!("p95 measured; max observed {max:.2}ms"),
    }
}

fn benchmark_hash_100mb() -> PerfMetric {
    let bytes = vec![0xAB_u8; 100 * 1024 * 1024];
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    let input = format!("FILE_BASE64:{encoded}");

    let started = Instant::now();
    let result = run_converter_tool("hash-generator".to_string(), input);
    let elapsed = started.elapsed();
    let measured = ms(elapsed);

    PerfMetric {
        metric: "Hash computation on 100MB file".to_string(),
        target_ms: 5000.0,
        measured_ms: measured,
        pass: result.is_ok() && measured <= 5000.0,
        notes: "single-run measurement with sha256 file payload".to_string(),
    }
}

fn benchmark_image_conversion() -> PerfMetric {
    let input = match create_image_payload(1920, 1080) {
        Ok(payload) => payload,
        Err(error) => {
            return PerfMetric {
                metric: "Image conversion (single file, <10MB)".to_string(),
                target_ms: 3000.0,
                measured_ms: 0.0,
                pass: false,
                notes: error,
            };
        }
    };

    let mut samples = Vec::new();
    let mut all_ok = true;
    for _ in 0..5 {
        let started = Instant::now();
        let result = run_converter_tool("png-to-webp-converter".to_string(), input.clone());
        samples.push(started.elapsed());
        if result.is_err() {
            all_ok = false;
        }
    }

    let p95 = p95_ms(&samples);
    let max = samples.iter().copied().max().map(ms).unwrap_or(0.0);
    PerfMetric {
        metric: "Image conversion (single file, <10MB)".to_string(),
        target_ms: 3000.0,
        measured_ms: p95,
        pass: all_ok && p95 <= 3000.0,
        notes: format!("png-to-webp p95 measured; max observed {max:.2}ms"),
    }
}

fn benchmark_ocr() -> PerfMetric {
    let image_payload = match create_image_payload(1240, 1754) {
        Ok(payload) => payload,
        Err(error) => {
            return PerfMetric {
                metric: "OCR on a standard document page".to_string(),
                target_ms: 10000.0,
                measured_ms: 0.0,
                pass: false,
                notes: error,
            };
        }
    };

    let ocr_input = |allow_download: bool| {
        serde_json::json!({
            "image": image_payload,
            "language": "eng",
            "allowDownload": allow_download,
        })
        .to_string()
    };

    let started = Instant::now();
    let initial = run_converter_tool("image-to-text-converter".to_string(), ocr_input(false));
    let elapsed = started.elapsed();

    let (measured_ms, pass, notes) = match initial {
        Ok(_) => (ms(elapsed), ms(elapsed) <= 10000.0, "eng language already available".to_string()),
        Err(error) if error.contains("missing OCR language data") => {
            let bootstrap = run_converter_tool(
                "image-to-text-converter".to_string(),
                ocr_input(true),
            );
            if bootstrap.is_err() {
                (
                    0.0,
                    false,
                    "missing OCR language data and bootstrap download failed".to_string(),
                )
            } else {
                let started_retry = Instant::now();
                let retry = run_converter_tool(
                    "image-to-text-converter".to_string(),
                    ocr_input(false),
                );
                let retry_elapsed = started_retry.elapsed();
                let retry_ms = ms(retry_elapsed);
                (
                    retry_ms,
                    retry.is_ok() && retry_ms <= 10000.0,
                    "bootstrap download performed before measured run".to_string(),
                )
            }
        }
        Err(error) => (0.0, false, format!("OCR failed: {error}")),
    };

    PerfMetric {
        metric: "OCR on a standard document page".to_string(),
        target_ms: 10000.0,
        measured_ms,
        pass,
        notes,
    }
}

fn main() -> Result<(), String> {
    let registry = ToolRegistry::with_builtin_tools()?;
    let metrics = vec![
        benchmark_search(&registry),
        benchmark_clipboard_detection(&registry),
        benchmark_formatter_typical_input(),
        benchmark_hash_100mb(),
        benchmark_image_conversion(),
        benchmark_ocr(),
    ];

    println!("metric,target_ms,measured_ms,pass,notes");
    for metric in &metrics {
        println!(
            "\"{}\",{:.2},{:.2},{},\"{}\"",
            metric.metric,
            metric.target_ms,
            metric.measured_ms,
            metric.pass,
            metric.notes.replace('"', "'"),
        );
    }

    if metrics.iter().all(|metric| metric.pass) {
        Ok(())
    } else {
        Err("one or more performance targets did not pass".to_string())
    }
}
