import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useClipboardDetection } from "./useClipboardDetection";

// ── Types re-declared locally so the hook is self-contained ────────────

type CommandScope = "detect" | "all" | "tools" | "actions";

type ClipboardDetectionMatch = {
  toolId: string;
  toolName: string;
  confidence: number;
  reason: string;
};

export type CommandPaletteItem = {
  id: string;
  label: string;
  subtitle: string;
  scope: Exclude<CommandScope, "all">;
  onSelect: () => void;
};

type ToolDefinition = {
  id: string;
  name: string;
};

const COMMAND_SCOPES: CommandScope[] = [
  "detect",
  "all",
  "tools",
  "actions",
];

// ── Hook params ────────────────────────────────────────────────────────

export type UseCommandPaletteParams = {
  sidebarCatalog: ToolDefinition[];

  /** Callbacks used to build the command palette action items. */
  addTab: () => string;
  closeTab: (tabId: string) => void;
  activeTabId: string;
  openToolInNewTab: (toolId: string) => string;

  clearActiveTool: () => void;
  clearHistory: (scope: "active" | "all") => void;
  checkForUpdates: (manual: boolean) => void;

  setShowStatusBar: Dispatch<SetStateAction<boolean>>;
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setIsWhatsNewOpen: Dispatch<SetStateAction<boolean>>;
  setWhatsNewNotes: Dispatch<SetStateAction<string>>;
  setIsPipelineBuilderOpen: Dispatch<SetStateAction<boolean>>;
  setIsQuickLauncherOpen: Dispatch<SetStateAction<boolean>>;

  currentAppVersion: string;
  whatsNewNotes: string;

  sidebarSearchInputRef: RefObject<HTMLInputElement | null>;

  /** Guard flags - when any modal is open, keyboard shortcuts are suppressed. */
  isSettingsOpen: boolean;
  isQuickLauncherOpen: boolean;
  isSendToOpen: boolean;
  isPipelineBuilderOpen: boolean;
};

// ── Hook return ────────────────────────────────────────────────────────

export type UseCommandPaletteReturn = {
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  commandScope: CommandScope;
  setCommandScope: Dispatch<SetStateAction<CommandScope>>;
  commandQuery: string;
  setCommandQuery: Dispatch<SetStateAction<string>>;
  selectedCommandIndex: number;
  setSelectedCommandIndex: Dispatch<SetStateAction<number>>;
  commandPaletteInputRef: RefObject<HTMLInputElement | null>;
  commandPaletteItems: CommandPaletteItem[];
  executeCommandPaletteSelection: () => void;
  detectMatches: ClipboardDetectionMatch[];
  isDetectingInPalette: boolean;
};

// ── Hook ───────────────────────────────────────────────────────────────

