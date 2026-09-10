/**
 * useEntrySelection.ts - Shared Selection/Filter/Sort State For Viz Pages
 *
 * ──────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH ACROSS ALL THREE VISUALIZATION PAGES
 * ──────────────────────────────────────────────────────────────────────
 * Constellation (StarMap), Timeline (LinearTimeline), and Spiral
 * (SpiralTimeline) all show the same underlying `entries` array through a
 * different lens, but need IDENTICAL surrounding behavior: which entries
 * have a sidebar panel open (and whether that panel is expanded or
 * minimized), which categories are filtered to normal opacity vs. dimmed,
 * how the open panels are currently arranged (by date or by category),
 * and the two-press-Escape "clear everything" reset.
 *
 * This hook is THE place that state and logic lives now. It used to be
 * copy-pasted (or, for Timeline/Spiral, simply missing) per page - see
 * Constellation.tsx's git history for the original inline version this
 * was extracted from. Every page that renders a sidebar panel stack
 * (SidebarPanelStack.tsx) should get its `selectedEntries` /
 * `categoryGroups` from here, every page that renders <FilterBar> should
 * get `sortMode`/`filterCategories` (and their handlers) from here, and
 * every page with a <ResetButton>/<ResetToast> pair should get
 * `resetPending`/`resetAll` from here. A page should never re-implement
 * any piece of this locally - if a page needs new selection/filter/sort
 * behavior, it belongs here, not duplicated per page.
 *
 * WHAT DELIBERATELY IS NOT HERE: pan/zoom. Each canvas (StarMap,
 * LinearTimeline, SpiralTimeline) owns its own zoom transform and its own
 * "reset the view" animation - that's canvas-specific rendering state,
 * not selection state, and different canvases even reset to different
 * things (StarMap resets to `d3.zoomIdentity`; a future canvas might not
 * use d3-zoom at all). What THIS hook owns is only the "did a full reset
 * just happen" signal - see `onFullReset` below - so a page can hook its
 * own canvas-specific pan/zoom reset into the same two-press Escape flow
 * without that flow needing to know anything about zoom transforms.
 *
 * ──────────────────────────────────────────────────────────────────────
 * PANEL STACK: SORT ORDER, EXPAND/MINIMIZE, AND THE "OPENED" HIGHLIGHT
 * ──────────────────────────────────────────────────────────────────────
 * `selectedEntries` holds `{ entry, expanded }` pairs, always kept sorted
 * newest-first by `entry.timestamp` (see `insertSortedByTimestampDesc`).
 * That sort only runs when an entry is *added* - toggling which panel is
 * expanded, or removing one, never reorders the rest of the list, so a
 * panel doesn't jump around in the stack just because the user is
 * clicking through it.
 *
 * At most one panel is expanded at a time: opening a new entry, or
 * re-clicking/re-selecting an already-open one, expands that entry and
 * collapses every other one. This mirrors a lot of "accordion" UIs and
 * keeps the sidebar from growing unboundedly tall as more entries are
 * opened - only the panel currently being looked at takes up full space,
 * the rest collapse to compact rows (see EntryPanel.tsx).
 *
 * `openedEntryIds` (for a canvas's highlight ring/glow around "opened"
 * items, e.g. StarMap's stars) is *every* id in `selectedEntries`,
 * expanded or not - "opened" means "has a panel in the sidebar at all",
 * not "is currently expanded". It's derived with `useMemo` rather than
 * tracked as separate state, so it can never drift out of sync with
 * `selectedEntries` itself.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CLICK OUTCOMES: OPEN NEW / EXPAND MINIMIZED / DESELECT EXPANDED
 * ──────────────────────────────────────────────────────────────────────
 * `handleEntryClick` is what every canvas's click handler calls - StarMap's
 * star `onClick` and LinearTimeline's point/capsule `onClick` both forward
 * straight to this ONE function (see their own files' comments) rather
 * than each maintaining its own copy of this branching logic, which is
 * what used to happen: this three-way decision originally lived only in
 * StarMap.tsx (as a local `handleStarClick` wrapper around a separately
 * passed `onStarDeselect` prop), so LinearTimeline had no equivalent
 * "click the already-open one again to close it" behavior until this was
 * generalized here. What a click means depends entirely on that entry's
 * CURRENT state in `selectedEntries`, checked in one atomic
 * `setSelectedEntries` update (not read from a separately-computed
 * `expandedEntryId` closure the way StarMap's old version did, so there's
 * no risk of acting on a stale value):
 *
 *   1. Not in `selectedEntries` at all -> open it: same as before - collapse
 *      every existing panel, insert this one (expanded) back into
 *      chronological order.
 *   2. In `selectedEntries` but minimized (not the expanded one) -> expand
 *      it: switch which panel is expanded, collapsing the rest. No
 *      duplicate, no reorder.
 *   3. In `selectedEntries` AND ALREADY the expanded one -> deselect it:
 *      clicking an entry that's already front-and-center is read as
 *      "close this," not "reopen this," so its panel is removed entirely
 *      - the same outcome as its × close button (`handleClosePanel`).
 *
 * Cases 1 and 2 both result in the entry becoming (or staying) the
 * expanded panel, so a canvas's own recenter effect (StarMap's
 * CLICK-TO-CENTER, LinearTimeline's AUTO-RECENTER) should pan to it. Case
 * 3 is a close, not an open, so it must NOT trigger that pan - both
 * effects are keyed on `expandedEntryId` itself (not called from
 * `handleEntryClick` directly), and a deselect sets `expandedEntryId`
 * back to `null` (nothing becomes newly expanded), so their own
 * `!expandedEntryId` guards already skip the pan for free - see either
 * effect's own comment for the full reasoning.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SORT MODE: REORGANIZING, NOT FILTERING
 * ──────────────────────────────────────────────────────────────────────
 * `sortMode` ('date' | 'category') controls how `selectedEntries` is
 * *presented* - grouped under colored category headers, or as one flat
 * newest-first list - via `categoryGroups` below. It never touches
 * `selectedEntries` itself: every entry that's open stays open, and its
 * expanded/minimized state is unaffected, when the mode is switched.
 *
 * This is deliberately unlike a *filter*: a filter changes which panels
 * are visible at all - it can make a panel disappear. This sort toggle
 * only changes how the still-fully-visible set of panels is arranged on
 * screen. Filtering (below) composes with this - filter first, then
 * apply whichever sort mode to what's left.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CATEGORY FILTER: DIMS, NEVER TOUCHES THE SIDEBAR
 * ──────────────────────────────────────────────────────────────────────
 * `filterCategories` is the set of category ids currently "active" -
 * defaults to *all* of them, i.e. nothing filtered out. A canvas uses it
 * to dim (not remove) any entry whose activityType isn't in the set - see
 * the comment above `stars.map()` in StarMap.tsx for why "dim, don't
 * remove" matters (an opened item's highlight should stay visible, just
 * dimmed, even while filtered out).
 *
 * Crucially, `filterCategories` is completely independent of
 * `selectedEntries`: filtering a category out never closes, removes, or
 * even collapses that category's sidebar panels. The sidebar and a
 * canvas's own filtered rendering are two separate views over the same
 * data - a panel you opened stays open (and its canvas highlight stays)
 * even if you then filter its category out entirely.
 *
 * ──────────────────────────────────────────────────────────────────────
 * ESCAPE KEY: COLLAPSE THE EXPANDED PANEL, OR TWO-PRESS FULL RESET
 * ──────────────────────────────────────────────────────────────────────
 * Escape means one of two very different things depending on whether a
 * panel is currently expanded:
 *
 *   - A panel IS expanded: Escape just collapses it back to minimized -
 *     immediate, no confirmation, since it's trivially undone by
 *     re-expanding the same panel.
 *   - NO panel is expanded: Escape instead drives a destructive "full
 *     reset" - every open panel, the category filter, AND the sort mode
 *     get cleared/reset at once (plus, via `onFullReset`, whatever a
 *     canvas-specific pan/zoom reset the calling page wired up). That's
 *     too easy to trigger by accident (Escape is an easy key to hit
 *     reflexively) to fire on a single press, so it's gated behind a
 *     TWO-PRESS CONFIRMATION instead of a blocking modal:
 *       1. First Escape press while nothing is armed: arm `resetPending`
 *          (a page renders this via <ResetToast>) and start a timer.
 *          This press does NOT reset anything by itself.
 *       2. Second Escape press while `resetPending` is still true:
 *          treated as confirmation - perform the actual reset and
 *          disarm.
 *     If the second press doesn't come before the timer fires, the
 *     arming just silently expires (`resetPending` -> false) rather than
 *     resetting. Every other handler below calls `cancelResetPending()`
 *     as its first action, so any OTHER interaction disarms a pending
 *     reset early too - without that, a stray Escape days- or
 *     minutes-later, arriving after the user has moved on to doing
 *     something else entirely, could land on a still-armed
 *     `resetPending` left over from an unrelated earlier press and reset
 *     the view out from under them unexpectedly.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Entry } from '../types/Entry';
import { Category } from '../types/Category';
import { SortMode } from '../components/FilterBar';

export interface SelectedEntry {
  entry: Entry;
  expanded: boolean;
}

export interface CategoryGroup {
  category: Category;
  entries: SelectedEntry[];
}

interface UseEntrySelectionOptions {
  /** The current dynamic category list - see utils/categories.ts. */
  categories: Category[];
  /**
   * Called whenever a full reset actually fires (Escape's second press,
   * or a page's <ResetButton>), IN ADDITION to this hook clearing its own
   * state - a page uses this to also reset its own canvas-specific
   * pan/zoom, without that logic living in this hook. See the top-of-file
   * comment for why pan/zoom is deliberately excluded from here.
   */
  onFullReset?: () => void;
}

