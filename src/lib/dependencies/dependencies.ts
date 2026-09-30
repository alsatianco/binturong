export const DEPENDENCY_HELP_URL = "https://play.alsatian.co/software/binturong.html";

export type DependencyStatus = {
  id: string;
  name: string;
  description: string;
  estimatedSize: string;
  path: string;
  configuredPath: string;
  available: boolean;
  detail: string | null;
  installing: boolean;
  installError: string | null;
  installer: string | null;
  configPath: string;
  languageDataPath: string;
};

export function missingDependencyId(error: unknown): string | null {
  try {
    const value = typeof error === "string" ? JSON.parse(error) : error;
    if (value && typeof value === "object" && value.code === "missingDependency" && value.dependencyId === "tesseract") {
      return value.dependencyId;
    }
  } catch { /* Ordinary tool errors do not require installation. */ }
  return null;
}
