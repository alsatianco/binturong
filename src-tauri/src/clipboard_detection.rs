use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;

use crate::tool_registry::{ClipboardPatternKind, ToolRegistry};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardDetectionMatch {
    pub tool_id: String,
    pub tool_name: String,
    pub confidence: u8,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardDetectionResult {
    pub source_length: usize,
    pub top_matches: Vec<ClipboardDetectionMatch>,
}

fn score_pattern(kind: &ClipboardPatternKind, pattern_value: &str, content: &str) -> Option<f32> {
    match kind {
        ClipboardPatternKind::Prefix => {
            if content.starts_with(pattern_value) {
                Some(1.0)
            } else {
                None
            }
        }
        ClipboardPatternKind::Contains => {
            if content.contains(pattern_value) {
                let density = (pattern_value.len() as f32 / content.len().max(1) as f32).min(1.0);
                Some((0.6 + density).min(1.0))
            } else {
                None
            }
        }
        ClipboardPatternKind::Regex => Regex::new(pattern_value)
            .ok()
            .and_then(|regex| if regex.is_match(content) { Some(0.9) } else { None }),
    }
}

pub fn detect_content(registry: &ToolRegistry, content: &str) -> ClipboardDetectionResult {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return ClipboardDetectionResult {
            source_length: 0,
            top_matches: Vec::new(),
        };
    }

    let mut scores_by_tool: HashMap<String, (f32, String, String)> = HashMap::new();
    for tool in registry.list() {
        let mut best_score = 0.0_f32;
        let mut best_reason = String::new();

        for pattern in &tool.clipboard_patterns {
            let Some(multiplier) = score_pattern(&pattern.kind, &pattern.value, trimmed) else {
                continue;
            };

            let score = pattern.confidence as f32 * multiplier;
            if score > best_score {
                best_score = score;
                best_reason = match pattern.kind {
                    ClipboardPatternKind::Prefix => {
                        format!("prefix match '{}'", pattern.value)
                    }
                    ClipboardPatternKind::Contains => {
                        format!("contains '{}'", pattern.value)
                    }
                    ClipboardPatternKind::Regex => {
                        format!("regex match /{}/", pattern.value)
                    }
                };
            }
        }

        // Additional heuristic boosts for higher-confidence disambiguation.
        if trimmed.starts_with('{') || trimmed.starts_with('[') {
            if tool.id == "json-format" {
                best_score += 12.0;
                best_reason = "json-shaped payload".to_string();
            }
        }

        if best_score > 0.0 {
            scores_by_tool.insert(tool.id.clone(), (best_score, tool.name.clone(), best_reason));
        }
    }

    let mut matches: Vec<ClipboardDetectionMatch> = scores_by_tool
        .into_iter()
        .map(|(tool_id, (score, tool_name, reason))| ClipboardDetectionMatch {
            tool_id,
            tool_name,
            confidence: score.round().clamp(1.0, 100.0) as u8,
            reason,
        })
        .collect();

    matches.sort_by(|left, right| {
        right
            .confidence
            .cmp(&left.confidence)
            .then_with(|| left.tool_name.cmp(&right.tool_name))
    });
    matches.truncate(3);

    ClipboardDetectionResult {
        source_length: trimmed.len(),
        top_matches: matches,
    }
}

#[tauri::command]
pub fn detect_clipboard_content(
    registry: tauri::State<'_, ToolRegistry>,
    content: String,
) -> ClipboardDetectionResult {
    detect_content(registry.inner(), &content)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool_registry::ToolRegistry;

    #[test]
    fn json_payload_prefers_json_tool() {
        let registry = ToolRegistry::with_builtin_tools().expect("tool registry");
        let detection = detect_content(&registry, "{\"name\":\"binturong\"}");
        assert!(!detection.top_matches.is_empty());
        assert_eq!(detection.top_matches[0].tool_id, "json-format");
    }

    #[test]
    fn returns_at_most_three_matches() {
        let registry = ToolRegistry::with_builtin_tools().expect("tool registry");
        let detection = detect_content(&registry, "abc123+/=");
        assert!(detection.top_matches.len() <= 3);
    }

    #[test]
    fn empty_input_returns_no_matches() {
        let registry = ToolRegistry::with_builtin_tools().expect("tool registry");
        let detection = detect_content(&registry, "   ");
        assert_eq!(detection.top_matches.len(), 0);
    }
}
