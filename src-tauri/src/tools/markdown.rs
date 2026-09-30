use base64::Engine;
use htmd::{element_handler::Handlers, options::Options, HtmlToMarkdown};
use markup5ever_rcdom::{Node, NodeData};
use std::{
    collections::HashMap,
    io::{Cursor, Read},
    rc::Rc,
};

fn tag(node: &Node) -> &str {
    match &node.data {
        NodeData::Element { name, .. } => name.local.as_ref(),
        _ => "",
    }
}

fn attr(node: &Node, key: &str) -> Option<String> {
    match &node.data {
        NodeData::Element { attrs, .. } => attrs
            .borrow()
            .iter()
            .find(|a| a.name.local.as_ref() == key)
            .map(|a| a.value.to_string()),
        _ => None,
    }
}

// Work on an inert parsed tree: never load styles, images, frames, or scripts.
// Keep visible page text, including navigation, rather than guessing which
// sections the user intended to copy.
fn clean_html(node: &Rc<Node>) {
    node.children.borrow_mut().retain(|child| {
        if matches!(
            tag(child),
            "head"
                | "script"
                | "style"
                | "template"
                | "noscript"
                | "svg"
                | "iframe"
                | "object"
                | "embed"
                | "meta"
                | "link"
        ) {
            return false;
        }
        if attr(child, "hidden").is_some()
            || attr(child, "aria-hidden").is_some_and(|s| s.eq_ignore_ascii_case("true"))
            || (tag(child) == "dialog" && attr(child, "open").is_none())
        {
            return false;
        }
        if let Some(style) = attr(child, "style") {
            for declaration in style.split(';') {
                if let Some((key, value)) = declaration.split_once(':') {
                    let value = value.split('!').next().unwrap_or_default().trim();
                    if (key.trim().eq_ignore_ascii_case("display")
                        && value.eq_ignore_ascii_case("none"))
                        || (key.trim().eq_ignore_ascii_case("visibility")
                            && value.eq_ignore_ascii_case("hidden"))
                    {
                        return false;
                    }
                }
            }
        }
        true
    });
    for child in node.children.borrow().iter() {
        clean_html(child);
    }
}

fn contains_table(node: &Rc<Node>) -> bool {
    node.children
        .borrow()
        .iter()
        .any(|c| tag(c) == "table" || contains_table(c))
}

fn table_rows(node: &Rc<Node>, rows: &mut Vec<Rc<Node>>) {
    for child in node.children.borrow().iter() {
        match tag(child) {
            "tr" => rows.push(child.clone()),
            "thead" | "tbody" | "tfoot" => table_rows(child, rows),
            _ => {}
        }
    }
}

fn render_table(
    handlers: &dyn Handlers,
    element: htmd::Element,
) -> Option<htmd::element_handler::HandlerResult> {
    let mut rows = Vec::new();
    table_rows(element.node, &mut rows);
    let mut output = String::from("\n\n");
    for child in element
        .node
        .children
        .borrow()
        .iter()
        .filter(|n| tag(n) == "caption")
    {
        output.push_str(handlers.walk_children(child).content.trim());
        output.push_str("\n\n");
    }
    // Markdown cannot nest tables. Unwrap the outer layout table into blocks
    // so inner tables, paragraphs, and lists remain readable and in order.
    if contains_table(element.node) {
        for row in rows {
            for cell in row
                .children
                .borrow()
                .iter()
                .filter(|n| matches!(tag(n), "td" | "th"))
            {
                output.push_str(handlers.walk_children(cell).content.trim());
                output.push_str("\n\n");
            }
        }
        return Some(output.into());
    }
    let mut grid: Vec<Vec<String>> = Vec::new();
    let mut occupied = vec![0usize; 256];
    for row in rows {
        let mut values = Vec::new();
        for cell in row
            .children
            .borrow()
            .iter()
            .filter(|n| matches!(tag(n), "td" | "th"))
        {
            while values.len() < occupied.len() && occupied[values.len()] > 0 {
                values.push(String::new());
            }
            let content = handlers.walk_children(cell).content;
            let content = content
                .lines()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join(" / ");
            // An entity also works inside inline code, where a backslash would
            // become a visible character. No raw HTML is needed for line breaks.
            let content = content.replace('|', "&#124;");
            let span = attr(cell, "colspan")
                .and_then(|s| s.parse::<usize>().ok())
                .unwrap_or(1)
                .clamp(1, 256);
            let height = attr(cell, "rowspan")
                .and_then(|s| s.parse::<usize>().ok())
                .unwrap_or(1)
                .clamp(1, 65534);
            for column in values.len()..(values.len() + span).min(occupied.len()) {
                occupied[column] = height;
            }
            values.push(content);
            values.extend(std::iter::repeat_n(String::new(), span - 1));
        }
        for remaining in &mut occupied {
            *remaining = remaining.saturating_sub(1);
        }
        if !values.is_empty() {
            grid.push(values);
        }
    }
    let width = grid.iter().map(Vec::len).max().unwrap_or(0);
    if width == 0 {
        return Some(output.into());
    }
    for (index, row) in grid.iter_mut().enumerate() {
        row.resize(width, String::new());
        output.push_str(&format!("| {} |\n", row.join(" | ")));
        if index == 0 {
            output.push_str(&format!("| {} |\n", vec!["---"; width].join(" | ")));
        }
    }
    output.push('\n');
    Some(output.into())
}

