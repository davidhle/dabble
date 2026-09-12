/**
 * ThemeToggle.tsx - Light/Dark Theme Toggle Button
 *
 * A persistent circular icon button, fixed bottom-right, stacked directly
 * ABOVE ResetButton.tsx in that same corner (`bottom-20` here vs.
 * ResetButton's `bottom-6` - ResetButton is `h-11` at `bottom-6`, i.e. its
 * own top edge sits at 24+44=68px from the bottom, so `bottom-20` (80px)
 * leaves a clean ~12px gap between the two rather than touching). Same
 * `right-6`, same `h-11 w-11` circular footprint, and the same "floating
 * chrome" visual language (opaque panel surface, translucent border,
 * backdrop blur, shadow) ResetButton/ResetToast/TimeRangeSelector already
 * use - see useTheme.ts for the actual theme-switching state this renders.
 *
 * Rendered from Layout.tsx (not per-page like ResetButton, which only
 * three of five pages render) so the toggle itself is available
 * everywhere, including Home/About - a user shouldn't need to be on a
 * visualization page to switch themes.
 */

import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      onClick={toggleTheme}
      // Same z-40 tier as ResetButton/ResetToast/TimeRangeSelector - above
      // a canvas (z-0) and the header stack (z-10), below the
      // AddEntryForm modal (z-50). bottom-20: see the header comment above
      // for why this sits exactly 12px above ResetButton's own bottom-6.
      className="fixed bottom-20 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] text-[var(--text-color)] shadow-lg backdrop-blur transition-colors hover:bg-[var(--chrome-hover-bg-color)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-color)]"
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      {isLight ? (
        // Moon icon - shown while light is active, offering to switch to dark.
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          />
        </svg>
      ) : (
        // Sun icon - shown while dark is active, offering to switch to light.
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx={12} cy={12} r={4} />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      )}
    </button>
  );
}
