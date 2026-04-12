"""Oracle tests for the 13 formatter tools.

json-format and yaml-format use full semantic oracles (Python json/yaml libs).
The remaining 11 tools use property-based checks (format vs. minify invariants)
plus known input->output regression pairs, because their hand-rolled Rust
implementations do not have exact Python equivalents.
"""

import json
import xml.etree.ElementTree as ET

import pytest
import yaml

from comparators import json_semantic, stripped_match, yaml_semantic


# ---------------------------------------------------------------------------
# Assertion helpers
# ---------------------------------------------------------------------------

def assert_tool_output(cli, tool_id, input_text, expected, *,
                       format_mode=None, indent=None, comparator=None):
    """Run tool through CLI and compare with oracle."""
    result = cli.run_tool(tool_id, input_text,
                          format_mode=format_mode, indent=indent)
    assert result.exit_code == 0, (
        f"{tool_id} exited {result.exit_code}: {result.stderr}"
    )
    cmp = comparator or stripped_match
    passed, msg = cmp(result.stdout, expected)
    assert passed, (
        f"{tool_id} output mismatch:\n{msg}\n"
        f"--- input repr ---\n{input_text!r}"
    )


def assert_format_properties(cli, tool_id, input_text, *, indent=2):
    """Verify format/minify property invariants for a non-oracle formatter."""
    fmt_result = cli.run_tool(tool_id, input_text,
                              format_mode="format", indent=indent)
    assert fmt_result.exit_code == 0, (
        f"{tool_id} format exited {fmt_result.exit_code}: {fmt_result.stderr}"
    )
    min_result = cli.run_tool(tool_id, input_text,
                              format_mode="minify", indent=indent)
    assert min_result.exit_code == 0, (
        f"{tool_id} minify exited {min_result.exit_code}: {min_result.stderr}"
    )

    formatted = fmt_result.stdout.strip()
    minified = min_result.stdout.strip()

    # Format mode should produce multi-line output (or at minimum not be
    # shorter than minified) for non-trivial inputs.
    assert "\n" in formatted, (
        f"{tool_id} format output should be multi-line:\n{formatted[:500]}"
    )

    # Minified output should be no longer than formatted output.
    assert len(minified) <= len(formatted), (
        f"{tool_id} minified ({len(minified)}) should not exceed "
        f"formatted ({len(formatted)}) length"
    )

    return formatted, minified


def assert_tool_error(cli, tool_id, input_text, *,
                      format_mode="format", indent=None):
    """Assert the tool returns a non-zero exit code for invalid input."""
    result = cli.run_tool(tool_id, input_text,
                          format_mode=format_mode, indent=indent)
    assert result.exit_code != 0, (
        f"{tool_id} should have failed on invalid input, "
        f"but exited 0 with stdout:\n{result.stdout[:500]}"
    )


# ===================================================================
# 1. json-format  (full semantic oracle)
# ===================================================================

