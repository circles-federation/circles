import { useSyncExternalStore } from "react";
import { DEFAULT_THEME_CHOICE, THEME_STORAGE_KEY, isThemeChoice, resolveTheme, themeByKey, type ThemeChoice, type ThemeKey } from "./themes.util";

/* The browser's side of themes: this device's choice (in its storage, so a
   private window or cleared site data is back on Automatic) and applying it
   to the page, as themeScript does before the app's code has loaded. */

const CHANGED = "circles:theme-changed";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(saved) ? saved : DEFAULT_THEME_CHOICE;
  } catch {
    return DEFAULT_THEME_CHOICE;
  }
}

function apply(choice: ThemeChoice) {
  const key = resolveTheme(choice, darkQuery().matches);
  document.documentElement.setAttribute("data-theme", key);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", themeByKey(key).browserColor));
}

// choose a theme for this device, which takes effect at once
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === DEFAULT_THEME_CHOICE) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // storage refused (a private window): it applies for this visit only
  }
  apply(choice);
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  const query = darkQuery();
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  query.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
    query.removeEventListener("change", onChange);
  };
}

const snapshot = () => {
  const choice = readThemeChoice();
  return `${choice}:${resolveTheme(choice, darkQuery().matches)}`;
};

/* This device's choice, and the theme it comes to (Automatic's being the
   device's), kept current; null on the server, which can't know. */
export function useTheme(): { choice: ThemeChoice; theme: ThemeKey } | null {
  const value = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!value) return null;
  const [choice, theme] = value.split(":") as [ThemeChoice, ThemeKey];
  return { choice, theme };
}