export function useCommandPalette({
  sidebarCatalog,
  addTab,
  closeTab,
  activeTabId,
  openToolInNewTab,
  clearActiveTool,
  clearHistory,
  checkForUpdates,
  setShowStatusBar,
  setIsSettingsOpen,
  setIsWhatsNewOpen,
  setWhatsNewNotes,
  setIsPipelineBuilderOpen,
  setIsQuickLauncherOpen,
  currentAppVersion,
  whatsNewNotes,
  sidebarSearchInputRef,
  isSettingsOpen,
  isQuickLauncherOpen,
  isSendToOpen,
  isPipelineBuilderOpen,
}: UseCommandPaletteParams): UseCommandPaletteReturn {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandScope, setCommandScope] = useState<CommandScope>("detect");
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);

  // ── Clipboard detection (composed hook) ──────────────────────────────

  const { detectMatches, isDetectingInPalette, setDetectMatches } = useClipboardDetection({
    commandQuery,
    commandScope,
    setSelectedCommandIndex,
  });

  // ── Actions memo ─────────────────────────────────────────────────────

  const commandPaletteActions = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "action-new-tab",
        label: "New Tab",
        subtitle: "Create a new tab",
        scope: "actions",
        onSelect: () => addTab(),
      },
      {
        id: "action-close-tab",
        label: "Close Active Tab",
        subtitle: "Close the currently active tab",
        scope: "actions",
        onSelect: () => closeTab(activeTabId),
      },
      {
        id: "action-toggle-status",
        label: "Toggle Status Bar",
        subtitle: "Show or hide footer status bar",
        scope: "actions",
        onSelect: () => setShowStatusBar((value) => !value),
      },
      {
        id: "action-focus-sidebar-search",
        label: "Focus Sidebar Search",
        subtitle: "Move focus to sidebar search input",
        scope: "actions",
        onSelect: () => sidebarSearchInputRef.current?.focus(),
      },
      {
        id: "action-clear-tool",
        label: "Clear Active Tool Input/Output",
        subtitle: "Reset current tool shell state",
        scope: "actions",
        onSelect: () => clearActiveTool(),
      },
      {
        id: "action-clear-active-history",
        label: "Clear Active Tool History",
        subtitle: "Delete history entries for current tool",
        scope: "actions",
        onSelect: () => clearHistory("active"),
      },
      {
        id: "action-clear-all-history",
        label: "Clear All Tool History",
        subtitle: "Delete history entries for every tool",
        scope: "actions",
        onSelect: () => clearHistory("all"),
      },
      {
        id: "action-open-settings",
        label: "Open Settings",
        subtitle: "Open settings window",
        scope: "actions",
        onSelect: () => setIsSettingsOpen(true),
      },
      {
        id: "action-check-updates",
        label: "Check for Updates",
        subtitle: "Run manual update check now",
        scope: "actions",
        onSelect: () => checkForUpdates(true),
      },
      {
        id: "action-open-whats-new",
        label: "Open What's New",
        subtitle: "Review current release notes",
        scope: "actions",
        onSelect: () => {
          if (!whatsNewNotes.trim()) {
            setWhatsNewNotes(
              currentAppVersion
                ? `Binturong ${currentAppVersion}\n\nNo additional release notes are available.`
                : "No release notes are available yet.",
            );
          }
          setIsWhatsNewOpen(true);
        },
      },
      {
        id: "action-open-pipeline-builder",
        label: "Open Pipeline Builder",
        subtitle: "Build and test multi-step tool chains",
        scope: "actions",
        onSelect: () => setIsPipelineBuilderOpen(true),
      },
      {
        id: "action-open-quick-launcher",
        label: "Open Quick Launcher",
        subtitle: "Open compact launcher",
        scope: "actions",
        onSelect: () => setIsQuickLauncherOpen(true),
      },
    ],
    [
      activeTabId,
      addTab,
      clearActiveTool,
      clearHistory,
      checkForUpdates,
      closeTab,
      currentAppVersion,
      whatsNewNotes,
      sidebarSearchInputRef,
      setShowStatusBar,
      setIsSettingsOpen,
      setIsWhatsNewOpen,
      setWhatsNewNotes,
      setIsPipelineBuilderOpen,
      setIsQuickLauncherOpen,
    ],
  );

  // ── Filtered items memo ──────────────────────────────────────────────

  const commandPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const toolCommands: CommandPaletteItem[] = sidebarCatalog.map((tool) => ({
      id: `tool-${tool.id}`,
      label: tool.name,
      subtitle: "Open tool in a new tab",
      scope: "tools",
      onSelect: () => openToolInNewTab(tool.id),
    }));

    const detectCommands: CommandPaletteItem[] = detectMatches.map((match) => ({
      id: `detect-${match.toolId}`,
      label: match.toolName,
      subtitle: `${match.confidence}% - ${match.reason}`,
      scope: "detect",
      onSelect: () => openToolInNewTab(match.toolId),
    }));

    const allCommands = [
      ...detectCommands,
      ...toolCommands,
      ...commandPaletteActions,
    ];
    const normalizedQuery = commandQuery.trim().toLowerCase();

    return allCommands.filter((command) => {
      if (commandScope !== "all" && command.scope !== commandScope) {
        return false;
      }

      if (commandScope === "detect") {
        return command.scope === "detect";
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        command.label.toLowerCase().includes(normalizedQuery) ||
        command.subtitle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [
    commandPaletteActions,
    commandQuery,
    commandScope,
    detectMatches,
    openToolInNewTab,
    sidebarCatalog,
  ]);

  // ── Clamp selected index when items change ───────────────────────────

  useEffect(() => {
    setSelectedCommandIndex((current) => {
      if (commandPaletteItems.length === 0) {
        return 0;
      }
      return Math.min(current, commandPaletteItems.length - 1);
    });
  }, [commandPaletteItems]);

  // ── Reset state on open ──────────────────────────────────────────────

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return;
    }

    setCommandScope("detect");
    setCommandQuery("");
    setDetectMatches([]);
    setSelectedCommandIndex(0);
    const timeoutId = window.setTimeout(() => {
      commandPaletteInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCommandPaletteOpen, setDetectMatches]);

  // ── Execute selection ────────────────────────────────────────────────

  const executeCommandPaletteSelection = useCallback(() => {
    const selectedCommand = commandPaletteItems[selectedCommandIndex];
    if (!selectedCommand) {
      return;
    }

    selectedCommand.onSelect();
    setIsCommandPaletteOpen(false);
  }, [commandPaletteItems, selectedCommandIndex]);

  // ── Keyboard handler ─────────────────────────────────────────────────

  useEffect(() => {
    const handleCommandPaletteHotkeys = (event: KeyboardEvent) => {
      if (
        isSettingsOpen ||
        isQuickLauncherOpen ||
        isSendToOpen ||
        isPipelineBuilderOpen
      ) {
        return;
      }

      const isMetaOrCtrl = event.metaKey || event.ctrlKey;
      const lowerKey = event.key.toLowerCase();
      if (isMetaOrCtrl && (lowerKey === "k" || lowerKey === "p")) {
        event.preventDefault();
        setIsCommandPaletteOpen((value) => !value);
        return;
      }

      if (!isCommandPaletteOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsCommandPaletteOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedCommandIndex((current) =>
          Math.min(current + 1, Math.max(0, commandPaletteItems.length - 1)),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedCommandIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        executeCommandPaletteSelection();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const currentScopeIndex = COMMAND_SCOPES.indexOf(commandScope);
        const nextScope = COMMAND_SCOPES[(currentScopeIndex + 1) % COMMAND_SCOPES.length];
        setCommandScope(nextScope);
        setSelectedCommandIndex(0);
      }
    };

    window.addEventListener("keydown", handleCommandPaletteHotkeys);
    return () => {
      window.removeEventListener("keydown", handleCommandPaletteHotkeys);
    };
  }, [
    commandPaletteItems.length,
    commandScope,
    executeCommandPaletteSelection,
    isCommandPaletteOpen,
    isPipelineBuilderOpen,
    isQuickLauncherOpen,
    isSendToOpen,
    isSettingsOpen,
  ]);

  return {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    commandScope,
    setCommandScope,
    commandQuery,
    setCommandQuery,
    selectedCommandIndex,
    setSelectedCommandIndex,
    commandPaletteInputRef,
    commandPaletteItems,
    executeCommandPaletteSelection,
    detectMatches,
    isDetectingInPalette,
  };
}
