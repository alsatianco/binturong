use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AppErrorCode {
    Validation,
    Parse,
    Database,
    Registry,
    Lifecycle,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
    pub context: String,
    pub suggestion: String,
    pub technical_details: String,
}

impl AppError {
    pub fn new(
        code: AppErrorCode,
        context: impl Into<String>,
        message: impl Into<String>,
        suggestion: impl Into<String>,
        technical_details: impl Into<String>,
    ) -> Self {
        Self {
            code,
            message: message.into(),
            context: context.into(),
            suggestion: suggestion.into(),
            technical_details: technical_details.into(),
        }
    }
}

pub fn format_actionable_error(error: &AppError) -> String {
    format!(
        "[{:?}] {}. Context: {}. Suggestion: {}. Details: {}",
        error.code, error.message, error.context, error.suggestion, error.technical_details
    )
}

pub fn format_database_error(context: &str, source: impl std::fmt::Display) -> String {
    format_actionable_error(&AppError::new(
        AppErrorCode::Database,
        context,
        "Database operation failed",
        "Retry the action. If it persists, export data and inspect the local database file permissions.",
        source.to_string(),
    ))
}

pub fn format_registry_error(context: &str, source: impl std::fmt::Display) -> String {
    format_actionable_error(&AppError::new(
        AppErrorCode::Registry,
        context,
        "Tool registry operation failed",
        "Verify the tool definition metadata and restart the app.",
        source.to_string(),
    ))
}

pub fn format_lifecycle_error(context: &str, source: impl std::fmt::Display) -> String {
    format_actionable_error(&AppError::new(
        AppErrorCode::Lifecycle,
        context,
        "Lifecycle operation failed",
        "Restart the app. If the problem persists, inspect runtime-state.json in app data.",
        source.to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formatter_includes_context_and_suggestion() {
        let error = AppError::new(
            AppErrorCode::Database,
            "db.list_settings",
            "Database operation failed",
            "Retry",
            "disk io error",
        );

        let formatted = format_actionable_error(&error);
        assert!(formatted.contains("db.list_settings"));
        assert!(formatted.contains("Suggestion: Retry"));
        assert!(formatted.contains("disk io error"));
    }
}
