import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useAppDialog } from "./useAppDialog";

function Harness({ result }: { result: (value: unknown) => void }) {
  const { prompt, confirm, dialog } = useAppDialog();
  return <>
    <button onClick={async () => result(await prompt("Chain name", "Original"))}>Save chain</button>
    <button onClick={async () => result(await confirm("Delete chain?"))}>Delete chain</button>
    {dialog}
  </>;
}

describe("native app dialogs", () => {
  it("collects a chain name with keyboard focus and restores focus on submission", async () => {
    const user = userEvent.setup();
    const result = vi.fn();
    render(<Harness result={result} />);
    const trigger = screen.getByRole("button", { name: "Save chain" });
    await user.click(trigger);
    const input = screen.getByRole("textbox", { name: "Chain name" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "JSON to YAML{Enter}");
    await waitFor(() => expect(result).toHaveBeenCalledWith("JSON to YAML"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps keyboard focus inside the dialog and treats Escape as cancellation", async () => {
    const user = userEvent.setup();
    const result = vi.fn();
    render(<Harness result={result} />);
    await user.click(screen.getByRole("button", { name: "Save chain" }));
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(result).toHaveBeenCalledWith(null));
  });

  it("requires confirmation to delete and supports explicit cancellation", async () => {
    const result = vi.fn();
    render(<Harness result={result} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete chain" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(result).toHaveBeenCalledWith(false));
    fireEvent.click(screen.getByRole("button", { name: "Delete chain" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(result).toHaveBeenCalledWith(true));
  });
});
