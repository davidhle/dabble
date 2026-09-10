/**
 * LinearTimeline.tsx - Chronological Timeline Visualization of Entries
 *
 * Renders `entries` along a single horizontal time axis - a linear
 * counterpart to StarMap.tsx's 2D "constellation" layout. Where StarMap
 * groups entries into loose clusters by category with no inherent
 * ordering, this view puts every entry's exact position on a real
 * d3.scaleTime axis, so "when did this happen relative to everything
 * else" is the thing being visualized.
 *
 * ──────────────────────────────────────────────────────────────────────
 * D3 scaleTime + axisBottom PATTERN
 * ──────────────────────────────────────────────────────────────────────
 * `baseXScale` is a d3.scaleTime: it maps the Date range spanned by
 * `entries` (via d3.extent) onto a pixel range [0, innerWidth]. This is
 * the standard "continuous scale" half of a D3 chart - unlike
 * d3.scaleBand (used by the old D3Chart.tsx bar-chart demo this
 * replaces), a time scale is continuous, so any timestamp - not just
 * ones that exactly match a tick - maps to *some* x position, which is
 * exactly what's needed to place entries whose dates are irregularly
 * spaced.
 *
 * `d3.axisBottom(scale)` is a *generator*, not a value: `.call()`-ing it
 * on a `<g>` selection populates that group with the actual tick marks,
 * gridlines, and labels for whatever scale you hand it. Because the
 * generator has to walk the scale's domain and decide where ticks land
 * (and it mutates the DOM to do so, appending/removing `<g class="tick">`
 * children), this can't be expressed as plain JSX the way the circles
 * below are - it's called imperatively inside a `useEffect` keyed on the
 * *current* scale (see the AXIS EFFECT below), the same
 * imperative-d3-inside-useEffect pattern D3Chart.tsx already used for its
 * bar chart's axes. `.ticks(TICK_COUNT)` is a hint, not an exact count -
 * d3 picks the closest "nice" time interval (day/week/month/year) to
 * land near that many ticks; `.tickFormat(d3.timeFormat('%b %Y'))`
 * overrides the label text to a consistent month/year format regardless
 * of which interval d3 lands on.
 *
 * ──────────────────────────────────────────────────────────────────────
 * PAN/ZOOM: SAME INTERACTION LANGUAGE AS StarMap, DIFFERENT MECHANISM
 * ──────────────────────────────────────────────────────────────────────
 * This intentionally FEELS like StarMap - drag to pan, scroll/pinch to
 * zoom, `cursor-grab`/`active:cursor-grabbing` affordance, the same
 * `d3.zoom()` behavior attached once to the `<svg>` - so the two data
 * views read as one consistent app rather than two unrelated tools that
 * happen to share a codebase.
 *
 * The underlying MECHANISM has to differ, though: StarMap applies the
 * zoom transform directly to an SVG `<g>`'s `transform` attribute, which
 * works because every star is just a circle - scaling the whole group
 * scales circles uniformly and nothing needs to be relabeled. An axis is
 * different: zooming a time axis has to change WHICH dates the tick
 * labels show (zoom in far enough and "Jan 2024" should become "Jan 15",
 * "Jan 22", "Jan 29" - not the same "Jan 2024" text stretched wider).
 * That requires actually rescaling the underlying d3.scaleTime and
 * re-running the axis generator against the new scale, not just
 * transforming a group - see `xScale` and the AXIS EFFECT below. Circle
 * positions are computed from that same rescaled `xScale`, so entries and
 * their axis stay in lockstep at every zoom level, exactly the way
 * StarMap's stars and cluster labels stay in lockstep under its own
 * group-transform approach.
 *
 * This "bake the transform into every position" approach (rather than
 * StarMap's "transform one group") is also why the AUTO-RECENTER effect
 * below has to compute a *new zoom transform* from scratch instead of
 * just reading a star's fixed world (x, y) the way StarMap's
 * CLICK-TO-CENTER does - see that effect's own comment for the math.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FULL-BLEED CANVAS: `fixed inset-0`, SAME AS StarMap
 * ──────────────────────────────────────────────────────────────────────
 * This used to render inside a bordered, padded card (`rounded-lg border
 * ... p-6 shadow-sm`) as a normal-flow child of Chart.tsx (now
 * Timeline.tsx). Timeline.tsx now matches Constellation.tsx's page
 * structure exactly - see its top-of-file comment - so this component's
 * root is `fixed inset-0`, the same "always fills the entire viewport,
 * full width and height" approach StarMap.tsx uses (see StarMap's own
 * FULL-BLEED CANVAS comment), instead of a sized layout child. Timeline's
 * floating header (VizPageHeader + FilterBar) and its sidebar overlay
 * (SidebarPanelStack) both render as separate, higher-z-index siblings on
 * top of this canvas, exactly like Constellation's do over StarMap's.
 *
 * `filterCategories` (from useEntrySelection.ts, via Timeline.tsx) dims
 * - never removes - points/ranges whose activityType isn't active, the
 * same FILTERED_OUT_OPACITY treatment StarMap.tsx gives its stars, so
 * FilterBar's category toggles have real effect here too rather than
 * being inert once wired up to a canvas that ignored them.
 *
 * `onEntryClick` replaces the old local `selectedEntry` state +
 * <EntryDetailModal> popup: a click here is now forwarded straight to
 * Timeline.tsx's `handleEntryClick` (from the shared
 * useEntrySelection.ts hook), the exact same callback Constellation.tsx
 * wires to StarMap's `onStarClick`. This is what lets Timeline render
 * entries into the SAME sidebar panel stack Constellation uses
 * (SidebarPanelStack.tsx) instead of a separate, single-entry modal.
 *
 * CLICK PARITY WITH StarMap: because `onEntryClick` IS
 * `handleEntryClick` itself (not a wrapper this file writes), clicking a
 * point/capsule here gets the exact same three-way open-new /
 * expand-minimized / deselect-expanded behavior StarMap's stars have -
 * see useEntrySelection.ts's CLICK OUTCOMES comment for the full
 * breakdown. In particular, re-clicking an already-expanded point or
 * capsule closes its panel (case 3) instead of doing nothing or
 * re-centering on it again - `expandedEntryId` goes back to `null` in
 * that case, which is exactly what the AUTO-RECENTER effect below
 * already guards on (`!expandedEntryId`), so that "don't recenter on a
 * deselect" exception falls out of the existing guard for free, with no
 * extra branching needed in this file. This completes parity with
 * StarMap's click behavior - neither view has to re-implement any of
 * this decision on its own anymore, both just forward clicks to the one
 * shared hook function.
 *
 * ──────────────────────────────────────────────────────────────────────
 * MISSING DATA POINTS (Stage 1 full-bleed regression) - ROOT CAUSE
 * ──────────────────────────────────────────────────────────────────────
 * After the Stage 1 refactor to this fixed-inset full-bleed canvas, some
 * of the 18-entry seed dataset appeared to stop rendering. Two
 * contributing causes were found:
 *
 *   1. VERTICAL OVERLAP WITH THE HEADER (the dominant, reproducible
 *      cause): `points`/`ranges` are drawn starting at `BASELINE_Y`
 *      (~30px inside the plot's own margin) - only ~54px from the top of
 *      the canvas. Timeline.tsx's floating header (title, subtitle, and
 *      FilterBar's category-toggle pills and sort-mode toggle - both of
 *      which have REAL, non-transparent backgrounds, unlike StarMap's
 *      title/subtitle text which is legible straight over the starfield)
 *      sits at a higher z-index directly on top of that same top-left
 *      region, roughly 150-250px tall and `w-[33vw]` wide. Any point
 *      whose x position lands within that leftmost ~33% of the canvas -
 *      concretely, in the seed dataset, the two oldest entries (2009,
 *      2010 - the C-Walk videos) - rendered exactly where the header's
 *      opaque FilterBar pills paint on top of them. They were never
 *      missing from the DOM or from `points`/`ranges`; they were only
 *      ever invisible, painted over by higher-z-index UI. Fixed by the
 *      VERTICAL CENTERING below, which keeps the plot's content entirely
 *      below `topOffset` (the header's actual measured bottom edge) -
 *      this fixes it for ANY dataset's date distribution, not just this
 *      one's two oldest entries.
 *   2. A TRANSIENT ZERO-SIZE SCALE ON THE FIRST FRAME: `size` (and
 *      therefore `innerWidth`, `baseXScale`'s pixel range, and every
 *      entry's `cx`) started at `{0, 0}` and was only measured inside a
 *      plain `useEffect`, which React runs AFTER the browser paints.
 *      With `baseXScale`'s range collapsed to `[0, 0]`, every entry
 *      would briefly compute to the exact same x=0 instead of being
 *      spread across the axis - not literally "missing" (a subsequent
 *      render corrects it once the real size is measured), but a real
 *      first-paint glitch that the same full-bleed timing this task
 *      called out to investigate. Switched to `useLayoutEffect` (see
 *      "Responsive sizing" below) so the size - and therefore the scale
 *      every position is computed from - is correct on entries' very
 *      first rendered frame, with no intermediate degenerate-scale paint
 *      to begin with.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Entry } from '../types/Entry';
import { getActivityColor } from '../utils/colors';
// Shared with StarMap.tsx's own hover tooltip - see EntryTooltip.tsx's
// header comment for why this was pulled out into one component instead
// of each visualization keeping its own copy of the markup.
import EntryTooltip from './EntryTooltip';

interface LinearTimelineProps {
  entries: Entry[];
  /**
   * activityTypes currently "active" - see useEntrySelection.ts's
   * CATEGORY FILTER comment. Points/ranges whose activityType is NOT in
   * this list are dimmed to FILTERED_OUT_OPACITY, mirroring StarMap.tsx's
   * treatment of its stars.
   */
  filterCategories: string[];
  /**
   * Called with the clicked entry when a point or range is clicked -
   * wired by Timeline.tsx to useEntrySelection's `handleEntryClick`, the
   * same shared open-new/expand-minimized/deselect-expanded callback
   * Constellation.tsx wires to StarMap's `onStarClick` - see the CLICK
   * PARITY WITH StarMap comment above.
   */
  onEntryClick: (entry: Entry) => void;
  /**
   * IDs of entries currently "opened" (represented by a panel, expanded
   * or minimized, in Timeline.tsx's SidebarPanelStack) - the exact same
   * prop, same source (useEntrySelection.ts), and same purpose as
   * StarMap.tsx's `openedEntryIds`: points/ranges whose id appears here
   * render the SELECTED-ENTRY HIGHLIGHT ring/glow below, matching
   * StarMap's "opened star" treatment.
   */
  openedEntryIds: string[];
  /**
   * The id of the entry whose panel is currently expanded (not
   * minimized), or `null` - same prop, same source, and same purpose as
   * StarMap.tsx's `expandedEntryId`: this is what the AUTO-RECENTER
   * effect below keys off, exactly like StarMap's CLICK-TO-CENTER effect.
   */
  expandedEntryId: string | null;
  /**
   * The sidebar overlay's current rendered width in pixels (0 when it
   * isn't rendered) - same prop, same source (Timeline.tsx's measured
   * `sidebarWidth`), and same purpose as StarMap.tsx's `sidebarWidth`:
   * the AUTO-RECENTER effect below excludes this band when computing
   * the horizontal centering target, exactly like StarMap's
   * CLICK-TO-CENTER effect does.
   */
  sidebarWidth: number;
  /**
   * Timeline.tsx's measured `headerLayout.top` - the same measurement
   * Constellation.tsx takes for SidebarPanelStack's own `top`, i.e.
   * where the floating header (title/subtitle + FilterBar) stack
   * actually ends. See the VERTICAL CENTERING comment below for why,
   * unlike StarMap (whose starfield has no equivalent vertical
   * exclusion - only `sidebarWidth`, horizontally), this canvas needs it
   * to keep its own structured content from rendering underneath the
   * header - see the MISSING DATA POINTS comment at the top of this file
   * for the bug this fixes.
   */
  topOffset: number;
}

