mod analyzers;
mod converters;
mod encoders;
mod formatters;
mod generators;
mod image_tools;
mod text_transforms;
mod unicode_styles;

use analyzers::*;
use converters::*;
use encoders::*;
use formatters::*;
use generators::*;
use image_tools::*;
use text_transforms::*;
use unicode_styles::*;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FormatterMode {
    Format,
    Minify,
}

impl FormatterMode {
    fn parse(raw: &str) -> Result<Self, String> {
        match raw.trim().to_lowercase().as_str() {
            "format" => Ok(Self::Format),
            "minify" => Ok(Self::Minify),
            _ => Err(format!("unsupported formatter mode: {raw}")),
        }
    }
}

#[tauri::command]
pub fn run_formatter_tool(
    tool_id: String,
    input: String,
    mode: String,
    indent_size: Option<usize>,
) -> Result<String, String> {
    let formatter_mode = FormatterMode::parse(&mode)?;
    let normalized_input = input.trim();
    let allows_empty_input = matches!(tool_id.as_str(), "uuid-ulid");
    if normalized_input.is_empty() && !allows_empty_input {
        return Err("input cannot be empty".to_string());
    }

    let indent = indent_size.unwrap_or(2).clamp(1, 8);
    match tool_id.as_str() {
        "json-format" => match formatter_mode {
            FormatterMode::Format => format_json(normalized_input, indent),
            FormatterMode::Minify => minify_json(normalized_input),
        },
        "html-beautify" => match formatter_mode {
            FormatterMode::Format => Ok(format_html(normalized_input, indent)),
            FormatterMode::Minify => Ok(minify_html(normalized_input)),
        },
        "css-beautify" => match formatter_mode {
            FormatterMode::Format => Ok(format_stylesheet(normalized_input, indent, false)),
            FormatterMode::Minify => Ok(minify_stylesheet(normalized_input, false)),
        },
        "scss-beautify" => match formatter_mode {
            FormatterMode::Format => Ok(format_stylesheet(normalized_input, indent, true)),
            FormatterMode::Minify => Ok(minify_stylesheet(normalized_input, true)),
        },
        "less-beautify" => match formatter_mode {
            FormatterMode::Format => Ok(format_stylesheet(normalized_input, indent, true)),
            FormatterMode::Minify => Ok(minify_stylesheet(normalized_input, true)),
        },
        "javascript-beautify" => match formatter_mode {
            FormatterMode::Format => Ok(format_script(normalized_input, indent)),
            FormatterMode::Minify => Ok(minify_script(normalized_input)),
        },
        "typescript-beautify" => match formatter_mode {
            FormatterMode::Format => Ok(format_script(normalized_input, indent)),
            FormatterMode::Minify => Ok(minify_script(normalized_input)),
        },
        "graphql-format" => match formatter_mode {
            FormatterMode::Format => Ok(format_graphql(normalized_input, indent)),
            FormatterMode::Minify => Ok(minify_graphql(normalized_input)),
        },
        "erb-format" => match formatter_mode {
            FormatterMode::Format => Ok(format_erb(normalized_input, indent)),
            FormatterMode::Minify => Ok(minify_erb(normalized_input)),
        },
        "xml-format" => match formatter_mode {
            FormatterMode::Format => Ok(format_xml(normalized_input, indent)),
            FormatterMode::Minify => Ok(minify_xml(normalized_input)),
        },
        "sql-format" => match formatter_mode {
            FormatterMode::Format => Ok(format_sql(normalized_input, indent)),
            FormatterMode::Minify => Ok(minify_sql(normalized_input)),
        },
        "markdown-format" => match formatter_mode {
            FormatterMode::Format => Ok(format_markdown(normalized_input)),
            FormatterMode::Minify => Ok(minify_markdown(normalized_input)),
        },
        "yaml-format" => match formatter_mode {
            FormatterMode::Format => format_yaml(normalized_input),
            FormatterMode::Minify => minify_yaml(normalized_input),
        },
        "json-stringify" => match formatter_mode {
            FormatterMode::Format => stringify_json_text(normalized_input),
            FormatterMode::Minify => unstringify_json_text(normalized_input),
        },
        "url" => match formatter_mode {
            FormatterMode::Format => Ok(url_encode(normalized_input)),
            FormatterMode::Minify => Ok(url_decode(normalized_input)),
        },
        "html-entity" => match formatter_mode {
            FormatterMode::Format => Ok(html_entity_encode(normalized_input)),
            FormatterMode::Minify => Ok(html_entity_decode(normalized_input)),
        },
        "base64" => match formatter_mode {
            FormatterMode::Format => Ok(base64_encode_text(normalized_input)),
            FormatterMode::Minify => base64_decode_text(normalized_input),
        },
        "base64-image" => match formatter_mode {
            FormatterMode::Format => base64_encode_image_data_uri(normalized_input),
            FormatterMode::Minify => base64_decode_image_data_uri(normalized_input),
        },
        "backslash-escape" => match formatter_mode {
            FormatterMode::Format => Ok(escape_backslashes(normalized_input)),
            FormatterMode::Minify => unescape_backslashes(normalized_input),
        },
        "quote-helper" => match formatter_mode {
            FormatterMode::Format => Ok(quote_text(normalized_input)),
            FormatterMode::Minify => unquote_text(normalized_input),
        },
        "utf8" => match formatter_mode {
            FormatterMode::Format => Ok(encode_utf8_bytes(normalized_input)),
            FormatterMode::Minify => decode_utf8_bytes(normalized_input),
        },
        "binary-code" => match formatter_mode {
            FormatterMode::Format => Ok(encode_binary_text(normalized_input)),
            FormatterMode::Minify => decode_binary_text(normalized_input),
        },
        "morse-code" => match formatter_mode {
            FormatterMode::Format => encode_morse_text(normalized_input),
            FormatterMode::Minify => decode_morse_text(normalized_input),
        },
        "rot13" => Ok(apply_rot13(normalized_input)),
        "caesar-cipher" => {
            let shift = indent_size.unwrap_or(3).clamp(1, 25) as i8;
            match formatter_mode {
                FormatterMode::Format => Ok(apply_caesar_cipher(normalized_input, shift)),
                FormatterMode::Minify => Ok(apply_caesar_cipher(normalized_input, -shift)),
            }
        }
        "aes-encrypt" => {
            let payload: AesPayload = serde_json::from_str(normalized_input)
                .map_err(|e| format!("invalid input format: {e}"))?;
            if payload.key.is_empty() {
                return Err("passphrase cannot be empty".to_string());
            }
            if payload.text.is_empty() {
                return Err("text cannot be empty".to_string());
            }
            match formatter_mode {
                FormatterMode::Format => aes256_encrypt(&payload.text, &payload.key),
                FormatterMode::Minify => aes256_decrypt(&payload.text, &payload.key),
            }
        }
        "uuid-ulid" => match formatter_mode {
            FormatterMode::Format => Ok(generate_uuid_ulid_values()),
            FormatterMode::Minify => decode_uuid_or_ulid(normalized_input),
        },
        "qr-code" => match formatter_mode {
            FormatterMode::Format => generate_qr_svg(normalized_input),
            FormatterMode::Minify => decode_qr_content(normalized_input),
        },
        _ => Err(format!("unsupported formatter tool id: {tool_id}")),
    }
}