pub(crate) fn convert_html_to_markdown(input: &str) -> Result<String, String> {
    let converter = HtmlToMarkdown::builder()
        .options(Options {
            bullet_list_marker: htmd::options::BulletListMarker::Dash,
            ul_bullet_spacing: 1,
            ol_number_spacing: 1,
            ..Options::default()
        })
        .add_handler(vec!["table"], render_table)
        // Links wrapping whole profile cards must not turn block headings and
        // paragraphs into invalid multiline Markdown link labels.
        .add_handler(
            vec!["a"],
            |handlers: &dyn Handlers, element: htmd::Element| {
                let content = handlers.walk_children(element.node).content;
                if content.trim().is_empty() {
                    None
                } else if content.contains('\n') {
                    let link = attr(element.node, "href").unwrap_or_default();
                    let link = link
                        .replace('(', "%28")
                        .replace(')', "%29")
                        .replace(' ', "%20")
                        .replace('<', "%3C")
                        .replace('>', "%3E")
                        .replace('\n', "%0A")
                        .replace('\r', "%0D");
                    let suffix = if link.is_empty() {
                        String::new()
                    } else {
                        format!("\n\n[Link]({link})")
                    };
                    Some(format!("\n\n{}{suffix}\n\n", content.trim()).into())
                } else {
                    handlers.fallback(element)
                }
            },
        )
        .build();
    let tree = converter
        .html_to_tree(input)
        .map_err(|e| format!("failed to parse HTML: {e}"))?;
    clean_html(&tree);
    Ok(converter.tree_to_markdown(&tree).trim().to_string())
}

/// Shared by the plain-text tools so script/style bodies cannot leak there either.
pub(crate) fn html_visible_text(input: &str) -> String {
    fn walk(node: &Rc<Node>, output: &mut String) {
        if let NodeData::Text { contents } = &node.data {
            output.push_str(&contents.borrow());
        }
        let block = matches!(
            tag(node),
            "p" | "div"
                | "section"
                | "article"
                | "main"
                | "header"
                | "footer"
                | "li"
                | "ul"
                | "ol"
                | "tr"
                | "td"
                | "th"
                | "br"
                | "hr"
                | "h1"
                | "h2"
                | "h3"
                | "h4"
                | "h5"
                | "h6"
                | "blockquote"
        );
        if block {
            output.push('\n');
        }
        for child in node.children.borrow().iter() {
            walk(child, output);
        }
        if block {
            output.push('\n');
        }
    }
    let converter = HtmlToMarkdown::new();
    let Ok(tree) = converter.html_to_tree(input) else {
        return input.to_string();
    };
    clean_html(&tree);
    let mut output = String::new();
    walk(&tree, &mut output);
    output
}

fn xml_child<'a, 'input>(
    node: roxmltree::Node<'a, 'input>,
    name: &str,
) -> Option<roxmltree::Node<'a, 'input>> {
    node.children()
        .find(|n| n.is_element() && n.tag_name().name() == name)
}

