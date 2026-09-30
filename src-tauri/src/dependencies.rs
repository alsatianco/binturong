//! Optional runtime software. Installs use fixed package-manager arguments; never a shell.
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

static CONFIG_PATH: OnceLock<PathBuf> = OnceLock::new();
static INSTALL: Mutex<InstallState> = Mutex::new(InstallState {
    running: false,
    error: None,
});
static CONFIG_LOCK: Mutex<()> = Mutex::new(());
struct InstallState {
    running: bool,
    error: Option<String>,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    tesseract_path: String,
}

pub fn initialize(directory: PathBuf) -> Result<(), String> {
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    CONFIG_PATH
        .set(directory.join("tool-dependencies.json"))
        .map_err(|_| "Dependencies already initialized".to_string())
}

fn read_config() -> Result<Config, String> {
    let Some(path) = CONFIG_PATH.get() else {
        return Ok(Config::default());
    };
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|e| format!("Could not read dependency settings: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Config::default()),
        Err(e) => Err(format!("Could not read dependency settings: {e}")),
    }
}

fn save_config(path: &str) -> Result<(), String> {
    let _guard = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let file = CONFIG_PATH
        .get()
        .ok_or("Dependency settings are unavailable")?;
    let temporary = file.with_extension("tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(&Config {
            tesseract_path: path.into(),
        })
        .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(&temporary, file).map_err(|e| e.to_string())
}

pub(crate) fn command(path: &Path) -> Command {
    let mut command = Command::new(path);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Status polling and OCR must not flash a console window on Windows.
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    command.stdin(Stdio::null());
    command
}

fn executable_paths(name: &str) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();
    // Desktop apps often inherit a much smaller PATH than terminal shells.
    dirs.extend(
        [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/opt/local/bin",
            "/usr/bin",
            "/bin",
        ]
        .map(PathBuf::from),
    );
    #[cfg(target_os = "windows")]
    {
        for variable in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
            if let Some(root) = std::env::var_os(variable) {
                let root = PathBuf::from(root);
                dirs.extend([
                    root.join("Tesseract-OCR"),
                    root.join("Programs/Tesseract-OCR"),
                    root.join("Microsoft/WindowsApps"),
                ]);
            }
        }
    }
    let filename = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.into()
    };
    dirs.into_iter()
        .filter(|d| d.is_absolute())
        .map(|d| d.join(&filename))
        .collect()
}

fn find_executable(name: &str) -> Option<PathBuf> {
    executable_paths(name).into_iter().find(|p| p.is_file())
}

// The temporary output file avoids pipe deadlocks, including misbehaving executables.
struct ProbeFile(PathBuf);
impl Drop for ProbeFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn validate_binary(path: &Path) -> Result<(), String> {
    if !path.is_absolute() || !path.is_file() {
        return Err("Choose an absolute path to the Tesseract executable.".into());
    }
    let probe = ProbeFile(
        std::env::temp_dir().join(format!("binturong-probe-{}.log", uuid::Uuid::new_v4())),
    );
    let output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe.0)
        .map_err(|e| e.to_string())?;
    let mut child = command(path)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(output.try_clone().map_err(|e| e.to_string())?)
        .stderr(output)
        .spawn()
        .map_err(|e| format!("Could not run this executable: {e}"))?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(format!("Executable version check failed: {status}"));
                }
                use std::io::Read;
                let mut version = String::new();
                fs::File::open(&probe.0)
                    .map_err(|e| e.to_string())?
                    .take(8192)
                    .read_to_string(&mut version)
                    .map_err(|e| e.to_string())?;
                return if version
                    .lines()
                    .any(|line| line.trim().to_lowercase().starts_with("tesseract "))
                {
                    Ok(())
                } else {
                    Err("This executable does not identify itself as Tesseract.".into())
                };
            }
            Ok(None) if start.elapsed() < Duration::from_secs(5) => {
                std::thread::sleep(Duration::from_millis(50))
            }
            result => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(match result {
                    Err(e) => e.to_string(),
                    _ => "Executable version check timed out.".into(),
                });
            }
        }
    }
}

fn detect_binary() -> Option<PathBuf> {
    executable_paths("tesseract")
        .into_iter()
        .find(|p| p.is_file() && validate_binary(p).is_ok())
}

pub(crate) fn missing_dependency(details: &str) -> String {
    serde_json::json!({"code":"missingDependency", "dependencyId":"tesseract", "message":"Tesseract OCR is unavailable.", "suggestion":"Open Settings → Tool dependencies to install it or configure its path.", "technicalDetails":details}).to_string()
}