#[tauri::command]
pub fn run_converter_tool(tool_id: String, input: String) -> Result<String, String> {
    let normalized_input = input.trim();
    let allows_empty_input = matches!(
        tool_id.as_str(),
        "random-string"
            | "password-generator"
            | "lorem-ipsum"
            | "random-number"
            | "random-letter"
            | "random-date"
            | "random-month"
            | "random-ip"
            | "random-choice"
            | "hash-generator"
            | "invisible-text-generator"
    );
    if normalized_input.is_empty() && !allows_empty_input {
        return Err("input cannot be empty".to_string());
    }

    match tool_id.as_str() {
        "json-to-yaml" => convert_json_to_yaml(normalized_input),
        "yaml-to-json" => convert_yaml_to_json(normalized_input),
        "json-to-csv" => convert_json_to_csv(normalized_input),
        "csv-to-json" => convert_csv_to_json(normalized_input),
        "json-to-php" => convert_json_to_php_array(normalized_input),
        "php-to-json" => convert_php_array_to_json(normalized_input),
        "php-serialize" => serialize_php_from_json(normalized_input),
        "php-unserialize" => unserialize_php_to_json(normalized_input),
        "html-to-jsx" => Ok(convert_html_to_jsx(normalized_input)),
        "html-to-markdown" => Ok(convert_html_to_markdown(normalized_input)),
        "word-to-markdown" => convert_word_to_markdown(normalized_input),
        "svg-to-css" => Ok(convert_svg_to_css(normalized_input)),
        "curl-to-code" => Ok(convert_curl_to_javascript_fetch(normalized_input)),
        "json-to-code" => convert_json_to_typescript_code(normalized_input),
        "query-string-to-json" => convert_query_string_to_json(normalized_input),
        "delimiter-converter" => Ok(convert_delimiter_to_newline_list(normalized_input)),
        "number-base-converter" => convert_number_base(normalized_input),
        "hex-to-ascii" => convert_hex_to_ascii(normalized_input),
        "ascii-to-hex" => Ok(convert_ascii_to_hex(normalized_input)),
        "roman-date-converter" => convert_roman_date(normalized_input),
        "url-parser" => parse_url_to_json(normalized_input),
        "utm-generator" => generate_utm_url(normalized_input),
        "slugify-url" => Ok(slugify_text(normalized_input)),
        "html-preview" => Ok(normalized_input.to_string()),
        "markdown-preview" => Ok(markdown_to_html_preview(normalized_input)),
        "unix-time" => convert_unix_time(normalized_input),
        "jwt-debugger" => decode_jwt_token(normalized_input),
        "regex-tester" => run_regex_tester(normalized_input),
        "text-diff" => run_text_diff(normalized_input),
        "string-inspector" => inspect_string_details(normalized_input),
        "cron-parser" => parse_cron_schedule(normalized_input),
        "color-converter" => convert_color_formats(normalized_input),
        "cert-decoder" => decode_certificate_details(normalized_input),
        "random-string" => generate_random_string(normalized_input),
        "password-generator" => generate_password(normalized_input),
        "lorem-ipsum" => generate_lorem_ipsum(normalized_input),
        "random-number" => generate_random_number(normalized_input),
        "random-letter" => generate_random_letter(normalized_input),
        "random-date" => generate_random_date(normalized_input),
        "random-month" => generate_random_month(normalized_input),
        "random-ip" => generate_random_ip(normalized_input),
        "random-choice" => generate_random_choice(normalized_input),
        "hash-generator" => run_hash_generator(normalized_input),
        "case-converter" => run_case_converter(normalized_input),
        "line-sort-dedupe" => run_line_sort_dedupe(normalized_input),
        "sort-words" => run_sort_words(normalized_input),
        "number-sorter" => run_number_sorter(normalized_input),
        "duplicate-word-finder" => run_duplicate_word_finder(normalized_input),
        "text-replace" => run_text_replace(normalized_input),
        "character-remover" => run_character_remover(normalized_input),
        "whitespace-remover" => run_whitespace_remover(normalized_input),
        "line-break-remover" => run_line_break_remover(normalized_input),
        "text-formatting-remover" => run_text_formatting_remover(normalized_input),
        "remove-underscores" => run_remove_underscores(normalized_input),
        "em-dash-remover" => run_em_dash_remover(normalized_input),
        "plain-text-converter" => run_plain_text_converter(normalized_input),
        "repeat-text-generator" => run_repeat_text_generator(normalized_input),
        "reverse-text-generator" => run_reverse_text_generator(normalized_input),
        "upside-down-text-generator" => run_upside_down_text_generator(normalized_input),
        "mirror-text-generator" => run_mirror_text_generator(normalized_input),
        "invisible-text-generator" => run_invisible_text_generator(normalized_input),
        "sentence-counter" => run_sentence_counter(normalized_input),
        "word-frequency-counter" => run_word_frequency_counter(normalized_input),
        "word-cloud-generator" => run_word_cloud_generator(normalized_input),
        "bold-text-generator" => run_bold_text_generator(normalized_input),
        "italic-text-converter" => run_italic_text_converter(normalized_input),
        "underline-text-generator" => run_underline_text_generator(normalized_input),
        "strikethrough-text-generator" => run_strikethrough_text_generator(normalized_input),
        "small-text-generator" => run_small_text_generator(normalized_input),
        "subscript-generator" => run_subscript_generator(normalized_input),
        "superscript-generator" => run_superscript_generator(normalized_input),
        "wide-text-generator" => run_wide_text_generator(normalized_input),
        "double-struck-text-generator" => run_double_struck_text_generator(normalized_input),
        "bubble-text-generator" => run_bubble_text_generator(normalized_input),
        "gothic-text-generator" => run_gothic_text_generator(normalized_input),
        "cursed-text-generator" => run_cursed_text_generator(normalized_input),
        "slash-text-generator" => run_slash_text_generator(normalized_input),
        "stacked-text-generator" => run_stacked_text_generator(normalized_input),
        "big-text-converter" => run_big_text_converter(normalized_input),
        "typewriter-text-generator" => run_typewriter_text_generator(normalized_input),
        "fancy-text-generator" => run_fancy_text_generator(normalized_input),
        "cute-font-generator" => run_cute_font_generator(normalized_input),
        "aesthetic-text-generator" => run_aesthetic_text_generator(normalized_input),
        "unicode-text-converter" => run_unicode_text_converter(normalized_input),
        "unicode-to-text-converter" => run_unicode_to_text_converter(normalized_input),
        "facebook-font-generator" => run_facebook_font_generator(normalized_input),
        "instagram-font-generator" => run_instagram_font_generator(normalized_input),
        "x-font-generator" => run_x_font_generator(normalized_input),
        "tiktok-font-generator" => run_tiktok_font_generator(normalized_input),
        "discord-font-generator" => run_discord_font_generator(normalized_input),
        "whatsapp-font-generator" => run_whatsapp_font_generator(normalized_input),
        "nato-phonetic-converter" => run_nato_phonetic_converter(normalized_input),
        "pig-latin-converter" => run_pig_latin_converter(normalized_input),
        "wingdings-converter" => run_wingdings_converter(normalized_input),
        "phonetic-spelling-converter" => run_phonetic_spelling_converter(normalized_input),
        "jpg-to-png-converter" => run_jpg_to_png_converter(normalized_input),
        "png-to-jpg-converter" => run_png_to_jpg_converter(normalized_input),
        "jpg-to-webp-converter" => run_jpg_to_webp_converter(normalized_input),
        "webp-to-jpg-converter" => run_webp_to_jpg_converter(normalized_input),
        "png-to-webp-converter" => run_png_to_webp_converter(normalized_input),
        "webp-to-png-converter" => run_webp_to_png_converter(normalized_input),
        "svg-to-png-converter" => run_svg_to_png_converter(normalized_input),
        "image-to-text-converter" => run_image_to_text_converter(normalized_input),
        "ascii-art-generator" => run_ascii_art_generator(normalized_input),
        "apa-format-generator" => run_apa_format_generator(normalized_input),
        "markdown-table-generator" => run_markdown_table_generator(normalized_input),
        _ => Err(format!("unsupported converter tool id: {tool_id}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use image::{DynamicImage, ImageFormat};
    use qrcode::QrCode;
    use std::io::Cursor;
    use std::io::Write;

    #[test]
    fn json_format_and_minify_work() {
        let formatted = run_formatter_tool(
            "json-format".to_string(),
            "{\"a\":1,\"b\":{\"c\":2}}".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format json");
        assert!(formatted.contains("\n"));
        assert!(formatted.contains("\"b\": {"));

        let minified = run_formatter_tool(
            "json-format".to_string(),
            "{\n  \"a\": 1,\n  \"b\": {\"c\": 2}\n}".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify json");
        assert_eq!(minified, "{\"a\":1,\"b\":{\"c\":2}}");
    }

    #[test]
    fn json_format_rejects_invalid_input() {
        let result = run_formatter_tool(
            "json-format".to_string(),
            "{broken}".to_string(),
            "format".to_string(),
            Some(2),
        );
        assert!(result.is_err());
    }

    #[test]
    fn html_format_and_minify_work() {
        let formatted = run_formatter_tool(
            "html-beautify".to_string(),
            "<div><span>Hello</span><br/></div>".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format html");
        assert!(formatted.contains("\n  <span>"));

        let minified = run_formatter_tool(
            "html-beautify".to_string(),
            "<div>\n  <span> hello </span>\n</div>".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify html");
        assert_eq!(minified, "<div><span> hello </span></div>");
    }

    #[test]
    fn css_and_scss_format_and_minify_work() {
        let css_formatted = run_formatter_tool(
            "css-beautify".to_string(),
            "body{color:red}.a{margin:0 8px;}".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format css");
        assert!(css_formatted.contains("body {"));
        assert!(css_formatted.contains("color:red"));

        let css_minified = run_formatter_tool(
            "css-beautify".to_string(),
            "body {\n  color: red;\n}\n.a { margin: 0 8px; }\n".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify css");
        assert_eq!(css_minified, "body{color:red;}.a{margin:0 8px;}");

        let scss_minified = run_formatter_tool(
            "scss-beautify".to_string(),
            "$primary: #fff; // keep value\n.nav { color: $primary; }\n".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify scss");
        assert_eq!(scss_minified, "$primary:#fff;.nav{color:$primary;}");
    }

    #[test]
    fn less_js_ts_graphql_and_erb_tools_work() {
        let less_minified = run_formatter_tool(
            "less-beautify".to_string(),
            "@pad: 12px;\n.card {\n  padding: @pad;\n}\n".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify less");
        assert_eq!(less_minified, "@pad:12px;.card{padding:@pad;}");

        let js_formatted = run_formatter_tool(
            "javascript-beautify".to_string(),
            "function hi(name){console.log(name);}".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format javascript");
        assert!(js_formatted.contains("function hi(name) {"));
        assert!(js_formatted.contains("console.log(name);"));

        let ts_minified = run_formatter_tool(
            "typescript-beautify".to_string(),
            "type User = { id: number };\nconst u: User = { id: 1 };".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify typescript");
        assert!(ts_minified.contains("type User={id:number};"));

        let graphql_formatted = run_formatter_tool(
            "graphql-format".to_string(),
            "query GetUser($id:ID!){user(id:$id){id name}}".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format graphql");
        assert!(graphql_formatted.contains("query GetUser($id:ID!) {"));
        assert!(graphql_formatted.contains("user(id:$id) {"));

        let erb_minified = run_formatter_tool(
            "erb-format".to_string(),
            "<div> <% if @user %> <span><%= @user.name %></span> <% end %> </div>".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify erb");
        assert!(erb_minified.contains("<% if @user %>"));
        assert!(erb_minified.contains("<%= @user.name %>"));
    }

    #[test]
    fn xml_sql_markdown_and_yaml_tools_work() {
        let xml_formatted = run_formatter_tool(
            "xml-format".to_string(),
            "<root><item>1</item><item>2</item></root>".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format xml");
        assert!(xml_formatted.contains("<root>"));
        assert!(xml_formatted.contains("\n  <item>"));

        let sql_formatted = run_formatter_tool(
            "sql-format".to_string(),
            "select id,name from users where active = 1 and team_id = 3 order by name".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format sql");
        assert!(sql_formatted.contains("SELECT"));
        assert!(sql_formatted.contains("\nFROM"));
        assert!(sql_formatted.contains("\nWHERE"));

        let markdown_minified = run_formatter_tool(
            "markdown-format".to_string(),
            "# Title\n\nSome text\n\n- one\n- two\n".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("minify markdown");
        assert_eq!(markdown_minified, "# Title Some text - one - two");

        let yaml_formatted = run_formatter_tool(
            "yaml-format".to_string(),
            "name: binturong\nitems:\n  - one\n  - two\n".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("format yaml");
        assert!(yaml_formatted.contains("name: binturong"));
        assert!(yaml_formatted.contains("items:"));
    }

    #[test]
    fn json_yaml_and_json_csv_converters_work() {
        let yaml = run_converter_tool(
            "json-to-yaml".to_string(),
            "{\"name\":\"binturong\",\"enabled\":true}".to_string(),
        )
        .expect("json to yaml");
        assert!(yaml.contains("name: binturong"));

        let json = run_converter_tool(
            "yaml-to-json".to_string(),
            "name: binturong\nenabled: true".to_string(),
        )
        .expect("yaml to json");
        assert!(json.contains("\"name\": \"binturong\""));

        let csv = run_converter_tool(
            "json-to-csv".to_string(),
            "[{\"id\":1,\"name\":\"A\"},{\"id\":2,\"name\":\"B\"}]".to_string(),
        )
        .expect("json to csv");
        assert!(csv.contains("id,name"));
        assert!(csv.contains("1,A"));

        let json_rows = run_converter_tool(
            "csv-to-json".to_string(),
            "id,name\n1,A\n2,B".to_string(),
        )
        .expect("csv to json");
        assert!(json_rows.contains("\"id\": \"1\""));
        assert!(json_rows.contains("\"name\": \"B\""));
    }

    #[test]
    fn php_converters_serializer_and_json_stringify_work() {
        let php_array = run_converter_tool(
            "json-to-php".to_string(),
            "{\"name\":\"binturong\",\"enabled\":true}".to_string(),
        )
        .expect("json to php");
        assert!(php_array.contains("'name' => 'binturong'"));

        let json_from_php = run_converter_tool(
            "php-to-json".to_string(),
            "['name' => 'binturong', 'enabled' => true]".to_string(),
        )
        .expect("php to json");
        assert!(json_from_php.contains("\"name\": \"binturong\""));
        assert!(json_from_php.contains("\"enabled\": true"));

        let serialized = run_converter_tool(
            "php-serialize".to_string(),
            "{\"name\":\"binturong\",\"count\":2}".to_string(),
        )
        .expect("php serialize");
        assert!(serialized.starts_with("a:2:{"));

        let unserialized = run_converter_tool(
            "php-unserialize".to_string(),
            "a:2:{s:4:\"name\";s:9:\"binturong\";s:5:\"count\";i:2;}".to_string(),
        )
        .expect("php unserialize");
        assert!(unserialized.contains("\"name\": \"binturong\""));
        assert!(unserialized.contains("\"count\": 2"));

        let stringified = run_formatter_tool(
            "json-stringify".to_string(),
            "hello \"world\"".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("json stringify");
        assert_eq!(stringified, "\"hello \\\"world\\\"\"");

        let unstringified = run_formatter_tool(
            "json-stringify".to_string(),
            "\"hello\\\\nworld\"".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("json unstringify");
        assert_eq!(unstringified, "hello\\nworld");
    }

    #[test]
    fn html_markdown_docx_svg_and_curl_converters_work() {
        let jsx = run_converter_tool(
            "html-to-jsx".to_string(),
            "<label class=\"field\" for=\"name\">Name</label><input />".to_string(),
        )
        .expect("html to jsx");
        assert!(jsx.contains("className=\"field\""));
        assert!(jsx.contains("htmlFor=\"name\""));

        let markdown = run_converter_tool(
            "html-to-markdown".to_string(),
            "<h1>Title</h1><p>Hello <strong>world</strong></p>".to_string(),
        )
        .expect("html to markdown");
        assert!(markdown.contains("# Title"));
        assert!(markdown.contains("**world**"));

        let svg_css = run_converter_tool(
            "svg-to-css".to_string(),
            "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\"/></svg>".to_string(),
        )
        .expect("svg to css");
        assert!(svg_css.starts_with("background-image: url(\"data:image/svg+xml,"));

        let curl_code = run_converter_tool(
            "curl-to-code".to_string(),
            "curl -X POST https://api.example.com -H \"Content-Type: application/json\" -d '{\"a\":1}'".to_string(),
        )
        .expect("curl to code");
        assert!(curl_code.contains("fetch(\"https://api.example.com\""));
        assert!(curl_code.contains("method: \"POST\""));

        let mut docx_buffer = Cursor::new(Vec::<u8>::new());
        {
            let mut zip_writer = zip::ZipWriter::new(&mut docx_buffer);
            let options = zip::write::SimpleFileOptions::default();
            zip_writer
                .start_file("word/document.xml", options)
                .expect("start docx xml entry");
            zip_writer
                .write_all(
                    br#"<w:document><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p><w:p><w:r><w:t>World</w:t></w:r></w:p></w:body></w:document>"#,
                )
                .expect("write docx xml");
            zip_writer.finish().expect("finish docx zip");
        }

        let payload = format!(
            "DOCX_BASE64:{}",
            base64::engine::general_purpose::STANDARD.encode(docx_buffer.into_inner())
        );
        let markdown_from_docx = run_converter_tool("word-to-markdown".to_string(), payload)
            .expect("word to markdown");
        assert!(markdown_from_docx.contains("Hello"));
        assert!(markdown_from_docx.contains("World"));
    }

    #[test]
    fn json_to_code_query_string_and_delimiter_tools_work() {
        let ts_code = run_converter_tool(
            "json-to-code".to_string(),
            "{\"user\":{\"id\":1,\"name\":\"A\"}}".to_string(),
        )
        .expect("json to code");
        assert!(ts_code.contains("type Root ="));
        assert!(ts_code.contains("user: {"));

        let query_json = run_converter_tool(
            "query-string-to-json".to_string(),
            "https://example.com?a=1&b=two&b=three".to_string(),
        )
        .expect("query string to json");
        assert!(query_json.contains("\"a\": \"1\""));
        assert!(query_json.contains("\"b\""));

        let converted = run_converter_tool(
            "delimiter-converter".to_string(),
            "one,two,three".to_string(),
        )
        .expect("delimiter converter");
        assert_eq!(converted, "one\ntwo\nthree");
    }

    #[test]
    fn base_hex_ascii_and_roman_date_tools_work() {
        let base_output = run_converter_tool(
            "number-base-converter".to_string(),
            "42".to_string(),
        )
        .expect("number base converter");
        assert!(base_output.contains("binary: 101010"));
        assert!(base_output.contains("hex: 2A"));

        let ascii = run_converter_tool("hex-to-ascii".to_string(), "48656C6C6F".to_string())
            .expect("hex to ascii");
        assert_eq!(ascii, "Hello");

        let hex = run_converter_tool("ascii-to-hex".to_string(), "Hi".to_string())
            .expect("ascii to hex");
        assert_eq!(hex, "4869");

        let roman_date = run_converter_tool(
            "roman-date-converter".to_string(),
            "2026-03-27".to_string(),
        )
        .expect("roman date");
        assert_eq!(roman_date, "MMXXVI-III-XXVII");

        let standard_date = run_converter_tool(
            "roman-date-converter".to_string(),
            "MMXXVI-III-XXVII".to_string(),
        )
        .expect("standard date");
        assert_eq!(standard_date, "2026-3-27");
    }

    #[test]
    fn url_entity_and_preview_tools_work() {
        let encoded_url = run_formatter_tool(
            "url".to_string(),
            "hello world".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("url encode");
        assert_eq!(encoded_url, "hello%20world");

        let decoded_url = run_formatter_tool(
            "url".to_string(),
            "hello%20world".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("url decode");
        assert_eq!(decoded_url, "hello world");

        let encoded_entity = run_formatter_tool(
            "html-entity".to_string(),
            "<tag>&".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("entity encode");
        assert_eq!(encoded_entity, "&lt;tag&gt;&amp;");

        let parsed_url = run_converter_tool(
            "url-parser".to_string(),
            "https://example.com/path?a=1&b=2".to_string(),
        )
        .expect("url parser");
        assert!(parsed_url.contains("\"scheme\": \"https\""));
        assert!(parsed_url.contains("\"path\": \"/path\""));

        let utm_url = run_converter_tool(
            "utm-generator".to_string(),
            "{\"baseUrl\":\"https://example.com\",\"source\":\"newsletter\",\"medium\":\"email\",\"campaign\":\"launch\"}".to_string(),
        )
        .expect("utm generator");
        assert!(utm_url.contains("utm_source=newsletter"));
        assert!(utm_url.contains("utm_campaign=launch"));

        let slug = run_converter_tool("slugify-url".to_string(), "Hello, Binturong!".to_string())
            .expect("slugify");
        assert_eq!(slug, "hello-binturong");

        let html_preview = run_converter_tool(
            "html-preview".to_string(),
            "<h1>Hello</h1>".to_string(),
        )
        .expect("html preview");
        assert_eq!(html_preview, "<h1>Hello</h1>");

        let markdown_preview = run_converter_tool(
            "markdown-preview".to_string(),
            "# Title\n- one\n- two".to_string(),
        )
        .expect("markdown preview");
        assert!(markdown_preview.contains("<h1>Title</h1>"));
        assert!(markdown_preview.contains("<li>one</li>"));
    }

    #[test]
    fn base64_backslash_quote_and_utf8_tools_work() {
        let base64_encoded = run_formatter_tool(
            "base64".to_string(),
            "hello world".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("base64 encode");
        assert_eq!(base64_encoded, "aGVsbG8gd29ybGQ=");

        let base64_decoded = run_formatter_tool(
            "base64".to_string(),
            base64_encoded.clone(),
            "minify".to_string(),
            Some(2),
        )
        .expect("base64 decode");
        assert_eq!(base64_decoded, "hello world");

        let raw_image = base64::engine::general_purpose::STANDARD.encode([0x89, 0x50, 0x4E, 0x47]);
        let image_data_uri = run_formatter_tool(
            "base64-image".to_string(),
            format!("IMAGE_BASE64:image/png;base64,{raw_image}"),
            "format".to_string(),
            Some(2),
        )
        .expect("base64 image encode");
        assert!(image_data_uri.starts_with("data:image/png;base64,"));

        let extracted_image_base64 = run_formatter_tool(
            "base64-image".to_string(),
            image_data_uri,
            "minify".to_string(),
            Some(2),
        )
        .expect("base64 image decode");
        assert_eq!(extracted_image_base64, raw_image);

        let escaped = run_formatter_tool(
            "backslash-escape".to_string(),
            "line1\nline2\tvalue".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("backslash escape");
        assert_eq!(escaped, "line1\\nline2\\tvalue");

        let unescaped = run_formatter_tool(
            "backslash-escape".to_string(),
            escaped,
            "minify".to_string(),
            Some(2),
        )
        .expect("backslash unescape");
        assert_eq!(unescaped, "line1\nline2\tvalue");

        let quoted = run_formatter_tool(
            "quote-helper".to_string(),
            "hello \"world\"".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("quote helper");
        assert_eq!(quoted, "\"hello \\\"world\\\"\"");

        let unquoted = run_formatter_tool(
            "quote-helper".to_string(),
            quoted,
            "minify".to_string(),
            Some(2),
        )
        .expect("unquote helper");
        assert_eq!(unquoted, "hello \"world\"");

        let utf8_bytes = run_formatter_tool(
            "utf8".to_string(),
            "Hi".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("utf8 encode");
        assert_eq!(utf8_bytes, "48 69");

        let utf8_text = run_formatter_tool(
            "utf8".to_string(),
            utf8_bytes,
            "minify".to_string(),
            Some(2),
        )
        .expect("utf8 decode");
        assert_eq!(utf8_text, "Hi");
    }

    #[test]
    fn binary_morse_rot13_and_caesar_tools_work() {
        let binary = run_formatter_tool(
            "binary-code".to_string(),
            "AB".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("binary encode");
        assert_eq!(binary, "01000001 01000010");

        let text = run_formatter_tool(
            "binary-code".to_string(),
            binary,
            "minify".to_string(),
            Some(2),
        )
        .expect("binary decode");
        assert_eq!(text, "AB");

        let morse = run_formatter_tool(
            "morse-code".to_string(),
            "SOS".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("morse encode");
        assert_eq!(morse, "... --- ...");

        let morse_text = run_formatter_tool(
            "morse-code".to_string(),
            "... --- ...".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("morse decode");
        assert_eq!(morse_text, "SOS");

        let rot13_encoded = run_formatter_tool(
            "rot13".to_string(),
            "Hello".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("rot13 encode");
        assert_eq!(rot13_encoded, "Uryyb");

        let rot13_decoded = run_formatter_tool(
            "rot13".to_string(),
            rot13_encoded,
            "minify".to_string(),
            Some(2),
        )
        .expect("rot13 decode");
        assert_eq!(rot13_decoded, "Hello");

        let encrypted = run_formatter_tool(
            "caesar-cipher".to_string(),
            "abc XYZ".to_string(),
            "format".to_string(),
            Some(3),
        )
        .expect("caesar encrypt");
        assert_eq!(encrypted, "def ABC");

        let decrypted = run_formatter_tool(
            "caesar-cipher".to_string(),
            encrypted,
            "minify".to_string(),
            Some(3),
        )
        .expect("caesar decrypt");
        assert_eq!(decrypted, "abc XYZ");
    }

    #[test]
    fn aes256_encrypt_decrypt_roundtrip_works() {
        let plaintext = "Hello, AES-256-GCM!";
        let passphrase = "my-secret-key";
        let payload = serde_json::json!({ "text": plaintext, "key": passphrase }).to_string();

        let encrypted = run_formatter_tool(
            "aes-encrypt".to_string(),
            payload.clone(),
            "format".to_string(),
            None,
        )
        .expect("aes encrypt");

        // Encrypted output should be base64
        assert!(base64::engine::general_purpose::STANDARD.decode(&encrypted).is_ok());

        // Decrypt the ciphertext
        let decrypt_payload =
            serde_json::json!({ "text": encrypted, "key": passphrase }).to_string();
        let decrypted = run_formatter_tool(
            "aes-encrypt".to_string(),
            decrypt_payload,
            "minify".to_string(),
            None,
        )
        .expect("aes decrypt");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn aes256_decrypt_with_wrong_key_fails() {
        let payload = serde_json::json!({ "text": "secret data", "key": "correct-key" }).to_string();
        let encrypted = run_formatter_tool(
            "aes-encrypt".to_string(),
            payload,
            "format".to_string(),
            None,
        )
        .expect("aes encrypt");

        let wrong_key_payload =
            serde_json::json!({ "text": encrypted, "key": "wrong-key" }).to_string();
        let result = run_formatter_tool(
            "aes-encrypt".to_string(),
            wrong_key_payload,
            "minify".to_string(),
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("wrong passphrase"));
    }

    #[test]
    fn aes256_rejects_empty_key_or_text() {
        let empty_key = serde_json::json!({ "text": "hello", "key": "" }).to_string();
        let result = run_formatter_tool(
            "aes-encrypt".to_string(),
            empty_key,
            "format".to_string(),
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("passphrase cannot be empty"));

        let empty_text = serde_json::json!({ "text": "", "key": "key" }).to_string();
        let result = run_formatter_tool(
            "aes-encrypt".to_string(),
            empty_text,
            "format".to_string(),
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("text cannot be empty"));
    }

    #[test]
    fn unix_jwt_regex_and_text_diff_tools_work() {
        let unix_output = run_converter_tool("unix-time".to_string(), "1700000000".to_string())
            .expect("unix converter");
        assert!(unix_output.contains("\"seconds\": 1700000000"));
        assert!(unix_output.contains("\"utcIso\""));

        let header =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(r#"{"alg":"HS256","typ":"JWT"}"#);
        let payload =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(r#"{"sub":"123","exp":4102444800}"#);
        let jwt_token = format!("{header}.{payload}.signature");
        let jwt_output =
            run_converter_tool("jwt-debugger".to_string(), jwt_token).expect("jwt debugger");
        assert!(jwt_output.contains("\"alg\": \"HS256\""));
        assert!(jwt_output.contains("\"sub\": \"123\""));
        assert!(jwt_output.contains("\"signature\": \"signature\""));

        let regex_output = run_converter_tool(
            "regex-tester".to_string(),
            r##"{"pattern":"\\d+","flags":"g","text":"id=42 code=77","replace":"#"}"##.to_string(),
        )
        .expect("regex tester");
        assert!(regex_output.contains("\"matched\": \"42\""));
        assert!(regex_output.contains("\"replacedText\": \"id=# code=#\""));

        let diff_output = run_converter_tool(
            "text-diff".to_string(),
            r#"{"left":"one\ntwo\nthree","right":"one\n2\nthree"}"#.to_string(),
        )
        .expect("text diff");
        assert!(diff_output.contains("  one"));
        assert!(diff_output.contains("- two"));
        assert!(diff_output.contains("+ 2"));
    }

    #[test]
    fn string_cron_color_and_certificate_tools_work() {
        let string_output = run_converter_tool(
            "string-inspector".to_string(),
            "Hi 🐾".to_string(),
        )
        .expect("string inspector");
        assert!(string_output.contains("\"characters\": 4"));
        assert!(string_output.contains("U+1F43E"));

        let cron_output = run_converter_tool(
            "cron-parser".to_string(),
            "*/15 * * * *".to_string(),
        )
        .expect("cron parser");
        assert!(cron_output.contains("\"normalizedExpression\": \"0 */15 * * * *\""));
        assert!(cron_output.contains("\"nextRunsUtc\""));

        let color_output = run_converter_tool(
            "color-converter".to_string(),
            "rgb(14, 165, 233)".to_string(),
        )
        .expect("color converter");
        assert!(color_output.contains("\"hex\": \"#0EA5E9\""));
        assert!(color_output.contains("\"hsl\":"));

        let certificate_output = run_converter_tool(
            "cert-decoder".to_string(),
            r#"-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUP8nqVf82sAirwQ0qGg7djTJfNoswDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJQmludHVyb25nMB4XDTI2MDMyNzE5Mjk1N1oXDTI3MDMy
NzE5Mjk1N1owFDESMBAGA1UEAwwJQmludHVyb25nMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAyhJzNhU2D1G0oaDOdMw2RX2A3G0ax/T3NmkTZcfv8Vv5
kst9Es1QyvuXJMBbd+gBZ9n31c3Pplv1BZtqoFzJLo92dfcIVy9OEazSklK9wOkV
KJwipGtbzb5bwXycXQVUmpp7xkCPbrjzMBT3rBdjhyUJ66tv3VnM6oZ25NmSz32U
Th8Q4yDAIwkd2j65dABetlCAr/Hk+marJdWbOHxCoxFOsQW0IaEIFlXwUNwlF/od
bZGag4PY1oZAn8hzIZw2/HpG4JFSCRaVBwDOlPnASR+WOAbKOaA6c2rP52WV+obz
MGcHxmd1/uStwigpza2sLomcjAzVHHFLHIOQeowG1QIDAQABo1MwUTAdBgNVHQ4E
FgQUAWAUO2n331jGLNRAa1G4wqFLMeIwHwYDVR0jBBgwFoAUAWAUO2n331jGLNRA
a1G4wqFLMeIwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEASx5w
SiAZG3K9grU11V7fjSsMrdYN+rtwMJvU9357G/gitTJiVxEvBcHWG4KVg17gOOhX
iBu/Gs3Nb1hP9QBgzTMMrwlxqPao71GxDSyfT1vbEK9tDqLFiG4YC68klOCQjiJQ
WBB8vBnoIYKzBNPb7d+gt9r4Bp4lKJ7pGtxY6kYzAh+mKD1YQNFvUvmIU+qOsVw9
oahkRJg3ZtbxKPzBUziJ8XSUZkElY1bVJf6WG1Cs/xiVexPJJOKMAyZ4C4VbjxHy
YFjr704cU7wf94yTWKw+Gysvu4jhv07cX/9YSC8hlrwEMlvSGZhLpbW8nQkjHhYz
xO+Kgb/A2Z7i52DQmw==
-----END CERTIFICATE-----"#.to_string(),
        )
        .expect("cert decoder");
        assert!(certificate_output.contains("\"subject\""));
        assert!(certificate_output.contains("Binturong"));
        assert!(certificate_output.contains("\"serialNumber\""));
    }

    #[test]
    fn uuid_random_password_lorem_and_qr_tools_work() {
        let generated_ids = run_formatter_tool(
            "uuid-ulid".to_string(),
            "generate".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("uuid/ulid generate");
        assert!(generated_ids.contains("uuidV4"));
        assert!(generated_ids.contains("ulid"));

        let decoded_uuid = run_formatter_tool(
            "uuid-ulid".to_string(),
            "550e8400-e29b-41d4-a716-446655440000".to_string(),
            "minify".to_string(),
            Some(2),
        )
        .expect("uuid decode");
        assert!(decoded_uuid.contains("\"type\": \"uuid\""));
        assert!(decoded_uuid.contains("\"version\": 4"));

        let random_string = run_converter_tool("random-string".to_string(), String::new())
            .expect("random string");
        assert_eq!(random_string.lines().count(), 1);
        assert_eq!(random_string.len(), 16);

        let generated_password = run_converter_tool("password-generator".to_string(), String::new())
            .expect("password generator");
        assert!(generated_password.len() >= 20);

        let lorem = run_converter_tool("lorem-ipsum".to_string(), String::new())
            .expect("lorem ipsum");
        assert!(lorem.contains('.'));

        let qr_svg = run_formatter_tool(
            "qr-code".to_string(),
            "binturong".to_string(),
            "format".to_string(),
            Some(2),
        )
        .expect("qr generate");
        assert!(qr_svg.contains("<svg"));

        let qr = QrCode::new("binturong").expect("build test qr");
        let qr_image = qr
            .render::<image::Luma<u8>>()
            .min_dimensions(128, 128)
            .build();
        let dynamic = image::DynamicImage::ImageLuma8(qr_image);
        let mut png = Cursor::new(Vec::new());
        dynamic
            .write_to(&mut png, image::ImageFormat::Png)
            .expect("encode qr png");
        let payload = format!(
            "IMAGE_BASE64:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(png.into_inner())
        );

        let qr_decoded = run_formatter_tool(
            "qr-code".to_string(),
            payload,
            "minify".to_string(),
            Some(2),
        )
        .expect("qr decode");
        assert_eq!(qr_decoded, "binturong");

        let svg_payload = format!(
            "IMAGE_BASE64:image/svg+xml;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(qr_svg.as_bytes())
        );
        let qr_decoded_svg = run_formatter_tool(
            "qr-code".to_string(),
            svg_payload,
            "minify".to_string(),
            Some(2),
        )
        .expect("qr svg decode");
        assert_eq!(qr_decoded_svg, "binturong");
    }

    #[test]
    fn random_number_letter_date_month_ip_and_choice_tools_work() {
        let random_number = run_converter_tool(
            "random-number".to_string(),
            r#"{"min":1,"max":10,"count":3,"integer":true}"#.to_string(),
        )
        .expect("random number");
        assert_eq!(random_number.lines().count(), 3);

        let random_letters = run_converter_tool(
            "random-letter".to_string(),
            r#"{"count":5,"uppercase":true,"lowercase":false}"#.to_string(),
        )
        .expect("random letter");
        assert_eq!(random_letters.len(), 5);
        assert!(random_letters.chars().all(|ch| ch.is_ascii_uppercase()));

        let random_dates = run_converter_tool(
            "random-date".to_string(),
            r#"{"start":"2026-03-27","end":"2026-03-27","count":2,"format":"%Y-%m-%d"}"#.to_string(),
        )
        .expect("random date");
        assert_eq!(random_dates.lines().count(), 2);
        assert!(random_dates.lines().all(|line| line.len() == 10 && line.contains('-')));

        let random_months = run_converter_tool(
            "random-month".to_string(),
            r#"{"count":4,"output":"number"}"#.to_string(),
        )
        .expect("random month");
        assert_eq!(random_months.lines().count(), 4);
        for month in random_months.lines() {
            let parsed = month.parse::<u8>().expect("month number");
            assert!((1..=12).contains(&parsed));
        }

        let random_ip = run_converter_tool(
            "random-ip".to_string(),
            r#"{"count":2,"version":"ipv4"}"#.to_string(),
        )
        .expect("random ip");
        assert_eq!(random_ip.lines().count(), 2);
        assert!(random_ip.lines().all(|line| line.split('.').count() == 4));

        let random_choice = run_converter_tool(
            "random-choice".to_string(),
            r#"{"items":["red","blue","green"],"count":2,"unique":true}"#.to_string(),
        )
        .expect("random choice");
        assert_eq!(random_choice.lines().count(), 2);

        // Plain text defaults to a single sha256 hash.
        let hash_default = run_converter_tool(
            "hash-generator".to_string(),
            "hello".to_string(),
        )
        .expect("hash generator default sha256");
        assert!(hash_default.contains("\"algorithm\": \"sha256\""));
        assert!(hash_default.contains("\"hash\": \"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824\""));

        // JSON without algorithm still returns all supported hashes.
        let hash_all = run_converter_tool(
            "hash-generator".to_string(),
            r#"{"text":"hello"}"#.to_string(),
        )
        .expect("hash generator all algorithms");
        assert!(hash_all.contains("\"algorithm\": \"SHA-256\""));
        assert!(hash_all.contains("\"algorithm\": \"MD5\""));

        // JSON with specific algorithm returns single hash (CLI backwards compat)
        let hash_md5 = run_converter_tool(
            "hash-generator".to_string(),
            r#"{"algorithm":"md5","text":"hello"}"#.to_string(),
        )
        .expect("hash generator md5");
        assert!(hash_md5.contains("\"algorithm\": \"md5\""));
        assert!(hash_md5.contains("\"hash\": \"5d41402abc4b2a76b9719d911017c592\""));
    }

    #[test]
    fn case_sort_and_duplicate_tools_work() {
        let snake = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"Hello Binturong","mode":"snake_case"}"#.to_string(),
        )
        .expect("case converter");
        assert_eq!(snake, "hello_binturong");

        let sentence = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"hELLO, wORLD! this IS fine. ok? yes: maybe","mode":"sentence"}"#.to_string(),
        )
        .expect("case converter sentence");
        assert_eq!(sentence, "Hello, world! This is fine. Ok? Yes: maybe");

        let lower = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"HeLLo, WoRLD! 123","mode":"lower"}"#.to_string(),
        )
        .expect("case converter lower");
        assert_eq!(lower, "hello, world! 123");

        let upper = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"HeLLo, WoRLD! 123","mode":"upper"}"#.to_string(),
        )
        .expect("case converter upper");
        assert_eq!(upper, "HELLO, WORLD! 123");

        let capitalized = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"hELLO, wORLD! keep-this: punctuation.","mode":"capitalized"}"#.to_string(),
        )
        .expect("case converter capitalized");
        assert_eq!(capitalized, "Hello, World! Keep-This: Punctuation.");

        let alternating = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"hello, world!","mode":"alternating"}"#.to_string(),
        )
        .expect("case converter alternating");
        assert_eq!(alternating, "hElLo, wOrLd!");

        let title = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"hELLO, wORLD! keep-this: punctuation.","mode":"title"}"#.to_string(),
        )
        .expect("case converter title");
        assert_eq!(title, "Hello, World! Keep-This: Punctuation.");

        let inverse = run_converter_tool(
            "case-converter".to_string(),
            r#"{"text":"Hello, World! 123","mode":"inverse"}"#.to_string(),
        )
        .expect("case converter inverse");
        assert_eq!(inverse, "hELLO, wORLD! 123");

        let sorted_lines = run_converter_tool(
            "line-sort-dedupe".to_string(),
            r#"{"text":"b\na\na","mode":"alpha","dedupe":true}"#.to_string(),
        )
        .expect("line sort dedupe");
        assert_eq!(sorted_lines, "a\nb");

        let sorted_words = run_converter_tool(
            "sort-words".to_string(),
            "banana apple cherry".to_string(),
        )
        .expect("sort words");
        assert_eq!(sorted_words, "apple banana cherry");

        let sorted_numbers = run_converter_tool(
            "number-sorter".to_string(),
            r#"{"numbers":"4,1,3","order":"desc"}"#.to_string(),
        )
        .expect("number sorter");
        assert_eq!(sorted_numbers, "4\n3\n1");

        let duplicates = run_converter_tool(
            "duplicate-word-finder".to_string(),
            "one two one three two".to_string(),
        )
        .expect("duplicate finder");
        assert!(duplicates.contains("\"word\": \"one\""));
        assert!(duplicates.contains("\"count\": 2"));
    }

    #[test]
    fn replace_and_removal_tools_work() {
        let replaced = run_converter_tool(
            "text-replace".to_string(),
            r#"{"text":"hello world","find":"world","replace":"binturong"}"#.to_string(),
        )
        .expect("text replace");
        assert_eq!(replaced, "hello binturong");

        let removed_chars = run_converter_tool(
            "character-remover".to_string(),
            r#"{"text":"a1b2c3","mode":"digits"}"#.to_string(),
        )
        .expect("character remover");
        assert_eq!(removed_chars, "abc");

        let whitespace = run_converter_tool(
            "whitespace-remover".to_string(),
            r#"{"text":"  hello   world  ","mode":"extra"}"#.to_string(),
        )
        .expect("whitespace remover");
        assert_eq!(whitespace, "hello world");

        let line_breaks = run_converter_tool(
            "line-break-remover".to_string(),
            r#"{"text":"a\nb\nc","replaceWithSpace":true}"#.to_string(),
        )
        .expect("line break remover (legacy replaceWithSpace)");
        assert_eq!(line_breaks, "a b c");

        let line_breaks_mode_replace = run_converter_tool(
            "line-break-remover".to_string(),
            r#"{"text":"a\nb\nc","mode":"replace-with-space"}"#.to_string(),
        )
        .expect("line break remover (mode replace-with-space)");
        assert_eq!(line_breaks_mode_replace, "a b c");

        let line_breaks_mode_remove = run_converter_tool(
            "line-break-remover".to_string(),
            r#"{"text":"a\nb\nc","mode":"remove"}"#.to_string(),
        )
        .expect("line break remover (mode remove)");
        assert_eq!(line_breaks_mode_remove, "abc");

        let formatting = run_converter_tool(
            "text-formatting-remover".to_string(),
            r##"{"text":"# Title\n**bold** <b>tag</b>"}"##.to_string(),
        )
        .expect("text formatting remover");
        assert_eq!(formatting, "Title bold tag");
    }

    #[test]
    fn underscore_dash_plain_repeat_and_reverse_tools_work() {
        let underscore_removed = run_converter_tool(
            "remove-underscores".to_string(),
            "hello_world__again".to_string(),
        )
        .expect("remove underscores");
        assert_eq!(underscore_removed, "hello world  again");

        let em_dash_removed = run_converter_tool(
            "em-dash-remover".to_string(),
            r#"{"text":"alpha-beta–gamma","mode":"space"}"#.to_string(),
        )
        .expect("em dash remover");
        assert_eq!(em_dash_removed, "alpha beta gamma");

        let plain_text = run_converter_tool(
            "plain-text-converter".to_string(),
            r##"{"text":"# Title\n**Bold** <b>tag</b> &amp; more"}"##.to_string(),
        )
        .expect("plain text converter");
        assert_eq!(plain_text, "Title Bold tag & more");

        let repeated = run_converter_tool(
            "repeat-text-generator".to_string(),
            r#"{"text":"go","count":3,"separator":"-"}"#.to_string(),
        )
        .expect("repeat text");
        assert_eq!(repeated, "go-go-go");

        let reversed = run_converter_tool(
            "reverse-text-generator".to_string(),
            "Binturong".to_string(),
        )
        .expect("reverse text");
        assert_eq!(reversed, "gnorutniB");
    }

    #[test]
    fn unicode_and_counting_tools_work() {
        let upside = run_converter_tool(
            "upside-down-text-generator".to_string(),
            "Hello!".to_string(),
        )
        .expect("upside down text");
        assert_eq!(upside, "¡ollǝɥ");

        let mirrored = run_converter_tool(
            "mirror-text-generator".to_string(),
            "ab(cd)".to_string(),
        )
        .expect("mirror text");
        assert_eq!(mirrored, "(bↄ)dɒ");

        let invisible = run_converter_tool(
            "invisible-text-generator".to_string(),
            r#"{"length":4,"character":"zwsp"}"#.to_string(),
        )
        .expect("invisible text");
        assert_eq!(invisible.chars().count(), 4);
        assert!(invisible.chars().all(|ch| ch == '\u{200B}'));

        let sentence_stats = run_converter_tool(
            "sentence-counter".to_string(),
            "One. Two three!\n\nFour?".to_string(),
        )
        .expect("sentence counter");
        assert!(sentence_stats.contains("\"sentences\": 3"));
        assert!(sentence_stats.contains("\"words\": 4"));
        assert!(sentence_stats.contains("\"paragraphs\": 2"));

        let frequency = run_converter_tool(
            "word-frequency-counter".to_string(),
            "apple banana apple pear banana apple".to_string(),
        )
        .expect("word frequency");
        assert!(frequency.contains("\"word\": \"apple\""));
        assert!(frequency.contains("\"count\": 3"));

        let word_cloud = run_converter_tool(
            "word-cloud-generator".to_string(),
            r#"{"text":"apple banana apple pear","maxWords":2}"#.to_string(),
        )
        .expect("word cloud");
        assert!(word_cloud.contains("<span"));
        assert!(word_cloud.contains("apple"));
    }

    #[test]
    fn unicode_style_tools_work() {
        let bold = run_converter_tool(
            "bold-text-generator".to_string(),
            "Ab3".to_string(),
        )
        .expect("bold text");
        assert_eq!(bold, "𝐀𝐛𝟑");

        let italic = run_converter_tool(
            "italic-text-converter".to_string(),
            "Abh".to_string(),
        )
        .expect("italic text");
        assert_eq!(italic, "𝐴𝑏ℎ");

        let underlined = run_converter_tool(
            "underline-text-generator".to_string(),
            "ab".to_string(),
        )
        .expect("underline text");
        assert_eq!(underlined, "a̲b̲");

        let struck = run_converter_tool(
            "strikethrough-text-generator".to_string(),
            "ab".to_string(),
        )
        .expect("strikethrough text");
        assert_eq!(struck, "a̶b̶");

        let small = run_converter_tool(
            "small-text-generator".to_string(),
            "ab3".to_string(),
        )
        .expect("small text");
        assert_eq!(small, "ᴀʙ³");

        let subscript = run_converter_tool(
            "subscript-generator".to_string(),
            "ten2".to_string(),
        )
        .expect("subscript text");
        assert_eq!(subscript, "ₜₑₙ₂");
    }

    #[test]
    fn unicode_extended_style_tools_work() {
        let superscript = run_converter_tool(
            "superscript-generator".to_string(),
            "H2O".to_string(),
        )
        .expect("superscript");
        assert_eq!(superscript, "ᴴ²ᴼ");

        let wide = run_converter_tool(
            "wide-text-generator".to_string(),
            "ABC 12".to_string(),
        )
        .expect("wide text");
        assert_eq!(wide, "ＡＢＣ　１２");

        let double_struck = run_converter_tool(
            "double-struck-text-generator".to_string(),
            "Ab3".to_string(),
        )
        .expect("double struck");
        assert_eq!(double_struck, "𝔸𝕓𝟛");

        let bubble = run_converter_tool(
            "bubble-text-generator".to_string(),
            "Ab3".to_string(),
        )
        .expect("bubble text");
        assert_eq!(bubble, "Ⓐⓑ③");

        let gothic = run_converter_tool(
            "gothic-text-generator".to_string(),
            "Ab".to_string(),
        )
        .expect("gothic text");
        assert_eq!(gothic, "𝔄𝔟");

        let cursed = run_converter_tool(
            "cursed-text-generator".to_string(),
            r#"{"text":"ab","intensity":1}"#.to_string(),
        )
        .expect("cursed text");
        assert!(cursed.starts_with('a'));
        assert!(cursed.contains('b'));
        assert!(cursed.chars().count() > 2);

        let slashed = run_converter_tool(
            "slash-text-generator".to_string(),
            "ab".to_string(),
        )
        .expect("slash text");
        assert_eq!(slashed, "a̸b̸");
    }

    #[test]
    fn unicode_novelty_and_converter_tools_work() {
        let stacked = run_converter_tool(
            "stacked-text-generator".to_string(),
            "ab".to_string(),
        )
        .expect("stacked text");
        assert_eq!(stacked, "a\nb");

        let big = run_converter_tool(
            "big-text-converter".to_string(),
            "ab".to_string(),
        )
        .expect("big text");
        assert!(big.contains("AAA BBB"));
        assert!(big.contains('\n'));

        let typewriter = run_converter_tool(
            "typewriter-text-generator".to_string(),
            "Ab1".to_string(),
        )
        .expect("typewriter text");
        assert_eq!(typewriter, "𝙰𝚋𝟷");

        let fancy = run_converter_tool(
            "fancy-text-generator".to_string(),
            r#"{"text":"Ab3","style":"double-struck"}"#.to_string(),
        )
        .expect("fancy text");
        assert_eq!(fancy, "𝔸𝕓𝟛");

        let cute = run_converter_tool(
            "cute-font-generator".to_string(),
            "cat".to_string(),
        )
        .expect("cute text");
        assert!(cute.contains("ʚ♡ɞ"));

        let aesthetic = run_converter_tool(
            "aesthetic-text-generator".to_string(),
            "ab".to_string(),
        )
        .expect("aesthetic text");
        assert_eq!(aesthetic, "Ａ Ｂ");

        let unicode_converted = run_converter_tool(
            "unicode-text-converter".to_string(),
            "A🙂".to_string(),
        )
        .expect("unicode text converter");
        assert!(unicode_converted.contains("U+0041"));
        assert!(unicode_converted.contains("U+1F642"));

        let unicode_to_text = run_converter_tool(
            "unicode-to-text-converter".to_string(),
            "U+0041 U+1F642".to_string(),
        )
        .expect("unicode to text converter");
        assert_eq!(unicode_to_text, "A🙂");
    }

    #[test]
    fn platform_font_generators_work() {
        let facebook = run_converter_tool(
            "facebook-font-generator".to_string(),
            "Ab1".to_string(),
        )
        .expect("facebook font");
        assert_eq!(facebook, "𝐀𝐛𝟏");

        let instagram = run_converter_tool(
            "instagram-font-generator".to_string(),
            "ab".to_string(),
        )
        .expect("instagram font");
        assert_eq!(instagram, "✦ ⓐⓑ ✦");

        let x_font = run_converter_tool(
            "x-font-generator".to_string(),
            "Ab".to_string(),
        )
        .expect("x font");
        assert_eq!(x_font, "𝔸𝕓");

        let tiktok = run_converter_tool(
            "tiktok-font-generator".to_string(),
            "ab".to_string(),
        )
        .expect("tiktok font");
        assert_eq!(tiktok, "Ａ Ｂ");

        let discord = run_converter_tool(
            "discord-font-generator".to_string(),
            "Ab1".to_string(),
        )
        .expect("discord font");
        assert_eq!(discord, "𝙰𝚋𝟷");

        let whatsapp = run_converter_tool(
            "whatsapp-font-generator".to_string(),
            "Abh".to_string(),
        )
        .expect("whatsapp font");
        assert_eq!(whatsapp, "𝐴𝑏ℎ");
    }

    #[test]
    fn translator_tools_work() {
        let nato = run_converter_tool(
            "nato-phonetic-converter".to_string(),
            "AB 1".to_string(),
        )
        .expect("nato encode");
        assert_eq!(nato, "Alpha Bravo / One");

        let nato_decoded = run_converter_tool(
            "nato-phonetic-converter".to_string(),
            r#"{"text":"Alpha Bravo / One","mode":"decode"}"#.to_string(),
        )
        .expect("nato decode");
        assert_eq!(nato_decoded, "AB 1");

        let pig_latin = run_converter_tool(
            "pig-latin-converter".to_string(),
            "hello apple".to_string(),
        )
        .expect("pig latin encode");
        assert_eq!(pig_latin, "ellohay appleyay");

        let wingdings = run_converter_tool(
            "wingdings-converter".to_string(),
            "ABC".to_string(),
        )
        .expect("wingdings encode");
        assert_eq!(wingdings, "✌☝✍");

        let wingdings_decoded = run_converter_tool(
            "wingdings-converter".to_string(),
            r#"{"text":"✌☝✍","mode":"decode"}"#.to_string(),
        )
        .expect("wingdings decode");
        assert_eq!(wingdings_decoded, "ABC");

        let phonetic = run_converter_tool(
            "phonetic-spelling-converter".to_string(),
            "AZ".to_string(),
        )
        .expect("phonetic encode");
        assert_eq!(phonetic, "AY ZEE");

        let phonetic_decoded = run_converter_tool(
            "phonetic-spelling-converter".to_string(),
            r#"{"text":"AY ZEE","mode":"decode"}"#.to_string(),
        )
        .expect("phonetic decode");
        assert_eq!(phonetic_decoded, "AZ");
    }

    #[test]
    fn image_conversion_tools_work() {
        let base_image = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            2,
            2,
            image::Rgba([255, 0, 0, 255]),
        ));
        let png_bytes = encode_dynamic_image(&base_image, ImageFormat::Png).expect("encode png");
        let jpeg_bytes = encode_jpeg_image(&base_image, 90).expect("encode jpeg");
        let webp_bytes =
            encode_dynamic_image(&base_image, ImageFormat::WebP).expect("encode webp");

        let jpg_to_png = run_converter_tool(
            "jpg-to-png-converter".to_string(),
            format!(
                "IMAGE_BASE64:image/jpeg;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(&jpeg_bytes)
            ),
        )
        .expect("jpg to png");
        assert!(jpg_to_png.starts_with("data:image/png;base64,"));

        let png_to_jpg = run_converter_tool(
            "png-to-jpg-converter".to_string(),
            format!(
                "IMAGE_BASE64:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(&png_bytes)
            ),
        )
        .expect("png to jpg");
        assert!(png_to_jpg.starts_with("data:image/jpeg;base64,"));

        let jpg_to_webp = run_converter_tool(
            "jpg-to-webp-converter".to_string(),
            format!(
                "IMAGE_BASE64:image/jpeg;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(&jpeg_bytes)
            ),
        )
        .expect("jpg to webp");
        assert!(jpg_to_webp.starts_with("data:image/webp;base64,"));

        let webp_to_jpg = run_converter_tool(
            "webp-to-jpg-converter".to_string(),
            format!(
                "IMAGE_BASE64:image/webp;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(&webp_bytes)
            ),
        )
        .expect("webp to jpg");
        assert!(webp_to_jpg.starts_with("data:image/jpeg;base64,"));

        let png_to_webp = run_converter_tool(
            "png-to-webp-converter".to_string(),
            format!(
                "IMAGE_BASE64:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(&png_bytes)
            ),
        )
        .expect("png to webp");
        assert!(png_to_webp.starts_with("data:image/webp;base64,"));

        let webp_to_png = run_converter_tool(
            "webp-to-png-converter".to_string(),
            format!(
                "IMAGE_BASE64:image/webp;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(&webp_bytes)
            ),
        )
        .expect("webp to png");
        assert!(webp_to_png.starts_with("data:image/png;base64,"));

        let svg_to_png = run_converter_tool(
            "svg-to-png-converter".to_string(),
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>"#.to_string(),
        )
        .expect("svg to png");
        assert!(svg_to_png.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn ocr_language_helpers_work() {
        let parsed = parse_ocr_languages("eng+spa+eng").expect("parse OCR languages");
        assert_eq!(parsed, vec!["eng".to_string(), "spa".to_string()]);
        assert!(parse_ocr_languages("eng+!").is_err());

        let download_url = tessdata_download_url("eng");
        assert!(download_url.ends_with("/eng.traineddata"));

        let missing_image_error = run_converter_tool(
            "image-to-text-converter".to_string(),
            "{}".to_string(),
        )
        .expect_err("OCR should reject missing image");
        assert!(missing_image_error.contains("requires an image payload"));
    }

    #[test]
    fn ascii_art_generator_works_for_text_and_image() {
        let text_art = run_converter_tool(
            "ascii-art-generator".to_string(),
            "ab".to_string(),
        )
        .expect("ascii art from text");
        assert!(text_art.contains("AAA BBB"));
        assert!(text_art.contains('\n'));

        let base_image = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            2,
            2,
            image::Rgba([0, 0, 0, 255]),
        ));
        let png_bytes = encode_dynamic_image(&base_image, ImageFormat::Png).expect("encode png");
        let image_art = run_converter_tool(
            "ascii-art-generator".to_string(),
            format!(
                "{{\"image\":\"IMAGE_BASE64:image/png;base64,{}\",\"width\":16}}",
                base64::engine::general_purpose::STANDARD.encode(&png_bytes)
            ),
        )
        .expect("ascii art from image");
        assert!(!image_art.trim().is_empty());
        assert!(image_art.lines().count() > 0);
    }

    #[test]
    fn apa_and_markdown_table_generators_work() {
        let apa_reference = run_converter_tool(
            "apa-format-generator".to_string(),
            r#"{"authors":["Jane Doe"],"year":"2024","title":"Testing Tools","source":"Journal of Tooling","volume":"12","issue":"3","pages":"10-20","doi":"10.1000/test"}"#.to_string(),
        )
        .expect("apa reference");
        assert!(apa_reference.contains("Doe, J."));
        assert!(apa_reference.contains("(2024)."));
        assert!(apa_reference.contains("https://doi.org/10.1000/test"));

        let apa_in_text = run_converter_tool(
            "apa-format-generator".to_string(),
            r#"{"authors":["Jane Doe"],"year":"2024","mode":"in-text"}"#.to_string(),
        )
        .expect("apa in text");
        assert_eq!(apa_in_text, "(Doe, 2024)");

        let markdown_table = run_converter_tool(
            "markdown-table-generator".to_string(),
            r#"{"headers":["Name","Age"],"rows":[["Alice","30"],["Bob","28"]],"align":["left","right"]}"#.to_string(),
        )
        .expect("markdown table");
        assert!(markdown_table.contains("| Name | Age |"));
        assert!(markdown_table.contains("| :--- | ---: |"));
        assert!(markdown_table.contains("| Bob | 28 |"));

        let from_text = run_converter_tool(
            "markdown-table-generator".to_string(),
            "city,country\nHanoi,Vietnam".to_string(),
        )
        .expect("markdown table from text");
        assert!(from_text.contains("| city | country |"));
        assert!(from_text.contains("| Hanoi | Vietnam |"));
    }
}