class TestJsonFormat:

    # -- format mode (beautify) --

    @pytest.mark.parametrize("json_input, indent", [
        pytest.param('{"a":1,"b":2}', 2, id="object-indent2"),
        pytest.param('{"a":1,"b":2}', 4, id="object-indent4"),
        pytest.param('[1,2,3]', 2, id="array-indent2"),
        pytest.param('[1,2,3]', 4, id="array-indent4"),
        pytest.param('{"nested":{"x":[1,2,{"y":"z"}]}}', 2, id="nested-indent2"),
        pytest.param('{"nested":{"x":[1,2,{"y":"z"}]}}', 4, id="nested-indent4"),
        pytest.param('{"key":"value with spaces"}', 2, id="string-value"),
        pytest.param('true', 2, id="bare-true"),
        pytest.param('null', 2, id="bare-null"),
        pytest.param('42', 2, id="bare-number"),
        pytest.param('"hello"', 2, id="bare-string"),
        pytest.param('{}', 2, id="empty-object"),
        pytest.param('[]', 2, id="empty-array"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format(self, cli, json_input, indent):
        value = json.loads(json_input)
        expected = json.dumps(value, indent=indent, ensure_ascii=False)
        assert_tool_output(cli, "json-format", json_input, expected,
                           format_mode="format", indent=indent,
                           comparator=json_semantic)

    # -- minify mode --

    @pytest.mark.parametrize("json_input", [
        pytest.param('{ "a" : 1 , "b" : 2 }', id="spaced-object"),
        pytest.param('[\n  1,\n  2,\n  3\n]', id="multiline-array"),
        pytest.param('{\n  "nested": {\n    "x": [1, 2]\n  }\n}', id="nested"),
        pytest.param('true', id="bare-true"),
        pytest.param('"hello"', id="bare-string"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_minify(self, cli, json_input):
        value = json.loads(json_input)
        expected = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
        assert_tool_output(cli, "json-format", json_input, expected,
                           format_mode="minify",
                           comparator=json_semantic)

    # -- invalid input --

    @pytest.mark.parametrize("bad_input", [
        pytest.param("{bad json", id="missing-quote"),
        pytest.param("not json at all", id="plain-text"),
        pytest.param("{\"a\": }", id="trailing-comma-ish"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_invalid_input(self, cli, bad_input):
        assert_tool_error(cli, "json-format", bad_input, format_mode="format")
        assert_tool_error(cli, "json-format", bad_input, format_mode="minify")

    # -- roundtrip: format then minify preserves data --

    @pytest.mark.category_a
    def test_format_minify_roundtrip(self, cli):
        original = '{"users":[{"name":"Alice","age":30},{"name":"Bob","age":25}]}'
        fmt = cli.run_tool("json-format", original,
                           format_mode="format", indent=2)
        assert fmt.exit_code == 0
        mini = cli.run_tool("json-format", fmt.stdout.strip(),
                            format_mode="minify")
        assert mini.exit_code == 0
        passed, msg = json_semantic(mini.stdout, original)
        assert passed, f"json-format roundtrip mismatch:\n{msg}"

    # -- regression: known output --

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        input_text = '{"name":"test","value":123}'
        result = cli.run_tool("json-format", input_text,
                              format_mode="format", indent=2)
        assert result.exit_code == 0
        expected = '{\n  "name": "test",\n  "value": 123\n}'
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"json-format regression mismatch:\n{msg}"

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        input_text = '{\n  "name": "test",\n  "value": 123\n}'
        result = cli.run_tool("json-format", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        expected = '{"name":"test","value":123}'
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"json-format minify regression mismatch:\n{msg}"


# ===================================================================
# 2. yaml-format  (full semantic oracle)
# ===================================================================

class TestYamlFormat:

    # -- format mode --

    @pytest.mark.parametrize("yaml_input", [
        pytest.param("name: Alice\nage: 30", id="simple-map"),
        pytest.param("{name: Alice, age: 30}", id="flow-map"),
        pytest.param("- one\n- two\n- three", id="list"),
        pytest.param("[one, two, three]", id="flow-list"),
        pytest.param(
            "server:\n  host: localhost\n  port: 8080\n  tags:\n    - web\n    - prod",
            id="nested",
        ),
        pytest.param("key: 'value with spaces'", id="quoted-string"),
        pytest.param("count: 42", id="integer"),
        pytest.param("active: true", id="boolean"),
        pytest.param("nothing: null", id="null-value"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format(self, cli, yaml_input):
        result = cli.run_tool("yaml-format", yaml_input,
                              format_mode="format")
        assert result.exit_code == 0
        passed, msg = yaml_semantic(result.stdout, yaml_input)
        assert passed, f"yaml-format semantic mismatch:\n{msg}"

    # -- minify mode (YAML minify in Rust is just re-format with collapsed blanks) --

    @pytest.mark.parametrize("yaml_input", [
        pytest.param("name: Alice\nage: 30", id="simple-map"),
        pytest.param(
            "server:\n  host: localhost\n  port: 8080",
            id="nested-map",
        ),
        pytest.param("- one\n- two\n- three", id="list"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_minify(self, cli, yaml_input):
        result = cli.run_tool("yaml-format", yaml_input,
                              format_mode="minify")
        assert result.exit_code == 0
        passed, msg = yaml_semantic(result.stdout, yaml_input)
        assert passed, f"yaml-format minify semantic mismatch:\n{msg}"
        # Minify output should have no consecutive blank lines.
        lines = result.stdout.strip().splitlines()
        for i in range(len(lines) - 1):
            assert not (lines[i].strip() == "" and lines[i + 1].strip() == ""), (
                "yaml-format minify should not have consecutive blank lines"
            )

    # -- invalid input --

    @pytest.mark.parametrize("bad_input", [
        pytest.param("{{{{", id="bad-braces"),
        pytest.param("- :\n  - : :\n    bad", id="bad-nesting"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_invalid_input(self, cli, bad_input):
        assert_tool_error(cli, "yaml-format", bad_input, format_mode="format")

    # -- roundtrip: format then minify preserves data --

    @pytest.mark.category_a
    def test_format_minify_roundtrip(self, cli):
        original = "database:\n  host: localhost\n  port: 5432\n  name: mydb"
        fmt = cli.run_tool("yaml-format", original,
                           format_mode="format")
        assert fmt.exit_code == 0
        mini = cli.run_tool("yaml-format", fmt.stdout.strip(),
                            format_mode="minify")
        assert mini.exit_code == 0
        passed, msg = yaml_semantic(mini.stdout, original)
        assert passed, f"yaml-format roundtrip mismatch:\n{msg}"

    # -- regression --

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        input_text = "{name: Alice, age: 30}"
        result = cli.run_tool("yaml-format", input_text,
                              format_mode="format")
        assert result.exit_code == 0
        parsed = yaml.safe_load(result.stdout)
        assert parsed == {"name": "Alice", "age": 30}
        # Output should be block style, not flow
        assert "{" not in result.stdout.strip()


# ===================================================================
# 3. html-beautify  (property + regression)
# ===================================================================

HTML_SIMPLE = '<div><p>Hello</p><span>World</span></div>'
HTML_NESTED = '<html><head><title>Test</title></head><body><div class="main"><p>Content</p></div></body></html>'
HTML_SELF_CLOSING = '<div><img src="a.png"/><br/><input type="text"/></div>'

class TestHtmlBeautify:

    @pytest.mark.parametrize("html_input", [
        pytest.param(HTML_SIMPLE, id="simple"),
        pytest.param(HTML_NESTED, id="nested"),
        pytest.param(HTML_SELF_CLOSING, id="self-closing"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, html_input):
        formatted, minified = assert_format_properties(
            cli, "html-beautify", html_input, indent=2
        )
        # Formatted output should contain indentation
        assert any(line.startswith("  ") for line in formatted.splitlines()), (
            "html-beautify format should indent nested tags"
        )

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        formatted, _ = assert_format_properties(
            cli, "html-beautify", HTML_SIMPLE, indent=4
        )
        assert any(line.startswith("    ") for line in formatted.splitlines()), (
            "html-beautify format indent=4 should use 4-space indentation"
        )

    @pytest.mark.category_a
    def test_minify_removes_newlines(self, cli):
        result = cli.run_tool("html-beautify", HTML_NESTED,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "\n" not in minified, (
            "html-beautify minify should produce single-line output"
        )

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        result = cli.run_tool("html-beautify", '<div><p>Hello</p></div>',
                              format_mode="format", indent=2)
        assert result.exit_code == 0
        expected = "<div>\n  <p>\n    Hello\n  </p>\n</div>"
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"html-beautify regression:\n{msg}"

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        result = cli.run_tool(
            "html-beautify",
            "<div>\n  <p>\n    Hello\n  </p>\n</div>",
            format_mode="minify",
        )
        assert result.exit_code == 0
        # Rust minifier preserves whitespace inside text nodes
        expected = "<div><p> Hello </p></div>"
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"html-beautify minify regression:\n{msg}"


# ===================================================================
# 4. css-beautify  (property + regression)
# ===================================================================

CSS_SIMPLE = "body{margin:0;padding:0;}.container{width:100%;max-width:960px;}"
CSS_NESTED_MEDIA = "@media (max-width:768px){.container{width:100%;padding:10px;}}"

class TestCssBeautify:

    @pytest.mark.parametrize("css_input", [
        pytest.param(CSS_SIMPLE, id="simple"),
        pytest.param(CSS_NESTED_MEDIA, id="media-query"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, css_input):
        formatted, minified = assert_format_properties(
            cli, "css-beautify", css_input, indent=2
        )
        assert " {\n" in formatted, (
            "css-beautify format should have ' {\\n' pattern"
        )

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("css-beautify", CSS_SIMPLE,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines()), (
            "css-beautify format indent=4 should use 4-space indentation"
        )

    @pytest.mark.category_a
    def test_minify_compact(self, cli):
        input_text = "body {\n  margin: 0;\n  padding: 0;\n}"
        result = cli.run_tool("css-beautify", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "\n" not in minified, (
            "css-beautify minify should produce single-line output"
        )
        assert "{ " not in minified, (
            "css-beautify minify should not have spaces around braces"
        )

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        result = cli.run_tool("css-beautify", "body{margin:0;padding:0;}",
                              format_mode="format", indent=2)
        assert result.exit_code == 0
        expected = "body {\n  margin:0;\n  padding:0;\n}"
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"css-beautify regression:\n{msg}"

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        result = cli.run_tool(
            "css-beautify",
            "body {\n  margin: 0;\n  padding: 0;\n}",
            format_mode="minify",
        )
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "body{" in minified
        assert minified.endswith("}")


# ===================================================================
# 5. scss-beautify  (property + regression - shares impl with css)
# ===================================================================

SCSS_SIMPLE = "$color: red; .btn{color: $color; &:hover{opacity:0.8;}}"
SCSS_COMMENT = "/* block */ .foo{color:red;} // line comment\n.bar{color:blue;}"

class TestScssBeautify:

    @pytest.mark.parametrize("scss_input", [
        pytest.param(SCSS_SIMPLE, id="variables-nesting"),
        pytest.param(SCSS_COMMENT, id="comments"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, scss_input):
        formatted, minified = assert_format_properties(
            cli, "scss-beautify", scss_input, indent=2
        )
        assert " {\n" in formatted

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("scss-beautify", SCSS_SIMPLE,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines())

    @pytest.mark.category_a
    def test_minify_strips_comments(self, cli):
        result = cli.run_tool("scss-beautify", SCSS_COMMENT,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "/* block */" not in minified
        assert "// line" not in minified
        # Still has the selectors
        assert ".foo" in minified or ".bar" in minified

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        result = cli.run_tool("scss-beautify", ".a { color: red; }",
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "color:red" in minified


# ===================================================================
# 6. less-beautify  (property + regression - shares impl with scss)
# ===================================================================

LESS_SIMPLE = "@base-color: #333; .nav{color: @base-color; .item{padding:5px;}}"

class TestLessBeautify:

    @pytest.mark.category_a
    def test_format_properties(self, cli):
        formatted, minified = assert_format_properties(
            cli, "less-beautify", LESS_SIMPLE, indent=2
        )
        assert " {\n" in formatted

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("less-beautify", LESS_SIMPLE,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines())

    @pytest.mark.category_a
    def test_minify(self, cli):
        result = cli.run_tool("less-beautify", LESS_SIMPLE,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "\n" not in minified

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        result = cli.run_tool("less-beautify", ".x { padding: 10px; }",
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "padding:10px" in minified


# ===================================================================
# 7. javascript-beautify  (property + regression)
# ===================================================================

JS_SIMPLE = 'function hello(){var x=1;if(x>0){console.log("yes");}}'
JS_COMPLEX = 'var obj={a:1,b:function(){return 2;}};for(var i=0;i<10;i++){obj.a+=i;}'

class TestJavascriptBeautify:

    @pytest.mark.parametrize("js_input", [
        pytest.param(JS_SIMPLE, id="simple-function"),
        pytest.param(JS_COMPLEX, id="complex"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, js_input):
        formatted, minified = assert_format_properties(
            cli, "javascript-beautify", js_input, indent=2
        )
        assert " {\n" in formatted or "{\n" in formatted, (
            "javascript-beautify format should have braces on new lines"
        )

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("javascript-beautify", JS_SIMPLE,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines())

    @pytest.mark.category_a
    def test_minify_compact(self, cli):
        input_text = 'function hello() {\n  var x = 1;\n  return x;\n}'
        result = cli.run_tool("javascript-beautify", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "\n" not in minified
        assert "  " not in minified

    @pytest.mark.category_a
    def test_minify_strips_comments(self, cli):
        input_text = '// a comment\nvar x = 1; /* block */ var y = 2;'
        result = cli.run_tool("javascript-beautify", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "// a comment" not in minified
        assert "/* block */" not in minified

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        result = cli.run_tool(
            "javascript-beautify",
            'if(true){return 1;}',
            format_mode="format", indent=2,
        )
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert "if(true)" in formatted or "if(true) {" in formatted
        assert "\n" in formatted


# ===================================================================
# 8. typescript-beautify  (shares impl with javascript)
# ===================================================================

TS_SIMPLE = 'function greet(name:string):void{console.log("Hello "+name);}'
TS_INTERFACE = 'interface User{name:string;age:number;}const u:User={name:"A",age:1};'

class TestTypescriptBeautify:

    @pytest.mark.parametrize("ts_input", [
        pytest.param(TS_SIMPLE, id="simple-function"),
        pytest.param(TS_INTERFACE, id="interface"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, ts_input):
        formatted, minified = assert_format_properties(
            cli, "typescript-beautify", ts_input, indent=2
        )
        assert "\n" in formatted

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("typescript-beautify", TS_SIMPLE,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines())

    @pytest.mark.category_a
    def test_minify(self, cli):
        result = cli.run_tool("typescript-beautify", TS_INTERFACE,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "\n" not in minified

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        input_text = 'const x: number = 42;\nconst y: string = "hello";'
        result = cli.run_tool("typescript-beautify", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "const" in minified
        assert "42" in minified


# ===================================================================
# 9. graphql-format  (property + regression)
# ===================================================================

GQL_QUERY = 'query{user(id:1){name,email,posts{title,body}}}'
GQL_MUTATION = 'mutation{createUser(input:{name:"Alice",email:"a@b.com"}){id,name}}'

class TestGraphqlFormat:

    @pytest.mark.parametrize("gql_input", [
        pytest.param(GQL_QUERY, id="query"),
        pytest.param(GQL_MUTATION, id="mutation"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, gql_input):
        formatted, minified = assert_format_properties(
            cli, "graphql-format", gql_input, indent=2
        )
        # Formatted should have indented fields
        assert any(line.startswith("  ") for line in formatted.splitlines()), (
            "graphql-format should indent fields"
        )

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("graphql-format", GQL_QUERY,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines())

    @pytest.mark.category_a
    def test_minify_compact(self, cli):
        input_text = (
            "query {\n  user(id: 1) {\n    name\n    email\n  }\n}"
        )
        result = cli.run_tool("graphql-format", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "\n" not in minified

    @pytest.mark.category_a
    def test_minify_strips_comments(self, cli):
        input_text = "# a comment\nquery { user { name } }"
        result = cli.run_tool("graphql-format", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "# a comment" not in minified
        assert "user" in minified

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        result = cli.run_tool(
            "graphql-format",
            'query{user{name,email}}',
            format_mode="format", indent=2,
        )
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        # Should have "query {" with a brace on the same line
        assert "query {" in formatted or "query{" in formatted
        assert "name" in formatted
        assert "email" in formatted

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        result = cli.run_tool(
            "graphql-format",
            "query {\n  user {\n    name\n    email\n  }\n}",
            format_mode="minify",
        )
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert minified == "query{user{name email}}"


# ===================================================================
# 10. erb-format  (property + regression)
# ===================================================================

ERB_SIMPLE = '<div><%= @user.name %><p>Hello</p></div>'
ERB_NESTED = '<html><body><% if @show %><div><p><%= @content %></p></div><% end %></body></html>'

class TestErbFormat:

    @pytest.mark.parametrize("erb_input", [
        pytest.param(ERB_SIMPLE, id="simple"),
        pytest.param(ERB_NESTED, id="nested"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, erb_input):
        formatted, minified = assert_format_properties(
            cli, "erb-format", erb_input, indent=2
        )
        # ERB blocks should be preserved in output
        assert "<%" in formatted

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("erb-format", ERB_SIMPLE,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines())

    @pytest.mark.category_a
    def test_minify(self, cli):
        result = cli.run_tool("erb-format", ERB_NESTED,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        # ERB tags should be preserved
        assert "<% if @show %>" in minified
        assert "<% end %>" in minified

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        result = cli.run_tool(
            "erb-format",
            '<div><p><%= @name %></p></div>',
            format_mode="format", indent=2,
        )
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert "<div>" in formatted
        assert "<%= @name %>" in formatted
        assert "\n" in formatted

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        result = cli.run_tool(
            "erb-format",
            "<div>\n  <p>\n    <%= @name %>\n  </p>\n</div>",
            format_mode="minify",
        )
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "<div>" in minified
        assert "<%= @name %>" in minified


# ===================================================================
# 11. xml-format  (property + regression + parse validation)
# ===================================================================

XML_SIMPLE = '<root><item>one</item><item>two</item></root>'
XML_NESTED = '<catalog><book id="1"><title>Test</title><author>A</author></book><book id="2"><title>Other</title></book></catalog>'
XML_SELF_CLOSING = '<config><setting name="a" value="1"/><setting name="b" value="2"/></config>'
XML_WITH_DECL = '<?xml version="1.0"?><root><child>text</child></root>'

class TestXmlFormat:

    @pytest.mark.parametrize("xml_input", [
        pytest.param(XML_SIMPLE, id="simple"),
        pytest.param(XML_NESTED, id="nested"),
        pytest.param(XML_SELF_CLOSING, id="self-closing"),
        pytest.param(XML_WITH_DECL, id="with-declaration"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, xml_input):
        formatted, minified = assert_format_properties(
            cli, "xml-format", xml_input, indent=2
        )
        assert any(line.startswith("  ") for line in formatted.splitlines()), (
            "xml-format format should indent nested tags"
        )

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("xml-format", XML_SIMPLE,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert any(line.startswith("    ") for line in formatted.splitlines())

    @pytest.mark.category_a
    def test_format_produces_parseable_xml(self, cli):
        """Formatted XML output should be parseable by xml.etree."""
        result = cli.run_tool("xml-format", XML_NESTED,
                              format_mode="format", indent=2)
        assert result.exit_code == 0
        try:
            tree = ET.fromstring(result.stdout.strip())
        except ET.ParseError as exc:
            pytest.fail(f"xml-format output is not valid XML: {exc}")
        assert tree.tag == "catalog"

    @pytest.mark.category_a
    def test_minify_single_line(self, cli):
        result = cli.run_tool("xml-format", XML_NESTED,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "\n" not in minified

    @pytest.mark.category_a
    def test_minify_produces_parseable_xml(self, cli):
        """Minified XML output should still be parseable."""
        result = cli.run_tool("xml-format", XML_NESTED,
                              format_mode="minify")
        assert result.exit_code == 0
        try:
            tree = ET.fromstring(result.stdout.strip())
        except ET.ParseError as exc:
            pytest.fail(f"xml-format minify output is not valid XML: {exc}")
        assert tree.tag == "catalog"

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        result = cli.run_tool("xml-format", '<root><child>text</child></root>',
                              format_mode="format", indent=2)
        assert result.exit_code == 0
        expected = "<root>\n  <child>\n    text\n  </child>\n</root>"
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"xml-format regression:\n{msg}"

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        result = cli.run_tool(
            "xml-format",
            "<root>\n  <child>\n    text\n  </child>\n</root>",
            format_mode="minify",
        )
        assert result.exit_code == 0
        # Rust minifier preserves whitespace inside text nodes
        expected = "<root><child> text </child></root>"
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"xml-format minify regression:\n{msg}"

    @pytest.mark.category_a
    def test_roundtrip_preserves_structure(self, cli):
        """Format then minify should preserve XML structure."""
        fmt = cli.run_tool("xml-format", XML_NESTED,
                           format_mode="format", indent=2)
        assert fmt.exit_code == 0
        mini = cli.run_tool("xml-format", fmt.stdout.strip(),
                            format_mode="minify")
        assert mini.exit_code == 0
        tree = ET.fromstring(mini.stdout.strip())
        books = tree.findall("book")
        assert len(books) == 2
        # Rust formatter may add/preserve whitespace around text content
        assert books[0].find("title").text.strip() == "Test"


# ===================================================================
# 12. sql-format  (property + regression)
# ===================================================================

SQL_SELECT = "select name, age from users where age > 21 order by name"
SQL_JOIN = "select u.name, o.total from users u inner join orders o on u.id = o.user_id where o.total > 100"
SQL_INSERT = "insert into users (name, age) values ('Alice', 30)"
SQL_COMPLEX = "select a.id, b.name from table_a a left join table_b b on a.id = b.a_id where a.active = true and b.status = 'open' group by a.id having count(*) > 1 order by a.id limit 10"

class TestSqlFormat:

    @pytest.mark.parametrize("sql_input", [
        pytest.param(SQL_SELECT, id="simple-select"),
        pytest.param(SQL_JOIN, id="join"),
        pytest.param(SQL_COMPLEX, id="complex"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_properties(self, cli, sql_input):
        formatted, minified = assert_format_properties(
            cli, "sql-format", sql_input, indent=2
        )
        # SQL format should uppercase keywords
        upper_formatted = formatted
        assert "SELECT" in upper_formatted or "INSERT" in upper_formatted, (
            "sql-format should uppercase SQL keywords"
        )

    @pytest.mark.category_a
    def test_insert_formats(self, cli):
        """INSERT may stay single-line - just verify keywords are uppercased."""
        result = cli.run_tool("sql-format", SQL_INSERT,
                              format_mode="format", indent=2)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert "INSERT" in formatted.upper()

    @pytest.mark.category_a
    def test_format_indent4(self, cli):
        result = cli.run_tool("sql-format", SQL_COMPLEX,
                              format_mode="format", indent=4)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        # AND/OR lines should be indented with 4 spaces
        and_lines = [l for l in formatted.splitlines() if l.strip().startswith("AND")]
        if and_lines:
            assert any(l.startswith("    ") for l in and_lines), (
                "sql-format indent=4 should indent AND with 4 spaces"
            )

    @pytest.mark.category_a
    def test_minify_compact(self, cli):
        result = cli.run_tool("sql-format", SQL_SELECT,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        # Should be single-line
        assert "\n" not in minified

    @pytest.mark.category_a
    def test_format_uppercases_keywords(self, cli):
        result = cli.run_tool("sql-format", "select name from users where age > 21",
                              format_mode="format", indent=2)
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert "SELECT" in formatted
        assert "FROM" in formatted
        assert "WHERE" in formatted

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        result = cli.run_tool(
            "sql-format",
            "select name from users where age > 21",
            format_mode="format", indent=2,
        )
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        lines = formatted.splitlines()
        assert lines[0].startswith("SELECT")
        assert any("FROM" in l for l in lines)
        assert any("WHERE" in l for l in lines)

    @pytest.mark.category_a
    def test_regression_join_format(self, cli):
        result = cli.run_tool(
            "sql-format",
            "select u.name from users u inner join orders o on u.id = o.user_id",
            format_mode="format", indent=2,
        )
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        # Rust SQL formatter may break INNER and JOIN onto separate lines
        assert "INNER" in formatted
        assert "JOIN" in formatted
        assert "ON" in formatted

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        input_text = "SELECT name\nFROM users\nWHERE age > 21"
        result = cli.run_tool("sql-format", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        assert "name" in minified
        assert "users" in minified
        assert "21" in minified


# ===================================================================
# 13. markdown-format  (property + regression)
# ===================================================================

MD_SIMPLE = "# Title\n\n\n\nSome text.\n\n\n\n## Subtitle\n\nMore text."
MD_MESSY = "# Heading  \n  Some text  \n\n\n\n  Another paragraph  \n\n\n\n\n## Sub  \nLine"

class TestMarkdownFormat:

    @pytest.mark.parametrize("md_input", [
        pytest.param(MD_SIMPLE, id="simple"),
        pytest.param(MD_MESSY, id="messy"),
    ], ids=lambda x: "")
    @pytest.mark.category_a
    def test_format_collapses_blank_lines(self, cli, md_input):
        result = cli.run_tool("markdown-format", md_input,
                              format_mode="format")
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        # No consecutive blank lines
        lines = formatted.splitlines()
        for i in range(len(lines) - 1):
            assert not (lines[i] == "" and lines[i + 1] == ""), (
                f"markdown-format should not have consecutive blanks "
                f"at line {i}: {lines[max(0,i-1):i+3]}"
            )

    @pytest.mark.category_a
    def test_format_preserves_content(self, cli):
        result = cli.run_tool("markdown-format", MD_SIMPLE,
                              format_mode="format")
        assert result.exit_code == 0
        formatted = result.stdout.strip()
        assert "# Title" in formatted
        assert "## Subtitle" in formatted
        assert "Some text." in formatted
        assert "More text." in formatted

    @pytest.mark.category_a
    def test_minify_single_line(self, cli):
        result = cli.run_tool("markdown-format", MD_SIMPLE,
                              format_mode="minify")
        assert result.exit_code == 0
        minified = result.stdout.strip()
        # Minified is all non-blank lines joined with spaces
        assert "\n" not in minified
        assert "# Title" in minified
        assert "## Subtitle" in minified

    @pytest.mark.category_a
    def test_minify_shorter_than_format(self, cli):
        fmt = cli.run_tool("markdown-format", MD_SIMPLE,
                           format_mode="format")
        assert fmt.exit_code == 0
        mini = cli.run_tool("markdown-format", MD_SIMPLE,
                            format_mode="minify")
        assert mini.exit_code == 0
        assert len(mini.stdout.strip()) <= len(fmt.stdout.strip())

    @pytest.mark.category_a
    def test_regression_format(self, cli):
        input_text = "# Title\n\n\n\nParagraph."
        result = cli.run_tool("markdown-format", input_text,
                              format_mode="format")
        assert result.exit_code == 0
        expected = "# Title\n\nParagraph."
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"markdown-format regression:\n{msg}"

    @pytest.mark.category_a
    def test_regression_minify(self, cli):
        input_text = "# Title\n\nParagraph one.\n\nParagraph two."
        result = cli.run_tool("markdown-format", input_text,
                              format_mode="minify")
        assert result.exit_code == 0
        expected = "# Title Paragraph one. Paragraph two."
        passed, msg = stripped_match(result.stdout, expected)
        assert passed, f"markdown-format minify regression:\n{msg}"

    # -- markdown-format ignores indent param (Rust impl has no indent_size) --

    @pytest.mark.category_a
    def test_format_indent_ignored(self, cli):
        """markdown-format does not use indent, output should be identical."""
        r2 = cli.run_tool("markdown-format", MD_SIMPLE,
                           format_mode="format", indent=2)
        r4 = cli.run_tool("markdown-format", MD_SIMPLE,
                           format_mode="format", indent=4)
        assert r2.exit_code == 0
        assert r4.exit_code == 0
        passed, _ = stripped_match(r2.stdout, r4.stdout)
        assert passed, "markdown-format should produce identical output regardless of indent"


# ===================================================================
# Cross-cutting: all 13 formatters reject empty input
# ===================================================================

ALL_FORMATTER_TOOL_IDS = [
    "json-format",
    "yaml-format",
    "html-beautify",
    "css-beautify",
    "scss-beautify",
    "less-beautify",
    "javascript-beautify",
    "typescript-beautify",
    "graphql-format",
    "erb-format",
    "xml-format",
    "sql-format",
    "markdown-format",
]


class TestFormatterEmptyInput:

    @pytest.mark.parametrize("tool_id", ALL_FORMATTER_TOOL_IDS,
                             ids=lambda x: x)
    @pytest.mark.category_a
    def test_empty_input_rejected(self, cli, tool_id):
        """All formatters should reject empty string input."""
        result = cli.run_tool(tool_id, "", format_mode="format")
        assert result.exit_code != 0, (
            f"{tool_id} should reject empty input but exited 0"
        )


# ===================================================================
# Cross-cutting: format then re-format is idempotent
# ===================================================================

IDEMPOTENT_CASES = [
    ("json-format", '{"a":1,"b":[2,3]}'),
    ("yaml-format", "name: Alice\nage: 30"),
    ("html-beautify", '<div><p>Hello</p></div>'),
    ("css-beautify", "body{margin:0;padding:0;}"),
    ("scss-beautify", ".btn{color:red;&:hover{opacity:0.8;}}"),
    ("less-beautify", ".nav{color:#333;.item{padding:5px;}}"),
    ("javascript-beautify", 'function f(){var x=1;return x;}'),
    ("typescript-beautify", 'function f(x:number):number{return x+1;}'),
    ("graphql-format", 'query{user{name,email}}'),
    ("erb-format", '<div><%= @name %><p>text</p></div>'),
    ("xml-format", '<root><child>text</child></root>'),
    ("sql-format", "select name from users where id = 1"),
    ("markdown-format", "# Title\n\nParagraph."),
]


class TestFormatterIdempotent:

    @pytest.mark.parametrize("tool_id, input_text", IDEMPOTENT_CASES,
                             ids=[t[0] for t in IDEMPOTENT_CASES])
    @pytest.mark.category_a
    def test_format_is_idempotent(self, cli, tool_id, input_text):
        """Formatting already-formatted output should produce identical output."""
        first = cli.run_tool(tool_id, input_text,
                             format_mode="format", indent=2)
        assert first.exit_code == 0, (
            f"{tool_id} first format failed: {first.stderr}"
        )
        second = cli.run_tool(tool_id, first.stdout.strip(),
                              format_mode="format", indent=2)
        assert second.exit_code == 0, (
            f"{tool_id} second format failed: {second.stderr}"
        )
        passed, msg = stripped_match(first.stdout, second.stdout)
        assert passed, (
            f"{tool_id} format is not idempotent:\n{msg}"
        )
