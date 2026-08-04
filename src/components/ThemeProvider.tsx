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
export const DEFAULT_ACCENT = "#fa5400";

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
 * accent) is on <html> on first frame — otherwise a dark-mode user gets a
 * white flash, or an accent-color user briefly sees the default orange.
 * Light is the default whenever there is no stored override and the OS
 * expresses no dark preference.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var a=localStorage.getItem("${ACCENT_STORAGE_KEY}");if(a)document.documentElement.style.setProperty("--accent",a);}catch(e){}})();`;

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function apply(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("light");
  const [accent, setAccentState] = useState<string | null>(null);

  // Adopt whatever the pre-paint script already decided.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const pref = stored ?? "system";
    setPreferenceState(pref);
    setTheme(pref === "system" ? systemTheme() : pref);
    setAccentState(localStorage.getItem(ACCENT_STORAGE_KEY));
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = media.matches ? "dark" : "light";
      setTheme(next);
      apply(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    const resolved = next === "system" ? systemTheme() : next;
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
