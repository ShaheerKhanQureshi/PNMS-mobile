import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/session";

/**
 * Appearance preference. Purely client-side: stored in localStorage, namespaced by the authenticated user's
 * existing unique id, so two accounts on one device keep independent choices. No backend or database is involved.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];
const KEY_PREFIX = "pnms.theme.v1.user.";
/** Non-sensitive "last used" hint so the login screen and first paint use a sensible theme (read by theme-init.js). */
export const THEME_HINT_KEY = "pnms.theme.hint";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export const themeStorageKey = (userId: number | string) =>
  `${KEY_PREFIX}${userId}`;
export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / storage blocked: the preference still applies for this session */
  }
}
export function readStoredPreference(userId?: number): ThemePreference {
  const stored = userId === undefined ? read(THEME_HINT_KEY) : read(themeStorageKey(userId));
  return isThemePreference(stored) ? stored : "system";
}

function subscribeSystem(callback: () => void) {
  const query = window.matchMedia?.(DARK_QUERY);
  query?.addEventListener?.("change", callback);
  return () => query?.removeEventListener?.("change", callback);
}
const systemPrefersDark = () =>
  window.matchMedia?.(DARK_QUERY).matches ?? false;

export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#131a17" : "#165d48");
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [version, setVersion] = useState(0);
  // Re-derived whenever the signed-in user changes (or the preference is saved / changed in another tab).
  const preference = useMemo(() => readStoredPreference(userId), [userId, version]);
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    systemPrefersDark,
    () => false,
  );
  const resolved: ResolvedTheme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);
  useEffect(() => {
    // Remember the signed-in user's choice as the hint for the next page load; never touch it while signed out.
    if (userId !== undefined) write(THEME_HINT_KEY, preference);
  }, [userId, preference]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (userId !== undefined && event.key === themeStorageKey(userId))
        setVersion((v) => v + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      if (userId === undefined) return;
      write(themeStorageKey(userId), next);
      write(THEME_HINT_KEY, next);
      setVersion((v) => v + 1);
    },
    [userId],
  );
  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("Theme provider required");
  return ctx;
}

/** Colours for Recharts (SVG attributes cannot read every CSS rule, so the chart components take them from here). */
export function chartPalette(theme: ResolvedTheme) {
  return theme === "dark"
    ? {
        ok: "#4fb88f",
        okFill: "#1f3a30",
        warn: "#d9a054",
        warnFill: "#3a2f1e",
        grid: "#2d3833",
        axis: "#98a7a0",
        tooltipBg: "#1a2220",
        tooltipBorder: "#2d3833",
        tooltipText: "#e4ece7",
        neutral: "#7fa493",
      }
    : {
        ok: "#26745b",
        okFill: "#e7f0e9",
        warn: "#c98a3c",
        warnFill: "#faefdc",
        grid: "#e7ede9",
        axis: "#64736c",
        tooltipBg: "#ffffff",
        tooltipBorder: "#e1e7e2",
        tooltipText: "#223a31",
        neutral: "#a9bd9a",
      };
}
