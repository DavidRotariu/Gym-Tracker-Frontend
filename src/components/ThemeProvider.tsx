"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "overload_theme";

/** Must match --background for each theme in globals.css exactly. */
const THEME_COLOR = { dark: "#000000", light: "#ffffff" } as const;

interface ThemeContextValue {
  /** What the user picked — "system" follows the OS. */
  preference: ThemePreference;
  /** What is actually rendered right now. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Inlined in <head> before paint so the correct theme class (and the
 * matching status-bar color) is set on first frame — otherwise a light-mode
 * user gets a white flash. Dark is the default whenever there is no stored
 * override — an unset preference no longer follows the OS, it resolves
 * straight to dark, the app's primary design target. Only an explicit
 * "light" choice opts out.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var d=p!=="light";document.documentElement.classList.toggle("dark",d);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content",d?"${THEME_COLOR.dark}":"${THEME_COLOR.light}");}catch(e){}})();`;

/** "system"/unset resolves to dark by default now — see themeInitScript. */
function defaultTheme(): ResolvedTheme {
  return "dark";
}

/**
 * Writes the `theme-color` meta tag Safari reads to paint the status
 * bar/notch area — creating it if `themeInitScript` hasn't run yet for some
 * reason. Exported so screens that go full-bleed a color other than the
 * theme background (the post-workout summary's solid-accent takeover) can
 * point it at their own color while mounted, then hand it back.
 */
export function setThemeColorMeta(hex: string) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", hex);
}

/** The `theme-color` value for the currently-resolved theme's background. */
export function themeColorFor(theme: ResolvedTheme): string {
  return THEME_COLOR[theme];
}

function apply(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  setThemeColorMeta(THEME_COLOR[theme]);
}

// The stored preference is an external store (localStorage) read through
// useSyncExternalStore: "system" on the server and during hydration, the real
// value right after — no effect that sets state on mount.
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const theme: ResolvedTheme = preference === "system" ? defaultTheme() : preference;

  // The pre-paint script already applied the stored theme; keep the document in
  // step when another tab changes it.
  useEffect(() => apply(theme), [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the theme still applies for this visit */
    }
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
