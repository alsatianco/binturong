import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

// ── Types re-declared locally so the hook is self-contained ────────────

type FormatMode = "format" | "minify";
type CaseConverterMode =
  | "sentence"
  | "lower"
  | "upper"
  | "capitalized"
  | "alternating"
  | "title"
  | "inverse"
  | "camel"
  | "snake"
  | "kebab"
  | "pascal"
  | "constant"
  | "dot"
  | "path";
type BatchDelimiterMode = "newline" | "tab" | "comma" | "custom";
type BatchItemResult = {
  index: number;
  input: string;
  output: string;
  error: string;
};

import { type ToolOutputState } from "../components/tool-shell/ToolShell";

export type TabWorkspaceState = {
  name: string;
  greetMsg: string;
  notes: string;
  formatMode: FormatMode;
  caseConverterMode: CaseConverterMode;
  indentSize: number;
  batchModeEnabled: boolean;
  batchDelimiterMode: BatchDelimiterMode;
  batchCustomDelimiter: string;
  batchResults: BatchItemResult[];
  outputState: ToolOutputState;
  outputError: string;
};

export type WorkspaceTab = {
  id: string;
  toolId: string;
  title: string;
};

type TabContextMenuState = {
  tabId: string;
  x: number;
  y: number;
};

type ToolDefinition = {
  id: string;
  name: string;
  aliases?: string[];
  keywords?: string[];
  supportsBatch?: boolean;
  chainAccepts?: string[];
  chainProduces?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────

function createDefaultTabWorkspaceState(): TabWorkspaceState {
  return {
    name: "",
    greetMsg: "",
    notes: "",
    formatMode: "format",
    caseConverterMode: "sentence",
    indentSize: 2,
    batchModeEnabled: false,
    batchDelimiterMode: "newline",
    batchCustomDelimiter: "",
    batchResults: [],
    outputState: "idle",
    outputError: "",
  };
}

// ── Hook params ────────────────────────────────────────────────────────

export type UseTabManagerParams = {
  defaultToolId: string;
  sidebarCatalog: ToolDefinition[];
  getSampleInput: (toolId: string) => string;
};

// ── Hook return ────────────────────────────────────────────────────────

export type UseTabManagerReturn = {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  tabContextMenu: TabContextMenuState | null;
  setTabContextMenu: React.Dispatch<React.SetStateAction<TabContextMenuState | null>>;
  draggingTabId: string | null;
  setDraggingTabId: React.Dispatch<React.SetStateAction<string | null>>;
  canScrollTabsLeft: boolean;
  setCanScrollTabsLeft: React.Dispatch<React.SetStateAction<boolean>>;
  canScrollTabsRight: boolean;
  setCanScrollTabsRight: React.Dispatch<React.SetStateAction<boolean>>;
  tabWorkspaceById: Record<string, TabWorkspaceState>;
  setTabWorkspaceById: React.Dispatch<React.SetStateAction<Record<string, TabWorkspaceState>>>;
  tabCounterRef: MutableRefObject<number>;
  tabScrollerRef: RefObject<HTMLDivElement | null>;
  tabContextMenuRef: RefObject<HTMLDivElement | null>;
  activeTab: WorkspaceTab;
  activeTabWorkspace: TabWorkspaceState;
  addTab: (toolId?: string) => string;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  reorderTabs: (fromTabId: string, toTabId: string) => void;
  moveActiveTabByOffset: (offset: number) => void;
  updateTabScrollState: () => void;
  scrollTabsBy: (distance: number) => void;
};

// ── Hook ───────────────────────────────────────────────────────────────

export function useTabManager({
  defaultToolId,
  sidebarCatalog,
  getSampleInput,
}: UseTabManagerParams): UseTabManagerReturn {
  // Map for fast tool name lookups
  const toolById = useMemo(
    () => new Map(sidebarCatalog.map((tool) => [tool.id, tool])),
    [sidebarCatalog],
  );

  function getToolName(toolId: string): string {
    return toolById.get(toolId)?.name ?? toolId;
  }

  function createTab(tabId: string, toolId: string): WorkspaceTab {
    return {
      id: tabId,
      toolId,
      title: getToolName(toolId),
    };
  }

  function createSampleTabWorkspaceState(toolId: string): TabWorkspaceState {
    return {
      ...createDefaultTabWorkspaceState(),
      name: getSampleInput(toolId),
    };
  }

  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: "tab-1", toolId: defaultToolId, title: getToolName(defaultToolId) },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuState | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);
  const [tabWorkspaceById, setTabWorkspaceById] = useState<Record<string, TabWorkspaceState>>({
    "tab-1": createSampleTabWorkspaceState(defaultToolId),
  });

  const tabCounterRef = useRef(2);
  const tabScrollerRef = useRef<HTMLDivElement>(null);
  const tabContextMenuRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  );

  const activeTabWorkspace =
    (activeTab ? tabWorkspaceById[activeTab.id] : undefined) ??
    createDefaultTabWorkspaceState();

  const addTab = useCallback((toolId: string = defaultToolId) => {
    const nextTabId = `tab-${tabCounterRef.current}`;
    tabCounterRef.current += 1;

    const nextTab = createTab(nextTabId, toolId);
    setTabs((current) => [...current, nextTab]);
    setTabWorkspaceById((current) => ({
      ...current,
      [nextTabId]: createSampleTabWorkspaceState(toolId),
    }));
    setActiveTabId(nextTabId);
    return nextTabId;
  }, [defaultToolId, toolById]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((currentTabs) => {
      if (currentTabs.length <= 1) {
        return currentTabs;
      }

      const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex === -1) {
        return currentTabs;
      }

      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
      setActiveTabId((currentActiveTabId) => {
        if (currentActiveTabId !== tabId) {
          return currentActiveTabId;
        }

        const replacementIndex = Math.max(0, closingIndex - 1);
        return nextTabs[replacementIndex].id;
      });

      return nextTabs;
    });

    setTabWorkspaceById((current) => {
      const next = { ...current };
      delete next[tabId];
      return next;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    const nextTabId = `tab-${tabCounterRef.current}`;
    tabCounterRef.current += 1;

    setTabs([createTab(nextTabId, defaultToolId)]);
    setTabWorkspaceById({
      [nextTabId]: createSampleTabWorkspaceState(defaultToolId),
    });
    setActiveTabId(nextTabId);
  }, [defaultToolId, toolById]);

  const closeTabsToLeft = useCallback((tabId: string) => {
    setTabs((currentTabs) => {
      const tabIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex <= 0) {
        return currentTabs;
      }

      const removedTabIds = currentTabs.slice(0, tabIndex).map((tab) => tab.id);
      const nextTabs = currentTabs.slice(tabIndex);

      setActiveTabId((currentActiveTabId) =>
        nextTabs.some((tab) => tab.id === currentActiveTabId) ? currentActiveTabId : tabId,
      );
      setTabWorkspaceById((current) => {
        const next = { ...current };
        for (const removedTabId of removedTabIds) {
          delete next[removedTabId];
        }
        return next;
      });

      return nextTabs;
    });
  }, []);

  const closeTabsToRight = useCallback((tabId: string) => {
    setTabs((currentTabs) => {
      const tabIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1 || tabIndex >= currentTabs.length - 1) {
        return currentTabs;
      }

      const removedTabIds = currentTabs.slice(tabIndex + 1).map((tab) => tab.id);
      const nextTabs = currentTabs.slice(0, tabIndex + 1);

      setActiveTabId((currentActiveTabId) =>
        nextTabs.some((tab) => tab.id === currentActiveTabId) ? currentActiveTabId : tabId,
      );
      setTabWorkspaceById((current) => {
        const next = { ...current };
        for (const removedTabId of removedTabIds) {
          delete next[removedTabId];
        }
        return next;
      });

      return nextTabs;
    });
  }, []);

  const reorderTabs = useCallback((fromTabId: string, toTabId: string) => {
    if (fromTabId === toTabId) {
      return;
    }

    setTabs((currentTabs) => {
      const fromIndex = currentTabs.findIndex((tab) => tab.id === fromTabId);
      const toIndex = currentTabs.findIndex((tab) => tab.id === toTabId);

      if (fromIndex === -1 || toIndex === -1) {
        return currentTabs;
      }

      const nextTabs = [...currentTabs];
      const [movedTab] = nextTabs.splice(fromIndex, 1);
      nextTabs.splice(toIndex, 0, movedTab);
      return nextTabs;
    });
  }, []);

  const moveActiveTabByOffset = useCallback(
    (offset: number) => {
      if (tabs.length < 2) {
        return;
      }

      const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
      if (currentIndex === -1) {
        return;
      }

      const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
      setActiveTabId(tabs[nextIndex].id);
    },
    [activeTabId, tabs],
  );

  const updateTabScrollState = useCallback(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) {
      return;
    }

    setCanScrollTabsLeft(scroller.scrollLeft > 2);
    setCanScrollTabsRight(
      scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2,
    );
  }, []);

  const scrollTabsBy = useCallback((distance: number) => {
    tabScrollerRef.current?.scrollBy({ left: distance, behavior: "smooth" });
  }, []);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    tabContextMenu,
    setTabContextMenu,
    draggingTabId,
    setDraggingTabId,
    canScrollTabsLeft,
    setCanScrollTabsLeft,
    canScrollTabsRight,
    setCanScrollTabsRight,
    tabWorkspaceById,
    setTabWorkspaceById,
    tabCounterRef,
    tabScrollerRef,
    tabContextMenuRef,
    activeTab,
    activeTabWorkspace,
    addTab,
    closeTab,
    closeAllTabs,
    closeTabsToLeft,
    closeTabsToRight,
    reorderTabs,
    moveActiveTabByOffset,
    updateTabScrollState,
    scrollTabsBy,
  };
}
