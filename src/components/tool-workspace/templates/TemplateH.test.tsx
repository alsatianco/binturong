import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateH } from "./TemplateH";
import type { TemplateHProps } from "./TemplateH";

function renderTemplate(overrides: Partial<TemplateHProps> = {}) {
  const props: TemplateHProps = {
    input: "",
    onInputChange: vi.fn(),
    output: "",
    outputState: "idle",
    outputError: "",
    onRun: vi.fn(),
    onCopy: vi.fn(),
    onClear: vi.fn(),
    onDownload: vi.fn(),
    formatMode: "format",
    indentSize: 2,
    buttons: [{ label: "Extract Text", primary: true }],
    outputIsText: true,
    ...overrides,
  };

  function Harness() {
    const slots = TemplateH(props);
    return (
      <div>
        {slots.inputArea}
        {slots.actionButtons}
        {slots.outputArea}
      </div>
    );
  }

  return render(<Harness />);
}

describe("TemplateH OCR output rendering", () => {
  it("renders OCR JSON output with metadata and extracted text", () => {
    const output = JSON.stringify({
      language: "eng",
      downloadedLanguages: ["vie"],
      text: "Hello OCR",
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("Language: eng")).toBeInTheDocument();
    expect(screen.getByText("Downloaded: vie")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hello OCR")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });
});


describe("TemplateH file inputs", () => {
  it.each(["picker", "drop"])("encodes a DOCX from the %s as a document, not an image", async (source) => {
    const onInputChange = vi.fn();
    renderTemplate({ acceptedFiles: ".docx", onInputChange });
    const file = new File(["docx bytes"], "notes.DOCX", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    if (source === "picker") fireEvent.change(screen.getByLabelText("Input file"), { target: { files: [file] } });
    else fireEvent.drop(screen.getByRole("button", { name: "Choose input file" }), { dataTransfer: { files: [file] } });
    await waitFor(() => expect(onInputChange).toHaveBeenCalledWith(`DOCX_BASE64:${btoa("docx bytes")}`));
  });

  it.each([["png", "image/png"], ["tiff", "image/tiff"], ["bmp", "image/bmp"]])("keeps %s image encoding for OCR", async (extension, mime) => {
    const onInputChange = vi.fn();
    renderTemplate({ acceptedFiles: `.${extension}`, ocrLanguageSelect: true, onInputChange });
    fireEvent.change(screen.getByLabelText("Input file"), { target: { files: [new File(["png"], `scan.${extension}`, { type: mime })] } });
    await waitFor(() => expect(onInputChange).toHaveBeenCalled());
    expect(JSON.parse(onInputChange.mock.calls[0][0])).toEqual({ image: `IMAGE_BASE64:${mime};base64,cG5n`, language: "eng", downloadMissingLanguage: true });
  });

  it("reports unsupported files without changing input", async () => {
    const onInputChange = vi.fn();
    renderTemplate({ acceptedFiles: ".docx", onInputChange });
    fireEvent.change(screen.getByLabelText("Input file"), { target: { files: [new File(["x"], "old.doc")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a supported file: .docx");
    expect(onInputChange).not.toHaveBeenCalled();
  });
});


it("applies OCR settings to native desktop file drops", () => {
  const onRun = vi.fn();
  renderTemplate({ input: "IMAGE_BASE64:image/png;base64,cG5n", ocrLanguageSelect: true, onRun });
  fireEvent.click(screen.getByRole("button", { name: "Extract Text" }));
  expect(JSON.parse(onRun.mock.calls[0][0].inputOverride)).toEqual({ image: "IMAGE_BASE64:image/png;base64,cG5n", language: "eng", downloadMissingLanguage: true });
});
