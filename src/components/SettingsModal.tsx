import { useEffect, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  THEME_OPTIONS,
  type ThemeVariant,
} from "../lib/theme/themeTokens";
import { LoadingState } from "./ui/LoadingState";

const FONT_SIZE_LABELS = ["Compact", "Small", "Default", "Large", "Extra Large"];

type SettingsCategory =
  | "general"
  | "appearance"
  | "search"
  | "workflow"
  | "updates"
  | "diagnostics"
  | "about";

const SETTINGS_CATEGORIES: Array<{
  id: SettingsCategory;
  label: string;
}> = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "search", label: "Search" },
  { id: "workflow", label: "Workflow" },
  { id: "updates", label: "Updates" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "about", label: "About" },
];

const ABOUT_APP_NAME = "Binturong";
const ABOUT_TAGLINE = "Offline-first desktop developer utility suite";
const ABOUT_WEBSITE = "https://play.alsatian.co/software/binturong.html";
const ABOUT_REPO_URL = "https://github.com/alsatianco/binturong";
const ABOUT_LICENSE = "MIT";
const ABOUT_AUTHOR = "Duc Nguyen";
const ABOUT_AUTHOR_URL = "https://github.com/scorta";
const ABOUT_COPYRIGHT_YEAR = "2026";

function formatUnixTime(unixSeconds: number): string {
  const parsed = new Date(unixSeconds * 1000);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown time";
  }
  return parsed.toLocaleString();
}

async function openExternalLink(event: MouseEvent<HTMLAnchorElement>, url: string) {
  event.preventDefault();
  try {
    await openUrl(url);
  } catch (error) {
    console.error(`failed to open external link: ${url}`, error);
  }
}

type LifecycleBootstrap = {
  coldStartMs: number;
  coldStartTargetMs: number;
  coldStartWithinTarget: boolean;
  recoveredAfterUncleanShutdown: boolean;
  runtimeStatePath: string;
  panicReportPath: string;
  previousPanicReportExists: boolean;
};

type DatabaseStatus = {
  dbPath: string;
  currentSchemaVersion: number;
  latestSchemaVersion: number;
  appliedMigrationsOnBoot: number[];
};

type StorageModelCounts = {
  settingsCount: number;
  favoritesCount: number;
  recentsCount: number;
  presetsCount: number;
  historyCount: number;
  chainsCount: number;
};

type UpdateCheckResult = {
  checkedAtUnix: number;
  channel: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes: string;
};

type UpdateChannel = "stable" | "beta";
type UpdateCheckInterval = "onLaunch" | "daily" | "weekly";

export type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;

  // General
  rememberLastInput: boolean;
  onRememberLastInputChange: (value: boolean) => void;

  // Appearance
  themeVariant: ThemeVariant;
  onThemeVariantChange: (value: ThemeVariant) => void;
  showStatusBar: boolean;
  onShowStatusBarChange: (value: boolean) => void;
  fontSizeLevel: number;
  onFontSizeLevelChange: (level: number) => void;

  // Search
  searchDebounceMs: number;
  onSearchDebounceMsChange: (value: number) => void;

  // Workflow
  openToolsInNewTab: boolean;
  onOpenToolsInNewTabChange: (value: boolean) => void;
  quickLauncherEnabled: boolean;
  onQuickLauncherEnabledChange: (value: boolean) => void;
  quickLauncherShortcut: string;
  onQuickLauncherShortcutChange: (value: string) => void;

  // Updates
  autoUpdateEnabled: boolean;
  onAutoUpdateEnabledChange: (value: boolean) => void;
  updateChannel: UpdateChannel;
  onUpdateChannelChange: (value: UpdateChannel) => void;
  updateCheckInterval: UpdateCheckInterval;
  onUpdateCheckIntervalChange: (value: UpdateCheckInterval) => void;
  isCheckingForUpdates: boolean;
  lastUpdateCheckResult: UpdateCheckResult | null;
  currentAppVersion: string;
  whatsNewNotes: string;
  onCheckForUpdates: (manual: boolean) => void;
  onOpenWhatsNew: (notes: string) => void;

  // Diagnostics
  lifecycle: LifecycleBootstrap | null;
  lifecycleError: string | null;
  databaseStatus: DatabaseStatus | null;
  storageCounts: StorageModelCounts | null;
  databaseError: string | null;

  // Sidebar
  hiddenCategories: Set<string>;
  onHiddenCategoriesChange: (categories: Set<string>) => void;
  allCategories: string[];

  // Persistence
  persistSetting: (key: string, value: unknown) => void;
};

