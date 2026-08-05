"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "overload_theme";
const ACCENT_STORAGE_KEY = "overload_accent";

/** The built-in default (set in globals.css) — shown as "Default" in the picker. */
export const DEFAULT_ACCENT = "#ff7a2f";

/** Must match --background for each theme in globals.css exactly. */
const THEME_COLOR = { dark: "#000000", light: "#ffffff" } as const;

export const ACCENT_OPTIONS = [
  "#F45D22",
  "#FF6B00",
  "#ff7a00",
  "#FF5A1F",
  "#FF5F1F",
  "#ff6700",
] as const;

interface ThemeContextValue {
  /** What the user picked — "system" follows the OS. */
  preference: ThemePreference;
  /** What is actually rendered right now. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Selected accent hex, or null when following the default per-theme value. */
  accent: string | null;
  setAccent: (hex: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Inlined in <head> before paint so the correct theme class (and any custom
 * accent) is on <html> on first frame — otherwise a light-mode user gets a
 * white flash, or an accent-color user briefly sees the default orange.
 * Dark is the default whenever there is no stored override — an unset
 * preference no longer follows the OS, it resolves straight to dark, the
 * app's primary design target. Only an explicit "light" choice opts out.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var d=p!=="light";document.documentElement.classList.toggle("dark",d);var a=localStorage.getItem("${ACCENT_STORAGE_KEY}");if(a)document.documentElement.style.setProperty("--accent",a);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content",d?"${THEME_COLOR.dark}":"${THEME_COLOR.light}");}catch(e){}})();`;

/** "system"/unset resolves to dark by default now — see themeInitScript. */
function defaultTheme(): ResolvedTheme {
  return "dark";
}

/**
 * The single place that keeps three things in lockstep whenever the
 * resolved theme changes: the `.dark` class, and the `theme-color` meta tag
 * that tells Safari what color to paint the status bar / notch area over.
 * Same tag `themeInitScript` writes pre-paint — this just keeps it correct
 * across a runtime toggle (e.g. Profile's theme picker), which the static
 * media-query-based tag Next can generate has no way to react to.
 */
function apply(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLOR[theme]);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("dark");
  const [accent, setAccentState] = useState<string | null>(null);

  // Adopt whatever the pre-paint script already decided.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const pref = stored ?? "system";
    setPreferenceState(pref);
    setTheme(pref === "system" ? defaultTheme() : pref);
    setAccentState(localStorage.getItem(ACCENT_STORAGE_KEY));
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    const resolved = next === "system" ? defaultTheme() : next;
    setTheme(resolved);
    apply(resolved);
  }, []);

  const setAccent = useCallback((hex: string | null) => {
    setAccentState(hex);
    if (hex) {
      localStorage.setItem(ACCENT_STORAGE_KEY, hex);
      document.documentElement.style.setProperty("--accent", hex);
    } else {
      localStorage.removeItem(ACCENT_STORAGE_KEY);
      document.documentElement.style.removeProperty("--accent");
    }
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference, accent, setAccent }),
    [preference, theme, setPreference, accent, setAccent],
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