/** Opacity applied to a point/range whose category is filtered out - same value as StarMap.tsx's FILTERED_OUT_OPACITY. */
const FILTERED_OUT_OPACITY = 0.15;

/**
 * Neutral, bright highlight color for the "opened entry" ring/glow -
 * same color, same reasoning as StarMap.tsx's OPENED_HIGHLIGHT_COLOR:
 * deliberately not tied to any activityType color, so it reads clearly
 * against every entry color.
 */
const OPENED_HIGHLIGHT_COLOR = '#ffffff';

/** Plot margins - room for the axis (bottom) and so edge points aren't clipped. */
const MARGIN = { top: 24, right: 24, bottom: 40, left: 24 };

/** Hint passed to d3's axis tick generator - see the AXIS EFFECT comment above. */
const TICK_COUNT = 7;

/** Small circle radius (px) - "small circle" per entry, as opposed to StarMap's varying "magnitude" stars. */
const POINT_RADIUS = 5;

/**
 * Fixed y-offset (px, within the inner/margined plot area) of the main
 * baseline row - where every point entry (no endTimestamp) renders, and
 * the reference row lane-assigned capsules stack downward from. See the
 * "LANE-BASED LAYOUT" comment above the `ranges` useMemo below for why
 * this is a fixed offset near the top of the plot's OWN content rather
 * than vertically centered *itself* - the plot as a whole is centered
 * within the canvas by the VERTICAL CENTERING logic below instead (see
 * `contentOffsetY`), which is a different, later-added concern from this
 * constant's original "keep points off the very top edge" job.
 */
