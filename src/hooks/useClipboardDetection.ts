import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// ── Types re-declared locally so the hook is self-contained ────────────

type ClipboardDetectionMatch = {
  toolId: string;
  toolName: string;
  confidence: number;
  reason: string;
};

type ClipboardDetectionResult = {
  sourceLength: number;
  topMatches: ClipboardDetectionMatch[];
};

type CommandScope = "detect" | "all" | "tools" | "actions";

// ── Hook params ────────────────────────────────────────────────────────

export type UseClipboardDetectionParams = {
  commandQuery: string;
  commandScope: CommandScope;
  setSelectedCommandIndex: Dispatch<SetStateAction<number>>;
};

// ── Hook return ────────────────────────────────────────────────────────

export type UseClipboardDetectionReturn = {
  detectMatches: ClipboardDetectionMatch[];
  isDetectingInPalette: boolean;
  setDetectMatches: Dispatch<SetStateAction<ClipboardDetectionMatch[]>>;
};

// ── Hook ───────────────────────────────────────────────────────────────

export function useClipboardDetection({
  commandQuery,
  commandScope,
  setSelectedCommandIndex,
}: UseClipboardDetectionParams): UseClipboardDetectionReturn {
  const [detectMatches, setDetectMatches] = useState<ClipboardDetectionMatch[]>([]);
  const [isDetectingInPalette, setIsDetectingInPalette] = useState(false);

  useEffect(() => {
    if (commandScope !== "detect") {
      return;
    }

    const trimmed = commandQuery.trim();
    if (!trimmed) {
      setDetectMatches([]);
      setIsDetectingInPalette(false);
      return;
    }

    setIsDetectingInPalette(true);
    const timeoutId = window.setTimeout(() => {
      invoke<ClipboardDetectionResult>("detect_clipboard_content", {
        content: trimmed,
      })
        .then((result) => {
          setDetectMatches(result.topMatches.slice(0, 3));
          setSelectedCommandIndex(0);
        })
        .catch(() => setDetectMatches([]))
        .finally(() => setIsDetectingInPalette(false));
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [commandQuery, commandScope, setSelectedCommandIndex]);

  return { detectMatches, isDetectingInPalette, setDetectMatches };
}
