pub mod clipboard_detection;
mod db;
mod error_model;
pub mod tools;
mod lifecycle;
mod operation_runtime;
pub mod tool_registry;

use serde::Serialize;
use std::{
    sync::Mutex,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, State,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const DEFAULT_QUICK_LAUNCHER_SHORTCUT: &str = "CmdOrCtrl+Shift+Space";
const MENU_ID_OPEN_MAIN_WINDOW: &str = "app.open-main-window";
const MENU_ID_OPEN_SETTINGS: &str = "app.open-settings";
const MENU_ID_TOGGLE_QUICK_LAUNCHER: &str = "app.toggle-quick-launcher";
const MENU_ID_QUIT: &str = "app.quit";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickLauncherShortcutConfig {
    enabled: bool,
    shortcut: String,
}

struct QuickLauncherShortcutState {
    config: Mutex<QuickLauncherShortcutConfig>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCheckResult {
    checked_at_unix: u64,
    channel: String,
    current_version: String,
    latest_version: String,
    has_update: bool,
    release_notes: String,
}

impl QuickLauncherShortcutState {
    fn new(enabled: bool, shortcut: String) -> Self {
        Self {
            config: Mutex::new(QuickLauncherShortcutConfig { enabled, shortcut }),
        }
    }

    fn read(&self) -> Result<QuickLauncherShortcutConfig, String> {
        self.config
            .lock()
            .map(|config| config.clone())
            .map_err(|_| "quick launcher shortcut state is unavailable".to_string())
    }
}

fn normalize_shortcut(shortcut: Option<String>) -> String {
    let candidate = shortcut
        .map(|value| value.trim().to_string())
        .unwrap_or_default();
    if candidate.is_empty() {
        DEFAULT_QUICK_LAUNCHER_SHORTCUT.to_string()
    } else {
        candidate
    }
}

fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn default_release_notes(version: &str) -> String {
    format!(
        "Binturong {version}\n\n- Performance improvements\n- Workflow polish updates\n- Stability and bug fixes"
    )
}

fn reveal_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle_main_window_visibility<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            Ok(false) | Err(_) => {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
    }
}

fn emit_quick_launcher_toggle<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("quick-launcher://toggle", ());
}

fn emit_open_settings<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("app://open-settings", ());
}

fn unregister_quick_launcher_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: &str,
) -> Result<(), String> {
    if !app.global_shortcut().is_registered(shortcut) {
        return Ok(());
    }

    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|error| format!("failed to unregister quick launcher shortcut '{shortcut}': {error}"))
}

fn register_quick_launcher_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: &str,
) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                reveal_main_window(app);
                emit_quick_launcher_toggle(app);
            }
        })
        .map_err(|error| format!("failed to register quick launcher shortcut '{shortcut}': {error}"))
}

fn apply_quick_launcher_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    quick_launcher_state: &QuickLauncherShortcutState,
    enabled: bool,
    shortcut: Option<String>,
) -> Result<QuickLauncherShortcutConfig, String> {
    let mut config = quick_launcher_state
        .config
        .lock()
        .map_err(|_| "quick launcher shortcut state is unavailable".to_string())?;

    let previous = config.clone();
    let next = QuickLauncherShortcutConfig {
        enabled,
        shortcut: normalize_shortcut(shortcut.or_else(|| Some(previous.shortcut.clone()))),
    };

    if previous.enabled {
        unregister_quick_launcher_shortcut(app, &previous.shortcut)?;
    }

    if next.enabled {
        if let Err(error) = register_quick_launcher_shortcut(app, &next.shortcut) {
            if previous.enabled {
                let _ = register_quick_launcher_shortcut(app, &previous.shortcut);
            }
            return Err(error);
        }
    }

    *config = next.clone();
    Ok(next)
}

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let open_main_item = MenuItem::with_id(
        app,
        MENU_ID_OPEN_MAIN_WINDOW,
        "Open Main Window",
        true,
        None::<&str>,
    )?;
    let open_quick_launcher_item = MenuItem::with_id(
        app,
        MENU_ID_TOGGLE_QUICK_LAUNCHER,
        "Toggle Quick Launcher",
        true,
        None::<&str>,
    )?;
    let open_settings_item =
        MenuItem::with_id(app, MENU_ID_OPEN_SETTINGS, "Open Settings", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, MENU_ID_QUIT, "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    Menu::with_items(
        app,
        &[
            &open_main_item,
            &open_quick_launcher_item,
            &open_settings_item,
            &separator,
            &quit_item,
        ],
    )
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        MENU_ID_OPEN_MAIN_WINDOW => {
            reveal_main_window(app);
        }
        MENU_ID_TOGGLE_QUICK_LAUNCHER => {
            reveal_main_window(app);
            emit_quick_launcher_toggle(app);
        }
        MENU_ID_OPEN_SETTINGS => {
            reveal_main_window(app);
            emit_open_settings(app);
        }
        MENU_ID_QUIT => {
            app.exit(0);
        }
        _ => {}
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn configure_quick_launcher_shortcut(
    app: AppHandle,
    quick_launcher_state: State<'_, QuickLauncherShortcutState>,
    enabled: bool,
    shortcut: Option<String>,
) -> Result<QuickLauncherShortcutConfig, String> {
    apply_quick_launcher_shortcut(&app, quick_launcher_state.inner(), enabled, shortcut)
}

