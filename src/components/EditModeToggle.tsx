/**
 * EditModeToggle.tsx - "Edit Mode" On/Off Button
 *
 * A persistent circular icon button, fixed bottom-right, sitting at
 * `bottom-[136px]` - one corner-slot further UP than ResetButton.tsx's own
 * `bottom-20` (80px). ResetButton is `h-11` (44px), so at `bottom-20` its
 * own top edge sits at 80+44=124px from the bottom; `bottom-[136px]`
 * leaves the same clean ~12px gap ResetButton/ThemeToggle.tsx already use
 * between each other, rather than touching. Top-to-bottom the corner stack
 * reads: this button, ResetButton, ThemeToggle.
 *
 * Unlike ResetButton (purely presentational/controlled - its `resetAll`
 * is page-specific canvas-reset logic), this reads `useEditMode()`
 * directly, the same way ThemeToggle.tsx reads `useTheme()` - there's no
 * per-page variation to inject, `isEditMode` is a single global flag (see
 * EditModeContext.tsx's own top-of-file comment for why), so every page
 * that renders this button can do so with no props at all.
 *
 * ACTIVE STATE: filled indigo background (matching the app's one
 * consistent primary-action color - Layout.tsx's + button, AddEntryForm's
 * CTAs) plus `aria-pressed` while on, instead of just swapping the icon
 * like ThemeToggle does - Edit Mode changes what clicking ANYWHERE on the
 * canvas does, a much bigger behavior change than a color theme, so it
 * needs a harder-to-miss "this is currently active" signal than an icon
 * swap alone would give. Each page also shows a text banner in its
 * VizPageHeader subtitle while active - see e.g. Constellation.tsx's own
 * `subtitle` prop - as a second, harder-to-miss confirmation beyond this
 * corner button alone.
 */

import { useEditMode } from '../context/EditModeContext';

export default function EditModeToggle() {
  const { isEditMode, toggleEditMode } = useEditMode();

  return (
    <button
      onClick={toggleEditMode}
      aria-pressed={isEditMode}
      // z-40: same layer as ResetButton/ThemeToggle - above a canvas
      // (z-0) and the header stack (z-10), below the AddEntryForm modal
      // (z-50). bottom-[136px]: see the header comment above.
      className={`fixed bottom-[136px] right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-color)] ${
        isEditMode
          ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700'
          : 'border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] text-[var(--text-color)] hover:bg-[var(--chrome-hover-bg-color)]'
      }`}
      aria-label={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      title={
        isEditMode
          ? 'Exit Edit Mode'
          : 'Enter Edit Mode - click any entry to edit it'
      }
    >
      {/* Pencil icon - same path EntryPanel.tsx's own edit button uses. */}
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
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
        />
      </svg>
    </button>
  );
}
