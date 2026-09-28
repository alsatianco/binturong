import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateB } from "./TemplateB";
import type { TemplateProps } from "./types";

function renderTemplate(overrides: Partial<TemplateProps> = {}) {
  const props: TemplateProps = {
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
    buttons: [
      { label: "Generate", mode: "format", primary: true },
      { label: "Decode", mode: "minify" },
    ],
    directionLabels: ["Generate", "Decode"],
    placeholder: "Paste UUID or ULID",
    onPaste: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const slots = TemplateB(props);
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

describe("TemplateB UUID/ULID output rendering", () => {
  it("renders UUID decode JSON as key-value rows", () => {
    const output = JSON.stringify({
      type: "uuid",
      value: "550e8400-e29b-41d4-a716-446655440000",
      version: 4,
      variant: "RFC4122",
      simple: "550e8400e29b41d4a716446655440000",
      bytesHex: "550E8400E29B41D4A716446655440000",
    });

    renderTemplate({ outputState: "success", output });

    expect(screen.getByText("type")).toBeInTheDocument();
    expect(screen.getByText("uuid")).toBeInTheDocument();
    expect(screen.getByText("bytesHex")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(output)).not.toBeInTheDocument();
  });
});

describe("TemplateB QR code", () => {
  it("renders a generated QR code as an image with an SVG download", () => {
    const svg = '<?xml version="1.0" standalone="yes"?><svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>';
    renderTemplate({ toolId: "qr-code", input: "hello", output: svg, outputState: "success" });

    const image = screen.getByRole("img", { name: "Generated QR code" });
    expect(image).toHaveAttribute("src", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    expect(screen.queryByDisplayValue(svg)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download QR image" })).toBeInTheDocument();
  });

  it("offers image upload and reads an uploaded QR image", () => {
    const onFileDrop = vi.fn();
    const onRun = vi.fn();
    const { container } = renderTemplate({
      toolId: "qr-code",
      input: "IMAGE_BASE64:image/png;base64,aGVsbG8=",
      onFileDrop,
      onRun,
    });

    expect(screen.getByRole("img", { name: "QR image to read" })).toHaveAttribute("src", "data:image/png;base64,aGVsbG8=");
    fireEvent.click(screen.getByRole("button", { name: "Read QR code" }));
    expect(onRun).toHaveBeenCalledWith({ mode: "minify" });

    const picker = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "code.png", { type: "image/png" });
    fireEvent.change(picker, { target: { files: [file] } });
    expect(onFileDrop).toHaveBeenCalledWith(file);
  });
});

describe("TemplateB encrypted text", () => {
  it("clears both text and passphrase from its local fields", () => {
    const onClear = vi.fn();
    renderTemplate({
      toolId: "aes-encrypt",
      onClear,
      extras: [{ key: "key", label: "Passphrase", type: "text", jsonWrap: true }],
      directionLabels: ["Encrypt", "Decrypt"],
    });

    const text = screen.getByPlaceholderText("Paste UUID or ULID");
    const passphrase = screen.getByLabelText("Passphrase");
    expect(passphrase).toHaveAttribute("type", "password");
    fireEvent.change(text, { target: { value: "private text" } });
    fireEvent.change(passphrase, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(text).toHaveValue("");
    expect(passphrase).toHaveValue("");
    expect(onClear).toHaveBeenCalledOnce();
  });
});
