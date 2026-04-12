use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DataType {
    PlainText,
    StructuredText,
    Json,
    Binary,
    Image,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ClipboardPatternKind {
    Prefix,
    Contains,
    Regex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardPattern {
    pub kind: ClipboardPatternKind,
    pub value: String,
    pub confidence: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub aliases: Vec<String>,
    pub keywords: Vec<String>,
    pub clipboard_patterns: Vec<ClipboardPattern>,
    pub chain_accepts: Vec<DataType>,
    pub chain_produces: DataType,
    pub supports_batch: bool,
    pub supports_file_input: bool,
    pub accepted_file_types: Vec<String>,
    pub supports_presets: bool,
    pub supports_history: bool,
    pub default_config: serde_json::Value,
}

struct ToolDefinitionBuilder {
    id: String,
    name: String,
    description: String,
    aliases: Vec<String>,
    keywords: Vec<String>,
    clipboard_patterns: Vec<ClipboardPattern>,
    chain_accepts: Vec<DataType>,
    chain_produces: DataType,
    supports_batch: bool,
    supports_file_input: bool,
    accepted_file_types: Vec<String>,
    supports_presets: bool,
    supports_history: bool,
    default_config: serde_json::Value,
}

impl ToolDefinition {
    fn builder(id: &str, name: &str) -> ToolDefinitionBuilder {
        ToolDefinitionBuilder {
            id: id.to_string(),
            name: name.to_string(),
            description: String::new(),
            aliases: vec![],
            keywords: vec![],
            clipboard_patterns: vec![],
            chain_accepts: vec![DataType::PlainText, DataType::StructuredText],
            chain_produces: DataType::StructuredText,
            supports_batch: false,
            supports_file_input: false,
            accepted_file_types: vec![],
            supports_presets: false,
            supports_history: false,
            default_config: json!({}),
        }
    }
}

impl ToolDefinitionBuilder {
    fn description(mut self, desc: &str) -> Self {
        self.description = desc.to_string();
        self
    }
    fn aliases(mut self, aliases: &[&str]) -> Self {
        self.aliases = aliases.iter().map(|s| s.to_string()).collect();
        self
    }
    fn keywords(mut self, kw: &[&str]) -> Self {
        self.keywords = kw.iter().map(|s| s.to_string()).collect();
        self
    }
    fn clipboard_pattern(mut self, kind: ClipboardPatternKind, value: &str, confidence: u8) -> Self {
        self.clipboard_patterns.push(ClipboardPattern {
            kind,
            value: value.to_string(),
            confidence,
        });
        self
    }
    fn chain(mut self, accepts: Vec<DataType>, produces: DataType) -> Self {
        self.chain_accepts = accepts;
        self.chain_produces = produces;
        self
    }
    fn batch(mut self) -> Self {
        self.supports_batch = true;
        self
    }
    fn file_input(mut self, types: &[&str]) -> Self {
        self.supports_file_input = true;
        self.accepted_file_types = types.iter().map(|s| s.to_string()).collect();
        self
    }
    fn presets(mut self) -> Self {
        self.supports_presets = true;
        self
    }
    fn history(mut self) -> Self {
        self.supports_history = true;
        self
    }
    /// Convenience: sets both `supports_presets` and `supports_history` to true.
    fn standard(self) -> Self {
        self.presets().history()
    }
    fn default_config(mut self, config: serde_json::Value) -> Self {
        self.default_config = config;
        self
    }
    fn build(self) -> ToolDefinition {
        ToolDefinition {
            id: self.id,
            name: self.name,
            description: self.description,
            aliases: self.aliases,
            keywords: self.keywords,
            clipboard_patterns: self.clipboard_patterns,
            chain_accepts: self.chain_accepts,
            chain_produces: self.chain_produces,
            supports_batch: self.supports_batch,
            supports_file_input: self.supports_file_input,
            accepted_file_types: self.accepted_file_types,
            supports_presets: self.supports_presets,
            supports_history: self.supports_history,
            default_config: self.default_config,
        }
    }
}

#[derive(Debug)]
pub struct ToolRegistry {
    tools_by_id: RwLock<HashMap<String, ToolDefinition>>,
    ordered_ids: RwLock<Vec<String>>,
    search_index_by_id: RwLock<HashMap<String, SearchIndexEntry>>,
}

#[derive(Debug, Clone)]
struct SearchIndexEntry {
    name_lower: String,
    name_compact_lower: String,
    aliases_lower: Vec<String>,
    aliases_compact_lower: Vec<String>,
    keywords_lower: Vec<String>,
    description_lower: String,
    typo_terms_lower: Vec<String>,
}

impl SearchIndexEntry {
    fn from_tool(tool: &ToolDefinition) -> Self {
        let name_lower = tool.name.to_lowercase();
        let aliases_lower: Vec<String> = tool.aliases.iter().map(|value| value.to_lowercase()).collect();
        let keywords_lower: Vec<String> = tool
            .keywords
            .iter()
            .map(|value| value.to_lowercase())
            .collect();

        let name_compact_lower = compact_alphanumeric_lower(&name_lower);
        let aliases_compact_lower = aliases_lower
            .iter()
            .map(|value| compact_alphanumeric_lower(value))
            .collect();

        Self {
            name_lower: name_lower.clone(),
            name_compact_lower: name_compact_lower.clone(),
            aliases_lower: aliases_lower.clone(),
            aliases_compact_lower,
            keywords_lower: keywords_lower.clone(),
            description_lower: tool.description.to_lowercase(),
            typo_terms_lower: build_typo_terms_lower(
                &name_lower,
                &name_compact_lower,
                &aliases_lower,
            ),
        }
    }
}

impl ToolRegistry {
    pub fn empty() -> Self {
        Self {
            tools_by_id: RwLock::new(HashMap::new()),
            ordered_ids: RwLock::new(Vec::new()),
            search_index_by_id: RwLock::new(HashMap::new()),
        }
    }

    pub fn with_builtin_tools() -> Result<Self, String> {
        let registry = Self::empty();
        for tool in builtin_tools() {
            registry.register(tool)?;
        }
        Ok(registry)
    }

    pub fn register(&self, tool: ToolDefinition) -> Result<(), String> {
        validate_tool_definition(&tool)?;
        let search_index = SearchIndexEntry::from_tool(&tool);
        let mut tools_by_id = self
            .tools_by_id
            .write()
            .expect("tool registry lock poisoned");
        if tools_by_id.contains_key(&tool.id) {
            return Err(format!("tool id already registered: {}", tool.id));
        }

        self.ordered_ids
            .write()
            .expect("tool order lock poisoned")
            .push(tool.id.clone());
        self.search_index_by_id
            .write()
            .expect("tool search index lock poisoned")
            .insert(tool.id.clone(), search_index);
        tools_by_id.insert(tool.id.clone(), tool);
        Ok(())
    }

    pub fn get(&self, id: &str) -> Option<ToolDefinition> {
        self.tools_by_id
            .read()
            .expect("tool registry lock poisoned")
            .get(id)
            .cloned()
    }

    pub fn list(&self) -> Vec<ToolDefinition> {
        let tools_by_id = self
            .tools_by_id
            .read()
            .expect("tool registry lock poisoned");
        let ordered_ids = self
            .ordered_ids
            .read()
            .expect("tool order lock poisoned");

        ordered_ids
            .iter()
            .filter_map(|id| tools_by_id.get(id).cloned())
            .collect()
    }

    pub fn search(&self, query: &str) -> Vec<ToolDefinition> {
        self.ranked_search(query, &[], &[])
    }

    pub fn ranked_search(
        &self,
        query: &str,
        favorite_tool_ids: &[String],
        recent_tool_ids: &[String],
    ) -> Vec<ToolDefinition> {
        let normalized_query = query.trim().to_lowercase();
        let tools_by_id = self
            .tools_by_id
            .read()
            .expect("tool registry lock poisoned");
        let ordered_ids = self
            .ordered_ids
            .read()
            .expect("tool order lock poisoned");
        let search_index_by_id = self
            .search_index_by_id
            .read()
            .expect("tool search index lock poisoned");
        let favorite_position_by_id: HashMap<String, usize> = favorite_tool_ids
            .iter()
            .enumerate()
            .map(|(index, tool_id)| (tool_id.clone(), index))
            .collect();
        let recent_position_by_id: HashMap<String, usize> = recent_tool_ids
            .iter()
            .enumerate()
            .map(|(index, tool_id)| (tool_id.clone(), index))
            .collect();

        let mut matches: Vec<(SearchSortKey, ToolDefinition)> =
            Vec::with_capacity(ordered_ids.len());
        for (canonical_position, tool_id) in ordered_ids.iter().enumerate() {
            let Some(tool) = tools_by_id.get(tool_id) else {
                continue;
            };
            let Some(search_index) = search_index_by_id.get(tool_id) else {
                continue;
            };

            let tier = resolve_match_tier(search_index, &normalized_query);
            if !normalized_query.is_empty() && tier == 99 {
                continue;
            }

            let sort_key = SearchSortKey {
                tier,
                favorite_rank: favorite_position_by_id
                    .get(tool_id)
                    .copied()
                    .unwrap_or(usize::MAX),
                recent_rank: recent_position_by_id
                    .get(tool_id)
                    .copied()
                    .unwrap_or(usize::MAX),
                canonical_position,
                alphabetical_name: search_index.name_lower.clone(),
            };
            matches.push((sort_key, tool.clone()));
        }

        matches.sort_by(|(key_a, _), (key_b, _)| key_a.cmp(key_b));
        matches.into_iter().map(|(_, tool)| tool).collect()
    }

    pub fn compatible_targets(&self, from_tool_id: &str) -> Vec<ToolDefinition> {
        let Some(source_tool) = self.get(from_tool_id) else {
            return Vec::new();
        };

        self.list()
            .into_iter()
            .filter(|target| target.id != source_tool.id)
            .filter(|target| {
                target
                    .chain_accepts
                    .iter()
                    .any(|accepts| accepts == &source_tool.chain_produces)
            })
            .collect()
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct SearchSortKey {
    tier: u8,
    favorite_rank: usize,
    recent_rank: usize,
    canonical_position: usize,
    alphabetical_name: String,
}

impl Ord for SearchSortKey {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.tier
            .cmp(&other.tier)
            .then_with(|| self.favorite_rank.cmp(&other.favorite_rank))
            .then_with(|| self.recent_rank.cmp(&other.recent_rank))
            .then_with(|| self.canonical_position.cmp(&other.canonical_position))
            .then_with(|| self.alphabetical_name.cmp(&other.alphabetical_name))
    }
}

impl PartialOrd for SearchSortKey {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

fn resolve_match_tier(search_index: &SearchIndexEntry, normalized_query: &str) -> u8 {
    if normalized_query.is_empty() {
        return 8;
    }

    let name = search_index.name_lower.as_str();
    if name == normalized_query {
        return 1;
    }
    if search_index
        .aliases_lower
        .iter()
        .any(|alias| alias == normalized_query)
    {
        return 2;
    }
    if name.starts_with(normalized_query) {
        return 3;
    }
    if search_index
        .aliases_lower
        .iter()
        .any(|alias| alias.starts_with(normalized_query))
    {
        return 4;
    }
    if name.contains(normalized_query) {
        return 5;
    }
    if search_index
        .aliases_lower
        .iter()
        .any(|alias| alias.contains(normalized_query))
    {
        return 6;
    }
    if search_index
        .keywords_lower
        .iter()
        .any(|keyword| keyword.contains(normalized_query))
    {
        return 7;
    }
    if search_index.description_lower.contains(normalized_query) {
        return 8;
    }

    let compact_query = compact_alphanumeric_lower(normalized_query);
    if compact_query.len() >= 2
        && (is_subsequence_match(&compact_query, &search_index.name_compact_lower)
            || search_index
                .aliases_compact_lower
                .iter()
                .any(|alias| is_subsequence_match(&compact_query, alias)))
    {
        return 9;
    }

    if compact_query.len() >= 3
        && has_typo_near_match(&compact_query, &search_index.typo_terms_lower)
    {
        return 10;
    }

    99
}

fn compact_alphanumeric_lower(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_alphanumeric())
        .flat_map(|character| character.to_lowercase())
        .collect()
}

fn build_typo_terms_lower(
    name_lower: &str,
    name_compact_lower: &str,
    aliases_lower: &[String],
) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut terms = Vec::new();

    let mut push_term = |term: String| {
        let trimmed = term.trim();
        if trimmed.len() < 3 {
            return;
        }
        let normalized = trimmed.to_string();
        if seen.insert(normalized.clone()) {
            terms.push(normalized);
        }
    };

    push_term(name_lower.to_string());
    push_term(name_compact_lower.to_string());

    for alias in aliases_lower {
        push_term(alias.clone());
        push_term(compact_alphanumeric_lower(alias));
    }
    for phrase in std::iter::once(name_lower)
        .chain(aliases_lower.iter().map(String::as_str))
    {
        for token in phrase.split(|character: char| !character.is_alphanumeric()) {
            if token.len() >= 3 {
                push_term(token.to_string());
            }
        }
    }

    terms
}

fn is_subsequence_match(query: &str, candidate: &str) -> bool {
    if query.is_empty() {
        return false;
    }
    let mut query_chars = query.chars();
    let mut current = query_chars.next();
    if current.is_none() {
        return false;
    }

    for character in candidate.chars() {
        if Some(character) == current {
            current = query_chars.next();
            if current.is_none() {
                return true;
            }
        }
    }

    false
}

fn has_typo_near_match(query: &str, terms: &[String]) -> bool {
    let max_distance = if query.len() >= 6 { 2 } else { 1 };
    terms
        .iter()
        .any(|term| bounded_levenshtein_distance(query, term, max_distance).is_some())
}

fn bounded_levenshtein_distance(a: &str, b: &str, max_distance: usize) -> Option<usize> {
    if a == b {
        return Some(0);
    }
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let a_len = a_chars.len();
    let b_len = b_chars.len();
    let length_gap = a_len.abs_diff(b_len);
    if length_gap > max_distance {
        return None;
    }

    let mut previous: Vec<usize> = (0..=b_len).collect();
    let mut current = vec![0; b_len + 1];
    for (i, a_char) in a_chars.iter().enumerate() {
        current[0] = i + 1;
        let mut row_minimum = current[0];
        for (j, b_char) in b_chars.iter().enumerate() {
            let substitution_cost = if a_char == b_char { 0 } else { 1 };
            let deletion = previous[j + 1] + 1;
            let insertion = current[j] + 1;
            let substitution = previous[j] + substitution_cost;
            let distance = deletion.min(insertion).min(substitution);
            current[j + 1] = distance;
            row_minimum = row_minimum.min(distance);
        }
        if row_minimum > max_distance {
            return None;
        }
        std::mem::swap(&mut previous, &mut current);
    }

    let final_distance = previous[b_len];
    if final_distance <= max_distance {
        Some(final_distance)
    } else {
        None
    }
}

fn validate_tool_definition(tool: &ToolDefinition) -> Result<(), String> {
    if tool.id.trim().is_empty() {
        return Err("tool id cannot be empty".to_string());
    }
    if tool.name.trim().is_empty() {
        return Err("tool name cannot be empty".to_string());
    }
    if tool.aliases.is_empty() {
        return Err(format!("tool {} requires at least 1 alias", tool.id));
    }
    if tool.keywords.len() < 5 {
        return Err(format!("tool {} requires at least 5 keywords", tool.id));
    }
    Ok(())
}

fn builtin_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition::builder("json-format", "JSON Format/Validate")
            .description("Format, validate, and minify JSON")
            .aliases(&["json formatter"])
            .keywords(&["json", "format", "validate", "minify", "pretty"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "{", 85)
            .chain(vec![DataType::PlainText, DataType::StructuredText], DataType::Json)
            .batch()
            .file_input(&["application/json"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("html-beautify", "HTML Beautify/Minify")
            .description("Beautify or minify HTML markup")
            .aliases(&["html formatter"])
            .keywords(&["html", "beautify", "minify", "markup", "format"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "<", 65)
            .batch()
            .file_input(&["text/html", ".html"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("css-beautify", "CSS Beautify/Minify")
            .description("Beautify or minify CSS stylesheets")
            .aliases(&["css formatter"])
            .keywords(&["css", "beautify", "minify", "styles", "format"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "{", 50)
            .batch()
            .file_input(&["text/css", ".css"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("scss-beautify", "SCSS Beautify/Minify")
            .description("Beautify or minify SCSS stylesheets")
            .aliases(&["scss formatter"])
            .keywords(&["scss", "sass", "beautify", "minify", "format"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "{", 45)
            .batch()
            .file_input(&["text/x-scss", ".scss"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("less-beautify", "LESS Beautify/Minify")
            .description("Beautify or minify LESS stylesheets")
            .aliases(&["less formatter"])
            .keywords(&["less", "beautify", "minify", "styles", "format"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "{", 45)
            .batch()
            .file_input(&["text/x-less", ".less"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("javascript-beautify", "JavaScript Beautify/Minify")
            .description("Beautify or minify JavaScript")
            .aliases(&["js formatter"])
            .keywords(&["javascript", "js", "beautify", "minify", "format"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "function", 60)
            .batch()
            .file_input(&["application/javascript", ".js"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("typescript-beautify", "TypeScript Beautify/Minify")
            .description("Beautify or minify TypeScript")
            .aliases(&["ts formatter"])
            .keywords(&["typescript", "ts", "beautify", "minify", "format"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "interface", 55)
            .batch()
            .file_input(&["application/typescript", ".ts"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("graphql-format", "GraphQL Format/Minify")
            .description("Format or minify GraphQL queries and schemas")
            .aliases(&["graphql formatter"])
            .keywords(&["graphql", "gql", "beautify", "minify", "query"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "query", 60)
            .batch()
            .file_input(&["application/graphql", ".graphql"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("erb-format", "ERB Beautify/Minify")
            .description("Beautify or minify ERB templates")
            .aliases(&["erb formatter"])
            .keywords(&["erb", "ruby", "template", "beautify", "minify"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "<%", 70)
            .batch()
            .file_input(&["text/x-erb", ".erb"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("xml-format", "XML Format/Minify")
            .description("Format or minify XML documents")
            .aliases(&["xml formatter"])
            .keywords(&["xml", "format", "minify", "markup", "pretty"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "<", 60)
            .batch()
            .file_input(&["application/xml", ".xml"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("sql-format", "SQL Format/Minify")
            .description("Format or minify SQL queries")
            .aliases(&["sql formatter"])
            .keywords(&["sql", "query", "format", "minify", "database"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "select", 60)
            .batch()
            .file_input(&["application/sql", ".sql"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("markdown-format", "Markdown Format/Minify")
            .description("Format or minify Markdown text")
            .aliases(&["markdown formatter"])
            .keywords(&["markdown", "md", "format", "minify", "document"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "#", 45)
            .batch()
            .file_input(&["text/markdown", ".md"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("yaml-format", "YAML Format/Minify")
            .description("Format or minify YAML documents")
            .aliases(&["yaml formatter"])
            .keywords(&["yaml", "yml", "format", "minify", "document"])
            .clipboard_pattern(ClipboardPatternKind::Contains, ":", 45)
            .batch()
            .file_input(&["application/yaml", ".yaml", ".yml"])
            .standard()
            .default_config(json!({ "mode": "format", "indent": 2 }))
            .build(),
        ToolDefinition::builder("json-to-yaml", "JSON to YAML Converter")
            .description("Convert JSON payloads to YAML")
            .aliases(&["json yaml"])
            .keywords(&["json", "yaml", "convert", "yml", "transform"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "{", 70)
            .chain(vec![DataType::Json, DataType::StructuredText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json"]).standard().build(),
        ToolDefinition::builder("yaml-to-json", "YAML to JSON Converter")
            .description("Convert YAML payloads to JSON")
            .aliases(&["yaml json"])
            .keywords(&["yaml", "json", "convert", "yml", "transform"])
            .clipboard_pattern(ClipboardPatternKind::Contains, ":", 55)
            .chain(vec![DataType::StructuredText], DataType::Json)
            .batch().file_input(&["application/yaml", ".yaml", ".yml"]).standard().build(),
        ToolDefinition::builder("json-to-csv", "JSON to CSV Converter")
            .description("Convert JSON arrays to CSV")
            .aliases(&["json csv"])
            .keywords(&["json", "csv", "convert", "table", "transform"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "[", 65)
            .chain(vec![DataType::Json, DataType::StructuredText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json"]).standard().build(),
        ToolDefinition::builder("csv-to-json", "CSV to JSON Converter")
            .description("Convert CSV rows to JSON arrays")
            .aliases(&["csv json"])
            .keywords(&["csv", "json", "convert", "table", "transform"])
            .clipboard_pattern(ClipboardPatternKind::Contains, ",", 50)
            .chain(vec![DataType::StructuredText], DataType::Json)
            .batch().file_input(&["text/csv", ".csv"]).standard().build(),
        ToolDefinition::builder("json-to-php", "JSON to PHP Converter")
            .description("Convert JSON payloads to PHP array syntax")
            .aliases(&["json php"])
            .keywords(&["json", "php", "array", "convert", "serializer"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "{", 70)
            .chain(vec![DataType::Json, DataType::StructuredText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json"]).standard().build(),
        ToolDefinition::builder("php-to-json", "PHP to JSON Converter")
            .description("Convert PHP array syntax to JSON")
            .aliases(&["php json"])
            .keywords(&["php", "json", "array", "convert", "parser"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "=>", 65)
            .chain(vec![DataType::StructuredText], DataType::Json)
            .batch().file_input(&["text/x-php", ".php"]).standard().build(),
        ToolDefinition::builder("php-serialize", "PHP Serializer")
            .description("Serialize JSON-style data into PHP serialized format")
            .aliases(&["serialize php"])
            .keywords(&["php", "serialize", "serializer", "array", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "{", 40)
            .chain(vec![DataType::Json, DataType::StructuredText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json"]).standard().build(),
        ToolDefinition::builder("php-unserialize", "PHP Unserializer")
            .description("Unserialize PHP serialized strings into JSON")
            .aliases(&["unserialize php"])
            .keywords(&["php", "unserialize", "parser", "serialized", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "a:", 60)
            .chain(vec![DataType::StructuredText], DataType::Json)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("json-stringify", "JSON Stringify/Unstringify")
            .description("Stringify plain text for JSON or parse back")
            .aliases(&["json unescape"])
            .keywords(&["json", "stringify", "unstringify", "escape", "unescape"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\\\"", 55)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "stringify" })).build(),
        ToolDefinition::builder("html-to-jsx", "HTML to JSX Converter")
            .description("Convert HTML markup to JSX syntax")
            .aliases(&["html jsx"])
            .keywords(&["html", "jsx", "react", "convert", "markup"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "<", 60)
            .chain(vec![DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["text/html", ".html"]).standard().build(),
        ToolDefinition::builder("html-to-markdown", "HTML to Markdown Converter")
            .description("Convert HTML markup to Markdown")
            .aliases(&["html md"])
            .keywords(&["html", "markdown", "md", "convert", "markup"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "<", 60)
            .chain(vec![DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["text/html", ".html"]).standard().build(),
        ToolDefinition::builder("word-to-markdown", "Word to Markdown Converter")
            .description("Convert .docx files to Markdown text")
            .aliases(&["docx markdown"])
            .keywords(&["word", "docx", "markdown", "convert", "document"])
            .chain(vec![DataType::Binary], DataType::StructuredText)
            .file_input(&["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"])
            .standard().build(),
        ToolDefinition::builder("svg-to-css", "SVG to CSS Converter")
            .description("Convert inline SVG to CSS data URI background-image")
            .aliases(&["svg css"])
            .keywords(&["svg", "css", "data uri", "background-image", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "<svg", 70)
            .chain(vec![DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["image/svg+xml", ".svg"]).standard().build(),
        ToolDefinition::builder("curl-to-code", "cURL to Code Converter")
            .description("Convert cURL commands to JavaScript fetch code")
            .aliases(&["curl converter"])
            .keywords(&["curl", "http", "request", "fetch", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "curl ", 80)
            .chain(vec![DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["text/plain", ".txt", ".sh"]).standard().build(),
        ToolDefinition::builder("json-to-code", "JSON to Code Generator")
            .description("Generate TypeScript type definitions from JSON")
            .aliases(&["json type generator"])
            .keywords(&["json", "code", "typescript", "type", "generator"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "{", 65)
            .chain(vec![DataType::Json, DataType::StructuredText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json"]).standard().build(),
        ToolDefinition::builder("query-string-to-json", "Query String to JSON")
            .description("Parse URL query strings into JSON objects")
            .aliases(&["qs parser"])
            .keywords(&["query", "string", "json", "params", "url"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "=", 45)
            .chain(vec![DataType::StructuredText, DataType::PlainText], DataType::Json)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("delimiter-converter", "List/Delimiter Converter")
            .description("Convert delimiter-separated lists to newline format")
            .aliases(&["delimiter changer"])
            .keywords(&["delimiter", "list", "convert", "separator", "csv"])
            .clipboard_pattern(ClipboardPatternKind::Contains, ",", 40)
            .chain(vec![DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["text/plain", ".txt", ".csv"]).standard().build(),
        ToolDefinition::builder("number-base-converter", "Number Base Converter")
            .description("Convert values between binary, octal, decimal, and hex")
            .aliases(&["base converter"])
            .keywords(&["binary", "octal", "decimal", "hex", "base"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "0x", 50)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("hex-to-ascii", "Hex to ASCII")
            .description("Decode hexadecimal strings to ASCII text")
            .aliases(&["hex ascii"])
            .keywords(&["hex", "ascii", "decode", "text", "converter"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[0-9a-fA-F\\s]+$", 60)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("ascii-to-hex", "ASCII to Hex")
            .description("Encode ASCII text to hexadecimal strings")
            .aliases(&["ascii hex"])
            .keywords(&["ascii", "hex", "encode", "text", "converter"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 20)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("roman-date-converter", "Roman Numeral Date Converter")
            .description("Convert date components between Arabic and Roman numerals")
            .aliases(&["roman date"])
            .keywords(&["roman", "date", "numeral", "converter", "calendar"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "MM", 35)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("url", "URL Encode/Decode")
            .description("Encode or decode percent-encoded URL strings")
            .aliases(&["url encoder"])
            .keywords(&["url", "uri", "encode", "decode", "percent"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "%20", 70)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "format" })).build(),
        ToolDefinition::builder("url-parser", "URL Parser")
            .description("Parse URLs into scheme, host, path, query, and fragment")
            .aliases(&["url breakdown"])
            .keywords(&["url", "uri", "query", "fragment", "params"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "://", 65)
            .chain(vec![DataType::PlainText, DataType::StructuredText], DataType::Json)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("utm-generator", "UTM Generator")
            .description("Build campaign URLs with UTM query parameters")
            .aliases(&["campaign url builder"])
            .keywords(&["utm", "campaign", "tracking", "url", "marketing"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "utm_", 45)
            .chain(vec![DataType::Json, DataType::StructuredText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("slugify-url", "Slugify URL Generator")
            .description("Generate URL-safe slugs from arbitrary text")
            .aliases(&["slugify"])
            .keywords(&["slug", "url", "seo", "kebab", "normalize"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 25)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("html-entity", "HTML Entity Encode/Decode")
            .description("Encode or decode HTML entity values")
            .aliases(&["html entities"])
            .keywords(&["html", "entity", "encode", "decode", "escape"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "&amp;", 65)
            .batch().file_input(&["text/plain", ".txt", ".html"]).standard()
            .default_config(json!({ "mode": "format" })).build(),
        ToolDefinition::builder("html-preview", "HTML Preview")
            .description("Live-preview rendered HTML markup")
            .aliases(&["live html preview"])
            .keywords(&["html", "preview", "render", "live", "markup"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "<", 55)
            .file_input(&["text/html", ".html", ".txt"]).standard().build(),
        ToolDefinition::builder("markdown-preview", "Markdown Preview")
            .description("Live-preview rendered Markdown content")
            .aliases(&["md preview"])
            .keywords(&["markdown", "md", "preview", "render", "live"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "# ", 45)
            .file_input(&["text/markdown", ".md", ".markdown", ".txt"]).standard().build(),
        ToolDefinition::builder("case-converter", "Case Converter")
            .description("Convert between text casing styles")
            .aliases(&["string case"])
            .keywords(&["case", "text", "camel", "snake", "kebab"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 30)
            .chain(vec![DataType::PlainText], DataType::PlainText)
            .batch().file_input(&["text/plain"]).standard()
            .default_config(json!({ "mode": "snake_case" })).build(),
        ToolDefinition::builder("line-sort-dedupe", "Line Sort/Dedupe")
            .description("Sort lines alphabetically/numerically and remove duplicates")
            .aliases(&["line sorter"])
            .keywords(&["line", "sort", "dedupe", "alphabetical", "numeric"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\n", 45)
            .batch().file_input(&["text/plain", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("sort-words", "Sort Words Alphabetically")
            .description("Sort words inside a text block")
            .aliases(&["word sorter"])
            .keywords(&["word", "sort", "alphabetical", "text", "order"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 30)
            .batch().file_input(&["text/plain", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("number-sorter", "Number Sorter")
            .description("Sort numeric lists ascending or descending")
            .aliases(&["numeric sorter"])
            .keywords(&["number", "sort", "numeric", "ascending", "descending"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[0-9,\\.\\s;-]+$", 55)
            .batch().file_input(&["text/plain", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("duplicate-word-finder", "Duplicate Word Finder")
            .description("Find repeated words and their counts")
            .aliases(&["word duplicates"])
            .keywords(&["duplicate", "word", "finder", "count", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 30)
            .batch().file_input(&["text/plain", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("text-replace", "Text Replacement Tool")
            .description("Find and replace text with optional regex/case controls")
            .aliases(&["find replace"])
            .keywords(&["replace", "find", "text", "regex", "substitute"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "->", 20)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("character-remover", "Character Remover")
            .description("Remove selected characters or character classes")
            .aliases(&["remove chars"])
            .keywords(&["character", "remove", "digits", "letters", "punctuation"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "1", 10)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("whitespace-remover", "Whitespace Remover")
            .description("Trim, collapse, or remove whitespace")
            .aliases(&["trim whitespace"])
            .keywords(&["whitespace", "trim", "spaces", "cleanup", "normalize"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "  ", 40)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("line-break-remover", "Remove Line Breaks")
            .description("Remove line breaks with optional spacing")
            .aliases(&["line break remover"])
            .keywords(&["line break", "newline", "remove", "join", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\n", 45)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("text-formatting-remover", "Remove Text Formatting")
            .description("Strip markdown, HTML, and ANSI formatting")
            .aliases(&["plain text cleaner"])
            .keywords(&["formatting", "plain text", "markdown", "html", "remove"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "**", 35)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("remove-underscores", "Remove Underscores")
            .description("Replace underscores with spaces")
            .aliases(&["underscore remover"])
            .keywords(&["underscore", "remove", "replace", "space", "cleanup"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "_", 40)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("em-dash-remover", "Em Dash Remover")
            .description("Remove em/en dashes or replace them with hyphen or spaces")
            .aliases(&["dash cleaner"])
            .keywords(&["em dash", "en dash", "remove", "replace", "hyphen"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\u{2014}", 65)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "mode": "hyphen" })).build(),
        ToolDefinition::builder("plain-text-converter", "Plain Text Converter")
            .description("Convert rich or formatted input to clean plain text")
            .aliases(&["rich text cleaner"])
            .keywords(&["plain text", "convert", "formatting", "markdown", "html"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "<", 20)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("repeat-text-generator", "Repeat Text Generator")
            .description("Repeat input text with configurable count and separator")
            .aliases(&["text repeater"])
            .keywords(&["repeat", "generator", "separator", "count", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\n", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "count": 2, "separator": "" })).build(),
        ToolDefinition::builder("reverse-text-generator", "Reverse Text Generator")
            .description("Reverse text character order")
            .aliases(&["text reverse"])
            .keywords(&["reverse", "text", "characters", "backward", "flip"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("upside-down-text-generator", "Upside Down Text Generator")
            .description("Flip text using upside-down Unicode characters")
            .aliases(&["flip text"])
            .keywords(&["upside down", "unicode", "flip", "text", "generator"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "!", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("mirror-text-generator", "Mirror Text Generator")
            .description("Mirror text horizontally using Unicode substitutions")
            .aliases(&["text mirror"])
            .keywords(&["mirror", "unicode", "text", "reverse", "generator"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "(", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("invisible-text-generator", "Invisible Text Generator")
            .description("Generate zero-width Unicode text")
            .aliases(&["zero width text"])
            .keywords(&["invisible", "zero width", "unicode", "hidden", "generator"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\u{200B}", 35)
            .chain(vec![DataType::PlainText, DataType::StructuredText], DataType::PlainText)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "length": 10, "character": "zwsp" })).build(),
        ToolDefinition::builder("sentence-counter", "Sentence Counter")
            .description("Count sentences, words, characters, paragraphs, and reading time")
            .aliases(&["text stats"])
            .keywords(&["sentence", "word count", "characters", "paragraphs", "reading time"])
            .clipboard_pattern(ClipboardPatternKind::Contains, ".", 20)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "wordsPerMinute": 200 })).build(),
        ToolDefinition::builder("word-frequency-counter", "Word Frequency Counter")
            .description("Count each word frequency with sortable output")
            .aliases(&["word frequency"])
            .keywords(&["word", "frequency", "counter", "sortable", "analysis"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 15)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "caseSensitive": false, "minWordLength": 1, "sort": "count-desc", "limit": 100 })).build(),
        ToolDefinition::builder("word-cloud-generator", "Word Cloud Generator")
            .description("Build a visual HTML word cloud from text frequencies")
            .aliases(&["word cloud"])
            .keywords(&["word cloud", "visual", "frequency", "font", "palette"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "maxWords": 40, "minWordLength": 2 })).build(),
        ToolDefinition::builder("bold-text-generator", "Bold Text Generator")
            .description("Generate bold Unicode text")
            .aliases(&["bold unicode"]).keywords(&["bold", "unicode", "style", "generator", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "**", 20)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("italic-text-converter", "Italic Text Converter")
            .description("Generate italic Unicode text")
            .aliases(&["italic unicode"]).keywords(&["italic", "unicode", "converter", "style", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "_", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("underline-text-generator", "Underline Text Generator")
            .description("Apply combining underline marks to text")
            .aliases(&["underline unicode"]).keywords(&["underline", "combining", "unicode", "style", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "_", 15)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("strikethrough-text-generator", "Strikethrough Text Generator")
            .description("Apply combining strikethrough marks to text")
            .aliases(&["strike unicode"]).keywords(&["strikethrough", "strike", "unicode", "style", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "~", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("small-text-generator", "Small Text Generator")
            .description("Generate small-caps and superscript-style Unicode text")
            .aliases(&["small caps"]).keywords(&["small", "small caps", "superscript", "unicode", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "^", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("subscript-generator", "Subscript Generator")
            .description("Generate subscript Unicode text")
            .aliases(&["subscript text"]).keywords(&["subscript", "unicode", "chemical", "math", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "_", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("superscript-generator", "Superscript Generator")
            .description("Generate superscript Unicode text")
            .aliases(&["superscript text"]).keywords(&["superscript", "unicode", "math", "exponent", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "^", 15)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("wide-text-generator", "Wide Text Generator")
            .description("Convert text to fullwidth Unicode style")
            .aliases(&["fullwidth text"]).keywords(&["wide", "fullwidth", "aesthetic", "unicode", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("double-struck-text-generator", "Double-Struck Text Generator")
            .description("Generate double-struck (blackboard bold) Unicode text")
            .aliases(&["blackboard bold"]).keywords(&["double struck", "blackboard", "unicode", "math", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "A", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("bubble-text-generator", "Bubble Text Generator")
            .description("Generate circled bubble Unicode text")
            .aliases(&["circled text"]).keywords(&["bubble", "circled", "unicode", "style", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "(", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("gothic-text-generator", "Gothic Text Generator")
            .description("Generate Fraktur/gothic Unicode text")
            .aliases(&["fraktur text"]).keywords(&["gothic", "fraktur", "unicode", "style", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "R", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("cursed-text-generator", "Cursed Text Generator")
            .description("Generate Zalgo-style cursed text with configurable intensity")
            .aliases(&["zalgo text"]).keywords(&["cursed", "zalgo", "glitch", "unicode", "intensity"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "~", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "intensity": 2 })).build(),
        ToolDefinition::builder("slash-text-generator", "Slash Text Generator")
            .description("Decorate text using slash/overlay Unicode marks")
            .aliases(&["slashed text"]).keywords(&["slash", "overlay", "unicode", "style", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "/", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("stacked-text-generator", "Stacked Text Generator")
            .description("Stack characters vertically with one character per line")
            .aliases(&["vertical text"]).keywords(&["stacked", "vertical", "text", "generator", "layout"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\n", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("big-text-converter", "Big Text Converter")
            .description("Expand text into large block-style rows")
            .aliases(&["big letters"]).keywords(&["big", "block", "text", "converter", "ascii art"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "A", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("typewriter-text-generator", "Typewriter Text Generator")
            .description("Generate monospaced typewriter-style Unicode text")
            .aliases(&["monospace text"]).keywords(&["typewriter", "monospace", "unicode", "text", "generator"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "`", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("fancy-text-generator", "Fancy Text Generator")
            .description("Apply decorative Unicode style presets to text")
            .aliases(&["decorative text"]).keywords(&["fancy", "style", "unicode", "decorative", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "*", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "style": "double-struck" })).build(),
        ToolDefinition::builder("cute-font-generator", "Cute Font Generator")
            .description("Generate text with cute Unicode decorations")
            .aliases(&["cute text"]).keywords(&["cute", "font", "decorative", "unicode", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\u{2661}", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("aesthetic-text-generator", "Aesthetic Text Generator")
            .description("Generate spaced fullwidth aesthetic text")
            .aliases(&["vaporwave text"]).keywords(&["aesthetic", "fullwidth", "vaporwave", "unicode", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 10)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("unicode-text-converter", "Unicode Text Converter")
            .description("Convert text to Unicode code points and escaped forms")
            .aliases(&["text to unicode"]).keywords(&["unicode", "code points", "escape", "convert", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\\u", 20)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("unicode-to-text-converter", "Unicode to Text Converter")
            .description("Decode Unicode code point sequences back to text")
            .aliases(&["unicode decoder"]).keywords(&["unicode", "decode", "code point", "text", "converter"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "U+", 50)
            .chain(vec![DataType::PlainText, DataType::StructuredText], DataType::PlainText)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("facebook-font-generator", "Facebook Font Generator")
            .description("Generate styled text suitable for Facebook posts and bios")
            .aliases(&["facebook text"]).keywords(&["facebook", "font", "styled", "bio", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "fb", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("instagram-font-generator", "Instagram Font Generator")
            .description("Generate styled text for Instagram bios and captions")
            .aliases(&["instagram text"]).keywords(&["instagram", "font", "styled", "caption", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "ig", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("x-font-generator", "Twitter/X Font Generator")
            .description("Generate styled text for posts on X (Twitter)")
            .aliases(&["twitter font"]).keywords(&["x", "twitter", "font", "styled", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "x.com", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("tiktok-font-generator", "TikTok Font Generator")
            .description("Generate styled text for TikTok profiles and captions")
            .aliases(&["tiktok text"]).keywords(&["tiktok", "font", "styled", "caption", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "tt", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("discord-font-generator", "Discord Font Generator")
            .description("Generate styled text for Discord messages and profiles")
            .aliases(&["discord text"]).keywords(&["discord", "font", "styled", "chat", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "discord", 15)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("whatsapp-font-generator", "WhatsApp Font Generator")
            .description("Generate styled text for WhatsApp messages and statuses")
            .aliases(&["whatsapp text"]).keywords(&["whatsapp", "font", "styled", "status", "text"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "wa", 5)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard().build(),
        ToolDefinition::builder("nato-phonetic-converter", "NATO Phonetic Converter")
            .description("Convert text to or from NATO phonetic alphabet words")
            .aliases(&["nato converter"]).keywords(&["nato", "phonetic", "alphabet", "encode", "decode"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "Alpha", 45)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("pig-latin-converter", "Pig Latin Converter")
            .description("Translate English words to Pig Latin and back")
            .aliases(&["pig latin translator"]).keywords(&["pig latin", "translator", "encode", "decode", "wordplay"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "ay ", 20)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("wingdings-converter", "Wingdings Converter")
            .description("Convert text to or from a Wingdings-style symbol mapping")
            .aliases(&["wingdings translator"]).keywords(&["wingdings", "symbols", "converter", "encode", "decode"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\u{270C}", 25)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("phonetic-spelling-converter", "Phonetic Spelling Converter")
            .description("Convert text to or from spoken-style phonetic spellings")
            .aliases(&["phonetic spelling"]).keywords(&["phonetic", "spelling", "converter", "encode", "decode"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "AY", 20)
            .batch().file_input(&["text/plain", "application/json", ".txt", ".json"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("jpg-to-png-converter", "JPG to PNG Converter")
            .description("Convert JPG/JPEG images to PNG data URI output")
            .aliases(&["jpeg to png"]).keywords(&["jpg", "jpeg", "png", "image", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/jpeg", 65)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/jpeg", ".jpg", ".jpeg"]).standard().build(),
        ToolDefinition::builder("png-to-jpg-converter", "PNG to JPG Converter")
            .description("Convert PNG images to JPG data URI output")
            .aliases(&["png to jpeg"]).keywords(&["png", "jpg", "jpeg", "image", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/png", 65)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/png", ".png"]).standard().build(),
        ToolDefinition::builder("jpg-to-webp-converter", "JPG to WebP Converter")
            .description("Convert JPG/JPEG images to WebP data URI output")
            .aliases(&["jpeg to webp"]).keywords(&["jpg", "jpeg", "webp", "image", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/jpeg", 60)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/jpeg", ".jpg", ".jpeg"]).standard().build(),
        ToolDefinition::builder("webp-to-jpg-converter", "WebP to JPG Converter")
            .description("Convert WebP images to JPG data URI output")
            .aliases(&["webp to jpeg"]).keywords(&["webp", "jpg", "jpeg", "image", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/webp", 60)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/webp", ".webp"]).standard().build(),
        ToolDefinition::builder("png-to-webp-converter", "PNG to WebP Converter")
            .description("Convert PNG images to WebP data URI output")
            .aliases(&["png webp"]).keywords(&["png", "webp", "image", "convert", "format"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/png", 55)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/png", ".png"]).standard().build(),
        ToolDefinition::builder("webp-to-png-converter", "WebP to PNG Converter")
            .description("Convert WebP images to PNG data URI output")
            .aliases(&["webp png"]).keywords(&["webp", "png", "image", "convert", "format"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/webp", 55)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/webp", ".webp"]).standard().build(),
        ToolDefinition::builder("svg-to-png-converter", "SVG to PNG Converter")
            .description("Rasterize SVG into PNG with optional custom resolution")
            .aliases(&["svg rasterizer"]).keywords(&["svg", "png", "rasterize", "resolution", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "<svg", 80)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/svg+xml", ".svg"]).standard()
            .default_config(json!({ "width": 1024, "height": 1024 })).build(),
        ToolDefinition::builder("image-to-text-converter", "Image to Text Converter (OCR)")
            .description("Extract text from images using local Tesseract OCR")
            .aliases(&["ocr tool"]).keywords(&["ocr", "extract text", "tesseract", "image", "recognize"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/", 60)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/png", "image/jpeg", "image/tiff", "image/bmp", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp"]).standard()
            .default_config(json!({ "language": "eng", "downloadMissingLanguage": false })).build(),
        ToolDefinition::builder("ascii-art-generator", "ASCII Art Generator")
            .description("Convert text or images into ASCII art")
            .aliases(&["ascii art"]).keywords(&["ascii", "art", "image", "text", "generator"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "IMAGE_BASE64:", 50)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/png", "image/jpeg", ".png", ".jpg", ".jpeg", ".txt"]).standard()
            .default_config(json!({ "width": 80, "charset": "@%#*+=-:. ", "invert": false })).build(),
        ToolDefinition::builder("apa-format-generator", "APA Format Generator")
            .description("Format references and citations in APA style")
            .aliases(&["apa citation"]).keywords(&["apa", "citation", "reference", "bibliography", "format"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "doi", 20)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard()
            .default_config(json!({ "mode": "reference" })).build(),
        ToolDefinition::builder("markdown-table-generator", "Markdown Table Generator")
            .description("Generate Markdown tables from headers, rows, or delimited text")
            .aliases(&["md table builder"]).keywords(&["markdown", "table", "csv", "grid", "generator"])
            .clipboard_pattern(ClipboardPatternKind::Contains, ",", 20)
            .batch().file_input(&["text/plain", "text/csv", "application/json", ".txt", ".csv", ".json"]).standard()
            .default_config(json!({ "delimiter": "," })).build(),
        ToolDefinition::builder("base64", "Base64 String Encode/Decode")
            .description("Encode or decode Base64 text strings")
            .aliases(&["base64 converter"]).keywords(&["base64", "encode", "decode", "string", "binary"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[A-Za-z0-9+/=]+$", 55)
            .chain(vec![DataType::PlainText, DataType::Binary, DataType::Json], DataType::PlainText)
            .batch().file_input(&["text/plain"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("base64-image", "Base64 Image Encode/Decode")
            .description("Encode images to Base64 data URI or decode back to raw Base64")
            .aliases(&["image base64"]).keywords(&["base64", "image", "data uri", "encode", "decode"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "data:image/", 85)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("backslash-escape", "Backslash Escape/Unescape")
            .description("Escape or unescape backslash sequences")
            .aliases(&["backslash unescape"]).keywords(&["backslash", "escape", "unescape", "newline", "string"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\\n", 65)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("quote-helper", "Quote/Unquote Helper")
            .description("Wrap text in quotes or remove surrounding quotes")
            .aliases(&["quote unquote"]).keywords(&["quote", "unquote", "escape", "string", "text"])
            .clipboard_pattern(ClipboardPatternKind::Prefix, "\"", 40)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("utf8", "UTF-8 Encoder/Decoder")
            .description("Encode text to UTF-8 bytes or decode UTF-8 byte sequences")
            .aliases(&["utf8 converter"]).keywords(&["utf8", "utf-8", "encode", "decode", "bytes"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^(?:0x)?[0-9a-fA-F]{2}(?:[\\s,]+(?:0x)?[0-9a-fA-F]{2})+$", 55)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("binary-code", "Binary Code Translator")
            .description("Translate text to binary or decode binary to text")
            .aliases(&["binary translator"]).keywords(&["binary", "text", "encode", "decode", "bits"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[01\\s]+$", 60)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("morse-code", "Morse Code Translator")
            .description("Translate text and Morse code with optional audio playback")
            .aliases(&["morse translator"]).keywords(&["morse", "code", "audio", "encode", "decode"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[\\.\\-\\s/]+$", 55)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("rot13", "ROT13 Encoder/Decoder")
            .description("Apply or reverse ROT13 substitution")
            .aliases(&["rot13 cipher"]).keywords(&["rot13", "cipher", "encode", "decode", "substitution"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "ury", 25)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "encode" })).build(),
        ToolDefinition::builder("caesar-cipher", "Caesar Cipher Tool")
            .description("Encrypt or decrypt text with a configurable shift")
            .aliases(&["caesar shift"]).keywords(&["caesar", "cipher", "encrypt", "decrypt", "shift"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 20)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "encrypt", "shift": 3 })).build(),
        ToolDefinition::builder("aes-encrypt", "AES-256 Encrypt/Decrypt")
            .description("Encrypt or decrypt text using AES-256-GCM with a passphrase")
            .aliases(&["aes encryption", "aes decryption"])
            .keywords(&["aes", "aes256", "encrypt", "decrypt", "cipher", "passphrase", "gcm", "symmetric"])
            .chain(vec![DataType::PlainText, DataType::StructuredText], DataType::PlainText)
            .history()
            .default_config(json!({ "mode": "encrypt" })).build(),
        ToolDefinition::builder("unix-time", "Unix Time Converter")
            .description("Convert between Unix timestamps and human-readable datetime values")
            .aliases(&["timestamp converter"]).keywords(&["unix", "timestamp", "epoch", "date", "time"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^\\d{10}(\\d{3})?$", 75)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("jwt-debugger", "JWT Debugger")
            .description("Decode JWT header and payload details")
            .aliases(&["jwt decoder"]).keywords(&["jwt", "token", "decode", "header", "payload"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$", 85)
            .chain(vec![DataType::PlainText, DataType::StructuredText], DataType::Json)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("text-diff", "Text Diff Checker")
            .description("Compare two text blocks and show line-level differences")
            .aliases(&["diff checker"]).keywords(&["diff", "text", "compare", "patch", "difference"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "\n", 30)
            .file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("string-inspector", "String Inspector")
            .description("Inspect characters, code points, and byte-level details")
            .aliases(&["unicode inspector"]).keywords(&["string", "unicode", "code point", "bytes", "inspect"])
            .clipboard_pattern(ClipboardPatternKind::Contains, " ", 25)
            .chain(vec![DataType::PlainText, DataType::StructuredText], DataType::Json)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("cron-parser", "Cron Job Parser")
            .description("Parse cron expressions and show upcoming run times")
            .aliases(&["cron expression parser"]).keywords(&["cron", "schedule", "parser", "expression", "timer"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^([\\d\\*/,-]+\\s+){4,6}[\\d\\*/,-]+$", 70)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("color-converter", "Color Converter")
            .description("Convert colors between HEX, RGB, and HSL")
            .aliases(&["hex rgb hsl"]).keywords(&["color", "hex", "rgb", "hsl", "convert"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^#?[0-9a-fA-F]{3,6}$", 60)
            .batch().file_input(&["text/plain", ".txt"]).standard().build(),
        ToolDefinition::builder("cert-decoder", "Certificate Decoder (X.509)")
            .description("Decode and inspect X.509 certificates from PEM or DER")
            .aliases(&["x509 decoder"]).keywords(&["certificate", "x509", "pem", "der", "tls"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "BEGIN CERTIFICATE", 90)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .file_input(&[".pem", ".crt", ".cer", ".der", "application/x-x509-ca-cert"]).standard().build(),
        ToolDefinition::builder("uuid-ulid", "UUID/ULID Generate/Decode")
            .description("Generate UUID/ULID values or decode an existing identifier")
            .aliases(&["uuid ulid"]).keywords(&["uuid", "ulid", "generate", "decode", "identifier"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[0-9a-fA-F-]{26,36}$", 65)
            .batch().file_input(&["text/plain", ".txt"]).standard()
            .default_config(json!({ "mode": "generate" })).build(),
        ToolDefinition::builder("random-string", "Random String Generator")
            .description("Generate random strings with configurable length and charset")
            .aliases(&["random text"]).keywords(&["random", "string", "generator", "charset", "length"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("password-generator", "Strong Password Generator")
            .description("Generate strong passwords with configurable complexity")
            .aliases(&["password generator"]).keywords(&["password", "generator", "security", "random", "strong"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("lorem-ipsum", "Lorem Ipsum Generator")
            .description("Generate lorem ipsum words, sentences, or paragraphs")
            .aliases(&["lorem generator"]).keywords(&["lorem", "ipsum", "generator", "text", "placeholder"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("qr-code", "QR Code Reader/Generator")
            .description("Generate QR code SVG from text or decode text from QR images")
            .aliases(&["qr generator"]).keywords(&["qr", "code", "reader", "generator", "barcode"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "IMAGE_BASE64:", 35)
            .chain(vec![DataType::PlainText, DataType::StructuredText, DataType::Binary], DataType::StructuredText)
            .batch().file_input(&[".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]).standard()
            .default_config(json!({ "mode": "generate" })).build(),
        ToolDefinition::builder("random-number", "Random Number Generator")
            .description("Generate random numbers from configurable ranges")
            .aliases(&["number generator"]).keywords(&["random", "number", "range", "integer", "generator"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("random-letter", "Random Letter Generator")
            .description("Generate random letters with configurable case")
            .aliases(&["letter generator"]).keywords(&["random", "letter", "alphabet", "uppercase", "lowercase"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("random-date", "Random Date Generator")
            .description("Generate random datetimes between start and end bounds")
            .aliases(&["date generator"]).keywords(&["random", "date", "time", "range", "generator"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("random-month", "Random Month Generator")
            .description("Generate random months as names or numbers")
            .aliases(&["month generator"]).keywords(&["random", "month", "calendar", "generator", "date"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("random-ip", "Random IP Address Generator")
            .description("Generate random IPv4 and IPv6 addresses")
            .aliases(&["ip generator"]).keywords(&["random", "ip", "ipv4", "ipv6", "generator"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("random-choice", "Random Choice Generator")
            .description("Pick random items from a user-provided list")
            .aliases(&["choice picker"]).keywords(&["random", "choice", "pick", "list", "generator"])
            .chain(vec![DataType::Json, DataType::StructuredText, DataType::PlainText], DataType::StructuredText)
            .batch().file_input(&["application/json", ".json", ".txt"]).standard().build(),
        ToolDefinition::builder("hash-generator", "Hash Generator")
            .description("Generate hashes for text or files")
            .aliases(&["hash"]).keywords(&["hash", "sha", "md5", "checksum", "digest"])
            .clipboard_pattern(ClipboardPatternKind::Regex, "^[a-fA-F0-9]{32,128}$", 35)
            .chain(vec![DataType::PlainText, DataType::Binary], DataType::PlainText)
            .batch().file_input(&["*/*"]).standard()
            .default_config(json!({ "algorithm": "sha256" })).build(),
        ToolDefinition::builder("regex-tester", "RegExp Tester")
            .description("Test regular expressions against text input")
            .aliases(&["regex"]).keywords(&["regex", "regexp", "pattern", "match", "test"])
            .clipboard_pattern(ClipboardPatternKind::Contains, "/", 20)
            .chain(vec![DataType::PlainText], DataType::StructuredText)
            .file_input(&["text/plain"]).standard()
            .default_config(json!({ "flags": "g" })).build(),
    ]
}
/// Lightweight catalog entry for the frontend sidebar and execution routing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCatalogEntry {
    pub id: String,
    pub name: String,
    pub execution_kind: String,
}

/// Tool IDs handled by `run_formatter_tool` (bidirectional format/minify or encode/decode).
/// All other tools are handled by `run_converter_tool`.
const FORMATTER_TOOL_IDS: &[&str] = &[
    "json-format", "html-beautify", "css-beautify", "scss-beautify", "less-beautify",
    "javascript-beautify", "typescript-beautify", "graphql-format", "erb-format",
    "xml-format", "sql-format", "markdown-format", "yaml-format",
    "json-stringify", "url", "html-entity", "base64", "base64-image",
    "backslash-escape", "quote-helper", "utf8", "binary-code", "morse-code",
    "rot13", "caesar-cipher", "aes-encrypt", "uuid-ulid", "qr-code",
];

/// Returns a lightweight catalog of all tools with their execution kind.
/// The frontend uses this to populate the sidebar and route tool invocations
/// to the correct Tauri command (`run_formatter_tool` vs `run_converter_tool`).
#[tauri::command]
pub fn list_tool_catalog(registry: tauri::State<'_, ToolRegistry>) -> Vec<ToolCatalogEntry> {
    let formatter_set: std::collections::HashSet<&str> =
        FORMATTER_TOOL_IDS.iter().copied().collect();
    registry
        .list()
        .into_iter()
        .map(|tool| {
            let kind = if formatter_set.contains(tool.id.as_str()) {
                "formatter"
            } else {
                "converter"
            };
            ToolCatalogEntry {
                id: tool.id,
                name: tool.name,
                execution_kind: kind.to_string(),
            }
        })
        .collect()
}

#[tauri::command]
pub fn list_tools(registry: tauri::State<'_, ToolRegistry>) -> Vec<ToolDefinition> {
    registry.list()
}

#[tauri::command]
pub fn get_tool_definition(
    registry: tauri::State<'_, ToolRegistry>,
    id: String,
) -> Option<ToolDefinition> {
    registry.get(&id)
}

#[tauri::command]
pub fn search_tools(
    registry: tauri::State<'_, ToolRegistry>,
    query: String,
) -> Vec<ToolDefinition> {
    registry.search(&query)
}

#[tauri::command]
pub fn compatible_tool_targets(
    registry: tauri::State<'_, ToolRegistry>,
    from_tool_id: String,
) -> Vec<ToolDefinition> {
    registry.compatible_targets(&from_tool_id)
}

#[tauri::command]
pub fn ranked_search_tools(
    registry: tauri::State<'_, ToolRegistry>,
    query: String,
    favorite_tool_ids: Vec<String>,
    recent_tool_ids: Vec<String>,
) -> Vec<ToolDefinition> {
    registry.ranked_search(&query, &favorite_tool_ids, &recent_tool_ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_validates_alias_and_keyword_requirements() {
        let registry = ToolRegistry::empty();
        let result = registry.register(ToolDefinition {
            id: "broken".to_string(),
            name: "Broken".to_string(),
            description: "Invalid tool".to_string(),
            aliases: vec![],
            keywords: vec!["one".to_string()],
            clipboard_patterns: vec![],
            chain_accepts: vec![DataType::PlainText],
            chain_produces: DataType::PlainText,
            supports_batch: false,
            supports_file_input: false,
            accepted_file_types: vec![],
            supports_presets: false,
            supports_history: false,
            default_config: json!({}),
        });

        assert!(result.is_err());
    }

    #[test]
    fn builtin_registry_contains_tools() {
        let registry = ToolRegistry::with_builtin_tools().expect("create registry");
        assert_eq!(registry.list().len(), 134);
        assert!(registry.get("json-format").is_some());
    }

    #[test]
    fn builtin_tools_have_required_alias_and_keyword_coverage() {
        let registry = ToolRegistry::with_builtin_tools().expect("create registry");
        let tools = registry.list();
        assert!(!tools.is_empty());

        for tool in tools {
            assert!(
                !tool.aliases.is_empty(),
                "tool {} is missing aliases",
                tool.id
            );
            assert!(
                tool.aliases.iter().all(|alias| !alias.trim().is_empty()),
                "tool {} has blank aliases",
                tool.id
            );
            assert!(
                tool.keywords.len() >= 5,
                "tool {} has fewer than 5 keywords",
                tool.id
            );
            assert!(
                tool.keywords
                    .iter()
                    .all(|keyword| !keyword.trim().is_empty()),
                "tool {} has blank keywords",
                tool.id
            );
        }
    }

    #[test]
    fn search_returns_expected_matches() {
        let registry = ToolRegistry::with_builtin_tools().expect("create registry");
        let matches = registry.search("json");
        assert!(!matches.is_empty());
        assert_eq!(matches[0].id, "json-format");
    }

    #[test]
    fn compatible_targets_return_chain_matches() {
        let registry = ToolRegistry::with_builtin_tools().expect("create registry");
        let targets = registry.compatible_targets("json-format");
        assert!(targets.iter().any(|tool| tool.id == "base64"));
    }

    #[test]
    fn ranked_search_applies_favorite_and_recent_tie_breakers() {
        let registry = ToolRegistry::with_builtin_tools().expect("create registry");
        let results = registry.ranked_search(
            "converter",
            &["case-converter".to_string()],
            &["base64".to_string(), "case-converter".to_string()],
        );

        // query matches both "case-converter" and "base64" via alias/keyword tiers.
        // favorite rank should place case converter first.
        assert!(!results.is_empty());
        assert_eq!(results[0].id, "case-converter");
    }

    #[test]
    fn ranked_search_exact_match_tier_beats_partial_match() {
        let registry = ToolRegistry::with_builtin_tools().expect("create registry");
        let results = registry.ranked_search("json format/validate", &[], &[]);
        assert!(!results.is_empty());
        assert_eq!(results[0].id, "json-format");
    }

    #[test]
    fn search_supports_exact_alias_partial_fuzzy_and_typo_queries() {
        let registry = ToolRegistry::with_builtin_tools().expect("create registry");

        let exact = registry.search("JSON Format/Validate");
        assert!(!exact.is_empty());
        assert_eq!(exact[0].id, "json-format");

        let alias = registry.search("js formatter");
        assert!(!alias.is_empty());
        assert_eq!(alias[0].id, "javascript-beautify");

        let partial = registry.search("markdo");
        assert!(!partial.is_empty());
        assert_eq!(partial[0].id, "markdown-format");

        let fuzzy = registry.search("jsnfmt");
        assert!(!fuzzy.is_empty());
        assert_eq!(fuzzy[0].id, "json-format");

        let typo = registry.search("jxon");
        assert!(!typo.is_empty());
        assert!(
            typo.iter().any(|tool| tool.id == "json-format"),
            "expected typo query to include json-format results"
        );
    }
}
