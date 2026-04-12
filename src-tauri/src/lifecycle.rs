use serde::{Deserialize, Serialize};
use std::{
    any::Any,
    error::Error,
    fs,
    io,
    panic,
    path::{Path, PathBuf},
    sync::Once,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

const RUNTIME_STATE_SCHEMA_VERSION: u8 = 1;
const RUNTIME_STATE_FILE_NAME: &str = "runtime-state.json";
const PANIC_REPORT_FILE_NAME: &str = "last-panic.log";
const COLD_START_TARGET_MS: u64 = 1_500;

static PANIC_HOOK_ONCE: Once = Once::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleBootstrap {
    pub cold_start_ms: u64,
    pub cold_start_target_ms: u64,
    pub cold_start_within_target: bool,
    pub recovered_after_unclean_shutdown: bool,
    pub runtime_state_path: String,
    pub panic_report_path: String,
    pub previous_panic_report_exists: bool,
}

#[derive(Debug, Clone)]
pub struct LifecycleManager {
    pub bootstrap: LifecycleBootstrap,
    pub runtime_state_path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeState {
    schema_version: u8,
    launch_count: u64,
    last_started_at_unix: u64,
    last_shutdown_at_unix: Option<u64>,
    last_clean_shutdown: bool,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            schema_version: 0,
            launch_count: 0,
            last_started_at_unix: 0,
            last_shutdown_at_unix: None,
            // Missing file is treated as first run, not an unclean recovery.
            last_clean_shutdown: true,
        }
    }
}

fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

fn read_runtime_state(path: &Path) -> RuntimeState {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<RuntimeState>(&raw).ok())
        .unwrap_or_default()
}

fn write_runtime_state(path: &Path, state: &RuntimeState) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let payload = serde_json::to_vec_pretty(state)
        .map_err(|err| io::Error::new(io::ErrorKind::Other, err.to_string()))?;
    fs::write(path, payload)
}

fn panic_payload_to_string(payload: &(dyn Any + Send)) -> String {
    if let Some(message) = payload.downcast_ref::<&str>() {
        return (*message).to_string();
    }

    if let Some(message) = payload.downcast_ref::<String>() {
        return message.clone();
    }

    "unknown panic payload".to_string()
}

fn install_panic_hook(report_path: PathBuf) {
    PANIC_HOOK_ONCE.call_once(|| {
        let default_hook = panic::take_hook();
        panic::set_hook(Box::new(move |panic_info| {
            let message = panic_payload_to_string(panic_info.payload());
            let location = panic_info
                .location()
                .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
                .unwrap_or_else(|| "unknown".to_string());

            let report = format!(
                "panic_at_unix: {}\nlocation: {}\nmessage: {}\n",
                now_unix_secs(),
                location,
                message
            );

            let _ = fs::write(&report_path, report);
            default_hook(panic_info);
        }));
    });
}

pub fn initialize(
    app_handle: &tauri::AppHandle,
    cold_start_ms: u64,
) -> Result<LifecycleManager, Box<dyn Error>> {
    let app_data_dir = app_handle.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;

    let runtime_state_path = app_data_dir.join(RUNTIME_STATE_FILE_NAME);
    let panic_report_path = app_data_dir.join(PANIC_REPORT_FILE_NAME);

    let mut runtime_state = read_runtime_state(&runtime_state_path);
    let recovered_after_unclean_shutdown = !runtime_state.last_clean_shutdown;
    let previous_panic_report_exists = panic_report_path.exists();

    runtime_state.schema_version = RUNTIME_STATE_SCHEMA_VERSION;
    runtime_state.launch_count = runtime_state.launch_count.saturating_add(1);
    runtime_state.last_started_at_unix = now_unix_secs();
    runtime_state.last_shutdown_at_unix = None;
    runtime_state.last_clean_shutdown = false;
    write_runtime_state(&runtime_state_path, &runtime_state)?;

    install_panic_hook(panic_report_path.clone());

    Ok(LifecycleManager {
        bootstrap: LifecycleBootstrap {
            cold_start_ms,
            cold_start_target_ms: COLD_START_TARGET_MS,
            cold_start_within_target: cold_start_ms <= COLD_START_TARGET_MS,
            recovered_after_unclean_shutdown,
            runtime_state_path: runtime_state_path.display().to_string(),
            panic_report_path: panic_report_path.display().to_string(),
            previous_panic_report_exists,
        },
        runtime_state_path,
    })
}

pub fn mark_clean_shutdown(app_handle: &tauri::AppHandle) {
    let Some(lifecycle) = app_handle.try_state::<LifecycleManager>() else {
        return;
    };

    let mut runtime_state = read_runtime_state(&lifecycle.runtime_state_path);
    runtime_state.schema_version = RUNTIME_STATE_SCHEMA_VERSION;
    runtime_state.last_clean_shutdown = true;
    runtime_state.last_shutdown_at_unix = Some(now_unix_secs());

    if let Err(error) = write_runtime_state(&lifecycle.runtime_state_path, &runtime_state) {
        eprintln!("failed to persist clean shutdown state: {error}");
    }
}

#[tauri::command]
pub fn get_lifecycle_bootstrap(
    lifecycle: tauri::State<'_, LifecycleManager>,
) -> LifecycleBootstrap {
    lifecycle.bootstrap.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, fs};

    fn unique_path(file_name: &str) -> PathBuf {
        env::temp_dir().join(format!("binturong-{file_name}-{}", now_unix_secs()))
    }

    #[test]
    fn reads_default_runtime_state_when_file_is_missing() {
        let path = unique_path("missing-runtime-state.json");
        let state = read_runtime_state(&path);

        assert_eq!(state.schema_version, 0);
        assert_eq!(state.launch_count, 0);
        assert!(state.last_clean_shutdown);
    }

    #[test]
    fn writes_and_reads_runtime_state_roundtrip() {
        let path = unique_path("runtime-state-roundtrip.json");
        let expected = RuntimeState {
            schema_version: 1,
            launch_count: 3,
            last_started_at_unix: 111,
            last_shutdown_at_unix: Some(222),
            last_clean_shutdown: true,
        };

        write_runtime_state(&path, &expected).expect("write state");
        let actual = read_runtime_state(&path);

        assert_eq!(actual.schema_version, expected.schema_version);
        assert_eq!(actual.launch_count, expected.launch_count);
        assert_eq!(actual.last_started_at_unix, expected.last_started_at_unix);
        assert_eq!(actual.last_shutdown_at_unix, expected.last_shutdown_at_unix);
        assert_eq!(actual.last_clean_shutdown, expected.last_clean_shutdown);

        let _ = fs::remove_file(path);
    }
}
