"""Oracle tests for image converter tools.

Image converters accept base64-encoded image data (as data URIs) and return
base64-encoded converted images.  Since image conversion is inherently lossy
we cannot do exact byte comparison.  Instead we validate:

  1. Output is a valid data URI with the correct MIME type.
  2. The base64 payload decodes successfully.
  3. The decoded bytes form a valid image in the expected format.
  4. The image has reasonable (non-zero) dimensions.
"""

import base64
import io
import json

import pytest
from PIL import Image


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_test_image(fmt: str, *, size: tuple[int, int] = (4, 4),
                    color: tuple[int, ...] = (255, 0, 0)) -> str:
    """Create a tiny test image and return it as a data-URI string.

    *fmt* must be a Pillow format name: ``"PNG"``, ``"JPEG"``, or ``"WEBP"``.
    """
    # JPEG does not support alpha; use RGB.  PNG/WebP can use RGBA.
    mode = "RGB" if fmt == "JPEG" else "RGBA"
    img = Image.new(mode, size, color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    mime = {
        "PNG": "image/png",
        "JPEG": "image/jpeg",
        "WEBP": "image/webp",
    }[fmt]
    return f"data:{mime};base64,{b64}"


SIMPLE_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">'
    '<rect width="8" height="8" fill="red"/>'
    "</svg>"
)


def validate_image_output(
    output: str,
    expected_mime: str,
    expected_format: str,
) -> None:
    """Assert that *output* is a valid data-URI image in the expected format."""
    prefix = f"data:{expected_mime};base64,"
    assert output.startswith(prefix), (
        f"Expected data URI prefix '{prefix}', got: {output[:60]}..."
    )
    b64_data = output.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_data)
    img = Image.open(io.BytesIO(img_bytes))
    assert img.format == expected_format, (
        f"Expected image format {expected_format}, got {img.format}"
    )
    assert img.width > 0 and img.height > 0, (
        f"Image has invalid dimensions: {img.width}x{img.height}"
    )


def run_image_tool(cli, tool_id: str, input_data: str, *,
                   timeout: float = 30.0) -> str:
    """Run an image converter tool and return the stripped stdout.

    Asserts exit code 0 and returns the output string.
    """
    result = cli.run_tool(tool_id, input_data, timeout=timeout)
    assert result.exit_code == 0, (
        f"{tool_id} exited {result.exit_code}: {result.stderr}"
    )
    return result.stdout.strip()


# ---------------------------------------------------------------------------
# 1. jpg-to-png-converter
# ---------------------------------------------------------------------------

