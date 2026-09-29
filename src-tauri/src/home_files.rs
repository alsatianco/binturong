use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{fs::File, io::Read, path::Path};

const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeFile {
    name: String,
    input: String,
    kind: String,
    extension: String,
}

// Read off the UI thread. Keep the complete input for handoff; previews have a
// separate 64 KiB limit. Taking one extra byte also bounds files that grow during reading.
#[tauri::command]
pub async fn read_home_file(path: String, tool_id: Option<String>) -> Result<HomeFile, String> {
    tauri::async_runtime::spawn_blocking(move || read_file(Path::new(&path), tool_id.as_deref()))
        .await
        .map_err(|error| error.to_string())?
}

fn read_file(path: &Path, tool_id: Option<&str>) -> Result<HomeFile, String> {
    let file = File::open(path).map_err(|error| format!("Could not open file: {error}"))?;
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("Choose a file rather than a folder.".into());
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err("Choose a file smaller than 20 MB.".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("Choose a file smaller than 20 MB.".into());
    }
    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match extension.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    };
    let (kind, input) = if tool_id == Some("hash-generator") {
        ("binary", format!("FILE_BASE64:{}", STANDARD.encode(&bytes)))
    } else if tool_id == Some("cert-decoder") && extension == "der" {
        ("binary", format!("DER_BASE64:{}", STANDARD.encode(&bytes)))
    } else if extension == "docx" {
        (
            "document",
            format!("DOCX_BASE64:{}", STANDARD.encode(&bytes)),
        )
    } else if tool_id == Some("svg-to-css") {
        (
            "text",
            String::from_utf8(bytes).map_err(|_| "SVG must be UTF-8 text.".to_string())?,
        )
    } else if let Some(mime) = mime {
        (
            "image",
            format!("IMAGE_BASE64:{mime};base64,{}", STANDARD.encode(&bytes)),
        )
    } else {
        let text = String::from_utf8(bytes).map_err(|_| {
            "This file is not UTF-8 text, a supported image, or a Word document.".to_string()
        })?;
        if text.contains('\0') {
            return Err("This file appears to contain binary data.".into());
        }
        ("text", text)
    };
    Ok(HomeFile {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        input,
        kind: kind.into(),
        extension,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_text_and_encodes_documents_and_images() {
        let dir = tempfile::tempdir().unwrap();
        for (name, data, expected) in [
            ("a.txt", " hello\n", " hello\n"),
            ("a.docx", "zip", "DOCX_BASE64:emlw"),
            ("a.png", "png", "IMAGE_BASE64:image/png;base64,cG5n"),
        ] {
            let path = dir.path().join(name);
            std::fs::write(&path, data).unwrap();
            assert_eq!(read_file(&path, None).unwrap().input, expected);
        }
    }
    #[test]
    fn native_tool_drops_keep_the_existing_input_formats() {
        let dir = tempfile::tempdir().unwrap();
        let svg = dir.path().join("a.svg");
        std::fs::write(&svg, "<svg/>").unwrap();
        assert_eq!(read_file(&svg, Some("svg-to-css")).unwrap().input, "<svg/>");
        assert!(read_file(&svg, Some("hash-generator"))
            .unwrap()
            .input
            .starts_with("FILE_BASE64:"));
        let der = dir.path().join("a.der");
        std::fs::write(&der, [0, 255]).unwrap();
        assert!(read_file(&der, Some("cert-decoder"))
            .unwrap()
            .input
            .starts_with("DER_BASE64:"));
    }

    #[test]
    fn rejects_oversized_files_and_binary_text() {
        let file = tempfile::NamedTempFile::new().unwrap();
        file.as_file().set_len(MAX_FILE_BYTES + 1).unwrap();
        assert!(read_file(file.path(), None).is_err());
        std::fs::write(file.path(), [0, 255]).unwrap();
        assert!(read_file(file.path(), None).is_err());
    }
}
