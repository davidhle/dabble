/**
 * EntrySelectionContext.tsx - Shared, Cross-Page Selection/Filter/Sort State
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS LIVES ABOVE THE ROUTER, ALONGSIDE TimeRangeContext
 * ──────────────────────────────────────────────────────────────────────
 * This used to be a plain hook (useEntrySelection.ts) called separately by
 * each of Constellation.tsx, Timeline.tsx, and Spiral.tsx - each call
 * created its OWN `useState` for selectedEntries/filterCategories/
 * sortMode/resetPending, scoped to that page component's own lifetime.
 * Since React Router unmounts a page's component tree when the route
 * changes away from it, that state was silently thrown away on every
 * navigation: expanding an entry on Constellation, then clicking over to
 * Spiral, used to land on Spiral with an empty sidebar and no memory that
 * anything had ever been opened - exactly the same "state resets on
 * navigation" problem TimeRangeContext.tsx's own top-of-file comment
 * describes for `selectedRange`, solved here the identical way: state
 * that needs to SURVIVE navigation has to live in a component that ISN'T
 * a child of the router, so it never unmounts just because the router's
 * children do.
 *
 * `EntrySelectionProvider` is mounted in App.tsx wrapping `<HashRouter>`,
 * a sibling of (and structured exactly like) `TimeRangeProvider` - see
 * App.tsx's own comment for the resulting tree. It's handed the SAME
 * top-level `entries` state App.tsx already owns (again mirroring
 * TimeRangeProvider), which is all it needs to derive its own `categories`
 * list internally (see `categories` below) - callers no longer pass
 * `categories` into `useEntrySelection` themselves, since the state that
 * needs it now lives up here rather than in each page - see that hook's
 * own file for the resulting, slightly narrower options shape.
 *
 * `useEntrySelection` (still exported from '../hooks/useEntrySelection',
 * same import path as before) is now a THIN hook that reads this context
 * rather than owning any state itself - every existing consumer of its
 * RETURN VALUE (StarMap, LinearTimeline, SpiralTimeline, FilterBar,
 * SidebarPanelStack, ResetButton, ResetToast) needed no changes at all,
 * since the shape of what the hook returns is unchanged; only
 * Constellation/Timeline/Spiral (the CALLERS) needed the small
 * `categories`-argument adjustment mentioned above.
 *
 * ──────────────────────────────────────────────────────────────────────
 * onFullReset STAYS PAGE-SPECIFIC, EVEN THOUGH THE STATE IT CLEARS IS NOW
 * SHARED
 * ──────────────────────────────────────────────────────────────────────
 * A full reset (Escape's second press, or a page's <ResetButton>) needs
 * to reset TWO different kinds of things: the shared selection/filter/
 * sort state this file owns (the same regardless of which page triggered
 * it), AND whatever canvas-specific pan/zoom transform the CURRENTLY
 * MOUNTED page happens to own (StarMap's, LinearTimeline's, or
 * SpiralTimeline's own zoom identity/translateExtent reset - see this
 * file's original hook-only version's top-of-file comment for why that's
 * deliberately NOT part of this shared state: different canvases reset to
 * different things, and a canvas's own zoom transform isn't "selection"
 * state at all). Since only one page is ever mounted at a time,
 * `resetAll` below can't just call one fixed function - it calls whatever
 * the CURRENTLY MOUNTED page most recently registered via
 * `setPageFullResetHandler` (called internally by useEntrySelection.ts's
 * own effect, keyed on mount/unmount, so navigating away always
 * unregisters the outgoing page's handler before the incoming page
 * registers its own - there's never a stale handler left pointing at an
 * unmounted canvas).
 *
 * ──────────────────────────────────────────────────────────────────────
 * RECENTERING ON MOUNT: HANDLED BY EACH CANVAS'S EXISTING RECENTER
 * EFFECT, NOT HERE
 * ──────────────────────────────────────────────────────────────────────
 * Now that `expandedEntryId` can already be non-null the very FIRST time
 * a canvas (StarMap, LinearTimeline, SpiralTimeline) mounts - e.g. the
 * user expanded an entry on Constellation, then navigated to Spiral -
 * each canvas needs to pan/center itself onto that same entry
 * immediately on mount, not only in response to a later click. This
 * context does nothing special to make that happen: each canvas's OWN
 * existing recenter effect (StarMap's/SpiralTimeline's CLICK-TO-CENTER,
 * LinearTimeline's AUTO-RECENTER) is already a `useEffect` keyed on
 * `expandedEntryId` itself, and a `useEffect`'s dependency list runs
 * unconditionally on mount (there's no "previous value" to diff against
 * yet) - so if `expandedEntryId` is already truthy the moment a canvas
 * mounts, its existing recenter effect fires immediately, using the exact
 * same pan/zoom math it already uses for a live click. No separate
 * "is this a mount or a click" branch needed anywhere, and no new prop or
 * signal is threaded through this context for it.
 *
 * The one thing each canvas needed to get right for this to actually
 * work is not depending on any measurement (canvas size, spiral geometry)
 * that's still {0,0} the FIRST time that effect body runs.
 * LinearTimeline/SpiralTimeline already measured their size via
 * `useLayoutEffect` (synchronously corrected before ANY passive effect,
 * including their own recenter effect, ever runs against it);
 * StarMap's own responsive-sizing effect has been switched from
 * `useEffect` to `useLayoutEffect` to match (see StarMap.tsx's own
 * "Responsive sizing" comment) - without that, StarMap's CLICK-TO-CENTER
 * effect would run once on mount against a still-{0,0} `size`, silently
 * skip itself via its own zero-size guard, and never get a second chance,
 * since `expandedEntryId` doesn't change again just because `size` is
 * later measured correctly in a following render.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Entry } from '../types/Entry';
import { Category } from '../types/Category';
import { SortMode } from '../components/FilterBar';
import { loadCategories } from '../utils/categories';

export interface SelectedEntry {
  entry: Entry;
  expanded: boolean;
}

export interface CategoryGroup {
  category: Category;
  entries: SelectedEntry[];
}

export interface EntrySelectionContextValue {
  selectedEntries: SelectedEntry[];
  /** Every id currently represented by a sidebar panel, expanded or not. */
  openedEntryIds: string[];
  /** The single entry (if any) whose panel is currently expanded. */
  expandedEntryId: string | null;
  handleEntryClick: (entry: Entry) => void;
  handleExpandPanel: (entryId: string) => void;
  handleClosePanel: (entryId: string) => void;
  sortMode: SortMode;
  handleSortModeChange: (mode: SortMode) => void;
  categoryGroups: CategoryGroup[];
  filterCategories: string[];
  handleToggleFilterCategory: (category: string) => void;
  handleResetFilters: () => void;
  hasSelection: boolean;
  resetPending: boolean;
  resetAll: () => void;
  /**
   * Registers (or, called with `null`, unregisters) the currently mounted
   * page's own canvas-specific full-reset callback - see the top-of-file
   * "onFullReset STAYS PAGE-SPECIFIC" comment. Internal plumbing for
   * useEntrySelection.ts's own effect; pages never call this directly.
   */
  setPageFullResetHandler: (handler: (() => void) | null) => void;
}

