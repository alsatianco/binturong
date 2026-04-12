import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ToolOption = {
  id: string;
  name: string;
};

type PipelineToolSelectorProps = {
  tools: ToolOption[];
  selectedToolId: string;
  onSelect: (toolId: string) => void;
  highlightMatch?: (label: string, query: string) => ReactNode;
};

export function PipelineToolSelector({
  tools,
  selectedToolId,
  onSelect,
  highlightMatch,
}: PipelineToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId),
    [tools, selectedToolId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return tools;
    }
    return tools.filter((tool) => tool.name.toLowerCase().includes(q));
  }, [tools, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered]);

  const openSelector = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const closeSelector = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const selectTool = useCallback(
    (toolId: string) => {
      onSelect(toolId);
      closeSelector();
    },
    [onSelect, closeSelector],
  );

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeSelector();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeSelector]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((current) => Math.min(current + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const tool = filtered[highlightedIndex];
        if (tool) {
          selectTool(tool.id);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeSelector();
      }
    },
    [filtered, highlightedIndex, selectTool, closeSelector],
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) {
      return;
    }
    const items = dropdownRef.current.querySelectorAll("[data-pipeline-tool-item]");
    const target = items[highlightedIndex];
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openSelector}
        className="group flex max-w-lg items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-left text-xs text-slate-200 transition hover:border-cyan-500/50"
      >
        <span className="flex-1 truncate">{selectedTool?.name ?? "Select tool..."}</span>
        <span className="shrink-0 text-[10px] text-slate-500 group-hover:text-cyan-400">
          Change
        </span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative max-w-lg w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search tools..."
        className="w-full rounded-t border border-cyan-500/60 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-500"
      />
      <div
        ref={dropdownRef}
        className="absolute left-0 right-0 z-10 max-h-56 overflow-y-auto rounded-b border border-t-0 border-cyan-500/60 bg-slate-900 shadow-xl shadow-slate-950/60"
      >
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-500">No tools match your query.</p>
        )}
        {filtered.map((tool, index) => (
          <button
            key={tool.id}
            type="button"
            data-pipeline-tool-item
            onClick={() => selectTool(tool.id)}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={`w-full px-3 py-1.5 text-left text-xs ${
              highlightedIndex === index
                ? "bg-cyan-500/20 text-cyan-100"
                : tool.id === selectedToolId
                  ? "bg-slate-800 text-slate-200"
                  : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {highlightMatch ? highlightMatch(tool.name, query) : tool.name}
          </button>
        ))}
      </div>
    </div>
  );
}