const BASELINE_Y = 30;

/**
 * Vertical spacing (px) between stacked capsule lanes - lane 0 (the row
 * immediately below the baseline) sits at BASELINE_Y + LANE_HEIGHT, lane
 * 1 at BASELINE_Y + 2*LANE_HEIGHT, and so on. Within the 20-30px range
 * that reads as clearly separate rows without wasting vertical space.
 */
const LANE_HEIGHT = 26;

/**
 * Extra horizontal clearance (px, in xScale pixel units) required between
 * one capsule's end and the next capsule's start before they're allowed
 * to share a lane - see the LANE-ASSIGNMENT comment below. Without this,
 * two capsules whose date ranges are merely adjacent (not overlapping)
 * could still render close enough to visually blend into one shape,
 * especially once their rounded end caps (which extend slightly past the
 * raw start/end x, same as any round-linecap stroke) are drawn.
 */
const LANE_GAP_PX = 6;

/** Vertical gap (px) between the lowest occupied lane (or the baseline, if there are no capsules) and the time axis line. */
const AXIS_CLEARANCE = 24;

/**
 * Vertical room (px) reserved below the axis line for its tick label
 * text - part of the plot's own content footprint, used by the VERTICAL
 * CENTERING logic below (`plotContentHeight`) to center that whole
 * footprint, tick labels included, rather than accidentally centering
 * just the axis LINE and letting the label text hang past the bottom of
 * whatever space was left.
 */
const AXIS_LABEL_ROOM = 24;

/**
 * How far the user can zoom in/out. Lower bound matches StarMap's 0.5 (so
 * "zoomed out" feels the same amount looser in both views); the upper
 * bound is much higher than StarMap's 8 because zooming a *time* axis in
 * far enough to distinguish individual days - rather than just making
 * existing shapes bigger - needs a lot more scale range.
 */
const ZOOM_SCALE_EXTENT: [number, number] = [0.5, 40];

