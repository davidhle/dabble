/**
 * Timeline.tsx - Chronological Timeline Page
 *
 * Renders the entries array (lifted in App.tsx, same as Constellation.tsx
 * receives it) as a chronological timeline via LinearTimeline.tsx. This
 * used to render a D3.js bar-chart DEMO (D3Chart.tsx, driven by a
 * "Randomize Data" button over made-up placeholder numbers) that had
 * nothing to do with the app's actual entries - replaced entirely now
 * that there's a real per-entry visualization to show instead. See
 * LinearTimeline.tsx for the empty-state handling (no entries yet) and
 * the D3 scaleTime/axis/zoom implementation.
 *
 * PILOT: FIRST PAGE (AFTER CONSTELLATION) BUILT ON THE SHARED HOOK
 * ──────────────────────────────────────────────────────────────────────
 * This page used to be its own simple thing - a light-mode card
 * (`space-y-6`, LinearTimeline in a bordered box) with no filter/sort
 * controls at all, and clicking a point opened a single read-only
 * <EntryDetailModal> popup. It's now been refactored to match
 * Constellation.tsx's page structure exactly, as a pilot for eventually
 * doing the same to Spiral.tsx:
 *
 *   - Selection/filter/sort state comes from useEntrySelection.ts, the
 *     SAME hook Constellation.tsx uses - see that file's top-of-file
 *     comment for why it's now the single source of truth for this state
 *     across all three visualization pages, rather than being
 *     reimplemented (or, as here, simply absent) per page.
 *   - The title/subtitle block is VizPageHeader.tsx, the same component
 *     Constellation.tsx renders.
 *   - <FilterBar> is the same component and props shape Constellation.tsx
 *     uses - its category toggles actually dim LinearTimeline's
 *     points/ranges now (see LinearTimeline.tsx's `filterCategories`
 *     prop), the same FILTERED_OUT_OPACITY treatment StarMap.tsx gives
 *     its stars.
 *   - Clicking an entry no longer opens EntryDetailModal - it now adds a
 *     panel to SidebarPanelStack.tsx, the SAME sidebar panel stack
 *     component Constellation.tsx uses, via `handleEntryClick` wired to
 *     LinearTimeline's `onEntryClick` prop, mirroring exactly how
 *     Constellation.tsx wires the same handler to StarMap's
 *     `onStarClick`.
 *   - The page layout (full-bleed canvas behind a floating z-10 unified
 *     `.bullet-journal-surface` container - title/subtitle/FilterBar/
 *     sidebar panel stack all ONE container now, measured `containerLayout`/
 *     `topOffset` for its position) matches Constellation.tsx's CSS
 *     approach exactly - see Constellation.tsx's own top-of-file layout
 *     comment for the full reasoning behind each piece, which isn't
 *     re-explained here to avoid the two files' comments drifting out of
 *     sync with each other.
 *
 * STAGE 2: sidebarWidth, openedEntryIds/expandedEntryId, and topOffset
 * ──────────────────────────────────────────────────────────────────────
 * This page now also replicates two more pieces of Constellation.tsx's
 * wiring that a first pass skipped:
 *
 *   - `sidebarWidth` is measured off the unified container's own rendered
 *     DOM node the exact same way Constellation.tsx measures it for
 *     StarMap - LinearTimeline's own AUTO-RECENTER effect (see its header
 *     comment) needs it for the same "exclude the sidebar's band when
 *     centering" math StarMap's CLICK-TO-CENTER effect uses.
 *   - `openedEntryIds`/`expandedEntryId` (both already returned by
 *     useEntrySelection.ts, just not consumed here yet) are passed to
 *     LinearTimeline so it can render the SAME opened-entry highlight
 *     ring/glow StarMap renders for its stars, and drive that same
 *     AUTO-RECENTER effect.
 *   - `topOffset` (this page's own measured header-content bottom edge) is
 *     new - LinearTimeline needs it to vertically center its content
 *     BELOW the header, unlike StarMap's starfield which has no
 *     equivalent vertical exclusion. See LinearTimeline.tsx's VERTICAL
 *     CENTERING comment for why this page-specific need doesn't apply to
 *     StarMap.
 *
 * STAGE 3: TimeRangeContext - a HARD time filter, unlike filterCategories
 * ──────────────────────────────────────────────────────────────────────
 * This page is also the first (only, so far - see TimeRangeContext.tsx's
 * own top-of-file comment on why it's provided app-wide regardless)
 * consumer of TimeRangeContext's `selectedRange`, via
 * TimeRangeSelector.tsx's d3-brush control rendered below LinearTimeline.
 *
 * Deliberately a HARD filter - `timeFilteredEntries` below excludes
 * anything outside `selectedRange` entirely, rather than the
 * dim-don't-remove treatment `filterCategories` gets (see
 * useEntrySelection.ts's CATEGORY FILTER comment for that one's own
 * reasoning). The two aren't the same kind of question: a category
 * toggle asks "of everything that happened, which KINDS do I want to
 * see" - the events not shown still genuinely happened in the visible
 * window, so dimming (rather than hiding) keeps that context legible.
 * `selectedRange` instead asks "which SLICE OF TIME am I looking at right
 * now" - an entry outside that slice isn't a dimmed-down version of
 * what's being viewed, it's simply not part of the window at all, the
 * same way scrolling a calendar to March stops showing February's days
 * rather than rendering them grayed out.
 *
 * `isEntryWithinRange` (utils/entryDateRange.ts) is what decides
 * membership - see its own comment for the overlap-vs-containment
 * distinction for range entries. `timeFilteredEntries` (not `entries`) is
 * what actually reaches LinearTimeline; `categories`/`useEntrySelection`
 * below deliberately keep reading the full, UNfiltered `entries` - the
 * category list and the sidebar's open panels represent the user's whole
 * dataset and their own deliberate choices, neither of which should
 * change just because the visible time window did.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BookmarkRail from '../components/BookmarkRail';
import EditModeBanner from '../components/EditModeBanner';
import EditModeToggle from '../components/EditModeToggle';
import FilterBar from '../components/FilterBar';
import FocusedEntryView from '../components/FocusedEntryView';
import LinearTimeline from '../components/LinearTimeline';
import ResetButton from '../components/ResetButton';
import ResetToast from '../components/ResetToast';
import SidebarPanelStack from '../components/SidebarPanelStack';
import TimeRangeSelector from '../components/TimeRangeSelector';
import VizPageHeader from '../components/VizPageHeader';
import { Entry } from '../types/Entry';
import { loadCategories } from '../utils/categories';
import { isEntryWithinRange } from '../utils/entryDateRange';
import { useEntrySelection } from '../hooks/useEntrySelection';
import { useTimeRange } from '../context/TimeRangeContext';
import { useEditMode } from '../context/EditModeContext';

interface TimelineProps {
  entries: Entry[];
  /** Opens `entry` in the shared AddEntryForm's edit mode - see App.tsx's `editingEntry` state. */
  onEditEntry: (entry: Entry) => void;
  /** App.tsx's `updateEntry` - used by EntryPanel to save reflections. */
  onUpdateEntry: (entry: Entry) => void;
}

