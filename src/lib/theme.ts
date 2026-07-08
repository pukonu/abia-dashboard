export type ThemePreference = "dark" | "system";

export const THEME_STORAGE_KEY = "abia-theme";

export function resolveThemePreference(stored: string | null): ThemePreference {
  return stored === "dark" ? "dark" : "system";
}

export function isDarkTheme(preference: ThemePreference, systemDark: boolean): boolean {
  return preference === "dark" || (preference === "system" && systemDark);
}