/**
 * Geometry for a `<rect>` that traces a capsule (range entry) shape -
 * `x`/`y`/`width`/`height` plus `rx` equal to half the height, which is
 * what turns a plain rounded-rect into a true stadium/pill (full
 * semicircular caps, identical to the capsule's own
 * `<line strokeLinecap="round">` shape) rather than just rounded corners.
 *
 * `extra` inflates the pill uniformly in every direction (like an SVG
 * outline offset) - passing 0 reproduces the capsule's own outline
 * exactly; the SELECTED-ENTRY HIGHLIGHT glow/ring below pass +5 / +3,
 * mirroring the +5 / +3 a point's glow/ring circles use relative to
 * POINT_RADIUS. This is what lets the highlight below be drawn as a
 * `fill="none"` OUTLINE (see that comment for why a solid shape here
 * would be a bug), rather than the flat-out-wider `<line>` this used to
 * be drawn as.
 */
function capsuleOutlineRect(
  cxStart: number,
  cxEnd: number,
  y: number,
  extra: number
) {
  const halfHeight = POINT_RADIUS + extra;
  return {
    x: cxStart - halfHeight,
    y: y - halfHeight,
    width: Math.max(0, cxEnd - cxStart) + halfHeight * 2,
    height: halfHeight * 2,
    rx: halfHeight,
  };
}

