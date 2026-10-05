/**
 * SettingsContext.tsx - App-Wide User Preferences (currently: Animations)
 *
 * Mounted in App.tsx above the router (outermost provider), alongside
 * TimeRangeProvider/EntrySelectionProvider/EditModeProvider, so a
 * preference survives route changes and every page/canvas reads the same
 * value. Edited from SettingsModal.tsx's "Display" section.
 *
 * ──────────────────────────────────────────────────────────────────────
 * ANIMATIONS: USER CHOICE > OS PREFERENCE > ON
 * ──────────────────────────────────────────────────────────────────────
 * `animationsEnabled` is resolved as:
 *   1. The user's explicit choice, if they've ever toggled it (persisted
 *      under ANIMATIONS_STORAGE_KEY as 'on'/'off').
 *   2. Otherwise, the OS `prefers-reduced-motion` setting - followed LIVE
 *      (a `change` listener), so flipping the OS setting applies without
 *      a reload, for as long as the user hasn't chosen.
 *   3. Otherwise, on.
 * Once the user toggles, step 1 wins permanently - an explicit "on" even
 * overrides an OS reduce-motion preference.
 *
 * This is the ONLY place in the app that reads `prefers-reduced-motion`.
 * Everything that animates reads the resolved value through
 * hooks/useMotionEnabled.ts instead; CSS transitions are covered by the
 * `data-animations` attribute this provider sets on <html> (see the
 * ANIMATIONS OFF rule in index.css).
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

/** localStorage key for the explicit Animations choice - absent until the user first toggles it. */
export const ANIMATIONS_STORAGE_KEY = 'dabble-animations';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function loadStoredAnimations(): boolean | null {
  try {
    const stored = localStorage.getItem(ANIMATIONS_STORAGE_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    // Storage unavailable - fall through to the OS preference.
  }
  return null;
}

function osPrefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

interface SettingsContextValue {
  /** The effective value - see ANIMATIONS: USER CHOICE > OS PREFERENCE > ON. */
  animationsEnabled: boolean;
  /** Records an explicit choice, which from then on overrides the OS preference. */
  setAnimationsEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [storedChoice, setStoredChoice] = useState<boolean | null>(() =>
    loadStoredAnimations()
  );
  const [osReducedMotion, setOsReducedMotion] = useState(() =>
    osPrefersReducedMotion()
  );

  // Follow the OS setting live - only matters while there's no explicit
  // choice, but cheap enough to always keep current.
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!query) return;
    const update = () => setOsReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const animationsEnabled = storedChoice ?? !osReducedMotion;

  // Global CSS safety net (index.css's ANIMATIONS OFF rule). Layout effect
  // so the attribute is in place before the first paint - otherwise CSS
  // transitions could still play once on load.
  useLayoutEffect(() => {
    document.documentElement.setAttribute(
      'data-animations',
      animationsEnabled ? 'on' : 'off'
    );
  }, [animationsEnabled]);

  const setAnimationsEnabled = useCallback((enabled: boolean) => {
    setStoredChoice(enabled);
    try {
      localStorage.setItem(ANIMATIONS_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Storage unavailable - the choice still applies for this session.
    }
  }, []);

  const value = useMemo(
    () => ({ animationsEnabled, setAnimationsEnabled }),
    [animationsEnabled, setAnimationsEnabled]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Reads the shared settings - throws outside `SettingsProvider`, the same
 * fail-fast pattern as useEditMode/useTimeRange.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