#[tauri::command]
fn get_quick_launcher_shortcut_config(
    quick_launcher_state: State<'_, QuickLauncherShortcutState>,
) -> Result<QuickLauncherShortcutConfig, String> {
    quick_launcher_state.read()
}

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn check_for_updates(
    app: AppHandle,
    channel: Option<String>,
) -> Result<UpdateCheckResult, String> {
    let normalized_channel = match channel
        .unwrap_or_else(|| "stable".to_string())
        .trim()
        .to_lowercase()
        .as_str()
    {
        "beta" => "beta".to_string(),
        _ => "stable".to_string(),
    };

    let current_version = app.package_info().version.to_string();
    let version_env_key = if normalized_channel == "beta" {
        "BINTURONG_UPDATE_MOCK_BETA_VERSION"
    } else {
        "BINTURONG_UPDATE_MOCK_VERSION"
    };
    let notes_env_key = if normalized_channel == "beta" {
        "BINTURONG_UPDATE_MOCK_BETA_NOTES"
    } else {
        "BINTURONG_UPDATE_MOCK_NOTES"
    };

    let latest_version = std::env::var(version_env_key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| current_version.clone());
    let has_update = latest_version != current_version;
    let release_notes = std::env::var(notes_env_key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            if has_update {
                default_release_notes(&latest_version)
            } else {
                "No updates are currently available for this channel.".to_string()
            }
        });

    Ok(UpdateCheckResult {
        checked_at_unix: now_unix_secs(),
        channel: normalized_channel,
        current_version,
        latest_version,
        has_update,
        release_notes,
    })
}

#[tauri::command]
fn request_app_restart(app: AppHandle) -> Result<(), String> {
    app.request_restart();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch_started_at = Instant::now();

    let app = tauri::Builder::default()
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(|app, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window_visibility(app);
            }
        })
        .plugin(
            tauri_plugin_global_shortcut::Builder::new().build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let lifecycle = lifecycle::initialize(app.handle(), launch_started_at.elapsed().as_millis() as u64)
                .map_err(|error| error_model::format_lifecycle_error("startup.lifecycle", error))?;
            let db = db::initialize(app.handle())
                .map_err(|error| error_model::format_database_error("startup.database", error))?;
            let tool_registry = tool_registry::ToolRegistry::with_builtin_tools()
                .map_err(|error| error_model::format_registry_error("startup.toolRegistry", error))?;
            let operation_runtime = operation_runtime::OperationRuntime::new();
            let quick_launcher_state = QuickLauncherShortcutState::new(
                false,
                DEFAULT_QUICK_LAUNCHER_SHORTCUT.to_string(),
            );

            if let Err(error) = apply_quick_launcher_shortcut(
                app.handle(),
                &quick_launcher_state,
                true,
                Some(DEFAULT_QUICK_LAUNCHER_SHORTCUT.to_string()),
            ) {
                eprintln!(
                    "quick launcher shortcut initialization failed, app will continue: {error}"
                );
            }

            match build_tray_menu(app.handle()) {
                Ok(tray_menu) => {
                    let mut tray_builder = TrayIconBuilder::with_id("binturong-tray")
                        .menu(&tray_menu)
                        .tooltip("Binturong")
                        .show_menu_on_left_click(false);

                    if let Some(icon) = app.default_window_icon().cloned() {
                        tray_builder = tray_builder.icon(icon);
                    }
                    #[cfg(target_os = "macos")]
                    {
                        tray_builder = tray_builder.icon_as_template(true);
                    }
                    if let Err(error) = tray_builder.build(app.handle()) {
                        eprintln!("tray icon initialization failed, app will continue: {error}");
                    }
                }
                Err(error) => {
                    eprintln!("tray menu initialization failed, app will continue: {error}");
                }
            }

            if lifecycle.bootstrap.recovered_after_unclean_shutdown {
                let _ = app
                    .handle()
                    .emit("lifecycle://recovered", lifecycle.bootstrap.clone());
            }

            app.manage(lifecycle);
            app.manage(db);
            app.manage(tool_registry);
            app.manage(operation_runtime);
            app.manage(quick_launcher_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            configure_quick_launcher_shortcut,
            get_quick_launcher_shortcut_config,
            get_app_version,
            check_for_updates,
            request_app_restart,
            lifecycle::get_lifecycle_bootstrap,
            tool_registry::list_tools,
            tool_registry::list_tool_catalog,
            tool_registry::get_tool_definition,
            tool_registry::search_tools,
            tool_registry::ranked_search_tools,
            tool_registry::compatible_tool_targets,
            clipboard_detection::detect_clipboard_content,
            tools::run_formatter_tool,
            tools::run_converter_tool,
            operation_runtime::create_operation,
            operation_runtime::update_operation_progress,
            operation_runtime::cancel_operation,
            operation_runtime::get_operation_progress,
            operation_runtime::clear_operation,
            db::get_database_status,
            db::upsert_setting,
            db::list_settings,
            db::upsert_favorite,
            db::list_favorites,
            db::remove_favorite,
            db::record_recent_tool,
            db::list_recents,
            db::save_tool_preset,
            db::list_tool_presets,
            db::delete_tool_preset,
            db::append_tool_history,
            db::list_tool_history,
            db::clear_tool_history,
            db::save_chain,
            db::list_chains,
            db::delete_chain,
            db::get_storage_model_counts,
            db::export_user_data_json,
            db::import_user_data_json
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            lifecycle::mark_clean_shutdown(app_handle);
        }
    });
}
