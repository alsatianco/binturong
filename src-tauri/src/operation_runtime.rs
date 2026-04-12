use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationProgress {
    pub operation_id: String,
    pub progress_percent: u8,
    pub message: String,
    pub cancelled: bool,
    pub updated_at_unix: i64,
}

#[derive(Debug)]
pub struct OperationRuntime {
    operations: RwLock<HashMap<String, OperationProgress>>,
}

fn now_unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

impl OperationRuntime {
    pub fn new() -> Self {
        Self {
            operations: RwLock::new(HashMap::new()),
        }
    }

    pub fn create_operation(&self, operation_id: String) -> Result<OperationProgress, String> {
        if operation_id.trim().is_empty() {
            return Err("operation id cannot be empty".to_string());
        }

        let operation = OperationProgress {
            operation_id: operation_id.clone(),
            progress_percent: 0,
            message: "Created".to_string(),
            cancelled: false,
            updated_at_unix: now_unix_secs(),
        };

        self.operations
            .write()
            .expect("operation runtime lock poisoned")
            .insert(operation_id, operation.clone());
        Ok(operation)
    }

    pub fn update_progress(
        &self,
        operation_id: String,
        progress_percent: u8,
        message: String,
    ) -> Result<OperationProgress, String> {
        let mut operations = self
            .operations
            .write()
            .expect("operation runtime lock poisoned");
        let Some(operation) = operations.get_mut(&operation_id) else {
            return Err(format!("operation not found: {operation_id}"));
        };

        operation.progress_percent = progress_percent.min(100);
        operation.message = message;
        operation.updated_at_unix = now_unix_secs();
        Ok(operation.clone())
    }

    pub fn cancel_operation(&self, operation_id: String) -> Result<OperationProgress, String> {
        let mut operations = self
            .operations
            .write()
            .expect("operation runtime lock poisoned");
        let Some(operation) = operations.get_mut(&operation_id) else {
            return Err(format!("operation not found: {operation_id}"));
        };

        operation.cancelled = true;
        operation.updated_at_unix = now_unix_secs();
        Ok(operation.clone())
    }

    pub fn get_operation(&self, operation_id: String) -> Option<OperationProgress> {
        self.operations
            .read()
            .expect("operation runtime lock poisoned")
            .get(&operation_id)
            .cloned()
    }

    pub fn clear_operation(&self, operation_id: String) -> bool {
        self.operations
            .write()
            .expect("operation runtime lock poisoned")
            .remove(&operation_id)
            .is_some()
    }
}

#[tauri::command]
pub fn create_operation(
    runtime: tauri::State<'_, OperationRuntime>,
    operation_id: String,
) -> Result<OperationProgress, String> {
    runtime.create_operation(operation_id)
}

#[tauri::command]
pub fn update_operation_progress(
    runtime: tauri::State<'_, OperationRuntime>,
    operation_id: String,
    progress_percent: u8,
    message: String,
) -> Result<OperationProgress, String> {
    runtime.update_progress(operation_id, progress_percent, message)
}

#[tauri::command]
pub fn cancel_operation(
    runtime: tauri::State<'_, OperationRuntime>,
    operation_id: String,
) -> Result<OperationProgress, String> {
    runtime.cancel_operation(operation_id)
}

#[tauri::command]
pub fn get_operation_progress(
    runtime: tauri::State<'_, OperationRuntime>,
    operation_id: String,
) -> Option<OperationProgress> {
    runtime.get_operation(operation_id)
}

#[tauri::command]
pub fn clear_operation(
    runtime: tauri::State<'_, OperationRuntime>,
    operation_id: String,
) -> bool {
    runtime.clear_operation(operation_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_handles_create_update_cancel() {
        let runtime = OperationRuntime::new();
        runtime
            .create_operation("op-1".to_string())
            .expect("create operation");

        let updated = runtime
            .update_progress("op-1".to_string(), 45, "Working".to_string())
            .expect("update operation");
        assert_eq!(updated.progress_percent, 45);

        let cancelled = runtime
            .cancel_operation("op-1".to_string())
            .expect("cancel operation");
        assert!(cancelled.cancelled);
    }

    #[test]
    fn runtime_clears_operation() {
        let runtime = OperationRuntime::new();
        runtime
            .create_operation("op-2".to_string())
            .expect("create operation");
        assert!(runtime.clear_operation("op-2".to_string()));
        assert!(runtime.get_operation("op-2".to_string()).is_none());
    }
}