fn xml_attr<'a>(node: roxmltree::Node<'a, '_>, name: &str) -> Option<&'a str> {
    node.attributes()
        .find(|a| a.name() == name)
        .map(|a| a.value())
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn word_html(node: roxmltree::Node<'_, '_>, links: &HashMap<String, String>) -> String {
    let children = || {
        node.children()
            .filter(|n| n.is_element())
            .map(|n| word_html(n, links))
            .collect::<String>()
    };
    match node.tag_name().name() {
        "t" => escape_html(node.text().unwrap_or_default()),
        "tab" => " ".into(),
        "br" | "cr" => "<br>".into(),
        "noBreakHyphen" => "‑".into(),
        "softHyphen" => "\u{ad}".into(),
        "p" => {
            let properties = xml_child(node, "pPr");
            let style = properties
                .and_then(|n| xml_child(n, "pStyle"))
                .and_then(|n| xml_attr(n, "val"))
                .unwrap_or_default()
                .to_lowercase();
            let level = style
                .strip_prefix("heading")
                .and_then(|s| s.trim().parse::<u8>().ok())
                .filter(|n| (1..=6).contains(n));
            let tag = level.map(|n| format!("h{n}")).unwrap_or_else(|| "p".into());
            format!("<{tag}>{}</{tag}>", children())
        }
        "r" => {
            let mut content = children();
            if let Some(props) = xml_child(node, "rPr") {
                for (property, tag) in [("b", "strong"), ("i", "em"), ("strike", "del")] {
                    if xml_child(props, property)
                        .is_some_and(|n| !matches!(xml_attr(n, "val"), Some("0" | "false" | "off")))
                        && !content.trim().is_empty()
                    {
                        content = format!("<{tag}>{content}</{tag}>");
                    }
                }
            }
            content
        }
        "hyperlink" => {
            let target = xml_attr(node, "id")
                .and_then(|id| links.get(id).cloned())
                .or_else(|| xml_attr(node, "anchor").map(|s| format!("#{s}")));
            match target {
                Some(target) => format!("<a href=\"{}\">{}</a>", escape_html(&target), children()),
                None => children(),
            }
        }
        "tbl" => format!("<table>{}</table>", children()),
        "tr" => format!("<tr>{}</tr>", children()),
        "tc" => {
            let span = xml_child(node, "tcPr")
                .and_then(|n| xml_child(n, "gridSpan"))
                .and_then(|n| xml_attr(n, "val"))
                .and_then(|s| s.parse::<usize>().ok())
                .unwrap_or(1)
                .clamp(1, 256);
            format!("<td colspan=\"{span}\">{}</td>", children())
        }
        // Only document content is traversed; properties, field instructions,
        // drawings, deleted text and embedded binary data are never text runs.
        "document" | "body" | "sdt" | "sdtContent" | "ins" | "smartTag" => children(),
        _ => String::new(),
    }
}

pub(crate) fn decode_docx_base64_payload(input: &str) -> Result<Vec<u8>, String> {
    let payload = input.strip_prefix("DOCX_BASE64:").ok_or_else(|| {
        "Choose or drop a Word (.docx) file to convert it to Markdown.".to_string()
    })?;
    base64::engine::general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| format!("invalid base64 docx payload: {e}"))
}

pub(crate) fn convert_word_to_markdown(input: &str) -> Result<String, String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(decode_docx_base64_payload(input)?))
        .map_err(|e| format!("failed to read DOCX archive: {e}"))?;
    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .map_err(|e| format!("DOCX missing word/document.xml: {e}"))?
        .read_to_string(&mut xml)
        .map_err(|e| format!("failed to read DOCX XML: {e}"))?;
    let document =
        roxmltree::Document::parse(&xml).map_err(|e| format!("invalid DOCX document XML: {e}"))?;
    let mut links = HashMap::new();
    if let Ok(mut file) = archive.by_name("word/_rels/document.xml.rels") {
        let mut xml = String::new();
        file.read_to_string(&mut xml)
            .map_err(|e| format!("failed to read DOCX relationships: {e}"))?;
        let relationships = roxmltree::Document::parse(&xml)
            .map_err(|e| format!("invalid DOCX relationships XML: {e}"))?;
        for node in relationships
            .descendants()
            .filter(|n| n.has_tag_name("Relationship"))
        {
            if let (Some(id), Some(target)) = (node.attribute("Id"), node.attribute("Target")) {
                links.insert(id.to_string(), target.to_string());
            }
        }
    }
    convert_html_to_markdown(&word_html(document.root_element(), &links))
}
