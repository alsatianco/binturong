use base64::Engine;
use binturong_lib::tools::run_converter_tool;
use std::io::{Cursor, Write};

fn convert(tool: &str, input: &str) -> String {
    run_converter_tool(tool.into(), input.into()).expect("conversion succeeds")
}

fn docx(xml: &str, relationships: Option<&str>) -> String {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    zip.start_file(
        "word/document.xml",
        zip::write::SimpleFileOptions::default(),
    )
    .unwrap();
    write!(zip, "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><w:body>{xml}</w:body></w:document>").unwrap();
    if let Some(relationships) = relationships {
        zip.start_file(
            "word/_rels/document.xml.rels",
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
        zip.write_all(relationships.as_bytes()).unwrap();
    }
    format!(
        "DOCX_BASE64:{}",
        base64::engine::general_purpose::STANDARD.encode(zip.finish().unwrap().into_inner())
    )
}

#[test]
fn webpage_keeps_profile_content_without_source_code() {
    // Reduced from the supplied profile page: head metadata, script/style
    // bodies, SVG icons, hidden toolbar and deeply wrapped linked cards.
    let html = r#"<!doctype html><html><head><title>John Doe | Profile</title>
      <meta name="storage-inventory" content='[{"key":"tracker"}]'>
      <script>document.addEventListener('load', () => { if (1 < 2) alert('leak'); });</script>
      <style>:root { --color: red; } .hidden { display: none; }</style></head><body>
      <div aria-hidden="true"><p>Duplicate toolbar</p></div>
      <main><section><div class="layout" style="width:100%"><a href='/profile'>
        <div><h2>John Doe</h2><svg><title>Icon source</title><path d="M0 0h128"></path></svg></div>
      </a><p>Entrepreneur &amp; ECM specialist</p></div></section>
      <section><h2>About</h2><p>Architecture<br><br>Consulting
        <button aria-hidden="true">… more</button></p></section>
      <section><h2>Experience</h2><a href='/company'><div><p>Solutions Architect</p>
        <p>Example Inc.</p><p>2025 – Present</p></div></a></section></main>
      <dialog><h2>Ad options</h2></dialog><iframe>Frame source</iframe>
      <script>window.__webpack_require__ = () => import('bundle.js');</script>
      </body></html>"#;
    let md = convert("html-to-markdown", html);
    for expected in [
        "## John Doe",
        "## About",
        "## Experience",
        "Entrepreneur & ECM specialist",
        "Solutions Architect",
        "Example Inc.",
        "Consulting",
    ] {
        assert!(md.contains(expected), "missing {expected}: {md}");
    }
    for unwanted in [
        "document.addEventListener",
        "--color",
        "webpack",
        "Duplicate toolbar",
        "Icon source",
        "<svg",
        "<div",
        "Ad options",
        "Frame source",
        "… more",
        "[##",
    ] {
        assert!(!md.contains(unwanted), "leaked {unwanted}: {md}");
    }
}

#[test]
fn html_preserves_markdown_semantics_and_decodes_entities_once() {
    let md = convert(
        "html-to-markdown",
        r#"<h1>Résumé &#x1F600;</h1><p><strong>Bold</strong> and <em>italic</em>
        &lt;tag&gt; &amp;lt;literal&amp;gt; &nbsp; &#169;</p>
        <a href='https://example.com?a=1&amp;b=2' title='a > b'>Link</a>
        <blockquote><p>Quoted</p></blockquote><ol start='3'><li>Third<ul><li>Nested</li></ul></li></ol>
        <p>Use <code>a &lt; b</code>.</p><pre><code>if (a &lt; b) {
    run();
}</code></pre>"#,
    );
    for expected in [
        "# Résumé 😀",
        "**Bold**",
        "*italic*",
        "©",
        "&lt;literal&gt;",
        "https://example.com?a=1&b=2",
        "> Quoted",
        "3. Third",
        "- Nested",
        "`a < b`",
        "```",
        "    run();",
    ] {
        assert!(md.contains(expected), "missing {expected}: {md}");
    }
    assert!(!md.contains("<strong>"));
}

#[test]
fn headerless_tables_keep_cells_and_escape_pipes() {
    let md = convert("html-to-markdown", "<table><tr><td>Name</td><td>Skills</td></tr><tr><td>Jane</td><td><p>Rust | SQL</p><p><b>Design</b></p></td></tr></table>");
    assert_eq!(
        md,
        "| Name | Skills |\n| --- | --- |\n| Jane | Rust &#124; SQL / **Design** |"
    );
}

#[test]
fn merged_tables_keep_alignment_and_mixed_header_cells() {
    let md = convert("html-to-markdown", "<table><caption>Skills</caption><tr><th>Person</th><th colspan='2'>Skills</th></tr><tr><th rowspan='2'>Jane</th><td>Rust</td><td>SQL</td></tr><tr><td>Design</td><td>Testing</td></tr></table>");
    assert!(md.contains("| Person | Skills |  |"), "{md}");
    assert!(md.contains("| Jane | Rust | SQL |"), "{md}");
    assert!(md.contains("|  | Design | Testing |"), "{md}");
    assert!(!md.contains('<'));
}

#[test]
fn nested_layout_tables_keep_all_text_in_order() {
    let md = convert("html-to-markdown", "<table><tr><td><h2>Profile</h2><p>Summary</p></td><td><table><tr><td>Skill</td><td>Years</td></tr><tr><td>Rust</td><td>5</td></tr></table></td></tr></table><p>End</p>");
    assert!(md.starts_with("## Profile\n\nSummary"), "{md}");
    assert!(md.contains("| Rust | 5 |"), "{md}");
    assert!(md.ends_with("End"));
    assert!(!md.contains('<'));
}

#[test]
fn malformed_html_and_hidden_fragments_are_handled() {
    let md = convert("html-to-markdown", "<div hidden>Hidden</div><p style='DISPLAY: none !important'>Hidden</p><p style='visibility: hidden'>Hidden</p><template>Template</template><p>Hello <b>world");
    assert_eq!(md, "Hello **world**");
}

#[test]
fn docx_tables_do_not_leak_xml_from_prefix_matches() {
    let input = docx(
        r#"<w:tbl><w:tblPr><w:tblW w:w="5000"/></w:tblPr><w:tblGrid><w:gridCol w:w="2500"/></w:tblGrid>
      <w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Skills</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Jane</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:tab/><w:t>Rust &amp; SQL</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"#,
        None,
    );
    let md = convert("word-to-markdown", &input);
    assert_eq!(
        md,
        "| Name | Skills |\n| --- | --- |\n| Jane | Rust & SQL |"
    );
    assert!(!md.contains("w:"));
}

#[test]
fn docx_preserves_headings_runs_links_breaks_and_literal_entities() {
    let input = docx(
        r#"<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Résumé</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold</w:t></w:r><w:r><w:t xml:space="preserve"> and </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r></w:p>
      <w:p><w:hyperlink r:id="rId1"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>
      <w:p><w:r><w:t>&amp;lt;literal&amp;gt; &#169;</w:t><w:br/><w:t>Next line</w:t><w:instrText>FIELD CODE</w:instrText></w:r></w:p>"#,
        Some(
            r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="https://example.com?a=1&amp;b=2" Type="hyperlink"/></Relationships>"#,
        ),
    );
    let md = convert("word-to-markdown", &input);
    for expected in [
        "# Résumé",
        "**Bold** and *italic*",
        "[Portfolio](https://example.com?a=1&b=2)",
        "&lt;literal&gt; ©",
        "  \nNext line",
    ] {
        assert!(md.contains(expected), "missing {expected}: {md}");
    }
    assert!(!md.contains("FIELD CODE"));
}

#[test]
fn docx_reports_invalid_input() {
    for input in [
        "not a file".to_string(),
        "DOCX_BASE64:!".to_string(),
        docx("<w:p>", None),
    ] {
        assert!(run_converter_tool("word-to-markdown".into(), input).is_err());
    }
}

#[test]
fn plain_text_tools_also_drop_script_and_style_bodies() {
    for tool in ["plain-text-converter", "text-formatting-remover"] {
        let text = convert(tool, "<style>.leak{color:red}</style><script>window.leak=1</script><p>Hello <b>world</b> &amp; &#169;</p>");
        assert_eq!(text, "Hello world & ©", "{tool}");
    }
}