export function SettingsModal({
  isOpen,
  onClose,
  rememberLastInput,
  onRememberLastInputChange,
  themeVariant,
  onThemeVariantChange,
  showStatusBar,
  onShowStatusBarChange,
  fontSizeLevel,
  onFontSizeLevelChange,
  searchDebounceMs,
  onSearchDebounceMsChange,
  openToolsInNewTab,
  onOpenToolsInNewTabChange,
  quickLauncherEnabled,
  onQuickLauncherEnabledChange,
  quickLauncherShortcut,
  onQuickLauncherShortcutChange,
  autoUpdateEnabled,
  onAutoUpdateEnabledChange,
  updateChannel,
  onUpdateChannelChange,
  updateCheckInterval,
  onUpdateCheckIntervalChange,
  isCheckingForUpdates,
  lastUpdateCheckResult,
  currentAppVersion,
  whatsNewNotes,
  onCheckForUpdates,
  onOpenWhatsNew,
  lifecycle,
  lifecycleError,
  databaseStatus,
  storageCounts,
  databaseError,
  hiddenCategories,
  onHiddenCategoriesChange,
  allCategories,
  persistSetting,
}: SettingsModalProps) {
  const [activeSettingsCategory, setActiveSettingsCategory] =
    useState<SettingsCategory>("general");
  const [exportSizeBytes, setExportSizeBytes] = useState<number | null>(null);

  // Lazy-fetch export size only when diagnostics tab is viewed
  useEffect(() => {
    if (!isOpen || activeSettingsCategory !== "diagnostics") return;
    if (exportSizeBytes !== null) return; // already fetched
    invoke<string>("export_user_data_json")
      .then((payload) => setExportSizeBytes(new TextEncoder().encode(payload).length))
      .catch(() => setExportSizeBytes(-1));
  }, [isOpen, activeSettingsCategory, exportSizeBytes]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-slate-950/60 p-6 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Application settings"
        className="theme-surface-elevated theme-border w-full max-w-4xl rounded-xl border shadow-2xl shadow-slate-950/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="theme-border flex items-center justify-between border-b p-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Settings</p>
            <p className="text-xs text-[var(--text-muted)]">
              Changes are applied immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-[420px]">
          <aside className="theme-border w-48 border-r p-3">
            <ul className="space-y-1">
              {SETTINGS_CATEGORIES.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSettingsCategory(category.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                      activeSettingsCategory === category.id
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {category.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex-1 space-y-4 p-4 text-sm text-slate-200">
            {activeSettingsCategory === "general" && (
              <div className="space-y-3">
                <p className="font-semibold text-slate-100">General</p>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Remember last input per tool</span>
                  <input
                    type="checkbox"
                    checked={rememberLastInput}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.checked;
                      onRememberLastInputChange(nextValue);
                      persistSetting("app.rememberLastInput", nextValue);
                    }}
                  />
                </label>
              </div>
            )}

            {activeSettingsCategory === "appearance" && (
              <div className="space-y-3">
                <p className="font-semibold text-slate-100">Appearance</p>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Theme</span>
                  <select
                    value={themeVariant}
                    onChange={(event) => {
                      const nextTheme = event.currentTarget.value as ThemeVariant;
                      onThemeVariantChange(nextTheme);
                      persistSetting("app.themeVariant", nextTheme);
                    }}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  >
                    {THEME_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Show status bar</span>
                  <input
                    type="checkbox"
                    checked={showStatusBar}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.checked;
                      onShowStatusBarChange(nextValue);
                      persistSetting("app.showStatusBar", nextValue);
                    }}
                  />
                </label>
                <label className="block rounded border border-slate-700 p-3">
                  <span className="text-sm">
                    Font Size: {FONT_SIZE_LABELS[fontSizeLevel - 1]}
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={fontSizeLevel}
                    onChange={(event) => {
                      const nextValue = Number(event.currentTarget.value);
                      onFontSizeLevelChange(nextValue);
                      persistSetting("app.fontSizeLevel", nextValue);
                    }}
                    className="mt-2 w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-slate-400">
                    <span>Compact</span>
                    <span>Extra Large</span>
                  </div>
                </label>

                <div className="rounded border border-slate-700 p-3">
                  <p className="text-sm font-medium text-slate-100">Sidebar Categories</p>
                  <p className="mt-1 text-xs text-slate-400">Uncheck categories to hide them from the sidebar.</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {allCategories.map((category) => (
                      <label key={category} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={!hiddenCategories.has(category)}
                          onChange={(e) => {
                            const next = new Set(hiddenCategories);
                            if (e.target.checked) {
                              next.delete(category);
                            } else {
                              next.add(category);
                            }
                            onHiddenCategoriesChange(next);
                          }}
                          className="accent-cyan-500"
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSettingsCategory === "search" && (
              <div className="space-y-3">
                <p className="font-semibold text-slate-100">Search</p>
                <label className="block rounded border border-slate-700 p-3">
                  <span className="text-sm">
                    Debounce (ms): {searchDebounceMs}
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={10}
                    value={searchDebounceMs}
                    onChange={(event) => {
                      const nextValue = Number(event.currentTarget.value);
                      onSearchDebounceMsChange(nextValue);
                      persistSetting("app.searchDebounceMs", nextValue);
                    }}
                    className="mt-2 w-full"
                  />
                </label>
              </div>
            )}

            {activeSettingsCategory === "workflow" && (
              <div className="space-y-3">
                <p className="font-semibold text-slate-100">Workflow</p>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Open tools in new tab</span>
                  <input
                    type="checkbox"
                    checked={openToolsInNewTab}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.checked;
                      onOpenToolsInNewTabChange(nextValue);
                      persistSetting("app.openToolsInNewTab", nextValue);
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Quick launcher enabled</span>
                  <input
                    type="checkbox"
                    checked={quickLauncherEnabled}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.checked;
                      onQuickLauncherEnabledChange(nextValue);
                      persistSetting("app.quickLauncherEnabled", nextValue);
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Quick launcher shortcut</span>
                  <input
                    value={quickLauncherShortcut}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      onQuickLauncherShortcutChange(nextValue);
                      persistSetting("app.quickLauncherShortcut", nextValue);
                    }}
                    className="w-56 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  />
                </label>
              </div>
            )}

            {activeSettingsCategory === "updates" && (
              <div className="space-y-3">
                <p className="font-semibold text-slate-100">Updates</p>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Enable automatic update checks</span>
                  <input
                    type="checkbox"
                    checked={autoUpdateEnabled}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.checked;
                      onAutoUpdateEnabledChange(nextValue);
                      persistSetting("app.autoUpdateEnabled", nextValue);
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Update channel</span>
                  <select
                    value={updateChannel}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value as UpdateChannel;
                      onUpdateChannelChange(nextValue);
                      persistSetting("app.updateChannel", nextValue);
                    }}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  >
                    <option value="stable">Stable</option>
                    <option value="beta">Beta</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-slate-700 p-3">
                  <span>Check interval</span>
                  <select
                    value={updateCheckInterval}
                    onChange={(event) => {
                      const nextValue = event.currentTarget
                        .value as UpdateCheckInterval;
                      onUpdateCheckIntervalChange(nextValue);
                      persistSetting("app.updateCheckInterval", nextValue);
                    }}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  >
                    <option value="onLaunch">On launch</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </label>
                <div className="rounded border border-slate-700 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onCheckForUpdates(true)}
                      disabled={isCheckingForUpdates}
                      className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isCheckingForUpdates
                        ? "Checking..."
                        : "Check for updates now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!whatsNewNotes.trim()) {
                          onOpenWhatsNew(
                            currentAppVersion
                              ? `Binturong ${currentAppVersion}\n\nNo additional release notes are available.`
                              : "No release notes are available yet.",
                          );
                        } else {
                          onOpenWhatsNew(whatsNewNotes);
                        }
                      }}
                      className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200"
                    >
                      Open What's New
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Current version:{" "}
                    <code>{currentAppVersion || "unknown"}</code>
                    {lastUpdateCheckResult
                      ? ` \u2022 Last check: ${formatUnixTime(lastUpdateCheckResult.checkedAtUnix)}`
                      : ""}
                  </p>
                  {lastUpdateCheckResult && (
                    <p className="mt-1 text-xs text-slate-400">
                      Channel <code>{lastUpdateCheckResult.channel}</code> &bull; Latest{" "}
                      <code>{lastUpdateCheckResult.latestVersion}</code>
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeSettingsCategory === "diagnostics" && (
              <div className="space-y-6">
                <div>
                  <p className="font-semibold text-slate-100">Lifecycle Diagnostics</p>
                  <dl className="mt-3 grid gap-2 text-sm text-slate-200">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Cold start:</dt>
                      <dd>
                        {lifecycle
                          ? `${lifecycle.coldStartMs}ms / ${lifecycle.coldStartTargetMs}ms target`
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Within target:</dt>
                      <dd>
                        {lifecycle
                          ? lifecycle.coldStartWithinTarget
                            ? "yes"
                            : "no"
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Recovered session:</dt>
                      <dd>
                        {lifecycle
                          ? lifecycle.recoveredAfterUncleanShutdown
                            ? "yes"
                            : "no"
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Previous panic log:</dt>
                      <dd>
                        {lifecycle
                          ? lifecycle.previousPanicReportExists
                            ? "present"
                            : "none"
                          : "loading"}
                      </dd>
                    </div>
                    {lifecycleError && (
                      <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-red-200">
                        Failed to load lifecycle state: {lifecycleError}
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <p className="font-semibold text-slate-100">Database Diagnostics</p>
                  <dl className="mt-3 grid gap-2 text-sm text-slate-200">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">DB path:</dt>
                      <dd>
                        {databaseStatus?.dbPath ?? <LoadingState label="Loading DB status..." />}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Schema version:</dt>
                      <dd>
                        {databaseStatus
                          ? `${databaseStatus.currentSchemaVersion} / ${databaseStatus.latestSchemaVersion}`
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Applied migrations:</dt>
                      <dd>
                        {databaseStatus
                          ? databaseStatus.appliedMigrationsOnBoot.length > 0
                            ? databaseStatus.appliedMigrationsOnBoot.join(", ")
                            : "none"
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Model row counts:</dt>
                      <dd>
                        {storageCounts
                          ? `settings=${storageCounts.settingsCount}, favorites=${storageCounts.favoritesCount}, recents=${storageCounts.recentsCount}, presets=${storageCounts.presetsCount}, history=${storageCounts.historyCount}, chains=${storageCounts.chainsCount}`
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-slate-100">Export payload size:</dt>
                      <dd>{exportSizeBytes !== null ? `${exportSizeBytes} bytes` : "loading"}</dd>
                    </div>
                    {databaseError && (
                      <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-red-200">
                        Failed to load database status: {databaseError}
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            )}

            {activeSettingsCategory === "about" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white">{ABOUT_APP_NAME}</h3>
                  <p className="mt-1 text-sm text-slate-400">{ABOUT_TAGLINE}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Version {currentAppVersion || "0.0.0"}
                  </p>
                </div>

                <div className="rounded border border-slate-700 p-4 text-sm text-slate-300">
                  <p>
                    {ABOUT_APP_NAME} is an offline-first desktop developer utility suite with 134+ tools
                    for formatting, encoding, converting, generating, and manipulating text - all running
                    locally with no network required.
                  </p>
                </div>

                <dl className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-slate-400">Website</dt>
                    <dd>
                      <a
                        href={ABOUT_WEBSITE}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          void openExternalLink(event, ABOUT_WEBSITE);
                        }}
                        className="text-cyan-400 underline decoration-cyan-400/30 hover:decoration-cyan-400"
                      >
                        {ABOUT_WEBSITE}
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-slate-400">Source Code</dt>
                    <dd>
                      <a
                        href={ABOUT_REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          void openExternalLink(event, ABOUT_REPO_URL);
                        }}
                        className="text-cyan-400 underline decoration-cyan-400/30 hover:decoration-cyan-400"
                      >
                        {ABOUT_REPO_URL}
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-slate-400">License</dt>
                    <dd className="text-slate-200">{ABOUT_LICENSE}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-slate-400">Author</dt>
                    <dd>
                      <a
                        href={ABOUT_AUTHOR_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          void openExternalLink(event, ABOUT_AUTHOR_URL);
                        }}
                        className="text-cyan-400 underline decoration-cyan-400/30 hover:decoration-cyan-400"
                      >
                        {ABOUT_AUTHOR}
                      </a>
                    </dd>
                  </div>
                </dl>

                <div className="rounded border border-slate-700 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Built with</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Tauri 2", "Rust", "React 19", "TypeScript", "Tailwind CSS v4", "Vite"].map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-center text-xs text-slate-600">
                  &copy; {ABOUT_COPYRIGHT_YEAR} {ABOUT_AUTHOR}. Released under the {ABOUT_LICENSE} License.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