export interface UseEntrySelectionResult {
  selectedEntries: SelectedEntry[];
  /** Every id currently represented by a sidebar panel, expanded or not. */
  openedEntryIds: string[];
  /** The single entry (if any) whose panel is currently expanded. */
  expandedEntryId: string | null;
  /**
   * The single shared click handler for every canvas - see the CLICK
   * OUTCOMES comment above: opens a new entry (expanded), re-expands an
   * already-open minimized one, or deselects (closes) an entry that's
   * already the expanded one.
   */
  handleEntryClick: (entry: Entry) => void;
  /** Expands an already-open (currently minimized) panel by id. */
  handleExpandPanel: (entryId: string) => void;
  /** Removes an entry's panel entirely. */
  handleClosePanel: (entryId: string) => void;
  sortMode: SortMode;
  handleSortModeChange: (mode: SortMode) => void;
  /** `selectedEntries` bucketed by category, for 'category' sort mode. */
  categoryGroups: CategoryGroup[];
  filterCategories: string[];
  handleToggleFilterCategory: (category: string) => void;
  handleResetFilters: () => void;
  hasSelection: boolean;
  /** True while a first Escape press is armed, awaiting confirmation. */
  resetPending: boolean;
  /** Immediate full reset - no confirmation step (used by <ResetButton>). */
  resetAll: () => void;
}

