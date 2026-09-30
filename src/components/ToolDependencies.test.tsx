import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissingDependencyDialog, ToolDependencies } from "./ToolDependencies";
import { DEPENDENCY_HELP_URL, type DependencyStatus } from "../lib/dependencies/dependencies";

const { invokeMock, openUrlMock } = vi.hoisted(() => ({ invokeMock: vi.fn(), openUrlMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock }));
const missing: DependencyStatus = {
  id: "tesseract", name: "Tesseract OCR", description: "Extracts text from images.", estimatedSize: "About 30–150 MB",
  path: "", configuredPath: "", available: false, detail: "Not found", installing: false, installError: null,
  installer: "Homebrew", configPath: "/app/tool-dependencies.json", languageDataPath: "/data/tessdata",
};

beforeEach(() => { invokeMock.mockReset(); openUrlMock.mockReset().mockResolvedValue(undefined); });

describe("tool dependencies", () => {
  it("starts installation only on request and restores background progress after reopening", async () => {
    let row = { ...missing };
    invokeMock.mockImplementation((command: string) => {
      if (command === "install_tool_dependency") { row = { ...row, installing: true }; return Promise.resolve(); }
      return Promise.resolve([row]);
    });
    const view = render(<ToolDependencies />);
    await screen.findByText("Not available");
    expect(invokeMock).not.toHaveBeenCalledWith("install_tool_dependency", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Download & configure" }));
    await screen.findByText("Installing…");
    expect(invokeMock).toHaveBeenCalledWith("install_tool_dependency", { id: "tesseract" });
    view.unmount();
    render(<ToolDependencies />);
    await screen.findByText("Installing…");
    expect(screen.getByRole("button", { name: "Installing in background…" })).toBeDisabled();
    row = { ...row, installing: false, available: true, path: "/opt/homebrew/bin/tesseract" };
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    await screen.findByText("Available");
    expect(screen.getByLabelText("Executable path")).toHaveValue(row.path);
  });

  it("validates custom paths and keeps the draft on failure", async () => {
    invokeMock.mockImplementation((command: string) => command === "configure_tool_dependency"
      ? Promise.reject("This executable does not identify itself as Tesseract.") : Promise.resolve([missing]));
    render(<ToolDependencies />);
    const input = await screen.findByLabelText("Executable path");
    fireEvent.change(input, { target: { value: "/bad/path" } });
    fireEvent.click(screen.getByRole("button", { name: "Save path" }));
    await screen.findByRole("alert");
    expect(input).toHaveValue("/bad/path");
    expect(invokeMock).toHaveBeenCalledWith("configure_tool_dependency", { id: "tesseract", path: "/bad/path" });
  });

  it("offers instructions when no package manager is available and shows install failures", async () => {
    invokeMock.mockResolvedValue([{ ...missing, installer: null, installError: "Download failed; retry." }]);
    render(<ToolDependencies />);
    expect(await screen.findByRole("button", { name: "Download & configure" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Download failed");
    fireEvent.click(screen.getByRole("button", { name: "Installation instructions" }));
    await waitFor(() => expect(openUrlMock).toHaveBeenCalledWith(DEPENDENCY_HELP_URL));
  });

  it("offers both recovery choices and closes on Escape", async () => {
    const onManage = vi.fn(), onClose = vi.fn();
    render(<MissingDependencyDialog onManage={onManage} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Not now" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Open Tool dependencies" }));
    expect(onManage).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Install manually" }));
    await waitFor(() => expect(openUrlMock).toHaveBeenCalledWith(DEPENDENCY_HELP_URL));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
