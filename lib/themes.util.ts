/* Themes: how Circles looks, chosen per device in Settings → Appearance.
   A theme is its token values (Sol's are the @theme block in
   app/globals.css; any other's a file in app/themes/ setting them under
   [data-theme="…"]) and its entry here: a name, a line on it, the colour for
   the browser's own chrome (the status bar), and a few colours to draw its
   preview with. A new theme is one of each. Automatic follows the device:
   Luna while it's in dark mode, Sol otherwise. */

export const THEMES = [
  {
    key: "sol",
    label: "Sol",
    description: "Ink on paper.",
    browserColor: "#ffffff",
    preview: { paper: "#ffffff", ink: "#0a0a0a", soft: "#6b6b6b", faint: "#e4e4e4", chrome: "#0a0a0a", accent: "#0f7d77" },
  },
  {
    key: "luna",
    label: "Luna",
    description: "Paper on ink, for the evening.",
    browserColor: "#131313",
    preview: { paper: "#131313", ink: "#edebe6", soft: "#9a9893", faint: "#31302e", chrome: "#3a3a38", accent: "#2bb3a9" },
  },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];
export type ThemeChoice = ThemeKey | "auto";

// a new device follows its own light or dark setting
export const DEFAULT_THEME_CHOICE: ThemeChoice = "auto";
// the themes Automatic chooses between
export const LIGHT_THEME: ThemeKey = "sol";
export const DARK_THEME: ThemeKey = "luna";

// where this device keeps its choice (localStorage)
export const THEME_STORAGE_KEY = "circles:theme";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "auto" || THEMES.some((t) => t.key === value);
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ThemeKey {
  if (choice !== "auto") return choice;
  return prefersDark ? DARK_THEME : LIGHT_THEME;
}

export function themeByKey(key: ThemeKey) {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

/* The theme, applied before the page first draws: inline in the root
   layout's <head>, so a dark theme never flashes white on load (the server
   can't know, the choice being on the device). It follows the device's
   setting live while the choice is Automatic. lib/theme.ts does the same once
   the app's code is running; this is the copy that can't wait for it. */
export function themeScript(): string {
  const colors = Object.fromEntries(THEMES.map((t) => [t.key, t.browserColor]));
  const keys = THEMES.map((t) => t.key);
  return `(function(){try{var K=${JSON.stringify(THEME_STORAGE_KEY)},C=${JSON.stringify(colors)},T=${JSON.stringify(keys)},m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var c=null;try{c=localStorage.getItem(K)}catch(e){}var t=T.indexOf(c)>=0?c:(m.matches?${JSON.stringify(DARK_THEME)}:${JSON.stringify(LIGHT_THEME)});document.documentElement.setAttribute("data-theme",t);var n=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<n.length;i++)n[i].setAttribute("content",C[t]);}a();m.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===K)a()});}catch(e){}})();`;
}