export default function Timeline({
  entries,
  onEditEntry,
  onUpdateEntry,
}: TimelineProps) {
  // See the STAGE 3 comment above: `selectedRange` is the shared,
  // cross-page time filter; `timeFilteredEntries` is `entries` hard-cut
  // down to only what's `isEntryWithinRange` of it - this (not `entries`)
  // is what actually reaches LinearTimeline and its AUTO-RECENTER/
  // click-highlight machinery below.
  const { selectedRange, resetToFullRange } = useTimeRange();
  const timeFilteredEntries = useMemo(
    () => entries.filter(entry => isEntryWithinRange(entry, selectedRange)),
    [entries, selectedRange]
  );

  const {
    selectedEntries,
    openedEntryIds,
    expandedEntryId,
    handleEntryClick,
    handleExpandPanel,
    handleClosePanel,
    canUndoFocus,
    handleUndoFocus,
    handleExitFocus,
    sortMode,
    handleSortModeChange,
    categoryGroups,
    filterCategories,
    handleToggleFilterCategory,
    handleResetFilters,
    hasSelection,
    resetPending,
    resetAll,
    categoriesVersion,
  } = useEntrySelection({
    // `categories` is no longer passed here - see Constellation.tsx's
    // identical comment: the shared EntrySelectionProvider (App.tsx) now
    // derives its own categories from `entries` directly.
    //
    // RESET INCLUDES THE BRUSH: the hook's own `resetAll` (fired by the
    // bottom-right ResetButton, or Escape's second press - see
    // useEntrySelection.ts's ESCAPE KEY comment) already clears the panel
    // stack/category filter/sort mode; `onFullReset` is its hook for
    // whatever ELSE a page wants a full reset to also cover -
    // Constellation.tsx uses it to reset StarMap's pan/zoom, and this page
    // uses the exact same hook to put TimeRangeSelector's brush back to
    // `fullRange` too, via TimeRangeContext's `resetToFullRange` (not
    // `setSelectedRange` - see that function's own comment for why the
    // distinction matters for a FULL reset specifically). Since
    // TimeRangeSelector's own SYNC EFFECT already reacts to
    // `selectedRange` changing from outside a drag, the brush's handles
    // visually snap back to the full track automatically - nothing else
    // needs to be wired up for "the brush visually resets too."
    onFullReset: resetToFullRange,
  });

  // The dynamic category list - see Constellation.tsx's identical
  // `categories` useMemo (including the `categoriesVersion` dependency's
  // own comment there) for why this is recomputed off both `entries` and
  // `categoriesVersion`. Reads the full `entries`, not `timeFilteredEntries`
  // below - see the STAGE 3 comment above for why the category list
  // shouldn't shrink just because the visible time window did.
  const categories = useMemo(
    () => loadCategories(),
    [entries, categoriesVersion]
  );

  const { isEditMode } = useEditMode();

  /**
   * Composes LinearTimeline's single `onEntryClick` callback around the
   * shared `isEditMode` flag - see EditModeContext.tsx's top-of-file "WHY
   * THIS IS A GLOBAL CLICK-BEHAVIOR OVERRIDE" comment for why this branch
   * lives here (in the page) rather than inside LinearTimeline.tsx itself,
   * and Constellation.tsx's identical `handleCanvasEntryClick` for the
   * full reasoning (StarMap's version of this same wrapper).
   */
  const handleCanvasEntryClick = useCallback(
    (entry: Entry) => {
      if (isEditMode) {
        onEditEntry(entry);
        return;
      }
      handleEntryClick(entry);
    },
    [isEditMode, onEditEntry, handleEntryClick]
  );

  // `containerRef`/`headerContentRef`/`containerLayout`/`topOffset` -
  // identical to Constellation.tsx's own measurement setup; see its
  // layout comment for the full reasoning behind each. `topOffset` is
  // still handed to LinearTimeline below - see the STAGE 2 comment above.
  const isFocused = expandedEntryId !== null;
  const containerRef = useRef<HTMLDivElement>(null);
  const headerContentRef = useRef<HTMLDivElement>(null);
  const [containerLayout, setContainerLayout] = useState({ top: 0, left: 0 });
  const [topOffset, setTopOffset] = useState(0);

  useEffect(() => {
    const containerEl = containerRef.current;
    const headerEl = headerContentRef.current;
    if (!containerEl || !headerEl) return;

    const updateLayout = () => {
      const containerRect = containerEl.getBoundingClientRect();
      const headerRect = headerEl.getBoundingClientRect();
      setContainerLayout({ top: containerRect.top, left: containerRect.left });
      setTopOffset(headerRect.bottom);
    };
    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(containerEl);
    observer.observe(headerEl);
    window.addEventListener('resize', updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
    // Re-run when focused mode toggles: FocusedEntryView swaps in its own
    // header block (also attached to `headerContentRef`), so the observer
    // has to re-attach to whichever header element is now mounted.
  }, [isFocused]);

  // The unified container's live rendered width, passed to LinearTimeline
  // so its AUTO-RECENTER effect can keep its horizontal-centering math
  // accurate - identical to Constellation.tsx's own `sidebarWidth`
  // measurement for StarMap, including the `hasSelection` gate; see its
  // comment for why this stays 0 unless there's an actual panel open, even
  // though the container itself is always mounted now.
  const [sidebarWidth, setSidebarWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasSelection) {
      setSidebarWidth(0);
      return;
    }

    const updateWidth = () => setSidebarWidth(el.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasSelection]);

  return (
    // Fragment, not a `space-y-4` div - see Constellation.tsx's identical
    // comment: `space-y-*` would misalign LinearTimeline's `fixed inset-0`
    // edges by adding margin-top to it as a sibling.
    <>
      {/*
       * UNIFIED SIDEBAR CONTAINER - identical structure/reasoning to
       * Constellation.tsx's own container; see its layout comment.
       */}
      {/*
       * Wrapper shared by the sidebar container and the focused-mode
       * BookmarkRail, which pokes out past the container's right edge -
       * see BookmarkRail.tsx's OUTSIDE THE SIDEBAR comment for why the
       * rail has to be the container's sibling rather than its child.
       * `w-fit` shrink-wraps the container, so the rail's `left: 100%` is
       * the container's live right edge. `relative z-10` lifts both above
       * the `fixed` canvas, the same job the container's own `z-10` did
       * before this wrapper existed.
       */}
      <div className="relative z-10 w-fit">
        <div
          ref={containerRef}
          className="bullet-journal-surface relative z-10 flex flex-col rounded-2xl border border-[var(--panel-border-color)] shadow-lg backdrop-blur-sm"
          style={{
            width: `calc(33vw - ${containerLayout.left}px)`,
            maxHeight: `calc(100vh - ${containerLayout.top}px - 24px)`,
          }}
        >
          {/*
           * FOCUSED MODE - see FocusedEntryView.tsx: while an entry is
           * expanded, it takes over the whole sidebar in place of the page
           * header, FilterBar, and panel stack below.
           */}
          {expandedEntryId ? (
            <FocusedEntryView
              selectedEntries={selectedEntries}
              focusedEntryId={expandedEntryId}
              headerRef={headerContentRef}
              canUndo={canUndoFocus}
              onBack={handleExitFocus}
              onUndo={handleUndoFocus}
              onEdit={onEditEntry}
              onClose={handleClosePanel}
              onUpdateEntry={onUpdateEntry}
            />
          ) : (
            <>
              <div
                ref={headerContentRef}
                className="flex-shrink-0 space-y-4 p-4"
              >
                <VizPageHeader
                  title="Linear Timeline"
                  subtitle="Drag to pan, scroll to zoom, and click a point to see the entry behind it."
                />

                <FilterBar
                  sortMode={sortMode}
                  onSortModeChange={handleSortModeChange}
                  categories={categories}
                  filterCategories={filterCategories}
                  onToggleFilterCategory={handleToggleFilterCategory}
                  onResetFilters={handleResetFilters}
                  hasSelection={hasSelection}
                />
              </div>

              {hasSelection && (
                <div className="dark-scrollbar flex-1 overflow-y-auto px-4 pb-4">
                  <SidebarPanelStack
                    selectedEntries={selectedEntries}
                    sortMode={sortMode}
                    categoryGroups={categoryGroups}
                    onExpand={handleExpandPanel}
                    onClose={handleClosePanel}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {expandedEntryId && (
          <BookmarkRail
            selectedEntries={selectedEntries}
            focusedEntryId={expandedEntryId}
            onSelect={handleExpandPanel}
          />
        )}
      </div>

      <LinearTimeline
        entries={timeFilteredEntries}
        categories={categories}
        hasAnyEntries={entries.length > 0}
        filterCategories={filterCategories}
        onEntryClick={handleCanvasEntryClick}
        openedEntryIds={openedEntryIds}
        expandedEntryId={expandedEntryId}
        sidebarWidth={sidebarWidth}
        topOffset={topOffset}
        domainRange={selectedRange}
        isEditMode={isEditMode}
      />

      {/*
       * Rendered after LinearTimeline in source order - see the STAGE 3
       * comment above. Self-positioning `fixed bottom-*` chrome (see its
       * own comment), so its place here in the JSX tree doesn't determine
       * where it actually lands on screen. Passed the full, unfiltered
       * `entries` (not `timeFilteredEntries`) for its density ticks - see
       * TimeRangeSelector.tsx's own prop comment for why. Also passed the
       * same `sidebarWidth` LinearTimeline gets, so it can center itself
       * within the same sidebar-excluded visible region LinearTimeline's
       * own content now starts past - see both files' own comments on
       * their respective (different) sidebar-aware layout mechanisms.
       */}
      <TimeRangeSelector entries={entries} sidebarWidth={sidebarWidth} />

      {isEditMode && <EditModeBanner />}

      <ResetToast visible={resetPending} />
      <ResetButton onClick={resetAll} />
      <EditModeToggle />
    </>
  );
}
