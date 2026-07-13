"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, themeInitScript } from "@/lib/theme";

const subscribe = () => () => {};

/**
 * Emits the theme FOUC-prevention script only during SSR and the matching
 * hydration pass. Post-hydration client renders return null so React 19 does
 * not warn about creating <script> tags during client render. The IIFE has
 * already run from the SSR HTML by then.
 */
export default function ThemeInitScript() {
  const renderScript = useSyncExternalStore(subscribe, () => false, () => true);
  if (!renderScript) return null;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: themeInitScript(THEME_STORAGE_KEY),
      }}
    />
  );
}