/**
 * Inserts `selectedEntry` into `list` and returns a new array sorted
 * newest-first by timestamp. Used only when a *new* entry is opened - see
 * the PANEL STACK comment above for why toggling/closing never re-sorts.
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

export function useEntrySelection({
  categories,
  onFullReset,
}: UseEntrySelectionOptions): UseEntrySelectionResult {
  // The sidebar's panel stack - see the PANEL STACK comment above for the
  // sort-order and expand/collapse rules this state follows.
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);

  // How the (unchanged) panel stack is currently arranged - see the
  // SORT MODE comment above for why this never removes/hides a panel.
  const [sortMode, setSortMode] = useState<SortMode>('date');

  // Which category ids are currently active (visible at normal opacity)
  // on the canvas - see the CATEGORY FILTER comment above. Starts with
  // every category active, i.e. nothing filtered out.
  const [filterCategories, setFilterCategories] = useState<string[]>(() =>
    categories.map(category => category.id)
  );

  // Keeps a newly-appeared category (a fresh "+ Add new category" in
  // AddEntryForm) active by default, without clobbering any categories
  // the user has already toggled off. Runs off `categories` rather than
  // `entries` directly so it only fires when the category list itself
  // actually grows.
  useEffect(() => {
    setFilterCategories(prev => {
      const known = new Set(prev);
      const newIds = categories
        .map(category => category.id)
        .filter(id => !known.has(id));
      return newIds.length > 0 ? [...prev, ...newIds] : prev;
    });
  }, [categories]);

  // See the ESCAPE KEY comment above for the two-press confirmation
  // pattern `resetPending` drives.
  const [resetPending, setResetPending] = useState(false);
  const resetPendingTimeoutRef = useRef<number | null>(null);

  const cancelResetPending = () => {
    if (resetPendingTimeoutRef.current !== null) {
      window.clearTimeout(resetPendingTimeoutRef.current);
      resetPendingTimeoutRef.current = null;
    }
    setResetPending(false);
  };

  // The actual full reset - clears the sidebar's panel stack, the
  // category filter, and the sort mode; NOT pan/zoom (see `onFullReset`
  // and the top-of-file comment for why that stays canvas-specific).
  // Shared by both triggers that can cause a full reset: the Escape key's
  // two-press confirmation flow below, and a page's <ResetButton> onClick,
  // which skips `resetPending` entirely and calls this directly, since a
  // deliberate click on an always-visible, clearly-labeled button doesn't
  // need the same accidental-press safeguard a bare keypress does.
  const resetAll = () => {
    if (resetPendingTimeoutRef.current !== null) {
      window.clearTimeout(resetPendingTimeoutRef.current);
      resetPendingTimeoutRef.current = null;
    }
    setSelectedEntries([]);
    setFilterCategories(categories.map(category => category.id));
    setSortMode('date');
    setResetPending(false);
    onFullReset?.();
  };

  // Clears any in-flight timer on unmount only (not on every
  // resetPending/expandedEntryId change - the effect below re-attaching
  // its listener isn't a reason to drop a timer that's still legitimately
  // pending), so a late timeout callback can never fire against an
  // unmounted component.
  useEffect(() => {
    return () => {
      if (resetPendingTimeoutRef.current !== null) {
        window.clearTimeout(resetPendingTimeoutRef.current);
      }
    };
  }, []);

  // Implements all three CLICK OUTCOMES described above - the single
  // shared click handler every canvas (StarMap, LinearTimeline) forwards
  // its clicks to, instead of each re-deriving "open new / expand
  // minimized / deselect expanded" from its own copy of this branching.
  const handleEntryClick = (entry: Entry) => {
    cancelResetPending();
    setSelectedEntries(prev => {
      const existing = prev.find(selected => selected.entry.id === entry.id);

      if (existing?.expanded) {
        // Case 3: already open AND already the expanded panel - a
        // reclick on the currently front-and-center entry deselects it
        // (removes its panel entirely), rather than doing nothing or
        // re-expanding it.
        return prev.filter(selected => selected.entry.id !== entry.id);
      }

      if (existing) {
        // Case 2: already in the stack, but minimized - just switch
        // which panel is expanded. No duplicate, no reorder.
        return prev.map(selected => ({
          ...selected,
          expanded: selected.entry.id === entry.id,
        }));
      }

      // Case 1: a newly opened entry - collapse every existing panel,
      // then insert this one (expanded) back into chronological order.
      const collapsedRest = prev.map(selected => ({
        ...selected,
        expanded: false,
      }));
      return insertSortedByTimestampDesc(collapsedRest, {
        entry,
        expanded: true,
      });
    });
  };

  // Also used when a minimized panel row in the sidebar is clicked - same
  // "expand this one, collapse the rest, don't reorder" rule as re-clicking
  // an already-open entry.
  const handleExpandPanel = (entryId: string) => {
    cancelResetPending();
    setSelectedEntries(prev =>
      prev.map(selected => ({
        ...selected,
        expanded: selected.entry.id === entryId,
      }))
    );
  };

  const handleClosePanel = (entryId: string) => {
    cancelResetPending();
    setSelectedEntries(prev =>
      prev.filter(selected => selected.entry.id !== entryId)
    );
  };

  const handleToggleFilterCategory = (category: string) => {
    cancelResetPending();
    setFilterCategories(prev =>
      prev.includes(category)
        ? prev.filter(active => active !== category)
        : [...prev, category]
    );
  };

  const handleResetFilters = () => {
    cancelResetPending();
    setFilterCategories(categories.map(category => category.id));
  };

  const handleSortModeChange = (mode: SortMode) => {
    cancelResetPending();
    setSortMode(mode);
  };

  const openedEntryIds = useMemo(
    () => selectedEntries.map(selected => selected.entry.id),
    [selectedEntries]
  );

  const expandedEntryId = useMemo(
    () => selectedEntries.find(selected => selected.expanded)?.entry.id ?? null,
    [selectedEntries]
  );

  // The actual Escape-key listener - see the ESCAPE KEY comment above for
  // the two-press confirmation pattern this implements. Declared here
  // (rather than up next to `resetPending`) because it closes over
  // `expandedEntryId`/`resetAll`, which aren't defined until above this
  // point.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (expandedEntryId) {
        // Unchanged "closes expanded panel" behavior - just collapse it,
        // no confirmation flow involved.
        setSelectedEntries(prev =>
          prev.map(selected => ({ ...selected, expanded: false }))
        );
        return;
      }

      if (!resetPending) {
        // First press: arm, don't reset yet.
        setResetPending(true);
        resetPendingTimeoutRef.current = window.setTimeout(() => {
          resetPendingTimeoutRef.current = null;
          setResetPending(false);
        }, 3500);
        return;
      }

      // Second press while armed: this is the confirmation - do the
      // actual full reset.
      resetAll();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEntryId, resetPending]);

  // `selectedEntries` -> one bucket per activityType, for 'category' sort
  // mode. Buckets are populated by scanning `selectedEntries` in its
  // existing newest-first order, so each bucket comes out newest-first
  // too, with no separate per-group sort needed. Only non-empty buckets
  // are kept, then ordered alphabetically by label (per spec, "for now" -
  // a fixed/custom category order could replace this later).
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

  return {
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
  };
}
