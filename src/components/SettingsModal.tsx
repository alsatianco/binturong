import { useEffect, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  THEME_OPTIONS,
  type ThemeVariant,
} from "../lib/theme/themeTokens";
import { LoadingState } from "./ui/LoadingState";

const FONT_SIZE_LABELS = ["Compact", "Small", "Default", "Large", "Extra large"];

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
const ABOUT_TAGLINE = "Everyday tools for developers";
const ABOUT_WEBSITE = "https://play.alsatian.co/software/binturong.html";
const ABOUT_REPO_URL = "https://github.com/alsatianco/binturong";
const ABOUT_DONATION_URL = "https://www.alsatian.co/p/coffee.html";
const ABOUT_LICENSE = "MIT";
const ABOUT_AUTHOR = "Duc Nguyen";
const ABOUT_AUTHOR_URL = "https://www.linkedin.com/in/ducnd87/";
const ABOUT_COPYRIGHT_YEAR = "2026";

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
  startupView: "home" | "lastSession";
  onStartupViewChange: (value: "home" | "lastSession") => void;
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
  startupView,
  onStartupViewChange,
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
  isCheckingForUpdates,
  currentAppVersion,
  onCheckForUpdates,
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
      className="fixed inset-0 z-30 flex items-start justify-center bg-[color-mix(in_srgb,var(--app-bg)_75%,transparent)] p-6 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Application settings"
        className="theme-surface-elevated theme-border max-h-[calc(100vh-5.5rem)] w-full max-w-4xl overflow-y-auto rounded-xl border shadow-2xl shadow-[color-mix(in_srgb,var(--app-bg)_60%,transparent)]"
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
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]"
                    }`}
                  >
                    {category.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex-1 space-y-4 p-4 text-sm text-[var(--text-primary)]">
            {activeSettingsCategory === "general" && (
              <div className="space-y-3">
                <p className="font-semibold text-[var(--text-primary)]">General</p>
                <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] p-3">
                  <span>On start, open</span>
                  <select className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1" value={startupView} onChange={event => {
                    const value = event.target.value as "home" | "lastSession";
                    onStartupViewChange(value);
                    persistSetting("app.startupView", value);
                  }}><option value="home">Home</option><option value="lastSession">Last session tabs</option></select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] p-3">
                  <span>Remember the last input for each tool</span>
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
                <p className="font-semibold text-[var(--text-primary)]">Appearance</p>
                <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] p-3">
                  <span>Theme</span>
                  <select
                    value={themeVariant}
                    onChange={(event) => {
                      const nextTheme = event.currentTarget.value as ThemeVariant;
                      onThemeVariantChange(nextTheme);
                      persistSetting("app.themeVariant", nextTheme);
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                  >
                    {THEME_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] p-3">
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
                <label className="block rounded border border-[var(--border)] p-3">
                  <span className="text-sm">
                    Font size: {FONT_SIZE_LABELS[fontSizeLevel - 1]}
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
                  <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
                    <span>Compact</span>
                    <span>Extra large</span>
                  </div>
                </label>

                <div className="rounded border border-[var(--border)] p-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Sidebar categories</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Uncheck categories to hide them from the sidebar.</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {allCategories.map((category) => (
                      <label key={category} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]">
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
                <p className="font-semibold text-[var(--text-primary)]">Search</p>
                <label className="block rounded border border-[var(--border)] p-3">
                  <span className="text-sm">
                    Search delay (ms): {searchDebounceMs}
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
                <p className="font-semibold text-[var(--text-primary)]">Workflow</p>
                <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] p-3">
                  <span>Open tools in a new tab</span>
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
                <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] p-3">
                  <span>Enable quick launcher</span>
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
                <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] p-3">
                  <span>Quick launcher shortcut</span>
                  <input
                    value={quickLauncherShortcut}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      onQuickLauncherShortcutChange(nextValue);
                      persistSetting("app.quickLauncherShortcut", nextValue);
                    }}
                    className="w-56 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                  />
                </label>
              </div>
            )}

            {activeSettingsCategory === "updates" && (
              <div className="space-y-3">
                <p className="font-semibold text-[var(--text-primary)]">Updates</p>
                <p className="text-sm text-[var(--text-primary)]">
                  Automatic update checks and installation are not available yet.
                  Download a newer installer from GitHub Releases, or update with Homebrew.
                </p>
                <p className="text-xs text-[var(--text-muted)]">Current version: {currentAppVersion || "unknown"}</p>
                <button
                  type="button"
                  onClick={() => onCheckForUpdates(true)}
                  disabled={isCheckingForUpdates}
                  className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-40"
                >
                  View releases and downloads
                </button>
              </div>
            )}

            {activeSettingsCategory === "diagnostics" && (
              <div className="space-y-6">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Startup diagnostics</p>
                  <dl className="mt-3 grid gap-2 text-sm text-[var(--text-primary)]">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Cold start:</dt>
                      <dd>
                        {lifecycle
                          ? `${lifecycle.coldStartMs}ms / ${lifecycle.coldStartTargetMs}ms target`
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Within target:</dt>
                      <dd>
                        {lifecycle
                          ? lifecycle.coldStartWithinTarget
                            ? "yes"
                            : "no"
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Recovered session:</dt>
                      <dd>
                        {lifecycle
                          ? lifecycle.recoveredAfterUncleanShutdown
                            ? "yes"
                            : "no"
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Previous crash report:</dt>
                      <dd>
                        {lifecycle
                          ? lifecycle.previousPanicReportExists
                            ? "present"
                            : "none"
                          : "loading"}
                      </dd>
                    </div>
                    {lifecycleError && (
                      <div className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent)]">
                        Could not load startup details: {lifecycleError}
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Database diagnostics</p>
                  <dl className="mt-3 grid gap-2 text-sm text-[var(--text-primary)]">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Database location:</dt>
                      <dd>
                        {databaseStatus?.dbPath ?? <LoadingState label="Loading database details…" />}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Schema version:</dt>
                      <dd>
                        {databaseStatus
                          ? `${databaseStatus.currentSchemaVersion} / ${databaseStatus.latestSchemaVersion}`
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Applied migrations:</dt>
                      <dd>
                        {databaseStatus
                          ? databaseStatus.appliedMigrationsOnBoot.length > 0
                            ? databaseStatus.appliedMigrationsOnBoot.join(", ")
                            : "none"
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Saved records:</dt>
                      <dd>
                        {storageCounts
                          ? `settings=${storageCounts.settingsCount}, favorites=${storageCounts.favoritesCount}, recents=${storageCounts.recentsCount}, presets=${storageCounts.presetsCount}, history=${storageCounts.historyCount}, chains=${storageCounts.chainsCount}`
                          : "loading"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Data export size:</dt>
                      <dd>{exportSizeBytes === null ? "Loading…" : exportSizeBytes < 0 ? "Unavailable" : `${exportSizeBytes} bytes`}</dd>
                    </div>
                    {databaseError && (
                      <div className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent)]">
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
                  <img
                    src="/branding/logo.png"
                    alt="Binturong mascot"
                    width={96}
                    height={96}
                    className="mx-auto mb-3 h-24 w-24 object-contain"
                  />
                  <h3 className="text-2xl font-bold text-white">{ABOUT_APP_NAME}</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{ABOUT_TAGLINE}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {currentAppVersion ? `Version ${currentAppVersion}` : "Version unavailable"}
                  </p>
                </div>

                <div className="rounded border border-[var(--border)] p-4 text-sm text-[var(--text-primary)]">
                  <p>
                    Format code, convert data, work with text and images, and more.
                    Tools run locally on your computer. Most work offline; OCR language downloads require a connection.
                    Free and open source under the MIT license.
                  </p>
                </div>

                <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-primary)]">
                  <p>
                    If {ABOUT_APP_NAME} is useful to you, a GitHub star or a coffee is a welcome way to support it.
                  </p>
                  <a
                    href={ABOUT_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      void openExternalLink(event, ABOUT_REPO_URL);
                    }}
                    className="mr-2 mt-3 inline-flex items-center rounded-full border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    Star this repo
                  </a>
                  <a
                    href={ABOUT_DONATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      void openExternalLink(event, ABOUT_DONATION_URL);
                    }}
                    className="mt-3 inline-flex items-center rounded-full border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    Buy me a coffee
                  </a>
                </div>

                <dl className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-[var(--text-muted)]">Website</dt>
                    <dd>
                      <a
                        href={ABOUT_WEBSITE}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          void openExternalLink(event, ABOUT_WEBSITE);
                        }}
                        className="text-[var(--accent)] underline decoration-cyan-400/30 hover:decoration-cyan-400"
                      >
                        Visit the website
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-[var(--text-muted)]">Source code</dt>
                    <dd>
                      <a
                        href={ABOUT_REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          void openExternalLink(event, ABOUT_REPO_URL);
                        }}
                        className="text-[var(--accent)] underline decoration-cyan-400/30 hover:decoration-cyan-400"
                      >
                        View on GitHub
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-[var(--text-muted)]">License</dt>
                    <dd className="text-[var(--text-primary)]">{ABOUT_LICENSE}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="min-w-[100px] font-semibold text-[var(--text-muted)]">Author</dt>
                    <dd>
                      <a
                        href={ABOUT_AUTHOR_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          void openExternalLink(event, ABOUT_AUTHOR_URL);
                        }}
                        className="text-[var(--accent)] underline decoration-cyan-400/30 hover:decoration-cyan-400"
                      >
                        {ABOUT_AUTHOR}
                      </a>
                    </dd>
                  </div>
                </dl>

                <p className="text-center text-xs text-[var(--text-muted)]">
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
