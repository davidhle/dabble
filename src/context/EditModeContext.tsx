/**
 * EditModeContext.tsx - Shared, Cross-Page "Edit Mode" Click Override
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS IS A GLOBAL CLICK-BEHAVIOR OVERRIDE, NOT A PER-VIEW SETTING
 * ──────────────────────────────────────────────────────────────────────
 * Edit Mode isn't a StarMap feature, a LinearTimeline feature, or a
 * SpiralTimeline feature - it's a temporary re-interpretation of what
 * clicking ANY entry means ("open it in the editor" instead of "select
 * it"), and that re-interpretation is a property of the user's current
 * intent, not of whichever visualization happens to be on screen. A user
 * who flips Edit Mode on while looking at Constellation, then hops over to
 * Timeline to find a specific entry to fix a typo on, still wants that
 * same click-to-edit behavior there too - re-enabling it per page would
 * turn one mental mode into three separate settings to keep track of, for
 * no actual benefit (nothing about editing is Constellation-specific vs.
 * Timeline-specific). This is exactly the same reasoning
 * TimeRangeContext.tsx's `selectedRange` and EntrySelectionContext.tsx's
 * `selectedEntries`/filters are already global for - see those files' own
 * top-of-file comments.
 *
 * WHY THIS LIVES ABOVE THE ROUTER, NOT INSIDE A PAGE
 * Mounted in App.tsx wrapping `<HashRouter>`, alongside TimeRangeProvider
 * and EntrySelectionProvider - a provider wrapping the router never
 * unmounts when routes change (only the router's own children do), so
 * `isEditMode` survives navigating between Constellation/Timeline/Spiral
 * instead of silently resetting to off every time, the same way
 * `selectedRange`/`selectedEntries` already do.
 *
 * WHAT THIS DOESN'T OWN:
 * Just the boolean flag and its toggle. The actual click-handling branch
 * ("if isEditMode, open the editor instead of selecting") lives in each
 * page (Constellation.tsx/Timeline.tsx/Spiral.tsx), composed around the
 * same `handleEntryClick`/`onEditEntry` those pages already have - see
 * each page's own `handleCanvasEntryClick` comment. StarMap.tsx,
 * LinearTimeline.tsx, and SpiralTimeline.tsx stay unaware Edit Mode
 * exists at all: they still just call whichever single click callback
 * they're handed, exactly as before - keeping that "dumb canvas, smart
 * page" split intact rather than teaching all three canvases a new
 * concept.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

interface EditModeContextValue {
  /** Whether clicking an entry (star/point/capsule/arc) should open its editor instead of selecting it. */
  isEditMode: boolean;
  /** Flips `isEditMode` - wired to EditModeToggle.tsx's button. */
  toggleEditMode: () => void;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);

  // Stable across renders (empty deps - only ever touches a setState
  // setter) so the memoized `value` below only changes identity when
  // `isEditMode` itself actually changes, not on every provider render.
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  const value = useMemo(
    () => ({ isEditMode, toggleEditMode }),
    [isEditMode, toggleEditMode]
  );

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

/**
 * Reads the shared Edit Mode flag - throws if used outside
 * `EditModeProvider` (see App.tsx for where it's mounted), the same
 * fail-fast pattern useTimeRange/useEntrySelectionContext use rather than
 * silently defaulting to "off".
 */
// A context file exporting both its Provider component and the hook that
// reads it is the standard React pattern - see TimeRangeContext.tsx's
// identical eslint-disable comment on its own `useTimeRange`.
// eslint-disable-next-line react-refresh/only-export-components
export function useEditMode(): EditModeContextValue {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
}
