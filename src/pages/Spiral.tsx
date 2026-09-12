/**
 * Spiral.tsx - Spiral Timeline Page
 *
 * Renders the entries array (lifted in App.tsx, same as Constellation.tsx
 * and Timeline.tsx receive it) as a spiral-shaped timeline via
 * SpiralTimeline.tsx - a third visualization alongside the clustered
 * Constellation view and the straight-line Timeline view, for a history
 * that's easier to take in as one coiled shape than a long horizontal
 * line once it spans several years. See SpiralTimeline.tsx for the
 * spiral formula, textPath year labels, and range-entry arc rendering.
 *
 * ──────────────────────────────────────────────────────────────────────
 * PARITY WITH Constellation.tsx / Timeline.tsx - COMPLETING ALL THREE VIEWS
 * ──────────────────────────────────────────────────────────────────────
 * This page used to be a simple thing - a plain `space-y-6` heading/
 * subtitle above SpiralTimeline's own bordered card, with no filter/sort
 * controls, no sidebar, and clicking a point/arc opened a single
 * read-only <EntryDetailModal> popup. It's now been refactored to match
 * Constellation.tsx/Timeline.tsx's page structure exactly, completing the
 * three-way parity Timeline.tsx's own refactor started:
 *
 *   - Selection/filter/sort state comes from useEntrySelection.ts, the
 *     SAME hook Constellation.tsx and Timeline.tsx use - panel expand/
 *     minimize/close, sort mode, and category filtering now behave
 *     IDENTICALLY across all three views, with no Spiral-specific
 *     selection logic left anywhere in this file or SpiralTimeline.tsx.
 *   - The title/subtitle block is VizPageHeader.tsx, the same component
 *     Constellation.tsx/Timeline.tsx render (same constrained width,
 *     same spacing, same "text over the canvas" treatment).
 *   - <FilterBar> is the same component and props shape the other two
 *     pages use - its category toggles dim SpiralTimeline's points/arcs,
 *     the same FILTERED_OUT_OPACITY treatment StarMap.tsx/
 *     LinearTimeline.tsx give their own entries.
 *   - Clicking a point/arc no longer opens EntryDetailModal - it adds a
 *     panel to SidebarPanelStack.tsx, the SAME sidebar panel stack
 *     component Constellation.tsx/Timeline.tsx use, via `handleEntryClick`
 *     wired to SpiralTimeline's `onEntryClick` prop - the exact same
 *     three-way open-new/expand-minimized/deselect-expanded click
 *     behavior (see useEntrySelection.ts's CLICK OUTCOMES comment) the
 *     other two views already share.
 *   - The page layout (full-bleed canvas behind a floating z-10 header
 *     and a z-30 sidebar overlay, measured `headerLayout` for the
 *     sidebar's position, the same fixed-width/`space-y-4` header
 *     wrapper, `sidebarWidth` measured off the sidebar's own DOM node)
 *     matches Constellation.tsx/Timeline.tsx's CSS approach exactly - see
 *     Constellation.tsx's own top-of-file layout comment for the full
 *     reasoning behind each piece, not re-explained here to avoid the
 *     three files' comments drifting out of sync with each other.
 *   - TimeRangeContext's `selectedRange` is consumed exactly like
 *     Constellation.tsx/Timeline.tsx: `timeFilteredEntries` is `entries`
 *     hard-cut to `isEntryWithinRange` (the same overlap test, not the
 *     dim-don't-remove treatment `filterCategories` gets), and
 *     `<TimeRangeSelector>` renders below SpiralTimeline with the same
 *     sidebar-aware centering. `onFullReset` resets SpiralTimeline's own
 *     pan/zoom (`resetViewSignal`, adapted from StarMap.tsx's mechanism -
 *     see SpiralTimeline.tsx's own comment for why StarMap's approach,
 *     not Timeline's, fits this view's coordinate system) AND
 *     `resetToFullRange()`, so the bottom-right reset button/Escape's full
 *     reset puts the brush back to the full range here too.
 *
 * With this, all three visualization views (Constellation, Timeline,
 * Spiral) now fully share the same interaction/state/styling system:
 * one selection hook, one filter bar, one sidebar panel stack, one
 * time-range filter and control, and the same opened-entry highlight
 * language - each view differs only in how it lays out entries in space,
 * not in how selecting, filtering, or time-windowing them works.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FilterBar from '../components/FilterBar';
import ResetButton from '../components/ResetButton';
import ResetToast from '../components/ResetToast';
import SidebarPanelStack from '../components/SidebarPanelStack';
import SpiralTimeline from '../components/SpiralTimeline';
import TimeRangeSelector from '../components/TimeRangeSelector';
import VizPageHeader from '../components/VizPageHeader';
import { Entry } from '../types/Entry';
import { loadCategories } from '../utils/categories';
import { isEntryWithinRange } from '../utils/entryDateRange';
import { useEntrySelection } from '../hooks/useEntrySelection';
import { useTimeRange } from '../context/TimeRangeContext';

interface SpiralProps {
  entries: Entry[];
}

export default function Spiral({ entries }: SpiralProps) {
  // The dynamic category list - see Constellation.tsx's identical
  // `categories` useMemo for why this is recomputed off `entries`.
  const categories = useMemo(() => loadCategories(), [entries]);

  // `selectedRange` is the shared, cross-page time filter (same context
  // Constellation.tsx/Timeline.tsx read); `timeFilteredEntries` is
  // `entries` hard-cut down to only what's `isEntryWithinRange` of it -
  // this (not `entries`) is what actually reaches SpiralTimeline below.
  const { selectedRange, resetToFullRange } = useTimeRange();
  const timeFilteredEntries = useMemo(
    () => entries.filter(entry => isEntryWithinRange(entry, selectedRange)),
    [entries, selectedRange]
  );

  // Bumped every time useEntrySelection's Escape-key full reset actually
  // fires (via `onFullReset` below) - passed to SpiralTimeline as
  // `resetViewSignal` so it can drive its own pan/zoom transform back to
  // identity, the same StarMap.tsx-derived mechanism Constellation.tsx
  // uses for StarMap.
  const [resetViewSignal, setResetViewSignal] = useState(0);

  const {
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
  } = useEntrySelection({
    categories,
    // RESET INCLUDES THE BRUSH: same pattern as Constellation.tsx/
    // Timeline.tsx's own `onFullReset` - bump `resetViewSignal` (this
    // page's canvas-specific pan/zoom reset) AND call
    // `resetToFullRange()` (TimeRangeContext's brush reset), so the
    // bottom-right reset button/Escape's full reset snaps both back here
    // too, not just on the other two pages.
    onFullReset: () => {
      setResetViewSignal(signal => signal + 1);
      resetToFullRange();
    },
  });

  // Where the header stack (title/subtitle + FilterBar) actually sits in
  // the viewport - identical to Constellation.tsx's/Timeline.tsx's own
  // `headerLayout` measurement; see either file's comment for why neither
  // `top` nor `left` can be a hardcoded guess.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerLayout, setHeaderLayout] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateLayout = () => {
      const rect = el.getBoundingClientRect();
      setHeaderLayout({ top: rect.bottom, left: rect.left });
    };
    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);
    window.addEventListener('resize', updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  // The sidebar overlay's live rendered width, passed to SpiralTimeline so
  // its CLICK-TO-CENTER effect can keep its centering math accurate -
  // identical to Constellation.tsx's/Timeline.tsx's own `sidebarWidth`
  // measurement.
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(0);

  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) {
      setSidebarWidth(0);
      return;
    }

    const updateWidth = () => setSidebarWidth(el.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasSelection]);

  // TimeRangeSelector's own CARD's live rendered position - identical to
  // Constellation.tsx's own `timeRangeSelectorRect` measurement; see its
  // comment for the full reasoning (why `sidebarWidth` is a dependency,
  // why both a ResizeObserver AND a resize listener are needed, and why
  // `useLayoutEffect`).
  const timeRangeSelectorCardRef = useRef<HTMLDivElement>(null);
  const [timeRangeSelectorRect, setTimeRangeSelectorRect] = useState({
    top: 0,
    right: 0,
    height: 0,
  });

  useLayoutEffect(() => {
    const el = timeRangeSelectorCardRef.current;
    if (!el) return;

    const updateRect = () => {
      const rect = el.getBoundingClientRect();
      setTimeRangeSelectorRect({
        top: rect.top,
        right: rect.right,
        height: rect.height,
      });
    };
    updateRect();

    const observer = new ResizeObserver(updateRect);
    observer.observe(el);
    window.addEventListener('resize', updateRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRect);
    };
  }, [sidebarWidth]);

  return (
    // Fragment, not a `space-y-4` div - see Constellation.tsx's identical
    // comment: `space-y-*` would misalign SpiralTimeline's `fixed inset-0`
    // edges by adding margin-top to it as a sibling.
    <>
      {/*
       * A fixed width, NOT `w-fit`: an earlier version used `w-fit` here
       * (shrinks this wrapper down to the widest child's own intrinsic
       * max-content width) since FilterBar's own root already has a fixed
       * width matching the sidebar's (see FilterBar.tsx's `leftInset` prop
       * comment), so as long as no OTHER child wanted to be wider than
       * that, the wrapper ended up that same width for free. Spiral's
       * subtitle is two full sentences (longer than either other page's
       * single sentence) - long enough that its unwrapped one-line
       * intrinsic width exceeds FilterBar's own width, which made THAT
       * `w-fit` computation pick the subtitle's own (wider) intrinsic
       * width instead, stretching the whole header out over the canvas
       * and blocking clicks on points/arcs underneath it. Constellation.tsx/
       * Timeline.tsx now use this same fixed-width approach too (see
       * Constellation.tsx's own comment), so the subtitle's wrap width is
       * a deliberate match to FilterBar/the sidebar everywhere, not an
       * incidental side effect of `w-fit` that happened to work for their
       * shorter one-sentence subtitles.
       *
       * `calc(33vw - headerLayout.left)`, not a flat `33vw`: matches
       * FilterBar's own width exactly (see its `leftInset` prop comment
       * for why a flat 33vw would overshoot SidebarPanelStack.tsx's actual
       * right edge by `headerLayout.left` pixels) - using the same flat
       * 33vw here instead would leave this wrapper wider than the
       * FilterBar it contains, and since this wrapper is itself
       * `relative z-10` (positioned above the canvas), that extra sliver
       * would silently block clicks on whatever's underneath it, the
       * exact bug this fixed width was introduced to avoid in the first
       * place. This forces the subtitle <p> to wrap within the SAME real
       * width FilterBar/SidebarPanelStack.tsx already share, so the
       * header, FilterBar, and (once a panel is open) the sidebar panel
       * stack all stay a consistent, canvas-sparing width regardless of
       * subtitle length or how much horizontal page padding
       * `headerLayout.left` happens to be.
       */}
      <div
        ref={headerRef}
        className="relative z-10 space-y-4"
        style={{ width: `calc(33vw - ${headerLayout.left}px)` }}
      >
        <VizPageHeader
          title="Spiral"
          subtitle="Drag to pan, scroll to zoom, and click a point (or arc) to see the entry behind it. Time coils outward from the center - oldest at the middle, most recent at the rim."
        />

        <FilterBar
          sortMode={sortMode}
          onSortModeChange={handleSortModeChange}
          categories={categories}
          filterCategories={filterCategories}
          onToggleFilterCategory={handleToggleFilterCategory}
          onResetFilters={handleResetFilters}
          hasSelection={hasSelection}
          leftInset={headerLayout.left}
        />
      </div>

      <SpiralTimeline
        entries={timeFilteredEntries}
        hasAnyEntries={entries.length > 0}
        filterCategories={filterCategories}
        onEntryClick={handleEntryClick}
        openedEntryIds={openedEntryIds}
        expandedEntryId={expandedEntryId}
        sidebarWidth={sidebarWidth}
        resetViewSignal={resetViewSignal}
        domainRange={selectedRange}
        topOffset={headerLayout.top}
        timeRangeSelectorRect={timeRangeSelectorRect}
      />

      {/*
       * Same component, same props shape, and same fixed-bottom
       * sidebar-aware centering as Constellation.tsx's/Timeline.tsx's own
       * <TimeRangeSelector>. Passed the full, unfiltered `entries` (not
       * `timeFilteredEntries`) for its density ticks - same reasoning as
       * the other two pages' own comment on this prop. `ref` is the
       * TimeRangeSelector.tsx forwardRef - see the `timeRangeSelectorRect`
       * measurement above for why.
       */}
      <TimeRangeSelector
        ref={timeRangeSelectorCardRef}
        entries={entries}
        sidebarWidth={sidebarWidth}
      />

      <ResetToast visible={resetPending} />
      <ResetButton onClick={resetAll} />

      {hasSelection && (
        <SidebarPanelStack
          ref={sidebarRef}
          selectedEntries={selectedEntries}
          sortMode={sortMode}
          categoryGroups={categoryGroups}
          onExpand={handleExpandPanel}
          onClose={handleClosePanel}
          top={headerLayout.top}
          left={headerLayout.left}
        />
      )}
    </>
  );
}