pub(crate) fn resolve_tesseract() -> Result<PathBuf, String> {
    let config = read_config()?;
    let configured = if config.tesseract_path.is_empty() {
        std::env::var("BINTURONG_TESSERACT_PATH").unwrap_or_default()
    } else {
        config.tesseract_path
    };
    if !configured.is_empty() {
        let path = PathBuf::from(configured);
        validate_binary(&path).map_err(|e| missing_dependency(&e))?;
        return Ok(path);
    }
    detect_binary().ok_or_else(|| {
        missing_dependency("Tesseract was not found in PATH or standard installation folders.")
    })
}

struct Installer {
    executable: PathBuf,
    args: Vec<&'static str>,
    label: &'static str,
}
fn installer() -> Option<Installer> {
    if cfg!(target_os = "macos") {
        return find_executable("brew").map(|executable| Installer {
            executable,
            args: vec!["install", "tesseract"],
            label: "Homebrew",
        });
    }
    if cfg!(target_os = "windows") {
        return find_executable("winget").map(|executable| Installer {
            executable,
            args: vec![
                "install",
                "--id",
                "UB-Mannheim.TesseractOCR",
                "--exact",
                "--source",
                "winget",
                "--silent",
                "--accept-package-agreements",
                "--accept-source-agreements",
                "--disable-interactivity",
            ],
            label: "WinGet (accepts package and source agreements)",
        });
    }
    if cfg!(target_os = "linux") {
        let executable = find_executable("pkexec")?;
        // Polkit displays the OS authentication prompt; passwords never enter Binturong.
        if Path::new("/usr/bin/apt-get").is_file() {
            return Some(Installer {
                executable,
                args: vec![
                    "/usr/bin/apt-get",
                    "install",
                    "-y",
                    "tesseract-ocr",
                    "tesseract-ocr-eng",
                ],
                label: "APT (administrator authentication required)",
            });
        }
        if Path::new("/usr/bin/dnf").is_file() {
            return Some(Installer {
                executable,
                args: vec![
                    "/usr/bin/dnf",
                    "install",
                    "-y",
                    "tesseract",
                    "tesseract-langpack-eng",
                ],
                label: "DNF (administrator authentication required)",
            });
        }
        if Path::new("/usr/bin/pacman").is_file() {
            return Some(Installer {
                executable,
                args: vec![
                    "/usr/bin/pacman",
                    "-S",
                    "--needed",
                    "--noconfirm",
                    "tesseract",
                    "tesseract-data-eng",
                ],
                label: "Pacman (administrator authentication required)",
            });
        }
    }
    None
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyStatus {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    estimated_size: &'static str,
    path: String,
    configured_path: String,
    available: bool,
    detail: Option<String>,
    installing: bool,
    install_error: Option<String>,
    installer: Option<&'static str>,
    config_path: String,
    language_data_path: String,
}

fn status() -> Result<Vec<DependencyStatus>, String> {
    let config = read_config()?;
    let resolved = resolve_tesseract();
    let state = INSTALL.lock().map_err(|e| e.to_string())?;
    Ok(vec![DependencyStatus {
        id: "tesseract",
        name: "Tesseract OCR",
        description: "Extracts text from images. Other tool libraries are bundled with Binturong.",
        estimated_size:
            "Estimated download: 30–150 MB including supporting libraries; varies by system.",
        path: resolved
            .as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        configured_path: config.tesseract_path,
        available: resolved.is_ok(),
        detail: resolved.err().map(|e| {
            serde_json::from_str::<serde_json::Value>(&e)
                .ok()
                .and_then(|v| v["technicalDetails"].as_str().map(str::to_owned))
                .unwrap_or(e)
        }),
        installing: state.running,
        install_error: state.error.clone(),
        installer: installer().map(|i| i.label),
        config_path: CONFIG_PATH
            .get()
            .map(|p| p.display().to_string())
            .unwrap_or_default(),
        language_data_path: crate::tools::image_tools::ocr_tessdata_dir()
            .display()
            .to_string(),
    }])
}

#[tauri::command]
pub async fn list_tool_dependencies() -> Result<Vec<DependencyStatus>, String> {
    tauri::async_runtime::spawn_blocking(status)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn configure_tool_dependency(id: String, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if id != "tesseract" {
            return Err("Unknown dependency".into());
        }
        let mut state = INSTALL.lock().map_err(|e| e.to_string())?;
        if state.running {
            return Err("Wait for the installation to finish before changing its path.".into());
        }
        let path = path.trim();
        if !path.is_empty() {
            validate_binary(Path::new(path))?;
        }
        save_config(path)?;
        state.error = None;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn install_tool_dependency(id: String) -> Result<(), String> {
    if id != "tesseract" {
        return Err("Unknown dependency".into());
    }
    let installer = installer().ok_or("Automatic installation is unavailable. Open the installation instructions, then configure the executable path.")?;
    let mut state = INSTALL.lock().map_err(|e| e.to_string())?;
    if state.running {
        return Err("Installation is already running.".into());
    }
    state.running = true;
    state.error = None;
    tauri::async_runtime::spawn_blocking(move || {
        let result = install(installer);
        if let Ok(mut state) = INSTALL.lock() {
            state.running = false;
            state.error = result.err();
        }
    });
    Ok(())
}

fn install(installer: Installer) -> Result<(), String> {
    let directory = CONFIG_PATH
        .get()
        .ok_or("Dependency settings unavailable")?
        .parent()
        .ok_or("Invalid settings directory")?;
    let log_path = directory.join("dependency-install.log");
    let log = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let mut command = command(&installer.executable);
    command
        .args(installer.args)
        .stdin(Stdio::null())
        .stdout(log.try_clone().map_err(|e| e.to_string())?)
        .stderr(log);
    command
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .env("NONINTERACTIVE", "1");
    if cfg!(target_os = "macos") {
        let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
            .map(|p| std::env::split_paths(&p).collect())
            .unwrap_or_default();
        dirs.extend(
            [
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                "/usr/sbin",
                "/sbin",
            ]
            .map(PathBuf::from),
        );
        command.env(
            "PATH",
            std::env::join_paths(dirs).map_err(|e| e.to_string())?,
        );
    }
    let mut child = command
        .spawn()
        .map_err(|e| format!("Could not start installation: {e}"))?;
    let started = Instant::now();
    loop {
        if let Some(exit) = child.try_wait().map_err(|e| e.to_string())? {
            if !exit.success() {
                return Err(format!(
                    "Installation failed ({exit}). See {}. You can retry or install manually.",
                    log_path.display()
                ));
            }
            break;
        }
        if started.elapsed() > Duration::from_secs(1800) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("Installation timed out. Check {} and refresh status before retrying; an installer subprocess may still be finishing.", log_path.display()));
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    let binary = detect_binary().ok_or("Installation finished, but Tesseract could not be detected. Configure its executable path manually.")?;
    save_config(&binary.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unknown_dependencies() {
        assert!(install_tool_dependency("curl | sh".into()).is_err());
    }
    #[test]
    fn missing_dependency_is_machine_readable() {
        let value: serde_json::Value =
            serde_json::from_str(&missing_dependency("missing")).unwrap();
        assert_eq!(value["code"], "missingDependency");
        assert_eq!(value["dependencyId"], "tesseract");
    }
    #[cfg(unix)]
    #[test]
    fn configured_binary_is_validated_persisted_and_used_by_ocr() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().unwrap();
        initialize(directory.path().to_owned()).unwrap();
        let binary = directory.path().join("custom tesseract");
        fs::write(&binary, "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'tesseract 5.5.0'; else echo 'configured OCR output'; fi\n").unwrap();
        fs::set_permissions(&binary, fs::Permissions::from_mode(0o755)).unwrap();
        tauri::async_runtime::block_on(configure_tool_dependency(
            "tesseract".into(),
            binary.display().to_string(),
        ))
        .unwrap();
        assert_eq!(resolve_tesseract().unwrap(), binary);
        assert_eq!(
            read_config().unwrap().tesseract_path,
            binary.display().to_string()
        );
        let rows = status().unwrap();
        assert!(rows[0].available);
        let output = crate::tools::run_converter_tool(
            "image-to-text-converter".into(),
            "IMAGE_BASE64:image/png;base64,cG5n".into(),
        )
        .unwrap();
        assert!(output.contains("configured OCR output"));
        let wrong_binary = directory.path().join("not tesseract");
        fs::write(&wrong_binary, "#!/bin/sh\necho 'unrelated program'\n").unwrap();
        fs::set_permissions(&wrong_binary, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(tauri::async_runtime::block_on(configure_tool_dependency(
            "tesseract".into(),
            wrong_binary.display().to_string()
        ))
        .is_err());
        assert_eq!(resolve_tesseract().unwrap(), binary);
        tauri::async_runtime::block_on(configure_tool_dependency(
            "tesseract".into(),
            String::new(),
        ))
        .unwrap();
        assert!(read_config().unwrap().tesseract_path.is_empty());
    }
    #[test]
    fn rejects_relative_and_missing_executables() {
        assert!(validate_binary(Path::new("tesseract")).is_err());
        assert!(validate_binary(Path::new("/nonexistent/tesseract")).is_err());
    }
}
