export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "abia-theme";

export const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
}> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function resolveThemePreference(stored: string | null): ThemePreference {
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function isDarkTheme(preference: ThemePreference, systemDark: boolean): boolean {
  if (preference === "light") return false;
  if (preference === "dark") return true;
  return systemDark;
}

export function themeInitScript(storageKey: string): string {
  return `(function(){try{var key=${JSON.stringify(storageKey)};var stored=localStorage.getItem(key);var dark=stored==="dark"||(stored!=="light"&&stored!=="dark"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
}
