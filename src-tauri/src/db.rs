use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    error::Error,
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use crate::error_model;

const DB_FILE_NAME: &str = "binturong.sqlite3";
const LATEST_SCHEMA_VERSION: i64 = 5;
const TOOL_HISTORY_LIMIT: usize = 20;

#[derive(Debug, Clone, Copy)]
struct Migration {
    version: i64,
    sql: &'static str,
}

#[derive(Debug)]
struct MigrationReport {
    applied_versions: Vec<i64>,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        sql: r#"
            CREATE TABLE IF NOT EXISTS app_kv (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at_unix INTEGER NOT NULL
            );
        "#,
    },
    Migration {
        version: 2,
        sql: r#"
            CREATE TABLE IF NOT EXISTS session_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload_json TEXT NOT NULL,
                updated_at_unix INTEGER NOT NULL
            );
        "#,
    },
    Migration {
        version: 3,
        sql: r#"
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY NOT NULL,
                value_json TEXT NOT NULL,
                updated_at_unix INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS favorites (
                tool_id TEXT PRIMARY KEY NOT NULL,
                position INTEGER NOT NULL,
                created_at_unix INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recents (
                tool_id TEXT PRIMARY KEY NOT NULL,
                last_used_at_unix INTEGER NOT NULL,
                use_count INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tool_presets (
                id TEXT PRIMARY KEY NOT NULL,
                tool_id TEXT NOT NULL,
                name TEXT NOT NULL,
                config_json TEXT NOT NULL,
                created_at_unix INTEGER NOT NULL,
                updated_at_unix INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tool_presets_tool_id ON tool_presets(tool_id);

            CREATE TABLE IF NOT EXISTS tool_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool_id TEXT NOT NULL,
                input_snapshot TEXT NOT NULL,
                output_snapshot TEXT NOT NULL,
                created_at_unix INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tool_history_tool_id_created_at
                ON tool_history(tool_id, created_at_unix DESC);

            CREATE TABLE IF NOT EXISTS saved_chains (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                chain_json TEXT NOT NULL,
                created_at_unix INTEGER NOT NULL,
                updated_at_unix INTEGER NOT NULL
            );
        "#,
    },
    Migration {
        version: 4,
        sql: r#"
            CREATE TABLE IF NOT EXISTS clipboard_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cipher_text BLOB NOT NULL,
                nonce BLOB NOT NULL,
                created_at_unix INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_clipboard_history_created_at
                ON clipboard_history(created_at_unix DESC);
        "#,
    },
    Migration {
        version: 5,
        sql: r#"
            DROP TABLE IF EXISTS clipboard_history;
            DROP INDEX IF EXISTS idx_clipboard_history_created_at;
        "#,
    },
];

#[derive(Debug)]
pub struct DatabaseLayer {
    connection: Mutex<Connection>,
    db_path: PathBuf,
    latest_schema_version: i64,
    applied_migrations_on_boot: Vec<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatus {
    pub db_path: String,
    pub current_schema_version: i64,
    pub latest_schema_version: i64,
    pub applied_migrations_on_boot: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingRecord {
    pub key: String,
    pub value_json: String,
    pub updated_at_unix: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteRecord {
    pub tool_id: String,
    pub position: i64,
    pub created_at_unix: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentRecord {
    pub tool_id: String,
    pub last_used_at_unix: i64,
    pub use_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolPresetRecord {
    pub id: String,
    pub tool_id: String,
    pub name: String,
    pub config_json: String,
    pub created_at_unix: i64,
    pub updated_at_unix: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolHistoryRecord {
    pub id: i64,
    pub tool_id: String,
    pub input_snapshot: String,
    pub output_snapshot: String,
    pub created_at_unix: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedChainRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub chain_json: String,
    pub created_at_unix: i64,
    pub updated_at_unix: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageModelCounts {
    pub settings_count: i64,
    pub favorites_count: i64,
    pub recents_count: i64,
    pub presets_count: i64,
    pub history_count: i64,
    pub chains_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataExportBundle {
    pub schema_version: i64,
    pub generated_at_unix: i64,
    pub settings: Vec<SettingRecord>,
    pub favorites: Vec<FavoriteRecord>,
    pub recents: Vec<RecentRecord>,
    pub presets: Vec<ToolPresetRecord>,
    pub history: Vec<ToolHistoryRecord>,
    pub chains: Vec<SavedChainRecord>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportCounts {
    pub settings: usize,
    pub favorites: usize,
    pub recents: usize,
    pub presets: usize,
    pub history: usize,
    pub chains: usize,
    pub ignored_invalid_records: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataImportResult {
    pub declared_schema_version: Option<i64>,
    pub imported_counts: ImportCounts,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct DataImportBundle {
    schema_version: Option<i64>,
    settings: Vec<ImportSettingRecord>,
    favorites: Vec<ImportFavoriteRecord>,
    recents: Vec<ImportRecentRecord>,
    presets: Vec<ImportToolPresetRecord>,
    history: Vec<ImportToolHistoryRecord>,
    chains: Vec<ImportSavedChainRecord>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ImportSettingRecord {
    key: String,
    value_json: String,
    updated_at_unix: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ImportFavoriteRecord {
    tool_id: String,
    position: i64,
    created_at_unix: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ImportRecentRecord {
    tool_id: String,
    last_used_at_unix: Option<i64>,
    use_count: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ImportToolPresetRecord {
    id: String,
    tool_id: String,
    name: String,
    config_json: String,
    created_at_unix: Option<i64>,
    updated_at_unix: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ImportToolHistoryRecord {
    tool_id: String,
    input_snapshot: String,
    output_snapshot: String,
    created_at_unix: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ImportSavedChainRecord {
    id: String,
    name: String,
    description: String,
    chain_json: String,
    created_at_unix: Option<i64>,
    updated_at_unix: Option<i64>,
}

fn now_unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn ensure_schema_version_table(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY NOT NULL,
            applied_at_unix INTEGER NOT NULL
        );
        "#,
    )?;

    let row_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM schema_version;",
        [],
        |row| row.get(0),
    )?;

    if row_count == 0 {
        connection.execute(
            "INSERT INTO schema_version (version, applied_at_unix) VALUES (0, ?1);",
            params![now_unix_secs()],
        )?;
    }

    Ok(())
}

fn current_schema_version(connection: &Connection) -> rusqlite::Result<i64> {
    connection.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version;",
        [],
        |row| row.get(0),
    )
}

fn run_migrations(
    connection: &mut Connection,
    migrations: &[Migration],
) -> Result<MigrationReport, Box<dyn Error>> {
    let transaction = connection.transaction()?;
    ensure_schema_version_table(&transaction)?;
    let existing_version = current_schema_version(&transaction)?;
    let mut applied_versions = Vec::new();

    for migration in migrations
        .iter()
        .filter(|migration| migration.version > existing_version)
    {
        transaction.execute_batch(migration.sql)?;
        transaction.execute(
            "INSERT INTO schema_version (version, applied_at_unix) VALUES (?1, ?2);",
            params![migration.version, now_unix_secs()],
        )?;
        applied_versions.push(migration.version);
    }

    transaction.commit()?;

    Ok(MigrationReport { applied_versions })
}

pub fn initialize(app_handle: &tauri::AppHandle) -> Result<DatabaseLayer, Box<dyn Error>> {
    let app_data_dir = app_handle.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join(DB_FILE_NAME);
    let mut connection = Connection::open(&db_path)?;
    connection.busy_timeout(Duration::from_secs(3))?;
    connection.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        "#,
    )?;

    let migration_report = run_migrations(&mut connection, MIGRATIONS)?;

    Ok(DatabaseLayer {
        connection: Mutex::new(connection),
        db_path,
        latest_schema_version: LATEST_SCHEMA_VERSION,
        applied_migrations_on_boot: migration_report.applied_versions,
    })
}

impl DatabaseLayer {
    fn db_status(&self) -> Result<DatabaseStatus, Box<dyn Error>> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let current_version = current_schema_version(&connection)?;
        Ok(DatabaseStatus {
            db_path: self.db_path.display().to_string(),
            current_schema_version: current_version,
            latest_schema_version: self.latest_schema_version,
            applied_migrations_on_boot: self.applied_migrations_on_boot.clone(),
        })
    }

    fn upsert_setting(&self, key: String, value_json: String) -> rusqlite::Result<SettingRecord> {
        let updated_at_unix = now_unix_secs();
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            r#"
            INSERT INTO settings (key, value_json, updated_at_unix)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(key) DO UPDATE
            SET value_json = excluded.value_json,
                updated_at_unix = excluded.updated_at_unix;
            "#,
            params![key, value_json, updated_at_unix],
        )?;

        Ok(SettingRecord {
            key,
            value_json,
            updated_at_unix,
        })
    }

    fn list_settings(&self) -> rusqlite::Result<Vec<SettingRecord>> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT key, value_json, updated_at_unix FROM settings ORDER BY key ASC;",
        )?;

        let rows = statement.query_map([], |row| {
            Ok(SettingRecord {
                key: row.get(0)?,
                value_json: row.get(1)?,
                updated_at_unix: row.get(2)?,
            })
        })?;

        rows.collect()
    }

    fn upsert_favorite(&self, tool_id: String, position: i64) -> rusqlite::Result<FavoriteRecord> {
        let created_at_unix = now_unix_secs();
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            r#"
            INSERT INTO favorites (tool_id, position, created_at_unix)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(tool_id) DO UPDATE
            SET position = excluded.position;
            "#,
            params![tool_id, position, created_at_unix],
        )?;
        connection.execute(
            r#"
            DELETE FROM favorites
            WHERE tool_id NOT IN (
                SELECT tool_id
                FROM favorites
                ORDER BY position ASC, created_at_unix ASC
                LIMIT 20
            );
            "#,
            [],
        )?;

        let stored_created_at_unix: Option<i64> = connection
            .query_row(
                "SELECT created_at_unix FROM favorites WHERE tool_id = ?1;",
                params![tool_id],
                |row| row.get(0),
            )
            .optional()?;

        Ok(FavoriteRecord {
            tool_id,
            position,
            created_at_unix: stored_created_at_unix.unwrap_or(created_at_unix),
        })
    }

    fn list_favorites(&self) -> rusqlite::Result<Vec<FavoriteRecord>> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT tool_id, position, created_at_unix FROM favorites ORDER BY position ASC;",
        )?;

        let rows = statement.query_map([], |row| {
            Ok(FavoriteRecord {
                tool_id: row.get(0)?,
                position: row.get(1)?,
                created_at_unix: row.get(2)?,
            })
        })?;

        rows.collect()
    }

    fn remove_favorite(&self, tool_id: String) -> rusqlite::Result<()> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            "DELETE FROM favorites WHERE tool_id = ?1;",
            params![tool_id],
        )?;
        Ok(())
    }

    fn record_recent_tool(&self, tool_id: String) -> rusqlite::Result<RecentRecord> {
        let now = now_unix_secs();
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            r#"
            INSERT INTO recents (tool_id, last_used_at_unix, use_count)
            VALUES (?1, ?2, 1)
            ON CONFLICT(tool_id) DO UPDATE
            SET last_used_at_unix = excluded.last_used_at_unix,
                use_count = recents.use_count + 1;
            "#,
            params![tool_id, now],
        )?;
        connection.execute(
            r#"
            DELETE FROM recents
            WHERE tool_id NOT IN (
                SELECT tool_id
                FROM recents
                ORDER BY last_used_at_unix DESC
                LIMIT 15
            );
            "#,
            [],
        )?;

        let stored_record: Option<RecentRecord> = connection
            .query_row(
                "SELECT tool_id, last_used_at_unix, use_count FROM recents WHERE tool_id = ?1;",
                params![tool_id],
                |row| {
                    Ok(RecentRecord {
                        tool_id: row.get(0)?,
                        last_used_at_unix: row.get(1)?,
                        use_count: row.get(2)?,
                    })
                },
            )
            .optional()?;

        Ok(stored_record.unwrap_or(RecentRecord {
            tool_id,
            last_used_at_unix: now,
            use_count: 1,
        }))
    }

    fn list_recents(&self) -> rusqlite::Result<Vec<RecentRecord>> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT tool_id, last_used_at_unix, use_count FROM recents ORDER BY last_used_at_unix DESC;",
        )?;

        let rows = statement.query_map([], |row| {
            Ok(RecentRecord {
                tool_id: row.get(0)?,
                last_used_at_unix: row.get(1)?,
                use_count: row.get(2)?,
            })
        })?;

        rows.collect()
    }

    fn save_tool_preset(
        &self,
        id: String,
        tool_id: String,
        name: String,
        config_json: String,
    ) -> rusqlite::Result<ToolPresetRecord> {
        let now = now_unix_secs();
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            r#"
            INSERT INTO tool_presets (
                id,
                tool_id,
                name,
                config_json,
                created_at_unix,
                updated_at_unix
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE
            SET tool_id = excluded.tool_id,
                name = excluded.name,
                config_json = excluded.config_json,
                updated_at_unix = excluded.updated_at_unix;
            "#,
            params![id, tool_id, name, config_json, now, now],
        )?;

        connection.query_row(
            r#"
            SELECT id, tool_id, name, config_json, created_at_unix, updated_at_unix
            FROM tool_presets
            WHERE id = ?1;
            "#,
            params![id],
            |row| {
                Ok(ToolPresetRecord {
                    id: row.get(0)?,
                    tool_id: row.get(1)?,
                    name: row.get(2)?,
                    config_json: row.get(3)?,
                    created_at_unix: row.get(4)?,
                    updated_at_unix: row.get(5)?,
                })
            },
        )
    }

    fn list_tool_presets(&self, tool_id: Option<String>) -> rusqlite::Result<Vec<ToolPresetRecord>> {
        let connection = self.connection.lock().expect("database mutex poisoned");

        if let Some(tool_id) = tool_id {
            let mut statement = connection.prepare(
                r#"
                SELECT id, tool_id, name, config_json, created_at_unix, updated_at_unix
                FROM tool_presets
                WHERE tool_id = ?1
                ORDER BY updated_at_unix DESC;
                "#,
            )?;

            let rows = statement.query_map(params![tool_id], |row| {
                Ok(ToolPresetRecord {
                    id: row.get(0)?,
                    tool_id: row.get(1)?,
                    name: row.get(2)?,
                    config_json: row.get(3)?,
                    created_at_unix: row.get(4)?,
                    updated_at_unix: row.get(5)?,
                })
            })?;

            return rows.collect();
        }

        let mut statement = connection.prepare(
            r#"
            SELECT id, tool_id, name, config_json, created_at_unix, updated_at_unix
            FROM tool_presets
            ORDER BY updated_at_unix DESC;
            "#,
        )?;

        let rows = statement.query_map([], |row| {
            Ok(ToolPresetRecord {
                id: row.get(0)?,
                tool_id: row.get(1)?,
                name: row.get(2)?,
                config_json: row.get(3)?,
                created_at_unix: row.get(4)?,
                updated_at_unix: row.get(5)?,
            })
        })?;

        rows.collect()
    }

    fn delete_tool_preset(&self, id: String) -> rusqlite::Result<()> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            "DELETE FROM tool_presets WHERE id = ?1;",
            params![id],
        )?;
        Ok(())
    }

    fn append_tool_history(
        &self,
        tool_id: String,
        input_snapshot: String,
        output_snapshot: String,
    ) -> rusqlite::Result<ToolHistoryRecord> {
        let created_at_unix = now_unix_secs();
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            r#"
            INSERT INTO tool_history (tool_id, input_snapshot, output_snapshot, created_at_unix)
            VALUES (?1, ?2, ?3, ?4);
            "#,
            params![tool_id, input_snapshot, output_snapshot, created_at_unix],
        )?;
        // Capture row ID immediately after INSERT, before DELETE could affect it
        let row_id = connection.last_insert_rowid();
        connection.execute(
            r#"
            DELETE FROM tool_history
            WHERE tool_id = ?1
              AND id NOT IN (
                SELECT id
                FROM tool_history
                WHERE tool_id = ?1
                ORDER BY id DESC
                LIMIT ?2
              );
            "#,
            params![tool_id, TOOL_HISTORY_LIMIT as i64],
        )?;
        Ok(ToolHistoryRecord {
            id: row_id,
            tool_id,
            input_snapshot,
            output_snapshot,
            created_at_unix,
        })
    }

    fn list_tool_history(&self, tool_id: Option<String>) -> rusqlite::Result<Vec<ToolHistoryRecord>> {
        let connection = self.connection.lock().expect("database mutex poisoned");

        if let Some(tool_id) = tool_id {
            let mut statement = connection.prepare(
                r#"
                SELECT id, tool_id, input_snapshot, output_snapshot, created_at_unix
                FROM tool_history
                WHERE tool_id = ?1
                ORDER BY created_at_unix DESC;
                "#,
            )?;

            let rows = statement.query_map(params![tool_id], |row| {
                Ok(ToolHistoryRecord {
                    id: row.get(0)?,
                    tool_id: row.get(1)?,
                    input_snapshot: row.get(2)?,
                    output_snapshot: row.get(3)?,
                    created_at_unix: row.get(4)?,
                })
            })?;

            return rows.collect();
        }

        let mut statement = connection.prepare(
            r#"
            SELECT id, tool_id, input_snapshot, output_snapshot, created_at_unix
            FROM tool_history
            ORDER BY created_at_unix DESC;
            "#,
        )?;

        let rows = statement.query_map([], |row| {
            Ok(ToolHistoryRecord {
                id: row.get(0)?,
                tool_id: row.get(1)?,
                input_snapshot: row.get(2)?,
                output_snapshot: row.get(3)?,
                created_at_unix: row.get(4)?,
            })
        })?;

        rows.collect()
    }

    fn clear_tool_history(&self, tool_id: Option<String>) -> rusqlite::Result<usize> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        if let Some(tool_id) = tool_id {
            return connection.execute(
                "DELETE FROM tool_history WHERE tool_id = ?1;",
                params![tool_id],
            );
        }

        connection.execute("DELETE FROM tool_history;", [])
    }

    fn save_chain(
        &self,
        id: String,
        name: String,
        description: String,
        chain_json: String,
    ) -> rusqlite::Result<SavedChainRecord> {
        let now = now_unix_secs();
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            r#"
            INSERT INTO saved_chains (
                id,
                name,
                description,
                chain_json,
                created_at_unix,
                updated_at_unix
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE
            SET name = excluded.name,
                description = excluded.description,
                chain_json = excluded.chain_json,
                updated_at_unix = excluded.updated_at_unix;
            "#,
            params![id, name, description, chain_json, now, now],
        )?;

        connection.query_row(
            r#"
            SELECT id, name, description, chain_json, created_at_unix, updated_at_unix
            FROM saved_chains
            WHERE id = ?1;
            "#,
            params![id],
            |row| {
                Ok(SavedChainRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    chain_json: row.get(3)?,
                    created_at_unix: row.get(4)?,
                    updated_at_unix: row.get(5)?,
                })
            },
        )
    }

    fn list_chains(&self) -> rusqlite::Result<Vec<SavedChainRecord>> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let mut statement = connection.prepare(
            r#"
            SELECT id, name, description, chain_json, created_at_unix, updated_at_unix
            FROM saved_chains
            ORDER BY updated_at_unix DESC;
            "#,
        )?;

        let rows = statement.query_map([], |row| {
            Ok(SavedChainRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                chain_json: row.get(3)?,
                created_at_unix: row.get(4)?,
                updated_at_unix: row.get(5)?,
            })
        })?;

        rows.collect()
    }

    fn delete_chain(&self, id: String) -> rusqlite::Result<usize> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute("DELETE FROM saved_chains WHERE id = ?1;", params![id])
    }

    fn storage_model_counts(&self) -> rusqlite::Result<StorageModelCounts> {
        let connection = self.connection.lock().expect("database mutex poisoned");

        let settings_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM settings;", [], |row| row.get(0))?;
        let favorites_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM favorites;", [], |row| row.get(0))?;
        let recents_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM recents;", [], |row| row.get(0))?;
        let presets_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM tool_presets;", [], |row| row.get(0))?;
        let history_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM tool_history;", [], |row| row.get(0))?;
        let chains_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM saved_chains;", [], |row| row.get(0))?;

        Ok(StorageModelCounts {
            settings_count,
            favorites_count,
            recents_count,
            presets_count,
            history_count,
            chains_count,
        })
    }

    fn export_data_bundle(&self) -> Result<DataExportBundle, Box<dyn Error>> {
        Ok(DataExportBundle {
            schema_version: self.latest_schema_version,
            generated_at_unix: now_unix_secs(),
            settings: self.list_settings()?,
            favorites: self.list_favorites()?,
            recents: self.list_recents()?,
            presets: self.list_tool_presets(None)?,
            history: self.list_tool_history(None)?,
            chains: self.list_chains()?,
        })
    }

    fn export_data_json(&self) -> Result<String, Box<dyn Error>> {
        let bundle = self.export_data_bundle()?;
        serde_json::to_string_pretty(&bundle).map_err(|error| error.into())
    }

    fn import_data_json(&self, payload_json: String) -> Result<DataImportResult, Box<dyn Error>> {
        let import_bundle: DataImportBundle = serde_json::from_str(&payload_json)?;
        let mut counts = ImportCounts::default();
        let mut connection = self.connection.lock().expect("database mutex poisoned");
        let transaction = connection.transaction()?;

        for record in import_bundle.settings {
            if record.key.trim().is_empty() {
                counts.ignored_invalid_records += 1;
                continue;
            }

            transaction.execute(
                r#"
                INSERT INTO settings (key, value_json, updated_at_unix)
                VALUES (?1, ?2, ?3)
                ON CONFLICT(key) DO UPDATE
                SET value_json = excluded.value_json,
                    updated_at_unix = excluded.updated_at_unix;
                "#,
                params![
                    record.key,
                    record.value_json,
                    record.updated_at_unix.unwrap_or_else(now_unix_secs)
                ],
            )?;
            counts.settings += 1;
        }

        for record in import_bundle.favorites {
            if record.tool_id.trim().is_empty() {
                counts.ignored_invalid_records += 1;
                continue;
            }

            transaction.execute(
                r#"
                INSERT INTO favorites (tool_id, position, created_at_unix)
                VALUES (?1, ?2, ?3)
                ON CONFLICT(tool_id) DO UPDATE
                SET position = excluded.position;
                "#,
                params![
                    record.tool_id,
                    record.position,
                    record.created_at_unix.unwrap_or_else(now_unix_secs)
                ],
            )?;
            counts.favorites += 1;
        }

        for record in import_bundle.recents {
            if record.tool_id.trim().is_empty() {
                counts.ignored_invalid_records += 1;
                continue;
            }

            transaction.execute(
                r#"
                INSERT INTO recents (tool_id, last_used_at_unix, use_count)
                VALUES (?1, ?2, ?3)
                ON CONFLICT(tool_id) DO UPDATE
                SET last_used_at_unix = excluded.last_used_at_unix,
                    use_count = excluded.use_count;
                "#,
                params![
                    record.tool_id,
                    record.last_used_at_unix.unwrap_or_else(now_unix_secs),
                    record.use_count.unwrap_or(1)
                ],
            )?;
            counts.recents += 1;
        }

        for record in import_bundle.presets {
            if record.id.trim().is_empty() || record.tool_id.trim().is_empty() {
                counts.ignored_invalid_records += 1;
                continue;
            }

            let now = now_unix_secs();
            transaction.execute(
                r#"
                INSERT INTO tool_presets (
                    id,
                    tool_id,
                    name,
                    config_json,
                    created_at_unix,
                    updated_at_unix
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(id) DO UPDATE
                SET tool_id = excluded.tool_id,
                    name = excluded.name,
                    config_json = excluded.config_json,
                    updated_at_unix = excluded.updated_at_unix;
                "#,
                params![
                    record.id,
                    record.tool_id,
                    record.name,
                    record.config_json,
                    record.created_at_unix.unwrap_or(now),
                    record.updated_at_unix.unwrap_or(now)
                ],
            )?;
            counts.presets += 1;
        }

        for record in import_bundle.history {
            if record.tool_id.trim().is_empty() {
                counts.ignored_invalid_records += 1;
                continue;
            }

            transaction.execute(
                r#"
                INSERT INTO tool_history (tool_id, input_snapshot, output_snapshot, created_at_unix)
                VALUES (?1, ?2, ?3, ?4);
                "#,
                params![
                    record.tool_id,
                    record.input_snapshot,
                    record.output_snapshot,
                    record.created_at_unix.unwrap_or_else(now_unix_secs)
                ],
            )?;
            counts.history += 1;
        }

        for record in import_bundle.chains {
            if record.id.trim().is_empty() {
                counts.ignored_invalid_records += 1;
                continue;
            }

            let now = now_unix_secs();
            transaction.execute(
                r#"
                INSERT INTO saved_chains (
                    id,
                    name,
                    description,
                    chain_json,
                    created_at_unix,
                    updated_at_unix
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(id) DO UPDATE
                SET name = excluded.name,
                    description = excluded.description,
                    chain_json = excluded.chain_json,
                    updated_at_unix = excluded.updated_at_unix;
                "#,
                params![
                    record.id,
                    record.name,
                    record.description,
                    record.chain_json,
                    record.created_at_unix.unwrap_or(now),
                    record.updated_at_unix.unwrap_or(now)
                ],
            )?;
            counts.chains += 1;
        }

        transaction.commit()?;

        Ok(DataImportResult {
            declared_schema_version: import_bundle.schema_version,
            imported_counts: counts,
        })
    }
}

#[tauri::command]
pub fn get_database_status(
    db: tauri::State<'_, DatabaseLayer>,
) -> Result<DatabaseStatus, String> {
    db.db_status()
        .map_err(|error| error_model::format_database_error("db.get_database_status", error))
}

#[tauri::command]
pub fn upsert_setting(
    db: tauri::State<'_, DatabaseLayer>,
    key: String,
    value_json: String,
) -> Result<SettingRecord, String> {
    db.upsert_setting(key, value_json)
        .map_err(|error| error_model::format_database_error("db.upsert_setting", error))
}

#[tauri::command]
pub fn list_settings(db: tauri::State<'_, DatabaseLayer>) -> Result<Vec<SettingRecord>, String> {
    db.list_settings()
        .map_err(|error| error_model::format_database_error("db.list_settings", error))
}

#[tauri::command]
pub fn upsert_favorite(
    db: tauri::State<'_, DatabaseLayer>,
    tool_id: String,
    position: i64,
) -> Result<FavoriteRecord, String> {
    db.upsert_favorite(tool_id, position)
        .map_err(|error| error_model::format_database_error("db.upsert_favorite", error))
}

#[tauri::command]
pub fn list_favorites(
    db: tauri::State<'_, DatabaseLayer>,
) -> Result<Vec<FavoriteRecord>, String> {
    db.list_favorites()
        .map_err(|error| error_model::format_database_error("db.list_favorites", error))
}

#[tauri::command]
pub fn remove_favorite(
    db: tauri::State<'_, DatabaseLayer>,
    tool_id: String,
) -> Result<(), String> {
    db.remove_favorite(tool_id)
        .map_err(|error| error_model::format_database_error("db.remove_favorite", error))
}

#[tauri::command]
pub fn record_recent_tool(
    db: tauri::State<'_, DatabaseLayer>,
    tool_id: String,
) -> Result<RecentRecord, String> {
    db.record_recent_tool(tool_id)
        .map_err(|error| error_model::format_database_error("db.record_recent_tool", error))
}

#[tauri::command]
pub fn list_recents(db: tauri::State<'_, DatabaseLayer>) -> Result<Vec<RecentRecord>, String> {
    db.list_recents()
        .map_err(|error| error_model::format_database_error("db.list_recents", error))
}

#[tauri::command]
pub fn save_tool_preset(
    db: tauri::State<'_, DatabaseLayer>,
    id: String,
    tool_id: String,
    name: String,
    config_json: String,
) -> Result<ToolPresetRecord, String> {
    db.save_tool_preset(id, tool_id, name, config_json)
        .map_err(|error| error_model::format_database_error("db.save_tool_preset", error))
}

#[tauri::command]
pub fn list_tool_presets(
    db: tauri::State<'_, DatabaseLayer>,
    tool_id: Option<String>,
) -> Result<Vec<ToolPresetRecord>, String> {
    db.list_tool_presets(tool_id)
        .map_err(|error| error_model::format_database_error("db.list_tool_presets", error))
}

#[tauri::command]
pub fn delete_tool_preset(
    db: tauri::State<'_, DatabaseLayer>,
    id: String,
) -> Result<(), String> {
    db.delete_tool_preset(id)
        .map_err(|error| error_model::format_database_error("db.delete_tool_preset", error))
}

#[tauri::command]
pub fn append_tool_history(
    db: tauri::State<'_, DatabaseLayer>,
    tool_id: String,
    input_snapshot: String,
    output_snapshot: String,
) -> Result<ToolHistoryRecord, String> {
    db.append_tool_history(tool_id, input_snapshot, output_snapshot)
        .map_err(|error| error_model::format_database_error("db.append_tool_history", error))
}

#[tauri::command]
pub fn list_tool_history(
    db: tauri::State<'_, DatabaseLayer>,
    tool_id: Option<String>,
) -> Result<Vec<ToolHistoryRecord>, String> {
    db.list_tool_history(tool_id)
        .map_err(|error| error_model::format_database_error("db.list_tool_history", error))
}

#[tauri::command]
pub fn clear_tool_history(
    db: tauri::State<'_, DatabaseLayer>,
    tool_id: Option<String>,
) -> Result<usize, String> {
    db.clear_tool_history(tool_id)
        .map_err(|error| error_model::format_database_error("db.clear_tool_history", error))
}

#[tauri::command]
pub fn save_chain(
    db: tauri::State<'_, DatabaseLayer>,
    id: String,
    name: String,
    description: String,
    chain_json: String,
) -> Result<SavedChainRecord, String> {
    db.save_chain(id, name, description, chain_json)
        .map_err(|error| error_model::format_database_error("db.save_chain", error))
}

#[tauri::command]
pub fn list_chains(
    db: tauri::State<'_, DatabaseLayer>,
) -> Result<Vec<SavedChainRecord>, String> {
    db.list_chains()
        .map_err(|error| error_model::format_database_error("db.list_chains", error))
}

#[tauri::command]
pub fn delete_chain(
    db: tauri::State<'_, DatabaseLayer>,
    id: String,
) -> Result<usize, String> {
    db.delete_chain(id)
        .map_err(|error| error_model::format_database_error("db.delete_chain", error))
}

#[tauri::command]
pub fn get_storage_model_counts(
    db: tauri::State<'_, DatabaseLayer>,
) -> Result<StorageModelCounts, String> {
    db.storage_model_counts()
        .map_err(|error| error_model::format_database_error("db.get_storage_model_counts", error))
}

#[tauri::command]
pub fn export_user_data_json(db: tauri::State<'_, DatabaseLayer>) -> Result<String, String> {
    db.export_data_json()
        .map_err(|error| error_model::format_database_error("db.export_user_data_json", error))
}

#[tauri::command]
pub fn import_user_data_json(
    db: tauri::State<'_, DatabaseLayer>,
    payload_json: String,
) -> Result<DataImportResult, String> {
    db.import_data_json(payload_json)
        .map_err(|error| error_model::format_database_error("db.import_user_data_json", error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{path::PathBuf, sync::Mutex};

    fn in_memory_layer() -> DatabaseLayer {
        let mut connection = Connection::open_in_memory().expect("open in-memory db");
        run_migrations(&mut connection, MIGRATIONS).expect("run migrations");

        DatabaseLayer {
            connection: Mutex::new(connection),
            db_path: PathBuf::from(":memory:"),
            latest_schema_version: LATEST_SCHEMA_VERSION,
            applied_migrations_on_boot: Vec::new(),
        }
    }

    #[test]
    fn migrations_apply_from_zero() {
        let mut connection = Connection::open_in_memory().expect("open in-memory db");
        let report = run_migrations(&mut connection, MIGRATIONS).expect("run migrations");

        assert_eq!(report.applied_versions, vec![1, 2, 3, 4, 5]);

        let stored_version = current_schema_version(&connection).expect("read schema version");
        assert_eq!(stored_version, LATEST_SCHEMA_VERSION);
    }

    #[test]
    fn migrations_are_transactional_on_failure() {
        let mut connection = Connection::open_in_memory().expect("open in-memory db");
        let bad_migrations = [
            Migration {
                version: 1,
                sql: "CREATE TABLE should_rollback (id INTEGER PRIMARY KEY);",
            },
            Migration {
                version: 2,
                sql: "CREATE TABLE broken_sql (",
            },
        ];

        let result = run_migrations(&mut connection, &bad_migrations);
        assert!(result.is_err());

        let rolled_back_table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback';",
                [],
                |row| row.get(0),
            )
            .expect("query sqlite_master");

        assert_eq!(rolled_back_table_count, 0);
    }

    #[test]
    fn storage_tables_exist_after_migration() {
        let mut connection = Connection::open_in_memory().expect("open in-memory db");
        run_migrations(&mut connection, MIGRATIONS).expect("run migrations");

        let table_names = [
            "settings",
            "favorites",
            "recents",
            "tool_presets",
            "tool_history",
            "saved_chains",
        ];

        for table_name in table_names {
            let count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1;",
                    params![table_name],
                    |row| row.get(0),
                )
                .expect("query sqlite_master");
            assert_eq!(count, 1, "table should exist: {table_name}");
        }
    }

    #[test]
    fn export_import_roundtrip_preserves_counts() {
        let source = in_memory_layer();
        source
            .upsert_setting("theme".to_string(), "\"tokyo-night\"".to_string())
            .expect("upsert setting");
        source
            .upsert_favorite("json-format".to_string(), 0)
            .expect("upsert favorite");
        source
            .record_recent_tool("json-format".to_string())
            .expect("record recent");
        source
            .save_tool_preset(
                "preset-1".to_string(),
                "json-format".to_string(),
                "Compact".to_string(),
                "{\"indent\":2}".to_string(),
            )
            .expect("save preset");
        source
            .append_tool_history(
                "json-format".to_string(),
                "{\"a\":1}".to_string(),
                "{\"a\":1}".to_string(),
            )
            .expect("append history");
        source
            .save_chain(
                "chain-1".to_string(),
                "Normalize JSON".to_string(),
                "Format then minify".to_string(),
                "[\"json-format\"]".to_string(),
            )
            .expect("save chain");

        let exported_json = source.export_data_json().expect("export data json");

        let target = in_memory_layer();
        let result = target
            .import_data_json(exported_json)
            .expect("import data json");

        assert_eq!(result.imported_counts.settings, 1);
        assert_eq!(result.imported_counts.favorites, 1);
        assert_eq!(result.imported_counts.recents, 1);
        assert_eq!(result.imported_counts.presets, 1);
        assert_eq!(result.imported_counts.history, 1);
        assert_eq!(result.imported_counts.chains, 1);

        let counts = target.storage_model_counts().expect("storage counts");
        assert_eq!(counts.settings_count, 1);
        assert_eq!(counts.favorites_count, 1);
        assert_eq!(counts.recents_count, 1);
        assert_eq!(counts.presets_count, 1);
        assert_eq!(counts.history_count, 1);
        assert_eq!(counts.chains_count, 1);
    }

    #[test]
    fn save_list_and_delete_chain_roundtrip() {
        let layer = in_memory_layer();
        let saved = layer
            .save_chain(
                "chain-delete-test".to_string(),
                "Delete Test".to_string(),
                "temporary chain".to_string(),
                "{\"steps\":[{\"toolId\":\"json-format\"}]}".to_string(),
            )
            .expect("save chain");
        assert_eq!(saved.id, "chain-delete-test");

        let listed = layer.list_chains().expect("list chains");
        assert!(listed.iter().any(|chain| chain.id == saved.id));

        let deleted_count = layer
            .delete_chain(saved.id.clone())
            .expect("delete chain");
        assert_eq!(deleted_count, 1);

        let listed_after_delete = layer.list_chains().expect("list chains after delete");
        assert!(listed_after_delete.iter().all(|chain| chain.id != saved.id));
    }

    #[test]
    fn tolerant_import_handles_missing_and_unknown_fields() {
        let layer = in_memory_layer();
        let payload = r#"
        {
          "schemaVersion": 99,
          "settings": [
            { "key": "theme", "valueJson": "\"forest\"", "unknownField": true },
            { "valueJson": "\"missing-key\"" }
          ],
          "favorites": [
            { "toolId": "json-format", "position": 0 },
            {}
          ],
          "extraPayload": { "ignored": true }
        }
        "#;

        let result = layer
            .import_data_json(payload.to_string())
            .expect("tolerant import should succeed");

        assert_eq!(result.declared_schema_version, Some(99));
        assert_eq!(result.imported_counts.settings, 1);
        assert_eq!(result.imported_counts.favorites, 1);
        assert!(result.imported_counts.ignored_invalid_records >= 2);
    }

    #[test]
    fn favorites_are_capped_at_twenty() {
        let layer = in_memory_layer();
        for index in 0..25 {
            layer
                .upsert_favorite(format!("tool-{index}"), index as i64)
                .expect("upsert favorite");
        }

        let favorites = layer.list_favorites().expect("list favorites");
        assert_eq!(favorites.len(), 20);
    }

    #[test]
    fn recents_are_capped_at_fifteen_distinct() {
        let layer = in_memory_layer();
        for index in 0..18 {
            layer
                .record_recent_tool(format!("tool-{index}"))
                .expect("record recent");
        }

        let recents = layer.list_recents().expect("list recents");
        assert_eq!(recents.len(), 15);
    }

    #[test]
    fn tool_preset_delete_removes_only_target_record() {
        let layer = in_memory_layer();
        layer
            .save_tool_preset(
                "preset-keep".to_string(),
                "json-format".to_string(),
                "Keep".to_string(),
                "{}".to_string(),
            )
            .expect("save keep preset");
        layer
            .save_tool_preset(
                "preset-delete".to_string(),
                "json-format".to_string(),
                "Delete".to_string(),
                "{}".to_string(),
            )
            .expect("save delete preset");

        layer
            .delete_tool_preset("preset-delete".to_string())
            .expect("delete preset");

        let presets = layer.list_tool_presets(None).expect("list presets");
        assert_eq!(presets.len(), 1);
        assert_eq!(presets[0].id, "preset-keep");
    }

    #[test]
    fn tool_history_clear_supports_tool_scoped_and_global() {
        let layer = in_memory_layer();
        layer
            .append_tool_history(
                "json-format".to_string(),
                "in-a".to_string(),
                "out-a".to_string(),
            )
            .expect("append history 1");
        layer
            .append_tool_history(
                "json-format".to_string(),
                "in-b".to_string(),
                "out-b".to_string(),
            )
            .expect("append history 2");
        layer
            .append_tool_history(
                "case-converter".to_string(),
                "in-c".to_string(),
                "out-c".to_string(),
            )
            .expect("append history 3");

        let cleared_for_tool = layer
            .clear_tool_history(Some("json-format".to_string()))
            .expect("clear scoped history");
        assert_eq!(cleared_for_tool, 2);

        let remaining = layer
            .list_tool_history(None)
            .expect("list history after scoped clear");
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].tool_id, "case-converter");

        let cleared_global = layer
            .clear_tool_history(None)
            .expect("clear global history");
        assert_eq!(cleared_global, 1);

        let empty = layer.list_tool_history(None).expect("list empty history");
        assert!(empty.is_empty());
    }

    #[test]
    fn tool_history_is_capped_to_default_limit() {
        let layer = in_memory_layer();
        for index in 0..25 {
            layer
                .append_tool_history(
                    "json-format".to_string(),
                    format!("in-{index}"),
                    format!("out-{index}"),
                )
                .expect("append history");
        }

        let history = layer
            .list_tool_history(Some("json-format".to_string()))
            .expect("list capped history");
        assert_eq!(history.len(), TOOL_HISTORY_LIMIT);
    }

}