class TestJpgToPng:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_basic_conversion(self, cli):
        jpeg_uri = make_test_image("JPEG")
        output = run_image_tool(cli, "jpg-to-png-converter", jpeg_uri)
        validate_image_output(output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_dimensions_preserved(self, cli):
        """Converted PNG should keep the same dimensions as the source JPEG."""
        jpeg_uri = make_test_image("JPEG", size=(16, 12))
        output = run_image_tool(cli, "jpg-to-png-converter", jpeg_uri)
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (16, 12)

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_larger_image(self, cli):
        """Ensure a slightly larger image converts without error."""
        jpeg_uri = make_test_image("JPEG", size=(64, 64), color=(0, 128, 255))
        output = run_image_tool(cli, "jpg-to-png-converter", jpeg_uri)
        validate_image_output(output, "image/png", "PNG")


# ---------------------------------------------------------------------------
# 2. png-to-jpg-converter
# ---------------------------------------------------------------------------

class TestPngToJpg:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_basic_conversion(self, cli):
        png_uri = make_test_image("PNG")
        output = run_image_tool(cli, "png-to-jpg-converter", png_uri)
        validate_image_output(output, "image/jpeg", "JPEG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_dimensions_preserved(self, cli):
        png_uri = make_test_image("PNG", size=(20, 10))
        output = run_image_tool(cli, "png-to-jpg-converter", png_uri)
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (20, 10)

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_rgba_flattened(self, cli):
        """PNG with alpha should produce a valid JPEG (no alpha channel)."""
        png_uri = make_test_image("PNG", color=(0, 255, 0, 128))
        output = run_image_tool(cli, "png-to-jpg-converter", png_uri)
        validate_image_output(output, "image/jpeg", "JPEG")
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert img.mode in ("RGB", "L"), f"JPEG should not have alpha, got mode {img.mode}"


# ---------------------------------------------------------------------------
# 3. jpg-to-webp-converter
# ---------------------------------------------------------------------------

class TestJpgToWebp:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_basic_conversion(self, cli):
        jpeg_uri = make_test_image("JPEG")
        output = run_image_tool(cli, "jpg-to-webp-converter", jpeg_uri)
        validate_image_output(output, "image/webp", "WEBP")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_dimensions_preserved(self, cli):
        jpeg_uri = make_test_image("JPEG", size=(24, 32))
        output = run_image_tool(cli, "jpg-to-webp-converter", jpeg_uri)
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (24, 32)


# ---------------------------------------------------------------------------
# 4. webp-to-jpg-converter
# ---------------------------------------------------------------------------

class TestWebpToJpg:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_basic_conversion(self, cli):
        webp_uri = make_test_image("WEBP")
        output = run_image_tool(cli, "webp-to-jpg-converter", webp_uri)
        validate_image_output(output, "image/jpeg", "JPEG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_dimensions_preserved(self, cli):
        webp_uri = make_test_image("WEBP", size=(10, 30))
        output = run_image_tool(cli, "webp-to-jpg-converter", webp_uri)
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (10, 30)


# ---------------------------------------------------------------------------
# 5. png-to-webp-converter
# ---------------------------------------------------------------------------

class TestPngToWebp:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_basic_conversion(self, cli):
        png_uri = make_test_image("PNG")
        output = run_image_tool(cli, "png-to-webp-converter", png_uri)
        validate_image_output(output, "image/webp", "WEBP")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_dimensions_preserved(self, cli):
        png_uri = make_test_image("PNG", size=(8, 16))
        output = run_image_tool(cli, "png-to-webp-converter", png_uri)
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (8, 16)


# ---------------------------------------------------------------------------
# 6. webp-to-png-converter
# ---------------------------------------------------------------------------

class TestWebpToPng:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_basic_conversion(self, cli):
        webp_uri = make_test_image("WEBP")
        output = run_image_tool(cli, "webp-to-png-converter", webp_uri)
        validate_image_output(output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_dimensions_preserved(self, cli):
        webp_uri = make_test_image("WEBP", size=(12, 6))
        output = run_image_tool(cli, "webp-to-png-converter", webp_uri)
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (12, 6)


# ---------------------------------------------------------------------------
# 7. svg-to-png-converter
# ---------------------------------------------------------------------------

class TestSvgToPng:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_basic_svg_text(self, cli):
        """Plain SVG markup (not base64) should be accepted."""
        output = run_image_tool(cli, "svg-to-png-converter", SIMPLE_SVG)
        validate_image_output(output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_svg_dimensions(self, cli):
        """Output should default to the SVG's intrinsic dimensions."""
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="15">'
            '<rect width="20" height="15" fill="blue"/>'
            "</svg>"
        )
        output = run_image_tool(cli, "svg-to-png-converter", svg)
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (20, 15)

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_svg_json_with_custom_size(self, cli):
        """JSON envelope with explicit width/height should resize the output."""
        payload = json.dumps({
            "svg": SIMPLE_SVG,
            "width": 32,
            "height": 32,
        })
        output = run_image_tool(cli, "svg-to-png-converter", payload)
        validate_image_output(output, "image/png", "PNG")
        b64_data = output.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (32, 32)

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_svg_with_viewbox(self, cli):
        """SVG using viewBox instead of width/height attributes."""
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">'
            '<circle cx="25" cy="25" r="20" fill="green"/>'
            "</svg>"
        )
        output = run_image_tool(cli, "svg-to-png-converter", svg)
        validate_image_output(output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_svg_base64_input(self, cli):
        """SVG provided as a data URI should also work."""
        svg_b64 = base64.b64encode(SIMPLE_SVG.encode()).decode("ascii")
        data_uri = f"data:image/svg+xml;base64,{svg_b64}"
        output = run_image_tool(cli, "svg-to-png-converter", data_uri)
        validate_image_output(output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_svg_image_base64_prefix(self, cli):
        """SVG provided with the IMAGE_BASE64: prefix format."""
        svg_b64 = base64.b64encode(SIMPLE_SVG.encode()).decode("ascii")
        payload = f"IMAGE_BASE64:image/svg+xml;base64,{svg_b64}"
        output = run_image_tool(cli, "svg-to-png-converter", payload)
        validate_image_output(output, "image/png", "PNG")


# ---------------------------------------------------------------------------
# 8. Cross-format roundtrips
# ---------------------------------------------------------------------------

class TestImageRoundtrips:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_png_to_jpg_to_png(self, cli):
        """PNG -> JPEG -> PNG should produce a valid PNG."""
        png_uri = make_test_image("PNG", size=(8, 8))
        jpeg_output = run_image_tool(cli, "png-to-jpg-converter", png_uri)
        validate_image_output(jpeg_output, "image/jpeg", "JPEG")
        png_output = run_image_tool(cli, "jpg-to-png-converter", jpeg_output)
        validate_image_output(png_output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_jpg_to_webp_to_jpg(self, cli):
        """JPEG -> WebP -> JPEG should produce a valid JPEG."""
        jpeg_uri = make_test_image("JPEG", size=(8, 8))
        webp_output = run_image_tool(cli, "jpg-to-webp-converter", jpeg_uri)
        validate_image_output(webp_output, "image/webp", "WEBP")
        jpeg_output = run_image_tool(cli, "webp-to-jpg-converter", webp_output)
        validate_image_output(jpeg_output, "image/jpeg", "JPEG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_png_to_webp_to_png(self, cli):
        """PNG -> WebP -> PNG should produce a valid PNG."""
        png_uri = make_test_image("PNG", size=(8, 8))
        webp_output = run_image_tool(cli, "png-to-webp-converter", png_uri)
        validate_image_output(webp_output, "image/webp", "WEBP")
        png_output = run_image_tool(cli, "webp-to-png-converter", webp_output)
        validate_image_output(png_output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_roundtrip_preserves_dimensions(self, cli):
        """Dimensions must be preserved across a full roundtrip."""
        w, h = 13, 17
        png_uri = make_test_image("PNG", size=(w, h))

        jpeg_output = run_image_tool(cli, "png-to-jpg-converter", png_uri)
        webp_output = run_image_tool(cli, "jpg-to-webp-converter", jpeg_output)
        final_png = run_image_tool(cli, "webp-to-png-converter", webp_output)

        b64_data = final_png.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        assert (img.width, img.height) == (w, h)


# ---------------------------------------------------------------------------
# 9. Input format variations
# ---------------------------------------------------------------------------

class TestInputFormats:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_image_base64_prefix(self, cli):
        """IMAGE_BASE64: prefix format should be accepted."""
        img = Image.new("RGB", (4, 4), (255, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        payload = f"IMAGE_BASE64:image/jpeg;base64,{b64}"
        output = run_image_tool(cli, "jpg-to-png-converter", payload)
        validate_image_output(output, "image/png", "PNG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_raw_base64_without_prefix(self, cli):
        """Plain base64 (no data URI, no IMAGE_BASE64 prefix) should work."""
        img = Image.new("RGB", (4, 4), (0, 0, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        output = run_image_tool(cli, "png-to-jpg-converter", b64)
        validate_image_output(output, "image/jpeg", "JPEG")

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_data_uri_format(self, cli):
        """Standard data URI format should be accepted."""
        png_uri = make_test_image("PNG")
        assert png_uri.startswith("data:image/png;base64,")
        output = run_image_tool(cli, "png-to-webp-converter", png_uri)
        validate_image_output(output, "image/webp", "WEBP")


# ---------------------------------------------------------------------------
# 10. Error handling
# ---------------------------------------------------------------------------

class TestImageErrors:

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_invalid_base64(self, cli):
        """Completely invalid base64 should cause a non-zero exit."""
        result = cli.run_tool("jpg-to-png-converter", "not-valid-base64!!!")
        assert result.exit_code != 0

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_empty_input(self, cli):
        """Empty input should cause a non-zero exit."""
        result = cli.run_tool("png-to-jpg-converter", "")
        assert result.exit_code != 0

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_corrupt_data_uri(self, cli):
        """A data URI with corrupt base64 payload should fail."""
        result = cli.run_tool(
            "webp-to-png-converter",
            "data:image/webp;base64,AAAA_NOT_REAL_IMAGE",
        )
        assert result.exit_code != 0

    @pytest.mark.category_c
    @pytest.mark.slow
    def test_svg_converter_rejects_non_svg(self, cli):
        """svg-to-png should reject non-SVG text input."""
        result = cli.run_tool("svg-to-png-converter", "just some plain text")
        assert result.exit_code != 0
