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
 * FULL-BLEED CANVAS + FLOATING OVERLAY SIDEBAR
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
 *   - The sidebar panel stack (SidebarPanelStack.tsx - shared with
 *     Timeline.tsx, see its own header comment) is a *separate*,
 *     absolutely-positioned overlay drawn on top of StarMap's canvas with
 *     a higher z-index. It only renders at all when `selectedEntries` is
 *     non-empty (`hasSelection`, from the hook) - there's still no
 *     separate "is the sidebar open" flag - but unlike before,
 *     mounting/unmounting it can't affect StarMap's size, because
 *     StarMap's size no longer depends on anything in this file's layout.
 *
 * The sidebar's width and header-relative position both still matter to
 * *other* things, even though they don't affect StarMap's own size:
 *   - Width, for *visually* centering a clicked star - see `sidebarWidth`
 *     below (the overlay's own *actual rendered* width, currently a
 *     product of SidebarPanelStack's fixed `w-[33vw]` class) and the
 *     CLICK-TO-CENTER comment in StarMap.tsx.
 *   - Header layout, so the overlay's content starts below the header
 *     stack (navbar + title/subtitle + FilterBar) and shares its left
 *     edge, instead of overlapping or misaligning with it - see
 *     `headerLayout` below.
 * FilterBar's own two rows (category filters, sort toggle) and
 * SidebarPanelStack all share the SAME fixed `33vw` width (one third of
 * the viewport) - previously this was measured off the instructional
 * subtitle `<p>`'s own rendered width instead, so all three matched it
 * exactly; that matching has been intentionally replaced with a flat
 * viewport-relative proportion (see FilterBar.tsx and
 * SidebarPanelStack.tsx), independent of the subtitle's width.
 * `headerLayout` still only measures `top`/`left` (position, not size) -
 * see below - to keep the sidebar's *left edge* aligned with the header,
 * which is unrelated to this width change.
 *
 * ──────────────────────────────────────────────────────────────────────
 * HEADER STACKING: FLOW LAYOUT, NOT MANUAL OFFSETS
 * ──────────────────────────────────────────────────────────────────────
 * The title/subtitle text (VizPageHeader.tsx) and <FilterBar> both need
 * to render on top of StarMap's `fixed inset-0` canvas (see StarMap.tsx)
 * without overlapping each other. An earlier version made FilterBar its
 * own `fixed`, hand-placed box (`top-20`) floating independently of the
 * title/subtitle block below it - which meant its position was a guess
 * that didn't account for the title block's actual (variable) rendered
 * height, and the two would visually overlap.
 *
 * The fix is to stop positioning them independently: both now live in
 * one normal-flow wrapper (`relative z-10`, below), stacked with
 * ordinary `space-y-4` margins the same way any other flow content
 * would be. `relative z-10` on the wrapper is what lifts the *whole*
 * subtree above the canvas in one place - see the comment on that div
 * for why - rather than each element separately fighting over z-index.
 * Ordinary block flow then guarantees no overlap, automatically
 * adjusting if the title block's height ever changes, instead of a
 * hand-tuned pixel offset needing to be re-guessed by hand.
 *
 * TRANSPARENT CONTAINER, CONTRASTED CONTENT:
 * Neither the title/subtitle block nor <FilterBar> has an opaque
 * background of its own - both sit directly over the starfield so it
 * stays visible through them, per the design brief. Legibility instead
 * comes from styling each piece of *content* for contrast individually -
 * see VizPageHeader.tsx and FilterBar.tsx. Multiple small contrasted
 * elements instead of one big backing box.
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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FilterBar from '../components/FilterBar';
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

interface ConstellationProps {
  entries: Entry[];
}

export default function Constellation({ entries }: ConstellationProps) {
  // The dynamic category list - recomputed whenever entries change, since
  // that's exactly when a new category could have appeared (a fresh "+
  // Add new category" in AddEntryForm always creates its new entry in the
  // same action). Passed down to useEntrySelection, FilterBar, and StarMap
  // rather than having each of them independently reload it.
  const categories = useMemo(() => loadCategories(), [entries]);

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

  // The sidebar overlay's live rendered width, passed to StarMap so it
  // can keep its click-to-center math accurate - see the layout comment
  // above and StarMap.tsx's CLICK-TO-CENTER comment. Measured off the DOM
  // node directly (rather than assumed from SidebarPanelStack's fixed
  // `w-[33vw]` class) because the overlay's actual rendered pixel width
  // still needs an actual measurement to convert that viewport-relative
  // unit into the pixel coordinates StarMap's zoom math works in. Resets
  // to 0 whenever the overlay unmounts (`hasSelection` false), since
  // there's no node to measure - matching StarMap's `sidebarWidth: 0`
  // "canvas is fully visible" case.
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

  // TimeRangeSelector's own CARD's live rendered position - forwarded via
  // TimeRangeSelector.tsx's `forwardRef` (see its own comment) - so
  // VizEmptyState's "filtered" message (below, via StarMap) can position
  // itself immediately to the card's right, on the same row, instead of
  // guessing at a fixed offset. Re-measured whenever `sidebarWidth`
  // changes (a dependency, not just mount) because TimeRangeSelector
  // re-centers its card within a narrower `[sidebarWidth, viewport
  // right]` box as the sidebar opens/closes - a pure horizontal
  // TRANSLATION of the same-sized card, which a ResizeObserver alone
  // would miss (it only fires on size changes, not position). The window
  // resize listener alongside it catches the OTHER way this position can
  // change: the viewport itself resizing. `useLayoutEffect` (not
  // `useEffect`) so this is measured before the first paint the message
  // could appear in, avoiding a one-frame flash at the wrong position.
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

  // Where the header stack (title/subtitle + FilterBar) actually sits in
  // the viewport, so SidebarPanelStack below can start just past its
  // bottom edge and share its left edge, instead of overlapping or
  // misaligning with it. This is position only, NOT size/width - see the
  // "FULL-BLEED CANVAS + FLOATING OVERLAY SIDEBAR" comment at the top of
  // this file for why width is now a flat 33vw instead of being derived
  // from anything measured here.
  //
  // Neither top nor left can be a hardcoded guess:
  //   - top: the navbar's height lives in Layout.tsx (not this file), and
  //     the header block's own height changes with its content - e.g.
  //     the sort toggle inside FilterBar showing/hiding with
  //     `hasSelection` (see FilterBar.tsx).
  //   - left: `main` in Layout.tsx is `mx-auto max-w-7xl px-4 sm:px-6
  //     lg:px-8` - on any viewport *wider* than max-w-7xl (1280px), the
  //     `mx-auto` centering margin adds on top of that padding, shifting
  //     `left` right as the window keeps growing. A static Tailwind class
  //     (even one that replicates the px-4/sm:px-6/lg:px-8 breakpoints
  //     exactly) can't reproduce that - only measuring the header's
  //     actual rendered position gives the exact number in every case.
  //
  // `headerRef.current.getBoundingClientRect()` gives both directly -
  // `.bottom`/`.left` already include the navbar's height and any
  // mx-auto centering margin for free (this wrapper sits below the
  // navbar, inside main, in normal document flow). Nothing to add or
  // guess for either.
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

    // ResizeObserver catches the header's own size changing (content
    // wrapping differently, FilterBar's sort toggle showing/hiding).
    // It does NOT fire when the header's *position* shifts without a
    // size change though - which is exactly what happens to `left` once
    // the viewport is wider than main's max-w-7xl cap (see above): the
    // header's width stops growing, but its mx-auto margin keeps
    // shifting as the window resizes. A window resize listener catches
    // that case too; both call the same `updateLayout`.
    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);
    window.addEventListener('resize', updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  return (
    // A Fragment, not a single `space-y-4` div, wraps the whole return:
    // `space-y-*` applies margin-top to every sibling, including the
    // out-of-flow `fixed` ones below (StarMap, the sidebar overlay) -
    // which would misalign StarMap's `inset-0` edges by that margin.
    // `space-y-4` is scoped to just the flow-content header wrapper
    // (title/subtitle + FilterBar) below instead.
    <>
      {/*
       * relative z-10: StarMap's canvas below is `fixed inset-0` at z-0
       * (see StarMap.tsx) and would otherwise paint over this
       * non-positioned content, since positioned elements always paint
       * above non-positioned ones regardless of DOM order. Putting z-10
       * here once lifts this whole subtree - title, subtitle, AND
       * FilterBar - above the canvas together, rather than each needing
       * its own position/z-index. See the "HEADER STACKING" and
       * "TRANSPARENT CONTAINER, CONTRASTED CONTENT" comments at the top
       * of this file for why FilterBar lives in here (ordinary flow, no
       * background) instead of as an independently `fixed` element.
       *
       * w-fit: without this, a plain block div stretches to its parent's
       * full width (`main`'s max-w-7xl content box) by default, even
       * though its actual content - the title, subtitle, and the
       * `w-[33vw]` FilterBar - is narrower than that. Since this div sits
       * above StarMap's starfield (z-10, transparent, no background of
       * its own - see "TRANSPARENT CONTAINER, CONTRASTED CONTENT" above),
       * that extra empty box-model width to the right of the visible
       * text/buttons would still catch pointer events, silently blocking
       * clicks on any star that happens to render underneath it. `w-fit`
       * shrinks the div's own box down to its widest child (in practice,
       * FilterBar's `w-[33vw]`) instead, so there's no invisible
       * click-blocking area left over - only the CONTAINER's width
       * behavior changes here; the children below still stack and
       * left-align exactly as before via `space-y-4`, and this has no
       * effect on the sidebar panel stack, sort toggle, or their own
       * independent `w-[33vw]` width-matching (see the top-of-file
       * layout comment) - none of that is sized off this wrapper.
       */}
      <div ref={headerRef} className="relative z-10 w-fit space-y-4">
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
       * Full-bleed canvas - see the layout comment at the top of this
       * file. Not a layout child of anything here; StarMap sizes and
       * positions itself via `fixed inset-0`.
       */}
      {/*
       * onStarClick={handleEntryClick}: StarMap forwards every star click
       * straight to this one hook function - open-new / expand-minimized
       * / deselect-expanded is decided entirely inside
       * useEntrySelection.ts now (see its CLICK OUTCOMES comment), not
       * split across a separate onStarDeselect prop the way it used to
       * be - see StarMap.tsx's own STAR CLICK OUTCOMES comment.
       */}
      <StarMap
        entries={timeFilteredEntries}
        hasAnyEntries={entries.length > 0}
        categories={categories}
        onStarClick={handleEntryClick}
        openedEntryIds={openedEntryIds}
        expandedEntryId={expandedEntryId}
        filterCategories={filterCategories}
        sidebarWidth={sidebarWidth}
        resetViewSignal={resetViewSignal}
        topOffset={headerLayout.top}
        timeRangeSelectorRect={timeRangeSelectorRect}
      />

      {/*
       * Same component, same props shape, and same fixed-bottom
       * sidebar-aware centering as Timeline.tsx's own <TimeRangeSelector> -
       * see the SHARED TIME-RANGE FILTER comment at the top of this file.
       * Passed the full, unfiltered `entries` (not `timeFilteredEntries`)
       * for its density ticks - same reasoning as Timeline.tsx's own
       * comment on this prop: the ticks need to show where data exists
       * across the entire `fullRange`, not just within the current
       * selection. `ref` is the new TimeRangeSelector.tsx forwardRef -
       * see the `timeRangeSelectorRect` measurement above for why.
       */}
      <TimeRangeSelector
        ref={timeRangeSelectorCardRef}
        entries={entries}
        sidebarWidth={sidebarWidth}
      />

      <ResetToast visible={resetPending} />

      {/*
       * Always rendered - unlike the sidebar overlay below, this isn't
       * gated on `hasSelection`/`expandedEntryId`: it's a distinct,
       * unambiguous action (reset EVERYTHING) from a panel's own ×
       * close button (which only removes that one panel), so it stays
       * visible/clickable whether a panel is expanded, minimized, or
       * nothing is open at all.
       */}
      <ResetButton onClick={resetAll} />

      {/*
       * Sidebar overlay - only rendered (and therefore only taking up
       * screen space) when `hasSelection`. Being `fixed` rather than a
       * flex sibling, mounting/unmounting it can't resize StarMap's
       * canvas underneath - see the layout comment at the top of this
       * file for why that's the whole point of this restructure.
       */}
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
