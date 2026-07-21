import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// 2026-07-21: dark mode toggle (Account/Settings) + system-default, same
// get/set-via-SecureStore shape as lib/sync/last-sync.ts. `preference` is
// what the agent chose ('system' unless they've explicitly overridden it);
// `resolvedTheme` is what actually gets passed to Tamagui's <Theme name=...>
// — the two differ whenever preference is 'system', in which case
// resolvedTheme follows the OS setting live via useColorScheme().

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'oracle_sales_theme_preference';

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_PREFERENCE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
      setLoaded(true);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    // Best-effort — a persistence failure just means the choice doesn't
    // survive an app restart, never blocks the toggle from working now.
    SecureStore.setItemAsync(THEME_PREFERENCE_KEY, next).catch((err) =>
      console.error('[theme-preference] failed to persist:', err instanceof Error ? err.message : String(err))
    );
  }, []);

  const resolvedTheme: ResolvedTheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  );

  // Don't flash the default theme before the persisted preference loads —
  // one extra frame of nothing is preferable to a visible light→dark snap.
  if (!loaded) return null;

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return ctx;
}