export default function LinearTimeline({
  entries,
  filterCategories,
  onEntryClick,
  openedEntryIds,
  expandedEntryId,
  sidebarWidth,
  topOffset,
}: LinearTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const axisRef = useRef<SVGGElement>(null);
  // Holds the same zoom *behavior* instance attached to the <svg> below,
  // so AUTO-RECENTER (see below) can programmatically drive it later,
  // outside of the 'zoom' event handler that normally drives it - same
  // role as StarMap.tsx's own `zoomBehaviorRef`.
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);

  // ─── Responsive sizing ───
  // Same ResizeObserver-on-a-container-ref pattern as StarMap.tsx - and,
  // now that the root is `fixed inset-0` (see the FULL-BLEED CANVAS
  // comment above), the SAME "measure the whole viewport" approach too:
  // both width AND height are tracked here, mirroring StarMap's `size`
  // state exactly, rather than only width with a content-driven height.
  //
  // `useLayoutEffect`, NOT `useEffect`: see the MISSING DATA POINTS
  // comment at the top of this file (cause #2) - this runs synchronously
  // after the DOM commits but BEFORE the browser paints, so `size` (and
  // therefore `baseXScale`'s pixel range and every entry's computed
  // position) is already correct on the very first frame anyone actually
  // sees, instead of painting one frame against a `{0, 0}` size first.
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerWidth = Math.max(0, size.width - MARGIN.left - MARGIN.right);

  // Set for O(1) membership checks per point/range, rebuilt only when the
  // prop itself changes - same pattern as StarMap.tsx's activeCategorySet.
  const activeCategorySet = useMemo(
    () => new Set<string>(filterCategories),
    [filterCategories]
  );

  // Set for O(1) membership checks per point/range - same pattern, same
  // source, and same purpose as StarMap.tsx's own `openedEntryIdSet`.
  const openedEntryIdSet = useMemo(
    () => new Set(openedEntryIds),
    [openedEntryIds]
  );

  // ─── Base time scale ───
  // Maps the full date range of `entries` onto [0, innerWidth] - see the
  // "D3 scaleTime + axisBottom PATTERN" comment above. Falls back to a
  // single-day domain when there are no entries (or no room to draw) so
  // scaleTime never sees an `undefined` bound; that fallback scale is
  // never actually rendered, since the EMPTY STATE branch below returns
  // before any of it is used.
  //
  // Includes each range entry's endTimestamp alongside every entry's
  // plain timestamp (mirroring SpiralTimeline.tsx's own domain
  // calculation) rather than extent-ing over timestamps alone - a range
  // entry whose end reaches past every other entry's timestamp would
  // otherwise get a domain that ends before its own end, pushing cxEnd
  // past innerWidth instead of landing inside the visible plot.
  const baseXScale = useMemo(() => {
    const dates = entries.flatMap(entry =>
      entry.endTimestamp
        ? [new Date(entry.timestamp), new Date(entry.endTimestamp)]
        : [new Date(entry.timestamp)]
    );
    const [minDate, maxDate] = d3.extent(dates);
    const domain: [Date, Date] =
      minDate && maxDate ? [minDate, maxDate] : [new Date(), new Date()];

    // A single-instant domain (one entry, or every entry on the same
    // timestamp) would otherwise map everything to the same x - pad it
    // out to a full day so a lone point still sits visibly inside the
    // plot instead of pinned to the left edge.
    if (domain[0].getTime() === domain[1].getTime()) {
      domain[0] = d3.timeDay.offset(domain[0], -1);
      domain[1] = d3.timeDay.offset(domain[1], 1);
    }

    return d3.scaleTime().domain(domain).range([0, innerWidth]);
  }, [entries, innerWidth]);

  // ─── Zoom transform ───
  // Holds only the *transform* d3-zoom last reported (translate + scale),
  // not a derived scale - `xScale` below recomputes from `baseXScale` +
  // this transform on every render via d3's own `rescaleX`, so it can
  // never drift out of sync with `baseXScale` when entries/size change.
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(
    d3.zoomIdentity
  );

  const xScale = useMemo(
    () => zoomTransform.rescaleX(baseXScale),
    [zoomTransform, baseXScale]
  );

  // ─── Pan/zoom behavior ───
  // Attached once (empty deps), same as StarMap's zoom effect, so the
  // behavior instance - and the user's current pan/zoom position - isn't
  // torn down and reset every time entries/size cause a re-render. The
  // handler only needs to report the transform; it doesn't need to close
  // over `baseXScale` at all (that's read fresh via the `xScale` useMemo
  // above on every render), so there's no staleness to guard against.
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_SCALE_EXTENT)
      .on('zoom', event => setZoomTransform(event.transform));

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svg.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  // ─── AXIS EFFECT ───
  // Re-runs the axisBottom generator against the current (possibly
  // zoomed) `xScale` whenever it changes - see the top-of-file comment
  // for why this has to be imperative rather than JSX. `text-xs` +
  // `fill-[var(--text-muted-color)]` on the tick labels, plus
  // `text-[var(--text-muted-color)]` on the <svg> itself (see the JSX
  // below) so the axis LINES - which d3 draws with `stroke="currentColor"`
  // and get no explicit class of their own - pick up the same muted color
  // via `currentColor`. Same convention D3Chart.tsx used for its bar
  // chart's axes.
  useEffect(() => {
    if (!axisRef.current || innerWidth === 0) return;

    const axis = d3
      .axisBottom(xScale)
      .ticks(TICK_COUNT)
      .tickFormat(
        d3.timeFormat('%b %Y') as (value: Date | d3.NumberValue) => string
      );

    d3.select(axisRef.current)
      .call(axis)
      .selectAll('text')
      .attr('class', 'fill-[var(--text-muted-color)] text-xs');
  }, [xScale, innerWidth]);

  // ─── Entry points ───
  // Point entries (no endTimestamp) all sit on one fixed baseline row
  // (`BASELINE_Y`) - unlike StarMap's 2D jitter, a timeline's whole point
  // is that position along the axis IS the meaningful data; a second,
  // arbitrary dimension would just add noise. Colored via the SAME
  // utils/colors.ts lookup StarMap uses for its stars, so an activity's
  // color means the same thing in both views - see the import comment
  // above.
  //
  // Split into `points` (no endTimestamp - a single dot on the baseline,
  // as before) and `ranges` (has endTimestamp - lane-assigned capsules
  // below the baseline, see the LANE-BASED LAYOUT comment on `ranges`
  // below) rather than one combined list, since the two need different
  // SVG shapes and different vertical placement rules - see the
  // endTimestamp field comment in types/Entry.ts.
  const points = useMemo(
    () =>
      entries
        .filter(entry => !entry.endTimestamp)
        .map(entry => ({
          entry,
          cx: xScale(new Date(entry.timestamp)),
          color: getActivityColor(entry.activityType),
        })),
    [entries, xScale]
  );

  /**
   * ──────────────────────────────────────────────────────────────────────
   * LANE-BASED LAYOUT FOR CAPSULES: GREEDY INTERVAL SCHEDULING
   * ──────────────────────────────────────────────────────────────────────
   * With every capsule pinned to one shared row, two entries whose date
   * ranges overlap (or nearly touch) would render on top of each other,
   * making both illegible - exactly the same problem overlapping events
   * in a calendar's day view solve with side-by-side columns, or a video
   * editor solves by putting one clip per track. The fix here is the same
   * "greedy interval scheduling" algorithm used for both of those: it's
   * the textbook minimum-number-of-rooms/tracks solution for "assign each
   * interval to the first row where it doesn't overlap anything already
   * there," and it's optimal (uses the fewest lanes possible) BECAUSE of
   * two properties of how it's applied:
   *
   *   1. PROCESS IN CHRONOLOGICAL (START-DATE) ORDER: a capsule can only
   *      ever conflict with capsules that started before it (nothing
   *      later has been placed yet when it's its turn), so checking
   *      "does this fit in lane 0? lane 1? ..." against only
   *      already-placed capsules is always checking against the complete
   *      relevant set - there's no already-processed capsule this one
   *      could still collide with that hasn't already been considered.
   *   2. TAKE THE FIRST (LOWEST-INDEX) NON-OVERLAPPING LANE, not just any
   *      open one: this keeps every lane's capsules packed as far left
   *      as possible over time, so a lane freed up by an earlier capsule
   *      ending gets reused by the next available capsule instead of
   *      lanes growing unboundedly - the number of lanes in use at any
   *      point equals the number of capsules whose date ranges are
   *      simultaneously "in progress," which is the true minimum needed
   *      for a collision-free layout.
   *
   * Each lane tracks only the rightmost `cxEnd` (in xScale pixel units,
   * which preserves chronological order since xScale is monotonic) it has
   * placed so far - a new capsule fits in that lane once its own `cxStart`
   * clears that value by `LANE_GAP_PX`, and the search always starts back
   * at lane 0 for every capsule (not "continue from the last lane used"),
   * which is what lets an early-ending capsule's lane be reclaimed later.
   */
  const ranges = useMemo(() => {
    const sortedByStart = entries
      .filter(entry => entry.endTimestamp)
      .map(entry => ({
        entry,
        cxStart: xScale(new Date(entry.timestamp)),
        cxEnd: xScale(new Date(entry.endTimestamp as string)),
        color: getActivityColor(entry.activityType),
      }))
      .sort((a, b) => a.cxStart - b.cxStart);

    // laneEndX[lane] = the rightmost cxEnd already placed in that lane.
    const laneEndX: number[] = [];

    return sortedByStart.map(range => {
      let lane = 0;
      while (
        laneEndX[lane] !== undefined &&
        range.cxStart < laneEndX[lane] + LANE_GAP_PX
      ) {
        lane++;
      }
      laneEndX[lane] = range.cxEnd;
      return { ...range, lane };
    });
  }, [entries, xScale]);

  // How many lanes are actually in use - drives the y-position of the
  // lowest capsule (and therefore the axis line below it). Zero when
  // there are no range entries at all.
  const laneCount = ranges.reduce(
    (max, range) => Math.max(max, range.lane + 1),
    0
  );

  // The axis line sits `AXIS_CLEARANCE` below the lowest occupied lane
  // (or the baseline itself, if there are no capsules at all - laneCount
  // is 0 in that case).
  const axisY = BASELINE_Y + laneCount * LANE_HEIGHT + AXIS_CLEARANCE;

  /**
   * ──────────────────────────────────────────────────────────────────────
   * VERTICAL CENTERING (accounting for the floating header)
   * ──────────────────────────────────────────────────────────────────────
   * Unlike StarMap - whose starfield is diffuse and deliberately allowed
   * to render underneath the semi-transparent floating header (see
   * Constellation.tsx's "TRANSPARENT CONTAINER, CONTRASTED CONTENT"
   * comment: StarMap's title/subtitle text is legible directly over the
   * stars) - this plot's axis + points are structured, readable content
   * that must NOT render underneath the header: FilterBar's category
   * toggles and sort-mode toggle both have real, non-transparent
   * backgrounds, so anything painted beneath them is fully hidden, not
   * just visually busy. That mismatch was the dominant cause of the
   * MISSING DATA POINTS bug described at the top of this file.
   *
   * `plotContentHeight` is the plot's own total vertical footprint - top
   * margin, down through the lowest occupied lane, the axis line, its
   * tick-label text, and a matching bottom margin - all as one number, so
   * it can be centered as a single block rather than centering just the
   * axis line and leaving the label text to hang wherever.
   *
   * `topOffset` (from Timeline.tsx's measured `headerLayout.top`, the
   * exact same value Constellation.tsx measures for SidebarPanelStack's
   * `top`) marks where the header stack actually ends. The plot is
   * centered within `[topOffset, size.height]` - the vertical band the
   * header does NOT cover - rather than within the full canvas height,
   * mirroring how StarMap's own CLICK-TO-CENTER (see below) centers
   * horizontally within `[sidebarWidth, size.width]` instead of the full
   * canvas width. `Math.max(0, ...)` is a floor, not just a fallback: it
   * guarantees `contentOffsetY` can never end up LESS than `topOffset`
   * (i.e. never renders above/into the header band) even if
   * `plotContentHeight` were somehow taller than the available height -
   * so this fixes the overlap unconditionally, for any dataset's date
   * spread or lane count, not just the seed dataset's specific shape.
   */
  const plotContentHeight =
    MARGIN.top + axisY + AXIS_LABEL_ROOM + MARGIN.bottom;
  const availableHeight = Math.max(0, size.height - topOffset);
  const contentOffsetY =
    topOffset + Math.max(0, (availableHeight - plotContentHeight) / 2);

  // ─── Hover tooltip ───
  // Tracks the hovered entry plus the raw viewport (clientX/clientY)
  // coordinates from the triggering mouse event - simplest way to
  // position a `fixed` tooltip div right next to the cursor without
  // converting through the SVG's own zoomed/panned coordinate space.
  // Rendered via the shared EntryTooltip component below (also used by
  // StarMap.tsx) - see its header comment for why this is a shared
  // pattern now rather than markup duplicated per view.
  const [hovered, setHovered] = useState<{
    entry: Entry;
    x: number;
    y: number;
  } | null>(null);

  /**
   * ──────────────────────────────────────────────────────────────────────
   * AUTO-RECENTER: PROGRAMMATIC PAN VIA d3-zoom's `.transform()`, TIED TO
   * THE EXPANDED-ENTRY STATE CHANGE
   * ──────────────────────────────────────────────────────────────────────
   * Same trigger, same `zoomBehavior.transform` + transition mechanism,
   * and same reasoning as StarMap.tsx's CLICK-TO-CENTER effect - keyed on
   * `expandedEntryId` itself (not called from the click handler directly)
   * so expanding a panel via a sidebar row click recenters exactly the
   * same as a direct click on the timeline does. See StarMap's own
   * comment for the full reasoning on why this lives in an effect keyed
   * on the prop rather than in the click handler.
   *
   * THE MATH HAS TO DIFFER FROM StarMap's, THOUGH - see the "PAN/ZOOM"
   * comment at the top of this file: StarMap transforms one `<g>`, so a
   * star's (x, y) is a fixed "world" coordinate independent of the
   * current zoom, and centering it is just "solve for the translate that
   * puts this fixed point at the target." Here, `xScale` (and therefore
   * every point/range's `cx`) already has the CURRENT zoom transform
   * baked in - so the "world" x to center on has to be read off
   * `baseXScale` (the UNZOOMED scale) instead, and the new transform's
   * `x` is solved the same way StarMap solves for its translate:
   * `screen = k * world + x`, so `x = target - k * world`, at the
   * CURRENT zoom level `k` (unchanged, same as StarMap preserving
   * `currentTransform.k`). `currentTransform.y` is carried over as-is
   * rather than recomputed - this view only ever reads `xScale`
   * (horizontal), so `y` has no visible effect on anything rendered here,
   * and preserving it (instead of, say, resetting to 0) avoids silently
   * fighting whatever y a user's own two-finger/trackpad pan gesture may
   * have already set.
   *
   * WHY THE TARGET IS `sidebarWidth + (width - sidebarWidth) / 2`, NOT
   * `width / 2`: same reasoning as StarMap's CLICK-TO-CENTER - `size` is
   * always the full viewport (see FULL-BLEED CANVAS above), not just the
   * region actually visible past the sidebar overlay, so the visible
   * band's own midpoint has to exclude `sidebarWidth` the same way
   * StarMap's target does. `- MARGIN.left` converts that SCREEN-space
   * target into the `<g transform="translate(MARGIN.left, ...)">`'s own
   * LOCAL coordinate space, which is what `cx`/`baseXScale` are already
   * expressed in.
   *
   * For a range entry (has `endTimestamp`), the midpoint of its start and
   * end is used as the "world" x to center on, rather than just its
   * start - centering on the capsule's start would visually push most of
   * a long-duration entry off to one side of the target instead of
   * centering the entry itself.
   */
  useEffect(() => {
    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior || !expandedEntryId) return;

    const target = entries.find(entry => entry.id === expandedEntryId);
    if (!target) return;

    const { width } = size;
    if (width === 0) return;

    const worldDate = target.endTimestamp
      ? new Date(
          (new Date(target.timestamp).getTime() +
            new Date(target.endTimestamp).getTime()) /
            2
        )
      : new Date(target.timestamp);
    const worldX = baseXScale(worldDate);

    const targetX = sidebarWidth + (width - sidebarWidth) / 2 - MARGIN.left;

    const currentTransform = d3.zoomTransform(svgNode);

    const centeredTransform = d3.zoomIdentity
      .translate(targetX, currentTransform.y)
      .scale(currentTransform.k) // preserve the user's current zoom level
      .translate(-worldX, 0);

    d3.select(svgNode)
      .transition()
      .duration(650) // 500-750ms: smooth, not sluggish - same duration as StarMap's
      .call(zoomBehavior.transform, centeredTransform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEntryId]);

  const isReady = size.width > 0 && size.height > 0;

  return (
    // `fixed inset-0` (not a layout child) - see the FULL-BLEED CANVAS
    // comment above. z-0, same base layer as StarMap.tsx: Timeline.tsx's
    // floating header and sidebar overlay both render above this with
    // their own higher z-index.
    <div ref={containerRef} className="fixed inset-0 z-0 bg-[var(--bg-color)]">
      {entries.length === 0 ? (
        // Same empty-state messaging pattern as the post-reset banner in
        // About.tsx (rounded-md border + colored border/bg/text trio) -
        // reused here rather than inventing a second visual language for
        // "there's nothing to show yet." `topOffset`-aware `top` (rather
        // than a flat `top-24`) so this never collides with the header
        // stack either, same reasoning as VERTICAL CENTERING above.
        <div
          className="absolute left-6 max-w-sm rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-sm text-indigo-300"
          style={{ top: topOffset + 24 }}
          role="status"
        >
          No entries yet. Click the + button (top right) to add your first one,
          and it'll show up here on the timeline.
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          className="cursor-grab text-[var(--text-muted-color)] active:cursor-grabbing"
        >
          <defs>
            {/*
             * Soft blur used behind opened entries' highlight ring, so it
             * reads as a glow rather than a hard-edged shape - same id
             * PATTERN and same filter primitive as StarMap.tsx's
             * `opened-star-glow` (kept as a separate id here since defs
             * ids are scoped per-<svg>, not shared across components).
             */}
            <filter
              id="opened-point-glow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <g transform={`translate(${MARGIN.left},${contentOffsetY})`}>
            {isReady &&
              // Range entries (endTimestamp set): a short horizontal
              // capsule from start to end x, instead of a single point -
              // `strokeLinecap="round"` is what turns a plain line into
              // a pill/capsule shape (rounded rather than square ends).
              // Same POINT_RADIUS-based thickness and hover/click wiring
              // as the single-point circles below, for visual and
              // interaction consistency between the two entry shapes.
              //
              // HIT-TESTING ACROSS THE WHOLE CAPSULE, NOT JUST ITS
              // CENTER: the mouse handlers below are attached to this
              // single <line> element covering the entire cxStart..cxEnd
              // span, not to a point at its midpoint - an SVG shape's
              // default `pointer-events: visiblePainted` makes its
              // rendered STROKE the hit-test area, so hovering/clicking
              // anywhere along this thick stroke (including the rounded
              // end caps) fires the same handlers, exactly as if the
              // whole capsule were one big target. No manual bounding-box
              // math or per-segment hit-testing is needed for this to
              // work across the full length.
              ranges.map(({ entry, cxStart, cxEnd, color, lane }) => {
                const isOpened = openedEntryIdSet.has(entry.id);
                const isFilteredOut = !activeCategorySet.has(
                  entry.activityType
                );
                const y = BASELINE_Y + (lane + 1) * LANE_HEIGHT;
                return (
                  // SELECTED-ENTRY HIGHLIGHT: one group per range, opacity
                  // applied once to the whole group (glow + capsule +
                  // ring) so a filtered-out capsule's highlight dims
                  // along with it - same structure as StarMap.tsx's
                  // per-star <g>.
                  <g
                    key={entry.id}
                    style={{
                      opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                    }}
                    className="transition-opacity duration-200"
                  >
                    {isOpened && (
                      // SELECTED-ENTRY HIGHLIGHT (capsule glow): same
                      // visual language as a point's glow circle just
                      // above/below - a blurred, `fill="none"` OUTLINE
                      // (not a filled shape) at +5px, so it reads as a
                      // soft halo AROUND the capsule rather than a filled
                      // disc behind it. Shaped as a rounded-rect "pill"
                      // (see capsuleOutlineRect) instead of a circle,
                      // since a capsule isn't circular - everything else
                      // (the same `opened-point-glow` blur filter, the
                      // same +5px inflation, the same 4px stroke width,
                      // the same 0.6 opacity) is identical to the point
                      // version above.
                      <rect
                        {...capsuleOutlineRect(cxStart, cxEnd, y, 5)}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={4}
                        strokeOpacity={0.6}
                        filter="url(#opened-point-glow)"
                        className="pointer-events-none"
                      />
                    )}
                    <line
                      x1={cxStart}
                      x2={cxEnd}
                      y1={y}
                      y2={y}
                      stroke={color}
                      strokeWidth={POINT_RADIUS * 2}
                      strokeLinecap="round"
                      strokeOpacity={0.85}
                      className="cursor-pointer"
                      onMouseEnter={event =>
                        setHovered({
                          entry,
                          x: event.clientX,
                          y: event.clientY,
                        })
                      }
                      onMouseMove={event =>
                        setHovered(current =>
                          current && current.entry.id === entry.id
                            ? { ...current, x: event.clientX, y: event.clientY }
                            : current
                        )
                      }
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => onEntryClick(entry)}
                    />
                    {isOpened && (
                      // SELECTED-ENTRY HIGHLIGHT (capsule ring): same
                      // visual language as a point's crisp ring just
                      // above/below - a `fill="none"` OUTLINE traced
                      // +3px outside the capsule's own edge, same 1.5px
                      // stroke width as the point ring. This used to be a
                      // plain wide `<line>` (effectively a SOLID capsule
                      // slightly bigger than the colored one, painted on
                      // top of it) - since a `<line>`'s stroke IS its
                      // whole visible shape, there's no way for a line to
                      // trace just an outline the way a `fill="none"`
                      // shape can, so that version visually washed the
                      // category color out under a near-opaque white
                      // overlay instead of framing it. capsuleOutlineRect
                      // (see its own comment) fixes that by tracing a
                      // true pill OUTLINE around the capsule instead,
                      // exactly like the point ring circle does around a
                      // dot - the category-colored capsule underneath
                      // stays fully visible, just framed.
                      <rect
                        {...capsuleOutlineRect(cxStart, cxEnd, y, 3)}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={1.5}
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}
            {isReady &&
              points.map(({ entry, cx, color }) => {
                const isOpened = openedEntryIdSet.has(entry.id);
                const isFilteredOut = !activeCategorySet.has(
                  entry.activityType
                );
                return (
                  // SELECTED-ENTRY HIGHLIGHT: same per-entry <g> + opacity
                  // + glow/ring structure as StarMap.tsx's stars.map() -
                  // see the comment on the range <g> above.
                  <g
                    key={entry.id}
                    style={{
                      opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                    }}
                    className="transition-opacity duration-200"
                  >
                    {isOpened && (
                      // Soft blurred halo, behind the point - same as
                      // StarMap's opened-star glow circle.
                      <circle
                        cx={cx}
                        cy={BASELINE_Y}
                        r={POINT_RADIUS + 5}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={4}
                        strokeOpacity={0.6}
                        filter="url(#opened-point-glow)"
                        className="pointer-events-none"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={BASELINE_Y}
                      r={POINT_RADIUS}
                      fill={color}
                      stroke={color}
                      strokeOpacity={0.35}
                      strokeWidth={4}
                      className="cursor-pointer"
                      onMouseEnter={event =>
                        setHovered({
                          entry,
                          x: event.clientX,
                          y: event.clientY,
                        })
                      }
                      onMouseMove={event =>
                        setHovered(current =>
                          current && current.entry.id === entry.id
                            ? { ...current, x: event.clientX, y: event.clientY }
                            : current
                        )
                      }
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => onEntryClick(entry)}
                    />
                    {isOpened && (
                      // Crisp thin ring on top, for a defined edge against
                      // the glow - same as StarMap's crisp ring drawn on
                      // top of an opened star.
                      <circle
                        cx={cx}
                        cy={BASELINE_Y}
                        r={POINT_RADIUS + 3}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={1.5}
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}
            <g ref={axisRef} transform={`translate(0,${axisY})`} />
          </g>
        </svg>
      )}

      {hovered && (
        <EntryTooltip entry={hovered.entry} x={hovered.x} y={hovered.y} />
      )}
    </div>
  );
}
