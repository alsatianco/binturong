import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveFile } from "./saveFile";

const { isTauriMock, downloadDirMock, joinMock, saveMock, writeFileMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(),
  downloadDirMock: vi.fn(),
  joinMock: vi.fn(),
  saveMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: isTauriMock }));
vi.mock("@tauri-apps/api/path", () => ({ downloadDir: downloadDirMock, join: joinMock }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: writeFileMock }));

describe("saveFile in the desktop app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(true);
    downloadDirMock.mockResolvedValue("/Downloads");
    joinMock.mockResolvedValue("/Downloads/output.svg");
    writeFileMock.mockResolvedValue(undefined);
  });

  it("writes the selected file", async () => {
    saveMock.mockResolvedValue("/chosen/output.svg");
    const bytes = Uint8Array.from([1, 2, 3]);
    const blob = { arrayBuffer: async () => bytes.buffer } as Blob;

    expect(await saveFile(blob, "output.svg", "svg")).toBe(true);
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: "/Downloads/output.svg",
    }));
    expect(writeFileMock).toHaveBeenCalledWith("/chosen/output.svg", bytes);
  });

  it("does not write when the user cancels", async () => {
    saveMock.mockResolvedValue(null);

    expect(await saveFile(new Blob(["text"]), "output.txt", "txt")).toBe(false);
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("still opens the dialog if Downloads is unavailable", async () => {
    downloadDirMock.mockRejectedValue(new Error("No Downloads directory"));
    saveMock.mockResolvedValue(null);

    expect(await saveFile(new Blob(["text"]), "output.txt", "txt")).toBe(false);
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: "output.txt" }));
  });
});
