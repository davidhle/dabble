/**
 * Constellation.tsx - Star Map Page
 *
 * Renders the entries array (lifted in App.tsx) as a pannable/zoomable
 * "star map" via StarMap.tsx. See StarMap.tsx for the pan/zoom,
 * clustering, and click handling implementation details.
 *
 * This used to fall back to a small set of mock entries
 * (utils/mockEntries.ts) whenever `entries` was empty, purely so there was
 * something to look at while testing before real data existed. That mock
 * generator has been removed entirely now that a real bundled dataset
 * exists as the actual first-visit default (see
 * utils/initializeFirstVisit.ts) - an empty `entries` array here now only
 * means a visitor deliberately reset to a blank slate (see the "Start
 * Your Own Constellation" button in About.tsx), and just renders an empty
 * star map rather than falling back to anything.
 *
 * SELECTION/FILTER/SORT STATE: this page used to own all of that directly
 * (selectedEntries, filterCategories, sortMode, resetPending, the
 * Escape-key handler, etc.) inline. It's now entirely delegated to
 * useEntrySelection.ts - see that file's top-of-file comment for why it's
 * the single source of truth for this state across all three
 * visualization pages, and for the exact panel-stack/sort/filter/reset
 * semantics. This page (and StarMap below) only consumes the hook's
 * return value and renders it; Timeline.tsx (see its own top-of-file
 * comment) is the second page built on the same hook, as a pilot for
 * eventually doing the same for Spiral.tsx.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FULL-BLEED CANVAS + UNIFIED SIDEBAR CONTAINER
 * ──────────────────────────────────────────────────────────────────────
 * This used to be a two-region flex layout: a sidebar and a StarMap
 * container as flex siblings, where opening the sidebar physically
 * shrank StarMap's box (and StarMap resized its <svg> to match via
 * ResizeObserver). That's been replaced with a layered approach:
 *
 *   - StarMap renders itself `fixed inset-0` (see its own top-of-file
 *     comment) - it always fills the entire viewport, full width and
 *     height, regardless of `selectedEntries`. It is no longer a sized
 *     flex child of anything here; nothing in this file constrains its
 *     box.
 *   - The title/subtitle (VizPageHeader.tsx), <FilterBar>, and the
 *     sidebar panel stack (SidebarPanelStack.tsx - shared with
 *     Timeline.tsx/Spiral.tsx, see its own header comment) are now ONE
 *     `.bullet-journal-surface` container (see index.css's own comment
 *     for that class's three-layer background) - not three separately
 *     positioned pieces. This container is ALWAYS rendered at the same
 *     left position, whether or not `selectedEntries` is empty - only
 *     the sidebar panel stack section WITHIN it is conditional on
 *     `hasSelection`, growing/shrinking the container's own height
 *     (capped by `maxHeight`, scrolling internally past that - see the
 *     JSX below) rather than the container itself mounting/unmounting.
 *     Mounting/unmounting that inner section still can't affect StarMap's
 *     size, because StarMap's size no longer depends on anything in this
 *     file's layout.
 *
 * The container's width and position both still matter to *other*
 * things, even though they don't affect StarMap's own size:
 *   - Width, for *visually* centering a clicked star - see `sidebarWidth`
 *     below (the container's own *actual rendered* width, measured off
 *     `containerRef`) and the CLICK-TO-CENTER comment in StarMap.tsx.
 *     Deliberately still gated on `hasSelection` (0 unless there's an
 *     actual panel open) even though the container itself is always
 *     mounted now - see `sidebarWidth`'s own comment below for why: the
 *     container's background being always-present is a purely visual
 *     change, not a "the canvas should always make room for it" one.
 *   - `topOffset` (StarMap's own prop, further down), so VizEmptyState
 *     positions itself below the header TEXT specifically - see
 *     `topOffset`'s own comment below for why that's measured separately
 *     from the container's own top/left.
 *
 * ──────────────────────────────────────────────────────────────────────
 * HEADER STACKING: FLOW LAYOUT, NOT MANUAL OFFSETS
 * ──────────────────────────────────────────────────────────────────────
 * The unified container needs to render on top of StarMap's `fixed
 * inset-0` canvas (see StarMap.tsx) without any of ITS own content
 * (title, subtitle, FilterBar, panels) overlapping. An earlier version
 * made FilterBar its own `fixed`, hand-placed box (`top-20`) floating
 * independently of the title/subtitle block below it - which meant its
 * position was a guess that didn't account for the title block's actual
 * (variable) rendered height, and the two would visually overlap.
 *
 * The fix is to stop positioning pieces independently: title, subtitle,
 * and FilterBar all live in one normal-flow inner wrapper (`headerContentRef`
 * below), stacked with ordinary `space-y-4` margins the same way any other
 * flow content would be, and the sidebar panel stack (when present) simply
 * follows it as a second flex child of the same outer container. The outer
 * container's own `relative z-10` is what lifts the *whole* subtree above
 * the canvas in one place, rather than each element separately fighting
 * over z-index. Ordinary block flow then guarantees no overlap within the
 * header, automatically adjusting if the title block's height ever
 * changes, instead of a hand-tuned pixel offset needing to be re-guessed
 * by hand.
 *
 * SEMI-OPAQUE CONTAINER, BULLET-JOURNAL TEXTURE:
 * Unlike the transparent, text-only header this page used to render
 * directly over the starfield, the unified container now has its own
 * `.bullet-journal-surface` background (see index.css) - a translucent
 * paper-like surface (~65-70% opaque, so the canvas still shows faintly
 * through it) with a faint grain texture and bullet-journal dot grid
 * layered underneath its actual content. Individual controls (FilterBar's
 * chips, the sort toggle) still keep their own per-control contrast on
 * top of that surface, same as before.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SHARED TIME-RANGE FILTER: SAME CONTEXT, SAME COMPONENT AS Timeline.tsx
 * ──────────────────────────────────────────────────────────────────────
 * This page now consumes TimeRangeContext exactly the way Timeline.tsx
 * does (see that file's STAGE 3 comment and TimeRangeContext.tsx's own
 * top-of-file comment for the full reasoning) - `selectedRange` is global/
 * persistent state that lives above the router, so it's already whatever
 * was last set on EITHER page: narrowing the brush here, then navigating
 * to Timeline, shows the same narrowed window there, and vice versa,
 * without either page needing to read or write anything Timeline/
 * Constellation-specific.
 *
 * `timeFilteredEntries` (not `entries`) is what actually reaches StarMap -
 * a hard filter via the SAME `isEntryWithinRange` overlap test
 * Timeline.tsx uses for its own range/capsule entries, not the
 * dim-don't-remove treatment `filterCategories` gets. Because StarMap's
 * own star positions/jitter/CLICK-TO-CENTER math are all computed
 * directly off its `entries` prop, handing it the already-time-filtered
 * set means that recentering math (and everything else StarMap derives
 * from `entries`) automatically operates on the FILTERED set too, with no
 * separate wiring needed here.
 *
 * `<TimeRangeSelector>` below is the exact same component, same
 * `sidebarWidth`-driven centering, and same fixed-bottom floating-chrome
 * position Timeline.tsx renders - one shared brush control for both pages
 * rather than a second copy. `onFullReset` (passed to useEntrySelection
 * below) now also calls `resetToFullRange()` alongside this page's own
 * `resetViewSignal` bump, so the bottom-right reset button / Escape's
 * full reset puts the brush back to the full range here too, exactly like
 * Timeline.tsx's own `resetAll` already does - confirmed by
 * TimeRangeSelector's own SYNC EFFECT reacting to `selectedRange`
 * changing from outside a drag, the same mechanism that already made this
 * work on Timeline.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BookmarkRail from '../components/BookmarkRail';
import EditModeBanner from '../components/EditModeBanner';
import EditModeToggle from '../components/EditModeToggle';
import FilterBar from '../components/FilterBar';
import FocusedEntryView from '../components/FocusedEntryView';
import ResetButton from '../components/ResetButton';
import ResetToast from '../components/ResetToast';
import SidebarPanelStack from '../components/SidebarPanelStack';
import StarMap from '../components/StarMap';
import TimeRangeSelector from '../components/TimeRangeSelector';
import VizPageHeader from '../components/VizPageHeader';
import { Entry } from '../types/Entry';
import { loadCategories } from '../utils/categories';
import { isEntryWithinRange } from '../utils/entryDateRange';
import { useEntrySelection } from '../hooks/useEntrySelection';
import { useTimeRange } from '../context/TimeRangeContext';
import { useEditMode } from '../context/EditModeContext';

interface ConstellationProps {
  entries: Entry[];
  /** Opens `entry` in the shared AddEntryForm's edit mode - see App.tsx's `editingEntry` state. */
  onEditEntry: (entry: Entry) => void;
  /** App.tsx's `updateEntry` - used by EntryPanel to save reflections. */
  onUpdateEntry: (entry: Entry) => void;
}