const EntrySelectionContext = createContext<EntrySelectionContextValue | null>(
  null
);

/**
 * Inserts `selectedEntry` into `list` and returns a new array sorted
 * newest-first by timestamp. Used only when a *new* entry is opened -
 * toggling which panel is expanded, or removing one, never reorders the
 * rest of the list, so a panel doesn't jump around in the stack just
 * because the user is clicking through it.
 */
function insertSortedByTimestampDesc(
  list: SelectedEntry[],
  selectedEntry: SelectedEntry
): SelectedEntry[] {
  return [...list, selectedEntry].sort(
    (a, b) =>
      new Date(b.entry.timestamp).getTime() -
      new Date(a.entry.timestamp).getTime()
  );
}

interface EntrySelectionProviderProps {
  /**
   * The full, unfiltered entries array (App.tsx's own `entries` state) -
   * used only to derive `categories` (see `loadCategories`), the same
   * computation each page used to run locally before this state moved up
   * here.
   */
  entries: Entry[];
  children: ReactNode;
}

export function EntrySelectionProvider({
  entries,
  children,
}: EntrySelectionProviderProps) {
  // Recomputed whenever entries change, since that's exactly when a new
  // category could have appeared (a fresh "+ Add new category" in
  // AddEntryForm always creates its new entry in the same action) - same
  // reasoning each page's own `categories` useMemo used before this moved
  // here.
  const categories = useMemo(() => loadCategories(), [entries]);

  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [filterCategories, setFilterCategories] = useState<string[]>(() =>
    categories.map(category => category.id)
  );

  // Keeps a newly-appeared category active by default, without clobbering
  // any categories the user has already toggled off.
  useEffect(() => {
    setFilterCategories(prev => {
      const known = new Set(prev);
      const newIds = categories
        .map(category => category.id)
        .filter(id => !known.has(id));
      return newIds.length > 0 ? [...prev, ...newIds] : prev;
    });
  }, [categories]);

  const [resetPending, setResetPending] = useState(false);
  const resetPendingTimeoutRef = useRef<number | null>(null);

  // See the "onFullReset STAYS PAGE-SPECIFIC" comment above - a ref, not
  // state, since registering/unregistering it should never itself cause a
  // re-render.
  const pageFullResetRef = useRef<(() => void) | null>(null);
  const setPageFullResetHandler = useCallback(
    (handler: (() => void) | null) => {
      pageFullResetRef.current = handler;
    },
    []
  );

  const cancelResetPending = useCallback(() => {
    if (resetPendingTimeoutRef.current !== null) {
      window.clearTimeout(resetPendingTimeoutRef.current);
      resetPendingTimeoutRef.current = null;
    }
    setResetPending(false);
  }, []);

  // The actual full reset - clears the sidebar's panel stack, the
  // category filter, and the sort mode, then invokes whatever the
  // CURRENTLY MOUNTED page registered as its own canvas-specific reset -
  // see the "onFullReset STAYS PAGE-SPECIFIC" comment above.
  const resetAll = useCallback(() => {
    if (resetPendingTimeoutRef.current !== null) {
      window.clearTimeout(resetPendingTimeoutRef.current);
      resetPendingTimeoutRef.current = null;
    }
    setSelectedEntries([]);
    setFilterCategories(categories.map(category => category.id));
    setSortMode('date');
    setResetPending(false);
    pageFullResetRef.current?.();
  }, [categories]);

  // Clears any in-flight timer on unmount only.
  useEffect(() => {
    return () => {
      if (resetPendingTimeoutRef.current !== null) {
        window.clearTimeout(resetPendingTimeoutRef.current);
      }
    };
  }, []);

  const handleEntryClick = useCallback(
    (entry: Entry) => {
      cancelResetPending();
      setSelectedEntries(prev => {
        const existing = prev.find(selected => selected.entry.id === entry.id);

        if (existing?.expanded) {
          // Already open AND already the expanded panel - a reclick on
          // the currently front-and-center entry deselects it.
          return prev.filter(selected => selected.entry.id !== entry.id);
        }

        if (existing) {
          // Already in the stack, but minimized - just switch which
          // panel is expanded. No duplicate, no reorder.
          return prev.map(selected => ({
            ...selected,
            expanded: selected.entry.id === entry.id,
          }));
        }

        // A newly opened entry - collapse every existing panel, then
        // insert this one (expanded) back into chronological order.
        const collapsedRest = prev.map(selected => ({
          ...selected,
          expanded: false,
        }));
        return insertSortedByTimestampDesc(collapsedRest, {
          entry,
          expanded: true,
        });
      });
    },
    [cancelResetPending]
  );

  const handleExpandPanel = useCallback(
    (entryId: string) => {
      cancelResetPending();
      setSelectedEntries(prev =>
        prev.map(selected => ({
          ...selected,
          expanded: selected.entry.id === entryId,
        }))
      );
    },
    [cancelResetPending]
  );

  const handleClosePanel = useCallback(
    (entryId: string) => {
      cancelResetPending();
      setSelectedEntries(prev =>
        prev.filter(selected => selected.entry.id !== entryId)
      );
    },
    [cancelResetPending]
  );

  const handleToggleFilterCategory = useCallback(
    (category: string) => {
      cancelResetPending();
      setFilterCategories(prev =>
        prev.includes(category)
          ? prev.filter(active => active !== category)
          : [...prev, category]
      );
    },
    [cancelResetPending]
  );

  const handleResetFilters = useCallback(() => {
    cancelResetPending();
    setFilterCategories(categories.map(category => category.id));
  }, [cancelResetPending, categories]);

  const handleSortModeChange = useCallback(
    (mode: SortMode) => {
      cancelResetPending();
      setSortMode(mode);
    },
    [cancelResetPending]
  );

  const openedEntryIds = useMemo(
    () => selectedEntries.map(selected => selected.entry.id),
    [selectedEntries]
  );

  const expandedEntryId = useMemo(
    () => selectedEntries.find(selected => selected.expanded)?.entry.id ?? null,
    [selectedEntries]
  );

  // The actual Escape-key listener - two-press confirmation for a full
  // reset, immediate collapse for an expanded panel. Declared here
  // (rather than up next to `resetPending`) because it closes over
  // `expandedEntryId`/`resetAll`, which aren't defined until above this
  // point.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (expandedEntryId) {
        setSelectedEntries(prev =>
          prev.map(selected => ({ ...selected, expanded: false }))
        );
        return;
      }

      if (!resetPending) {
        setResetPending(true);
        resetPendingTimeoutRef.current = window.setTimeout(() => {
          resetPendingTimeoutRef.current = null;
          setResetPending(false);
        }, 3500);
        return;
      }

      resetAll();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedEntryId, resetPending, resetAll]);

  // `selectedEntries` -> one bucket per activityType, for 'category' sort
  // mode. Only non-empty buckets are kept, ordered alphabetically by
  // label.
  const categoryGroups = useMemo(() => {
    const buckets = new Map<string, SelectedEntry[]>();
    for (const selected of selectedEntries) {
      const key = selected.entry.activityType;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(selected);
      } else {
        buckets.set(key, [selected]);
      }
    }

    return categories
      .map(category => ({
        category,
        entries: buckets.get(category.id) ?? [],
      }))
      .filter(group => group.entries.length > 0)
      .sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [selectedEntries, categories]);

  const hasSelection = selectedEntries.length > 0;

  // Every handler above is wrapped in `useCallback` with a complete,
  // accurate dependency list (unlike TimeRangeContext.tsx's simpler
  // couple of stable callbacks, this hook has many), which is what makes
  // this dependency list itself complete and safe: each handler's
  // identity only changes when something it actually closes over
  // (`categories`, or `cancelResetPending` itself) changes, so listing
  // them here doesn't cause the context value to be rebuilt - and every
  // consumer relying on it to re-render - on every unrelated render.
  const value = useMemo<EntrySelectionContextValue>(
    () => ({
      selectedEntries,
      openedEntryIds,
      expandedEntryId,
      handleEntryClick,
      handleExpandPanel,
      handleClosePanel,
      sortMode,
      handleSortModeChange,
      categoryGroups,
      filterCategories,
      handleToggleFilterCategory,
      handleResetFilters,
      hasSelection,
      resetPending,
      resetAll,
      setPageFullResetHandler,
    }),
    [
      selectedEntries,
      openedEntryIds,
      expandedEntryId,
      handleEntryClick,
      handleExpandPanel,
      handleClosePanel,
      sortMode,
      handleSortModeChange,
      categoryGroups,
      filterCategories,
      handleToggleFilterCategory,
      handleResetFilters,
      hasSelection,
      resetPending,
      resetAll,
      setPageFullResetHandler,
    ]
  );

  return (
    <EntrySelectionContext.Provider value={value}>
      {children}
    </EntrySelectionContext.Provider>
  );
}

/**
 * Reads the shared selection/filter/sort state - throws if used outside
 * `EntrySelectionProvider` (see App.tsx for where it's mounted), the same
 * fail-fast pattern TimeRangeContext.tsx's `useTimeRange` uses. Not
 * exported for direct use by pages/components - see useEntrySelection.ts,
 * the thin page-facing hook built on top of this, for the actual public
 * API (it additionally handles per-page `onFullReset` registration).
 */
// A context file exporting both its Provider component and the hook that
// reads it is the standard React pattern - see TimeRangeContext.tsx's
// identical eslint-disable comment on its own `useTimeRange`.
// eslint-disable-next-line react-refresh/only-export-components
export function useEntrySelectionContext(): EntrySelectionContextValue {
  const context = useContext(EntrySelectionContext);
  if (!context) {
    throw new Error(
      'useEntrySelectionContext must be used within an EntrySelectionProvider'
    );
  }
  return context;
}
