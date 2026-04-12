export type ThemeVariant =
  | "system"
  | "ocean"
  | "forest"
  | "sunset"
  | "graphite"
  | "paper"
  | "midnight"
  | "ember"
  | "mint"
  | "solar"
  | "cobalt";

export type ThemeTokenSet = {
  appBg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
};

export const THEME_OPTIONS: ThemeVariant[] = [
  "system",
  "ocean",
  "forest",
  "sunset",
  "graphite",
  "paper",
  "midnight",
  "ember",
  "mint",
  "solar",
  "cobalt",
];

const TOKENS: Record<Exclude<ThemeVariant, "system">, ThemeTokenSet> = {
  ocean: {
    appBg: "#061826",
    surface: "#0f2a3f",
    surfaceElevated: "#14374f",
    border: "#28506e",
    textPrimary: "#d4f3ff",
    textMuted: "#8bb8cd",
    accent: "#57d1ff",
    accentSoft: "rgba(87, 209, 255, 0.18)",
  },
  forest: {
    appBg: "#0e1e17",
    surface: "#173127",
    surfaceElevated: "#214034",
    border: "#36614c",
    textPrimary: "#d8f4e5",
    textMuted: "#9dbda9",
    accent: "#7ee08d",
    accentSoft: "rgba(126, 224, 141, 0.18)",
  },
  sunset: {
    appBg: "#2a1916",
    surface: "#442622",
    surfaceElevated: "#5a322d",
    border: "#7d4d45",
    textPrimary: "#ffe3d8",
    textMuted: "#d9b4a6",
    accent: "#ff9a63",
    accentSoft: "rgba(255, 154, 99, 0.2)",
  },
  graphite: {
    appBg: "#111316",
    surface: "#1d2228",
    surfaceElevated: "#262d35",
    border: "#3a4653",
    textPrimary: "#f0f3f7",
    textMuted: "#a5b1bd",
    accent: "#93b3d8",
    accentSoft: "rgba(147, 179, 216, 0.2)",
  },
  paper: {
    appBg: "#f3f0e8",
    surface: "#faf8f3",
    surfaceElevated: "#ffffff",
    border: "#d3c9b6",
    textPrimary: "#2d2a24",
    textMuted: "#746a5d",
    accent: "#3f7ab5",
    accentSoft: "rgba(63, 122, 181, 0.18)",
  },
  midnight: {
    appBg: "#06090f",
    surface: "#0f1520",
    surfaceElevated: "#151d2b",
    border: "#273043",
    textPrimary: "#d9e2f1",
    textMuted: "#8d9bb3",
    accent: "#67b2ff",
    accentSoft: "rgba(103, 178, 255, 0.2)",
  },
  ember: {
    appBg: "#1f120f",
    surface: "#341b16",
    surfaceElevated: "#47251f",
    border: "#714137",
    textPrimary: "#ffe5dc",
    textMuted: "#d7a79a",
    accent: "#ff8b72",
    accentSoft: "rgba(255, 139, 114, 0.2)",
  },
  mint: {
    appBg: "#0d1d1b",
    surface: "#16322f",
    surfaceElevated: "#21433f",
    border: "#39615b",
    textPrimary: "#d7faf4",
    textMuted: "#93bfb8",
    accent: "#73f0cf",
    accentSoft: "rgba(115, 240, 207, 0.2)",
  },
  solar: {
    appBg: "#2a240f",
    surface: "#473d1b",
    surfaceElevated: "#5f5124",
    border: "#857337",
    textPrimary: "#fff7d4",
    textMuted: "#d6c48f",
    accent: "#ffd76d",
    accentSoft: "rgba(255, 215, 109, 0.2)",
  },
  cobalt: {
    appBg: "#10142a",
    surface: "#1a2450",
    surfaceElevated: "#213067",
    border: "#3a4f93",
    textPrimary: "#e0e7ff",
    textMuted: "#a4b1e0",
    accent: "#7ca3ff",
    accentSoft: "rgba(124, 163, 255, 0.22)",
  },
};

export function resolveThemeVariant(themeVariant: ThemeVariant): Exclude<ThemeVariant, "system"> {
  if (themeVariant !== "system") {
    return themeVariant;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "midnight"
    : "paper";
}

export function applyThemeTokens(themeVariant: ThemeVariant): Exclude<ThemeVariant, "system"> {
  const resolvedTheme = resolveThemeVariant(themeVariant);
  const tokens = TOKENS[resolvedTheme];
  const root = document.documentElement;

  root.style.setProperty("--app-bg", tokens.appBg);
  root.style.setProperty("--surface", tokens.surface);
  root.style.setProperty("--surface-elevated", tokens.surfaceElevated);
  root.style.setProperty("--border", tokens.border);
  root.style.setProperty("--text-primary", tokens.textPrimary);
  root.style.setProperty("--text-muted", tokens.textMuted);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-soft", tokens.accentSoft);
  root.dataset.theme = resolvedTheme;

  return resolvedTheme;
}