export default function Constellation({
  entries,
  onEditEntry,
  onUpdateEntry,
}: ConstellationProps) {
  // See the SHARED TIME-RANGE FILTER comment above: `selectedRange` is the
  // shared, cross-page time filter (same context Timeline.tsx reads);
  // `timeFilteredEntries` is `entries` hard-cut down to only what's
  // `isEntryWithinRange` of it - this (not `entries`) is what actually
  // reaches StarMap below, identical in spirit to Timeline.tsx's own
  // `timeFilteredEntries`/LinearTimeline wiring.
  const { selectedRange, resetToFullRange } = useTimeRange();
  const timeFilteredEntries = useMemo(
    () => entries.filter(entry => isEntryWithinRange(entry, selectedRange)),
    [entries, selectedRange]
  );

  // Bumped every time useEntrySelection's Escape-key full reset actually
  // fires (via `onFullReset` below) - passed to StarMap as
  // `resetViewSignal` so it can drive its own pan/zoom transform back to
  // identity. A counter, not a boolean, so the effect that reacts to it
  // (StarMap's RESET-VIEW effect) still fires even if two resets happen
  // back to back - see that effect's comment for why a boolean/one-shot
  // flag can't represent that. This is the one piece of "full reset"
  // behavior that stays canvas-specific rather than living in the hook -
  // see useEntrySelection.ts's top-of-file comment for why.
  const [resetViewSignal, setResetViewSignal] = useState(0);

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
    focusedView,
    handleFocusedViewChange,
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
    // `categories` is no longer passed here - the shared
    // EntrySelectionProvider (see App.tsx) now derives its own categories
    // directly from `entries`, the same computation this page's own
    // `categories` below still runs locally for FilterBar/StarMap's props
    // - see useEntrySelection.ts's top-of-file comment.
    //
    // RESET INCLUDES THE BRUSH: bumping `resetViewSignal` (StarMap's own
    // pan/zoom reset) alongside `resetToFullRange()` (TimeRangeContext's
    // brush reset) is the exact same "onFullReset covers whatever ELSE a
    // page wants a full reset to also cover" pattern Timeline.tsx uses for
    // its own `resetAll` - see useEntrySelection.ts's `onFullReset` comment
    // and TimeRangeContext.tsx's `resetToFullRange` comment for why this
    // (not `setSelectedRange(fullRange)`) is the right call for a FULL
    // reset specifically. This confirms the bottom-right reset button/
    // Escape's full reset snaps the brush back to the full range from THIS
    // page too, not just from Timeline.
    onFullReset: () => {
      setResetViewSignal(signal => signal + 1);
      resetToFullRange();
    },
  });

  // The dynamic category list - recomputed whenever entries change, since
  // that's exactly when a new category could have appeared (a fresh "+
  // Add new category" in AddEntryForm always creates its new entry in the
  // same action). Passed down to FilterBar and StarMap rather than having
  // each of them independently reload it. Also recomputed off
  // `categoriesVersion` (from useEntrySelection above) - see
  // EntrySelectionContext.tsx's `categoriesVersion`/`refreshCategories`
  // comment for why an in-place rename/recolor/delete of an EXISTING
  // category (ManageCategoriesModal, opened from FilterBar) needs its own
  // trigger separate from `entries` changing.
  const categories = useMemo(
    () => loadCategories(),
    [entries, categoriesVersion]
  );

  const { isEditMode } = useEditMode();

  /**
   * Composes StarMap's single `onStarClick` callback around the shared
   * `isEditMode` flag - see EditModeContext.tsx's top-of-file "WHY THIS IS
   * A GLOBAL CLICK-BEHAVIOR OVERRIDE" comment for why this branch lives
   * here (in the page) rather than inside StarMap.tsx itself. While Edit
   * Mode is on, a star click goes STRAIGHT to `onEditEntry` and never
   * touches `handleEntryClick` at all - the sidebar panel stack is
   * completely bypassed, not just left as-is, so clicking a star that's
   * already open/expanded doesn't toggle or close its panel while editing
   * is the whole point of clicking.
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

  // `containerRef` is the unified `.bullet-journal-surface` box below
  // (title/subtitle/FilterBar/sidebar panel stack, all ONE container now -
  // see the "UNIFIED SIDEBAR CONTAINER" comment at the top of this file).
  // `headerContentRef` is just its inner title/subtitle/FilterBar block,
  // nested inside that container's own padding.
  //
  // `containerLayout` (top/left) positions/sizes the container itself -
  // measured off `containerRef` rather than hardcoded, for the exact same
  // two reasons as before this file's restructure:
  //   - top: the navbar's height lives in Layout.tsx (not this file), and
  //     the container's own height changes with its content (the sort
  //     toggle showing/hiding with `hasSelection`, the category chip grid
  //     collapsing/expanding, panels opening/closing - see FilterBar.tsx).
  //   - left: `main` in Layout.tsx is `mx-auto max-w-7xl px-4 sm:px-6
  //     lg:px-8` - on any viewport *wider* than max-w-7xl (1280px), the
  //     `mx-auto` centering margin adds on top of that padding, shifting
  //     `left` right as the window keeps growing. A static Tailwind class
  //     can't reproduce that - only measuring the container's actual
  //     rendered position gives the exact number in every case.
  //
  // `topOffset` is a SEPARATE value - where the header TEXT block
  // (title/subtitle/FilterBar) itself ends, NOT the outer container's own
  // edge (which now also encloses the sidebar panel stack below it) -
  // measured off `headerContentRef` instead. This is what StarMap still
  // gets as its own `topOffset` prop (see below), unchanged in meaning
  // from before this restructure.
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

    // ResizeObserver catches either element's own size changing (content
    // wrapping differently, the sort toggle/chip grid showing/hiding,
    // panels opening/closing). It does NOT fire when the container's
    // *position* shifts without a size change though - which is exactly
    // what happens to `left` once the viewport is wider than main's
    // max-w-7xl cap (see above). A window resize listener catches that
    // case too; both call the same `updateLayout`.
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

  // StarMap's own `sidebarWidth` prop, for its click-to-center math - see
  // the layout comment above and StarMap.tsx's CLICK-TO-CENTER comment.
  // Measured off `containerRef` (the SAME container `topOffset`/
  // `containerLayout` above already measure) rather than a second DOM
  // node, since the unified container's own width IS the sidebar's width
  // now. Deliberately gated on `hasSelection` (not just "does the node
  // exist" - the container itself is always mounted now, unlike the old
  // conditionally-rendered SidebarPanelStack overlay): the whole point of
  // this restructure is that the container's background/texture is always
  // visually present (see the top-of-file comment), but StarMap should
  // still only shift/recenter its canvas around it when there's an actual
  // panel open, exactly like before.
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
    // A Fragment, not a single `space-y-4` div, wraps the whole return:
    // `space-y-*` applies margin-top to every sibling, including the
    // out-of-flow `fixed` StarMap canvas below - which would misalign its
    // `inset-0` edges by that margin. The unified container below owns its
    // own internal spacing instead.
    <>
      {/*
       * UNIFIED SIDEBAR CONTAINER - see the top-of-file comment. ONE
       * `.bullet-journal-surface` box (title/subtitle/FilterBar, then -
       * once there's a selection - the sidebar panel stack), always
       * rendered at this same position regardless of `hasSelection`,
       * rather than a transparent header plus a separately-mounted
       * overlay below it.
       *
       * `relative z-10`: StarMap's canvas below is `fixed inset-0` at z-0
       * (see StarMap.tsx) and would otherwise paint over this
       * non-positioned content, since positioned elements always paint
       * above non-positioned ones regardless of DOM order.
       *
       * `calc(33vw - containerLayout.left)`, not `w-fit`: keeps this
       * container's own rendered width identical to what FilterBar/the
       * old SidebarPanelStack overlay always used - one third of the
       * viewport, minus this container's own offset from the viewport's
       * left edge. Consistent with Spiral.tsx/Timeline.tsx's identical
       * width calc.
       *
       * `maxHeight`, not a `fixed bottom-0` box: caps this container at
       * however much vertical space remains below it in the viewport, so
       * a long panel stack scrolls WITHIN the container (see the
       * `overflow-y-auto` region below) instead of pushing the container
       * itself past the bottom of the screen. Computed off the same
       * `containerLayout.top` used for width - see that state's own
       * comment above.
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
              view={focusedView}
              onViewChange={handleFocusedViewChange}
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
                  title="Constellation"
                  subtitle="Drag to pan, scroll to zoom, and click a star to see the entry behind it."
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

              {/*
               * Sidebar panel stack - only takes up space once there's a
               * selection, same as before this restructure (see
               * `containerLayout`'s own comment above for why `sidebarWidth`
               * still only reacts to `hasSelection`, not to this container's
               * own always-present background). `flex-1 overflow-y-auto` is
               * what lets this region scroll independently within the
               * container's own `maxHeight` cap above, rather than growing the
               * container past the bottom of the screen.
               */}
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

      {/*
       * Full-bleed canvas - see the layout comment at the top of this
       * file. Not a layout child of anything here; StarMap sizes and
       * positions itself via `fixed inset-0`.
       */}
      {/*
       * onStarClick={handleCanvasEntryClick}: StarMap forwards every star
       * click straight to this one function - open-new / expand-minimized
       * / deselect-expanded is decided entirely inside
       * useEntrySelection.ts's `handleEntryClick` now (see its CLICK
       * OUTCOMES comment), not split across a separate onStarDeselect prop
       * the way it used to be - see StarMap.tsx's own STAR CLICK OUTCOMES
       * comment. `handleCanvasEntryClick` (defined above) wraps that with
       * the Edit Mode branch - StarMap's own `isEditMode` prop below is
       * unrelated to this and purely presentational (see its own comment
       * in StarMap.tsx) - StarMap still has no click-behavior notion of
       * Edit Mode at all.
       */}
      <StarMap
        entries={timeFilteredEntries}
        hasAnyEntries={entries.length > 0}
        categories={categories}
        onStarClick={handleCanvasEntryClick}
        openedEntryIds={openedEntryIds}
        expandedEntryId={expandedEntryId}
        filterCategories={filterCategories}
        sidebarWidth={sidebarWidth}
        resetViewSignal={resetViewSignal}
        topOffset={topOffset}
        isEditMode={isEditMode}
      />

      {/*
       * Same component, same props shape, and same fixed-bottom
       * sidebar-aware centering as Timeline.tsx's own <TimeRangeSelector> -
       * see the SHARED TIME-RANGE FILTER comment at the top of this file.
       * Passed the full, unfiltered `entries` (not `timeFilteredEntries`)
       * for its density ticks - same reasoning as Timeline.tsx's own
       * comment on this prop: the ticks need to show where data exists
       * across the entire `fullRange`, not just within the current
       * selection.
       */}
      <TimeRangeSelector entries={entries} sidebarWidth={sidebarWidth} />

      {isEditMode && <EditModeBanner />}

      <ResetToast visible={resetPending} />

      {/*
       * Always rendered - unlike the sidebar panel stack above, this isn't
       * gated on `hasSelection`/`expandedEntryId`: it's a distinct,
       * unambiguous action (reset EVERYTHING) from a panel's own ×
       * close button (which only removes that one panel), so it stays
       * visible/clickable whether a panel is expanded, minimized, or
       * nothing is open at all.
       */}
      <ResetButton onClick={resetAll} />
      <EditModeToggle />
    </>
  );
}
