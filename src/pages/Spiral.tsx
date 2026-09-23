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
 *   - The page layout (full-bleed canvas behind a floating z-10 unified
 *     `.bullet-journal-surface` container - title/subtitle/FilterBar/
 *     sidebar panel stack all ONE container, measured `containerLayout`/
 *     `topOffset` for its position, `sidebarWidth` measured off the same
 *     container's own DOM node) matches Constellation.tsx/Timeline.tsx's
 *     CSS approach exactly - see Constellation.tsx's own top-of-file
 *     layout comment for the full reasoning behind each piece, not
 *     re-explained here to avoid the
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

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import EditModeBanner from '../components/EditModeBanner';
import EditModeToggle from '../components/EditModeToggle';
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
import { useEditMode } from '../context/EditModeContext';

/**
 * Gap (px) between the STAR GLYPH FOOTNOTE (see its own comment below,
 * near the returned JSX) and TimeRangeSelector's card - same role as
 * VizEmptyState.tsx's own `GAP` constant for its "above instead of
 * beside" layout, just a smaller value since this is a single-line
 * caption, not a bordered card.
 */
const STAR_GLYPH_FOOTNOTE_GAP = 8;

interface SpiralProps {
  entries: Entry[];
  /** Opens `entry` in the shared AddEntryForm's edit mode - see App.tsx's `editingEntry` state. */
  onEditEntry: (entry: Entry) => void;
  /** App.tsx's `updateEntry` - used by EntryPanel to save reflections. */
  onUpdateEntry: (entry: Entry) => void;
}

export default function Spiral({
  entries,
  onEditEntry,
  onUpdateEntry,
}: SpiralProps) {
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
    handleMinimizePanel,
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
    categoriesVersion,
  } = useEntrySelection({
    // `categories` is no longer passed here - see Constellation.tsx's
    // identical comment: the shared EntrySelectionProvider (App.tsx) now
    // derives its own categories from `entries` directly.
    //
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

  // The dynamic category list - see Constellation.tsx's identical
  // `categories` useMemo (including the `categoriesVersion` dependency's
  // own comment there) for why this is recomputed off both `entries` and
  // `categoriesVersion`.
  const categories = useMemo(
    () => loadCategories(),
    [entries, categoriesVersion]
  );

  const { isEditMode } = useEditMode();

  /**
   * Composes SpiralTimeline's single `onEntryClick` callback around the
   * shared `isEditMode` flag - see EditModeContext.tsx's top-of-file "WHY
   * THIS IS A GLOBAL CLICK-BEHAVIOR OVERRIDE" comment for why this branch
   * lives here (in the page) rather than inside SpiralTimeline.tsx itself,
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
  // identical to Constellation.tsx's/Timeline.tsx's own measurement setup
  // for their unified `.bullet-journal-surface` container; see
  // Constellation.tsx's layout comment for the full reasoning behind each.
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
  }, []);

  // The unified container's live rendered width, passed to SpiralTimeline
  // so its CLICK-TO-CENTER effect can keep its centering math accurate -
  // identical to Constellation.tsx's/Timeline.tsx's own `sidebarWidth`
  // measurement, including the `hasSelection` gate (0 unless there's an
  // actual panel open, even though the container itself is always mounted
  // now - see Constellation.tsx's comment on this same gate).
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

  // TimeRangeSelector's own CARD's live rendered position - used only by
  // the STAR GLYPH FOOTNOTE below (Spiral-only; Constellation.tsx/
  // Timeline.tsx no longer need this measurement themselves now that
  // EditModeBanner.tsx/VizEmptyState.tsx's "filtered" message both anchor
  // top-right instead of beside TimeRangeSelector - see
  // utils/topRightTooltipStack.ts). `sidebarWidth` is a dependency (not
  // just mount) because TimeRangeSelector re-centers its card within a
  // narrower `[sidebarWidth, viewport right]` box as the sidebar opens/
  // closes - a pure horizontal TRANSLATION of the same-sized card, which a
  // ResizeObserver alone would miss (it only fires on size changes, not
  // position). The window resize listener alongside it catches the OTHER
  // way this position can change: the viewport itself resizing.
  // `useLayoutEffect` (not `useEffect`) so this is measured before the
  // first paint the footnote could appear in, avoiding a one-frame flash
  // at the wrong position.
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
       * UNIFIED SIDEBAR CONTAINER - identical structure/reasoning to
       * Constellation.tsx's own container; see its layout comment. Since
       * this container's width is now driven by the outer
       * `.bullet-journal-surface` box (not FilterBar's own root, which no
       * longer computes its own width - see FilterBar.tsx's own WIDTH
       * comment), Spiral's two-sentence subtitle wraps within this SAME
       * `calc(33vw - containerLayout.left)` width every other page's
       * container uses, rather than able to stretch the container wider
       * than intended the way an unconstrained `w-fit` wrapper once could.
       */}
      <div
        ref={containerRef}
        className="bullet-journal-surface relative z-10 flex flex-col rounded-2xl border border-[var(--panel-border-color)] shadow-lg backdrop-blur-sm"
        style={{
          width: `calc(33vw - ${containerLayout.left}px)`,
          maxHeight: `calc(100vh - ${containerLayout.top}px - 24px)`,
        }}
      >
        <div ref={headerContentRef} className="flex-shrink-0 space-y-4 p-4">
          <VizPageHeader
            title="Spiral Timeline"
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
          />
        </div>

        {hasSelection && (
          <div className="dark-scrollbar flex-1 overflow-y-auto px-4 pb-4">
            <SidebarPanelStack
              selectedEntries={selectedEntries}
              sortMode={sortMode}
              categoryGroups={categoryGroups}
              onExpand={handleExpandPanel}
              onMinimize={handleMinimizePanel}
              onClose={handleClosePanel}
              onEdit={onEditEntry}
              onUpdateEntry={onUpdateEntry}
            />
          </div>
        )}
      </div>

      <SpiralTimeline
        entries={timeFilteredEntries}
        categories={categories}
        hasAnyEntries={entries.length > 0}
        filterCategories={filterCategories}
        onEntryClick={handleCanvasEntryClick}
        openedEntryIds={openedEntryIds}
        expandedEntryId={expandedEntryId}
        sidebarWidth={sidebarWidth}
        resetViewSignal={resetViewSignal}
        domainRange={selectedRange}
        topOffset={topOffset}
        isEditMode={isEditMode}
      />

      {/*
       * Same component, same props shape, and same fixed-bottom
       * sidebar-aware centering as Constellation.tsx's/Timeline.tsx's own
       * <TimeRangeSelector>. Passed the full, unfiltered `entries` (not
       * `timeFilteredEntries`) for its density ticks - same reasoning as
       * the other two pages' own comment on this prop. `ref` is the
       * TimeRangeSelector.tsx forwardRef, measured above for the STAR
       * GLYPH FOOTNOTE below - the only remaining consumer of that
       * measurement on this page.
       */}
      <TimeRangeSelector
        ref={timeRangeSelectorCardRef}
        entries={entries}
        sidebarWidth={sidebarWidth}
      />

      {/*
       * STAR GLYPH FOOTNOTE: explains SpiralTimeline's own "✦" year-glyph
       * markers (see its "YEAR GLYPHS" comment) - the same glyph character
       * is reused here so this note visually matches what's actually drawn
       * on the canvas. Spiral-only: this lives here rather than in
       * TimeRangeSelector.tsx itself, which Constellation.tsx/Timeline.tsx
       * also render and neither of which has a year glyph to explain.
       *
       * POSITIONING: stacked directly above TimeRangeSelector's card,
       * centered within `[sidebarWidth, viewport right]` - the same
       * horizontal centering approach TimeRangeSelector.tsx uses for
       * itself, just one row higher. `bottom` (not `top`) is derived from
       * `timeRangeSelectorRect.top` (the card's own measured top edge)
       * rather than a flat guessed pixel offset: this keeps the footnote
       * flush just above the card regardless of the card's own rendered
       * height, and regardless of how `sidebarWidth`/viewport width shift
       * where that card actually centers itself - i.e. the exact same
       * sidebar-aware centering TimeRangeSelector uses for itself, kept in
       * sync via the same measured rect rather than a second independent
       * calculation. `pointer-events-none` since this is read-only caption
       * text that shouldn't intercept clicks meant for the canvas/scrubber
       * around it.
       */}
      <div
        className="pointer-events-none fixed z-40 flex justify-center px-6"
        style={{
          bottom:
            window.innerHeight -
            timeRangeSelectorRect.top +
            STAR_GLYPH_FOOTNOTE_GAP,
          left: sidebarWidth,
          right: 0,
        }}
      >
        <p className="text-xs text-[var(--text-muted-color)]">
          ✦ marks a year along the spiral.
        </p>
      </div>

      {isEditMode && <EditModeBanner />}

      <ResetToast visible={resetPending} />
      <ResetButton onClick={resetAll} />
      <EditModeToggle />
    </>
  );
}
