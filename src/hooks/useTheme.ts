/**
 * useTheme.ts - Light/Dark Theme State, Persisted To localStorage
 *
 * Owns the single source of truth for which theme is active - 'dark' or
 * 'light' - and keeps three things in sync with it:
 *
 *   1. The `data-theme` attribute on <html> (`document.documentElement`),
 *      which is what index.css's `:root[data-theme="light"]` selector
 *      actually matches against - see its own THEME TOKENS comment. Dark
 *      is the bare `:root` default (no attribute needed), so this only
 *      ever sets/removes `data-theme="light"` rather than writing both
 *      values - see the effect below.
 *   2. localStorage, under THEME_STORAGE_KEY, so the choice survives a
 *      refresh - read back via the lazy `useState` initializer below,
 *      the same pattern App.tsx's own `entries` state uses for
 *      `loadEntries()`.
 *   3. Nothing else - this hook renders nothing and has no other side
 *      effects; ThemeToggle.tsx is the only consumer, calling `toggleTheme`
 *      from a single fixed-position icon button (see its own comment for
 *      why it's positioned directly above ResetButton.tsx).
 *
 * DEFAULT: 'dark' when no preference has been saved yet - dark ("night
 * sky") has been the app's primary designed experience so far (see
 * index.css's own THEME TOKENS comment), so a first-time visitor should
 * land there rather than on the newer light theme.
 */

import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

/** localStorage key the chosen theme is persisted under - same naming convention as entriesStorage.ts's ENTRIES_STORAGE_KEY. */
export const THEME_STORAGE_KEY = 'dabble-theme';

function loadStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => loadStoredTheme());

  useEffect(() => {
    // See the header comment above: dark is the attribute-less default,
    // so 'light' is the only value this ever needs to write.
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(current => (current === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme };
}
