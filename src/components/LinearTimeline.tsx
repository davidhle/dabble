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
 * Pan/zoom is also now bounded, not unconstrained: `baseXScale`'s domain
 * comes from `domainRange` (TimeRangeContext's `selectedRange`, via
 * Timeline.tsx) rather than the full dataset's own min/max - see the
 * DOMAIN COMES FROM domainRange and PAN/ZOOM CONSTRAINED TO domainRange
 * comments further down for why, and for how `translateExtent` keeps a
 * user from panning/zooming past the edges of whatever window they've
 * selected.
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
 * capsule closes its panel (case 3) instead of doing nothing. This
 * completes parity with
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
import { Category, getVisualStyle } from '../types/Category';
import {
  HOLLOW_POINT_STROKE_WIDTH,
  HOLLOW_WAVE_GLOW_BLUR_STD_DEVIATION,
  HOLLOW_WAVE_GLOW_OPACITY,
  HOLLOW_WAVE_GLOW_STROKE_WIDTH,
  HOLLOW_WAVE_HIT_STROKE_WIDTH,
  HOLLOW_WAVE_OPACITY,
  HOLLOW_WAVE_STROKE_WIDTH,
  buildPolylinePath,
  clampHollowWaveAmplitude,
  hollowWaveCycles,
  hollowWaveSampleCount,
} from '../utils/hollowGlyphs';
import { DateRange, useTimeRange } from '../context/TimeRangeContext';
import { getActivityColor } from '../utils/colors';
// Shared with StarMap.tsx's own hover tooltip - see EntryTooltip.tsx's
// header comment for why this was pulled out into one component instead
// of each visualization keeping its own copy of the markup.
import EntryTooltip from './EntryTooltip';
import type { SidebarSide } from '../hooks/useSidebarWidth';
import VizEmptyState from './VizEmptyState';
import { assignLanes } from '../utils/laneAssignment';
import {
  FOCUSED_GLOW_OPACITY,
  FOCUSED_GLOW_STROKE_WIDTH,
  FOCUSED_RING_STROKE_WIDTH,
} from '../utils/focusHighlight';

interface LinearTimelineProps {
  entries: Entry[];
  /**
   * The current category list - Timeline.tsx's own `categories` (already
   * recomputed off `categoriesVersion`, see EntrySelectionContext.tsx's own
   * comment on that field). Read to split entries into solid vs. hollow
   * (getVisualStyle - see the HOLLOW ENTRIES comment), which falls back to
   * each category's domain; colors still come from getActivityColor.
   * Being a dependency of the `points`/`ranges`/hollow useMemos is also
   * what makes a ManageCategoriesModal recolor/re-domain (which never
   * touches `entries`) recompute them instead of leaving stale colors or
   * shapes on screen.
   */
  categories: Category[];
  /**
   * Whether the RAW, unfiltered dataset (Timeline.tsx's own
   * `entries.length > 0`, not the time-filtered `entries` prop above) has
   * any entries at all - passed straight through to VizEmptyState.tsx so
   * it can distinguish "no data exists" from "filtered to nothing" - see
   * that component's own top-of-file comment for the full reasoning.
   */
  hasAnyEntries: boolean;
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
   * minimized), or `null` - same prop and source as StarMap.tsx's
   * `expandedEntryId`. Only used for the brighter FOCUSED highlight here;
   * this view deliberately doesn't recenter on it (see the "No
   * auto-recenter" note after the hover handlers).
   */
  expandedEntryId: string | null;
  /**
   * The screen band the sidebar covers, in pixels (Timeline.tsx's
   * measured `sidebarWidth`) - the axis starts SIDEBAR_GUTTER past it;
   * see the CANVAS ORIGIN SHIFT comment.
   */
  sidebarWidth: number;
  /** Which screen edge `sidebarWidth`'s band is on - see useSidebarWidth.ts's SidebarSide comment. */
  sidebarSide: SidebarSide;
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
  /**
   * The free vertical band (viewport px) the plot centers itself in - see
   * the VERTICAL CENTERING comment. `top` is just under the navbar (the
   * sidebar container's own top), `bottom` is TimeRangeSelector's card
   * top; either is 0 until Timeline.tsx has measured it, in which case
   * the canvas's own edge stands in.
   */
  plotBand: { top: number; bottom: number };
  /**
   * The visible axis window - Timeline.tsx's TimeRangeContext
   * `selectedRange`. `baseXScale`'s domain is built from THIS now,
   * instead of `entries`' own min/max timestamp the way it used to be -
   * see the DOMAIN COMES FROM domainRange comment below for why, and
   * PAN/ZOOM CONSTRAINED TO domainRange for how this also bounds
   * d3-zoom's `translateExtent`. `entries` itself is expected to already
   * be filtered to (roughly) this same window by Timeline.tsx - see its
   * own comment - but `domainRange` is threaded through separately
   * rather than re-derived from the (already-filtered) `entries` prop,
   * so the axis still shows the FULL selected window even when the
   * entries that happen to fall inside it cluster away from one edge.
   */
  domainRange: DateRange;
  /**
   * Whether the shared, cross-page Edit Mode flag (EditModeContext.tsx)
   * is currently on - passed straight through to VizEmptyState.tsx so its
   * "filtered" message knows whether EditModeBanner.tsx is ALSO occupying
   * the shared top-right tooltip stack's top slot (see that file's own
   * EDIT MODE STACKING comment). PURELY PRESENTATIONAL - see StarMap.tsx's
   * identical `isEditMode` prop comment for why this doesn't change
   * LinearTimeline's own click behavior.
   */
  isEditMode: boolean;
}

/** Opacity applied to a point/range whose category is filtered out - same value as StarMap.tsx's FILTERED_OUT_OPACITY. */
const FILTERED_OUT_OPACITY = 0.15;

/**
 * Neutral, bright highlight color for the "opened entry" ring/glow - same
 * color, same reasoning as StarMap.tsx's OPENED_HIGHLIGHT_COLOR:
 * deliberately not tied to any activityType color, so it reads clearly
 * against every entry color. A theme token (--star-highlight-color), not
 * a fixed hex value - see StarMap.tsx's own comment on its identical
 * constant for why.
 */
const OPENED_HIGHLIGHT_COLOR = 'var(--star-highlight-color)';

/** Plot margins - room for the axis (bottom) and so edge points aren't clipped. */
const MARGIN = { top: 24, right: 24, bottom: 40, left: 24 };

/**
 * Gap (px) between the sidebar's canvas-facing edge and where the axis
 * starts - see the CANVAS ORIGIN SHIFT comment below.
 */
const SIDEBAR_GUTTER = 20;

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
 * ──────────────────────────────────────────────────────────────────────
 * HOLLOW ENTRIES: RINGS + SINE WAVES, OUTSIDE THE LANE SYSTEM
 * ──────────────────────────────────────────────────────────────────────
 * The flat-axis version of SpiralTimeline.tsx's "ORBIT ENTRIES": entries
 * whose getVisualStyle is 'hollow' (an explicit per-entry override, else
 * hollow for an 'Orbit'-domain category) skip `points`/`ranges` and never
 * take part in `assignLanes`, so they don't push capsules down or count
 * toward `laneCount`. Both sit on the BASELINE row, where solid points
 * live:
 *   - A single-date hollow entry is a ring: a POINT_RADIUS circle filled
 *     with --bg-color (a "cutout") and bordered in the category color.
 *   - A hollow range is a thin stroked sine wave from its start x to its
 *     end x, offset vertically (the axis is horizontal, so "perpendicular"
 *     is straight up/down) by `amplitude * sin(2π * cycles * phase)`.
 *     Stroke, glow and opacity are shared with Spiral via
 *     utils/hollowGlyphs.ts, as is the duration-based oscillation count -
 *     but capped here by HOLLOW_WAVE_MIN_WAVELENGTH_PX, since this axis
 *     can give an entry far less room. Amplitude is a fraction of
 *     LANE_HEIGHT (below), clamped to the same px range Spiral uses.
 * Drawn waves first (behind everything, like Spiral's), then capsules,
 * then hollow rings, then solid points - so a solid point on top of a
 * ring or wave keeps the click.
 */
const HOLLOW_WAVE_AMPLITUDE_FRACTION_OF_LANE = 0.3;

/**
 * Shortest wavelength (px) a hollow wave may have at the selected range's
 * UNZOOMED width. The shared duration-based cycle count (hollowWaveCycles)
 * suits Spiral, whose outer loops give an entry lots of room, but on this
 * flat axis a months-long entry across a years-wide window can be only a
 * few dozen px - e.g. a 6-month entry over the full ~17-year range is
 * ~29px, where its 12 cycles would be ~2.4px apart and read as a solid
 * line. So the count is capped to what fits at this wavelength (down to a
 * single cycle). Measured on `baseXScale`, not the zoomed `xScale`, so
 * zooming in stretches the wave instead of adding crests - same as before.
 */
const HOLLOW_WAVE_MIN_WAVELENGTH_PX = 16;

/** How far (px) a drag must move before it starts sliding the selected range - see DRAG SLIDES A SUB-RANGE THROUGH TIME. */
const SLIDE_DEAD_ZONE_PX = 3;

/** A range's duration in ms. */
function rangeSpan(range: DateRange): number {
  return range.end.getTime() - range.start.getTime();
}

/**
 * The x of a drag's pointer, from d3-zoom's `sourceEvent` - null for
 * anything that isn't a single-pointer mouse/touch drag (wheel, dblclick,
 * a programmatic transform, a two-finger pinch).
 */
function pointerClientX(sourceEvent: unknown): number | null {
  if (
    sourceEvent instanceof MouseEvent &&
    !(sourceEvent instanceof WheelEvent)
  ) {
    return sourceEvent.type === 'dblclick' ? null : sourceEvent.clientX;
  }
  if (
    typeof TouchEvent !== 'undefined' &&
    sourceEvent instanceof TouchEvent &&
    sourceEvent.touches.length === 1
  ) {
    return sourceEvent.touches[0].clientX;
  }
  return null;
}

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
  categories,
  hasAnyEntries,
  filterCategories,
  onEntryClick,
  openedEntryIds,
  expandedEntryId,
  sidebarWidth,
  sidebarSide,
  topOffset,
  plotBand,
  domainRange,
  isEditMode,
}: LinearTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const axisRef = useRef<SVGGElement>(null);
  // Holds the same zoom *behavior* instance attached to the <svg> below,
  // so the translateExtent and domain-reset effects can drive it outside
  // the 'zoom' event handler - same role as StarMap.tsx's own
  // `zoomBehaviorRef`.
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

  /**
   * ──────────────────────────────────────────────────────────────────────
   * CANVAS ORIGIN SHIFT: A DIRECT SHIFT, NOT A PAN - AND WHY, UNLIKE
   * StarMap
   * ──────────────────────────────────────────────────────────────────────
   * StarMap.tsx keeps stars at fixed "world" coordinates spanning the
   * ENTIRE canvas regardless of the sidebar, and instead PANS (via a
   * d3-zoom transform on its zoom layer `<g>`) so a clicked star ends up
   * visually centered in whatever region the sidebar isn't covering - the
   * star field itself never "moves" in world-space, only the VIEW into it
   * does. That works well for StarMap because its layout has no inherent
   * left-to-right meaning - a cluster's *position* on screen is already
   * somewhat arbitrary (see StarMap's own CLUSTERING comment), so panning
   * the view is indistinguishable from moving the content.
   *
   * A time axis is different: x position IS the data (see the D3 scaleTime
   * comment at the top of this file) - "where on screen does this render"
   * and "what date does this represent" are the same question, mediated
   * only by `baseXScale`. Rather than draw the FULL axis somewhere off to
   * the left (behind the sidebar) and rely on panning to bring the
   * relevant part into view - which is what StarMap-style recentering
   * would mean here - `contentOriginX` instead moves the scale's own
   * pixel RANGE to start `SIDEBAR_GUTTER`px past the sidebar's right edge
   * in the first place. The whole axis (not just whichever entry happens
   * to be expanded) is never drawn under the sidebar to begin with,
   * rather than being drawn there and then panned out from under it - a
   * direct, structural fix rather than a runtime workaround, which fits a
   * single linear axis (one meaningful x-origin) better than it would fit
   * StarMap's free-form 2D field (where "the origin" isn't a single
   * meaningful place to begin with).
   *
   * `innerWidth` (and therefore `baseXScale`'s pixel range) shrinks to
   * match: the full `domainRange` window still maps across exactly the
   * REMAINING visible width - `size.width` minus this shifted origin
   * minus `MARGIN.right` - rather than the origin moving right while the
   * range width stays the same, which would just push content off the
   * right edge instead of fitting it into the smaller visible area.
   * `sidebarWidth === 0` (no panel open) falls back to the plain
   * `MARGIN.left` origin this always used, unchanged.
   */
  //
  // Mirrored when the sidebar is on the right: the content band starts at
  // the plain left margin and instead stops short of the sidebar's band
  // (plus the same gutter) on the right - so `innerWidth / 2` below still
  // centers within the visible area either way.
  const sidebarBand = sidebarWidth > 0 ? sidebarWidth + SIDEBAR_GUTTER : 0;
  const contentOriginX =
    sidebarSide === 'left' && sidebarBand > 0 ? sidebarBand : MARGIN.left;
  const contentEndMargin =
    sidebarSide === 'right' && sidebarBand > 0 ? sidebarBand : MARGIN.right;
  const innerWidth = Math.max(
    0,
    size.width - contentOriginX - contentEndMargin
  );

  // Set for O(1) membership checks per point/range, rebuilt only when the
  // prop itself changes - same pattern as StarMap.tsx's activeCategorySet.
  const activeCategorySet = useMemo(
    () => new Set<string>(filterCategories),
    [filterCategories]
  );

  // Whether there's anything actually visible to plot right now - see
  // StarMap.tsx's identical `isEmpty` comment and VizEmptyState.tsx's own
  // top-of-file comment for the full reasoning (this single check covers
  // both the time filter and the category filter as a possible cause).
  const isEmpty = useMemo(
    () => !entries.some(entry => activeCategorySet.has(entry.activityType)),
    [entries, activeCategorySet]
  );

  // Set for O(1) membership checks per point/range - same pattern, same
  // source, and same purpose as StarMap.tsx's own `openedEntryIdSet`.
  const openedEntryIdSet = useMemo(
    () => new Set(openedEntryIds),
    [openedEntryIds]
  );

  /**
   * ──────────────────────────────────────────────────────────────────────
   * DOMAIN COMES FROM domainRange, NOT `entries`
   * ──────────────────────────────────────────────────────────────────────
   * This used to derive its domain from `entries`' own min/max timestamp
   * (via d3.extent) - the axis showed exactly whatever window the
   * *visible* entries happened to span, nothing more or less. Now that
   * Timeline.tsx pre-filters `entries` down to whatever
   * TimeRangeContext's `selectedRange` is (see that prop's own comment),
   * doing the same "extent over the entries I was handed" would show a
   * SMALLER window than what the user actually selected whenever the
   * surviving entries happen to cluster away from one or both edges of
   * `domainRange` - e.g. selecting all of 2023 but every remaining entry
   * happens to fall in June would shrink the axis down to just June,
   * silently contradicting the range the user asked to see. Building the
   * domain from `domainRange` directly instead keeps the axis showing
   * the FULL selected window regardless of how the entries inside it are
   * actually distributed - the same reason TimeRangeSelector.tsx's own
   * brush track always shows `fullRange`, not `selectedRange`.
   *
   * The single-instant padding fallback stays as a defensive guard (in
   * case `domainRange.start === domainRange.end`, e.g. a maximally
   * narrowed brush) even though TimeRangeContext's own `computeFullRange`
   * already pads a degenerate range the same way, so this scale can never
   * end up with a literal zero-width domain regardless of what produced
   * `domainRange`.
   */
  const baseXScale = useMemo(() => {
    const domain: [Date, Date] = [domainRange.start, domainRange.end];

    if (domain[0].getTime() === domain[1].getTime()) {
      domain[0] = d3.timeDay.offset(domain[0], -1);
      domain[1] = d3.timeDay.offset(domain[1], 1);
    }

    return d3.scaleTime().domain(domain).range([0, innerWidth]);
  }, [domainRange, innerWidth]);

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

  /**
   * ──────────────────────────────────────────────────────────────────────
   * DRAG SLIDES A SUB-RANGE THROUGH TIME
   * ──────────────────────────────────────────────────────────────────────
   * While a sub-range is selected (`selectedRange` shorter than
   * `fullRange`), dragging the canvas doesn't pan within that window - it
   * SLIDES the window itself: the pointer's x-delta since the drag began
   * is converted to a time shift at the current zoom (so the content under
   * the cursor follows it) and written straight to TimeRangeContext, so
   * TimeRangeSelector's brush moves live. The window keeps its duration
   * and is clamped to `fullRange` at both ends.
   *
   * d3-zoom still runs the gesture (it owns click-vs-drag detection, and
   * wheel/pinch zoom are untouched), but a sliding drag's own translate is
   * discarded: the rendered `zoomTransform` stays at the drag's starting
   * transform, and on 'end' d3's internal node-level transform is put
   * back to it too, so the next wheel zoom continues from where the user
   * actually is. The x-delta comes from the raw pointer event rather than
   * `event.transform`, since `translateExtent` (PAN/ZOOM CONSTRAINED TO
   * domainRange, below) clamps the latter to zero at 1x zoom.
   *
   * Handlers are attached once, so they read the latest ranges/width via
   * `slideInputsRef`. `slidRangeRef` marks the range this component set
   * itself, so RESET PAN/ZOOM WHEN domainRange CHANGES can tell a slide
   * (keep the zoom) from a brush drag or reset (start fresh).
   */
  const { fullRange, selectedRange, setSelectedRange } = useTimeRange();
  const slideInputsRef = useRef({
    fullRange,
    selectedRange,
    setSelectedRange,
    innerWidth: 0,
  });
  slideInputsRef.current = {
    fullRange,
    selectedRange,
    setSelectedRange,
    innerWidth,
  };
  const slidRangeRef = useRef<DateRange | null>(null);

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

    // See DRAG SLIDES A SUB-RANGE THROUGH TIME above.
    let slide: {
      startClientX: number;
      startRange: DateRange;
      startTransform: d3.ZoomTransform;
      moved: boolean;
    } | null = null;

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_SCALE_EXTENT)
      .on('start', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        slide = null;
        const clientX = pointerClientX(event.sourceEvent);
        const { fullRange: full, selectedRange: selected } =
          slideInputsRef.current;
        if (clientX === null || rangeSpan(selected) >= rangeSpan(full)) {
          return;
        }
        slide = {
          startClientX: clientX,
          startRange: selected,
          startTransform: event.transform,
          moved: false,
        };
      })
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const clientX = pointerClientX(event.sourceEvent);
        // Only a one-pointer drag at the starting zoom slides - a pinch
        // (scale changing mid-gesture) zooms as usual.
        if (
          slide &&
          clientX !== null &&
          event.transform.k === slide.startTransform.k
        ) {
          const {
            fullRange: full,
            innerWidth: width,
            setSelectedRange: setRange,
          } = slideInputsRef.current;
          const dx = clientX - slide.startClientX;
          // Dead zone, so a click's jitter doesn't nudge the range.
          if (!slide.moved && Math.abs(dx) < SLIDE_DEAD_ZONE_PX) return;
          const span = rangeSpan(slide.startRange);
          const msPerPx = span / (Math.max(1, width) * slide.startTransform.k);
          const unclampedStart =
            slide.startRange.start.getTime() - dx * msPerPx;
          const start = Math.min(
            Math.max(unclampedStart, full.start.getTime()),
            full.end.getTime() - span
          );
          const next = { start: new Date(start), end: new Date(start + span) };
          slide.moved = true;
          slidRangeRef.current = next;
          setRange(next);
          return;
        }
        setZoomTransform(event.transform);
      })
      .on('end', () => {
        if (slide?.moved && svgRef.current) {
          d3.select(svgRef.current).property('__zoom', slide.startTransform);
        }
        slide = null;
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svg.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  /**
   * ──────────────────────────────────────────────────────────────────────
   * PAN/ZOOM CONSTRAINED TO domainRange
   * ──────────────────────────────────────────────────────────────────────
   * d3-zoom's `translateExtent` bounds how far the user can PAN (zoom
   * SCALE stays governed separately by `.scaleExtent(ZOOM_SCALE_EXTENT)`
   * above) - it's specified in the same "world" pixel coordinate space
   * `baseXScale`'s own RANGE already uses: `[0, innerWidth]`. Since
   * `baseXScale`'s DOMAIN is now `domainRange` itself (see the comment on
   * `baseXScale` above) rather than the full dataset's own min/max,
   * constraining translateExtent to this exact pixel box is what keeps
   * the user from panning/zooming past the selected window's edges - they
   * can still zoom in and pan freely WITHIN `domainRange`, just can't
   * reveal empty space beyond it the way panning with no extent set at
   * all (the previous behavior) allowed.
   *
   * Deliberately does NOT depend on `domainRange` itself: these bounds
   * are pixel bounds - `[0, innerWidth]` × `[0, size.height]` - the same
   * regardless of which calendar dates currently map to them, only the
   * container's own size changes them. Updating `translateExtent` on an
   * already-attached behavior (via `zoomBehavior.translateExtent(...)`,
   * not recreating the whole behavior) doesn't reset the user's current
   * pan/zoom position, unlike the effect below.
   *
   * `innerWidth` itself already accounts for the sidebar now too - see
   * the CANVAS ORIGIN SHIFT comment on `innerWidth`'s own definition -
   * so this effect needs no separate `sidebarWidth` handling of its own;
   * it just reacts to `innerWidth` changing, whatever the reason.
   */
  useEffect(() => {
    const zoomBehavior = zoomBehaviorRef.current;
    if (!zoomBehavior) return;

    zoomBehavior.translateExtent([
      [0, 0],
      [innerWidth, size.height],
    ]);
  }, [innerWidth, size.height]);

  /**
   * ──────────────────────────────────────────────────────────────────────
   * RESET PAN/ZOOM WHEN domainRange CHANGES
   * ──────────────────────────────────────────────────────────────────────
   * Selecting a different window on TimeRangeSelector.tsx's brush changes
   * what `baseXScale`'s domain even MEANS - the same `zoomTransform`
   * `{k, x}` values, reapplied via `rescaleX` to a brand new domain,
   * would show some scaled/offset slice of the NEW window that has no
   * relation to whatever the user was previously panned/zoomed to. Driving
   * the reset THROUGH `zoomBehavior.transform` (not just resetting the
   * `zoomTransform` React state directly) matters for the same reason
   * StarMap.tsx's RESET-VIEW effect does it that way: d3-zoom tracks its
   * OWN current transform on the `<svg>` DOM node, independent of React
   * state, so only driving the change through the behavior itself keeps
   * that internal node-level state in sync too - otherwise the NEXT
   * drag/scroll gesture would continue from the stale pre-reset transform
   * instead of the identity one this just set.
   *
   * `isFirstDomainRange` skips the very first run (mount) - `zoomTransform`
   * already starts at `d3.zoomIdentity`, so there's nothing to reset yet;
   * same "skip the first signal" guard StarMap.tsx's own RESET-VIEW effect
   * uses for its `resetViewSignal` prop.
   */
  const isFirstDomainRange = useRef(true);
  useEffect(() => {
    if (isFirstDomainRange.current) {
      isFirstDomainRange.current = false;
      return;
    }

    // A drag-slide (DRAG SLIDES A SUB-RANGE THROUGH TIME) moves the
    // window on purpose and keeps the user's zoom - only other range
    // changes (the brush, a reset, a year glyph) start fresh.
    if (domainRange === slidRangeRef.current) return;

    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior) return;

    d3.select(svgNode).call(zoomBehavior.transform, d3.zoomIdentity);
  }, [domainRange]);

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
  //
  // `.style('font-family', ...)` is set explicitly (not left to CSS
  // inheritance) because these tick `<text>` elements otherwise render in
  // the browser's own SVG UA-stylesheet default font rather than
  // --font-body ('Sen') - unlike an HTML element, an SVG `<text>` isn't
  // guaranteed to inherit `font-family` from its ancestors, so it has to
  // be set directly on the element itself, the same as the `fill`/
  // `text-xs` class right above it.
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
      .attr('class', 'fill-[var(--text-muted-color)] text-xs')
      .style('font-family', 'var(--font-body)');
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
  //
  // Both lists hold SOLID entries only - hollow ones get their own
  // `hollowPoints`/`hollowRanges` below (see the HOLLOW ENTRIES comment).
  const { solidEntries, hollowEntries } = useMemo(() => {
    const solid: Entry[] = [];
    const hollow: Entry[] = [];
    for (const entry of entries) {
      (getVisualStyle(entry, categories) === 'hollow' ? hollow : solid).push(
        entry
      );
    }
    return { solidEntries: solid, hollowEntries: hollow };
  }, [entries, categories]);

  const points = useMemo(
    () =>
      solidEntries
        .filter(entry => !entry.endTimestamp)
        .map(entry => ({
          entry,
          cx: xScale(new Date(entry.timestamp)),
          color: getActivityColor(entry.activityType),
        })),
    [solidEntries, xScale]
  );

  // HOLLOW ENTRIES - see that comment above. Rings on the baseline.
  const hollowPoints = useMemo(
    () =>
      hollowEntries
        .filter(entry => !entry.endTimestamp)
        .map(entry => ({
          entry,
          cx: xScale(new Date(entry.timestamp)),
          color: getActivityColor(entry.activityType),
        })),
    [hollowEntries, xScale]
  );

  // HOLLOW ENTRIES - sine waves along the baseline. Rebuilt on zoom (via
  // `xScale`), but the cycle count comes from the entry's own dates, so
  // zooming stretches the wave rather than adding crests.
  const hollowRanges = useMemo(() => {
    const amplitude = clampHollowWaveAmplitude(
      LANE_HEIGHT * HOLLOW_WAVE_AMPLITUDE_FRACTION_OF_LANE
    );
    return hollowEntries
      .filter(entry => entry.endTimestamp)
      .map(entry => {
        const startMs = new Date(entry.timestamp).getTime();
        const endMs = new Date(entry.endTimestamp as string).getTime();
        const x0 = xScale(new Date(Math.min(startMs, endMs)));
        const x1 = xScale(new Date(Math.max(startMs, endMs)));
        const baseLength = Math.abs(
          baseXScale(new Date(endMs)) - baseXScale(new Date(startMs))
        );
        // Capped so each wavelength stays legible - see
        // HOLLOW_WAVE_MIN_WAVELENGTH_PX. Rounded to a half cycle like
        // hollowWaveCycles, so the wave still ends on the baseline.
        const cycles = Math.max(
          1,
          Math.min(
            hollowWaveCycles(Math.abs(endMs - startMs)),
            Math.round((baseLength / HOLLOW_WAVE_MIN_WAVELENGTH_PX) * 2) / 2
          )
        );
        const sampleCount = hollowWaveSampleCount(cycles);
        const samples: { x: number; y: number }[] = [];
        for (let i = 0; i <= sampleCount; i++) {
          const phase = i / sampleCount;
          samples.push({
            x: x0 + (x1 - x0) * phase,
            y: BASELINE_Y + amplitude * Math.sin(2 * Math.PI * cycles * phase),
          });
        }
        return {
          entry,
          pathD: buildPolylinePath(samples),
          color: getActivityColor(entry.activityType),
        };
      });
  }, [hollowEntries, xScale, baseXScale]);

  /**
   * ──────────────────────────────────────────────────────────────────────
   * LANE-BASED LAYOUT FOR CAPSULES: GREEDY INTERVAL SCHEDULING
   * ──────────────────────────────────────────────────────────────────────
   * With every capsule pinned to one shared row, two entries whose date
   * ranges overlap (or nearly touch) would render on top of each other,
   * making both illegible - exactly the same problem overlapping events
   * in a calendar's day view solve with side-by-side columns, or a video
   * editor solves by putting one clip per track. The fix here is the same
   * "greedy interval scheduling" algorithm used for both of those: "assign
   * each interval to the first row where it doesn't overlap anything
   * already placed there." Two properties of how it's applied matter:
   *
   *   1. PROCESSING ORDER DECIDES WHICH CAPSULE WINS A GIVEN LANE, NOT
   *      WHETHER THE RESULT IS COLLISION-FREE: placement safety holds
   *      regardless of the order capsules are considered in - see
   *      utils/laneAssignment.ts's own header comment for why
   *      `laneEnd[lane]` is always the true max end assigned to that lane
   *      so far no matter what order items arrive in. What DOES depend on
   *      order is which capsule gets first crack at lane 0 (and each lane
   *      after it) whenever several overlap: that function sorts by
   *      DURATION DESCENDING rather than by start date, specifically so a
   *      long-spanning capsule reliably wins the base lane instead of
   *      whichever capsule merely happened to start first - see that
   *      file's "WHY DURATION-DESCENDING PROCESSING ORDER" comment for the
   *      full reasoning, and the trade-off against the guaranteed-minimum-
   *      lane-count result start-date order would otherwise give.
   *   2. TAKE THE FIRST (LOWEST-INDEX) NON-OVERLAPPING LANE, not just any
   *      open one: this keeps lanes reused rather than growing
   *      unboundedly - a lane freed up by an earlier-ending capsule (in
   *      xScale position, not processing order) gets reclaimed by the
   *      next capsule that fits there.
   *
   * Each lane tracks only the rightmost `cxEnd` (in xScale pixel units) it
   * has placed so far - a new capsule fits in that lane once its own
   * `cxStart` clears that value by `LANE_GAP_PX`, and the search always
   * starts back at lane 0 for every capsule (not "continue from the last
   * lane used"), which is what lets an early-ending capsule's lane be
   * reclaimed later.
   *
   * The actual assignment loop lives in utils/laneAssignment.ts's
   * `assignLanes` now, shared verbatim with SpiralTimeline.tsx - see that
   * file's own header comment for why the ALGORITHM (which lane number
   * each range gets) is identical between the two views, and its
   * "RADIAL LANE OFFSET" comment for the one thing that differs: what a
   * "lane" is offset BY visually.
   */
  const ranges = useMemo(() => {
    const items = solidEntries
      .filter(entry => entry.endTimestamp)
      .map(entry => ({
        entry,
        cxStart: xScale(new Date(entry.timestamp)),
        cxEnd: xScale(new Date(entry.endTimestamp as string)),
        color: getActivityColor(entry.activityType),
      }));

    return assignLanes(
      items,
      item => item.cxStart,
      item => item.cxEnd,
      LANE_GAP_PX
    );
  }, [solidEntries, xScale]);

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
   * VERTICAL CENTERING (within the band the chrome leaves free)
   * ──────────────────────────────────────────────────────────────────────
   * The plot centers its VISIBLE footprint - from half a lane above the
   * baseline row (room for points, rings and hollow waves) down to the
   * bottom of the axis tick labels - within `plotBand`: below the navbar
   * and above TimeRangeSelector's card, the vertical space the canvas
   * actually has. Horizontally the sidebar is already handled by
   * `contentOriginX`/`innerWidth` (the CANVAS ORIGIN SHIFT), so it needs no
   * vertical exclusion now that it sits beside the plot rather than above
   * it. Centering the footprint (not the axis line alone) keeps the
   * baseline row and the tick labels equally far from the band's edges
   * at any lane count.
   *
   * The `Math.max` is a floor: when the footprint is taller than the band
   * (many lanes, a short window), the plot pins to the band's top rather
   * than riding up under the navbar - it overflows downward instead.
   */
  const plotContentTop = BASELINE_Y - LANE_HEIGHT / 2;
  const plotContentBottom = axisY + AXIS_LABEL_ROOM;
  const bandTop = plotBand.top;
  const bandBottom = plotBand.bottom > 0 ? plotBand.bottom : size.height;
  const contentOffsetY = Math.max(
    bandTop - plotContentTop,
    (bandTop + bandBottom) / 2 - (plotContentTop + plotContentBottom) / 2
  );

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

  /** Hover-tooltip + click wiring for a hollow glyph - identical behavior to the solid points/capsules' inline handlers. */
  const hollowEntryHandlers = (entry: Entry) => ({
    onMouseEnter: (event: React.MouseEvent) =>
      setHovered({ entry, x: event.clientX, y: event.clientY }),
    onMouseMove: (event: React.MouseEvent) =>
      setHovered(current =>
        current && current.entry.id === entry.id
          ? { ...current, x: event.clientX, y: event.clientY }
          : current
      ),
    onMouseLeave: () => setHovered(null),
    onClick: () => onEntryClick(entry),
  });

  // No auto-recenter on opening an entry (unlike StarMap's CLICK-TO-
  // CENTER): the axis is pinned to `selectedRange` edge to edge, in sync
  // with TimeRangeSelector's brush and the drag-to-slide above, and
  // panning to an entry would silently break that alignment.

  const isReady = size.width > 0 && size.height > 0;

  return (
    // `fixed inset-0` (not a layout child) - see the FULL-BLEED CANVAS
    // comment above. z-0, same base layer as StarMap.tsx: Timeline.tsx's
    // floating header and sidebar overlay both render above this with
    // their own higher z-index. canvas-vignette-bg (see index.css), not a
    // flat bg-[var(--bg-color)] - the same radial vignette
    // StarMap.tsx's own canvas paints, so this reads as the same
    // background rather than a visibly flatter one just because this is a
    // different view.
    <div ref={containerRef} className="canvas-vignette-bg fixed inset-0 z-0">
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
          {/* Soft same-color glow under a hollow range's sine wave - see the HOLLOW ENTRIES comment. */}
          <filter
            id="hollow-wave-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur
              stdDeviation={HOLLOW_WAVE_GLOW_BLUR_STD_DEVIATION}
            />
          </filter>
        </defs>
        {/*
         * `contentOriginX`, not `MARGIN.left` - see the CANVAS ORIGIN
         * SHIFT comment above. This is the one place the shift actually
         * takes effect: every point/range/axis position computed below
         * is already relative to THIS origin, so shifting it here is
         * what moves the whole rendered timeline past the sidebar,
         * rather than drawing it at a fixed spot and panning the view.
         */}
        <g transform={`translate(${contentOriginX},${contentOffsetY})`}>
          {/*
           * HOLLOW WAVES - see the HOLLOW ENTRIES comment. Drawn first so
           * they sit behind everything else. The opened-entry highlight
           * is a highlight-colored copy of the wave's line (blurred glow +
           * crisp outline) behind the colored one, the same approach
           * SpiralTimeline.tsx uses for its waves, with this file's own
           * glow values (the capsules' +4px / 0.6 / opened-point-glow).
           */}
          {isReady &&
            hollowRanges.map(({ entry, pathD, color }) => {
              const isOpened = openedEntryIdSet.has(entry.id);
              const isFocused = entry.id === expandedEntryId;
              const isFilteredOut = !activeCategorySet.has(entry.activityType);
              return (
                <g
                  key={entry.id}
                  style={{
                    opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                  }}
                  className="cursor-pointer transition-opacity duration-200"
                  {...hollowEntryHandlers(entry)}
                >
                  {/* Invisible, wider hit stroke - the 1.75px line alone is too thin to hover comfortably. */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={HOLLOW_WAVE_HIT_STROKE_WIDTH}
                    strokeLinecap="round"
                  />
                  {isOpened && (
                    <>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={
                          HOLLOW_WAVE_STROKE_WIDTH +
                          (isFocused ? FOCUSED_GLOW_STROKE_WIDTH : 4) * 2
                        }
                        strokeOpacity={isFocused ? FOCUSED_GLOW_OPACITY : 0.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#opened-point-glow)"
                        className="pointer-events-none"
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={
                          HOLLOW_WAVE_STROKE_WIDTH +
                          (isFocused ? FOCUSED_RING_STROKE_WIDTH : 1.5) * 2
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pointer-events-none"
                      />
                    </>
                  )}
                  <g
                    opacity={HOLLOW_WAVE_OPACITY}
                    className="pointer-events-none"
                  >
                    <path
                      d={pathD}
                      fill="none"
                      stroke={color}
                      strokeWidth={HOLLOW_WAVE_GLOW_STROKE_WIDTH}
                      strokeOpacity={HOLLOW_WAVE_GLOW_OPACITY}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#hollow-wave-glow)"
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={color}
                      strokeWidth={HOLLOW_WAVE_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                </g>
              );
            })}
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
              // FOCUSED ENTRY: the one the sidebar's FocusedEntryView is
              // showing gets a brighter opened highlight - see
              // utils/focusHighlight.ts.
              const isFocused = entry.id === expandedEntryId;
              const isFilteredOut = !activeCategorySet.has(entry.activityType);
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
                      strokeWidth={isFocused ? FOCUSED_GLOW_STROKE_WIDTH : 4}
                      strokeOpacity={isFocused ? FOCUSED_GLOW_OPACITY : 0.6}
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
                      strokeWidth={isFocused ? FOCUSED_RING_STROKE_WIDTH : 1.5}
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
          {/*
           * HOLLOW RINGS - see the HOLLOW ENTRIES comment. Same opened
           * glow/ring as a solid point (points.map below); only the
           * marker itself differs. Drawn before solid points so a solid
           * point on top keeps the click.
           */}
          {isReady &&
            hollowPoints.map(({ entry, cx, color }) => {
              const isOpened = openedEntryIdSet.has(entry.id);
              const isFocused = entry.id === expandedEntryId;
              const isFilteredOut = !activeCategorySet.has(entry.activityType);
              return (
                <g
                  key={entry.id}
                  style={{
                    opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                  }}
                  className="transition-opacity duration-200"
                >
                  {isOpened && (
                    <circle
                      cx={cx}
                      cy={BASELINE_Y}
                      r={POINT_RADIUS + 5}
                      fill="none"
                      stroke={OPENED_HIGHLIGHT_COLOR}
                      strokeWidth={isFocused ? FOCUSED_GLOW_STROKE_WIDTH : 4}
                      strokeOpacity={isFocused ? FOCUSED_GLOW_OPACITY : 0.6}
                      filter="url(#opened-point-glow)"
                      className="pointer-events-none"
                    />
                  )}
                  {/* Hollow ring: a background-colored "cutout" with a category-colored border. Its opaque fill is also the hover/click target. */}
                  <circle
                    cx={cx}
                    cy={BASELINE_Y}
                    r={POINT_RADIUS}
                    fill="var(--bg-color)"
                    stroke={color}
                    strokeWidth={HOLLOW_POINT_STROKE_WIDTH}
                    className="cursor-pointer"
                    {...hollowEntryHandlers(entry)}
                  />
                  {isOpened && (
                    <circle
                      cx={cx}
                      cy={BASELINE_Y}
                      r={POINT_RADIUS + 3}
                      fill="none"
                      stroke={OPENED_HIGHLIGHT_COLOR}
                      strokeWidth={isFocused ? FOCUSED_RING_STROKE_WIDTH : 1.5}
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
          {isReady &&
            points.map(({ entry, cx, color }) => {
              const isOpened = openedEntryIdSet.has(entry.id);
              const isFocused = entry.id === expandedEntryId;
              const isFilteredOut = !activeCategorySet.has(entry.activityType);
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
                      strokeWidth={isFocused ? FOCUSED_GLOW_STROKE_WIDTH : 4}
                      strokeOpacity={isFocused ? FOCUSED_GLOW_OPACITY : 0.6}
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
                      strokeWidth={isFocused ? FOCUSED_RING_STROKE_WIDTH : 1.5}
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
          <g ref={axisRef} transform={`translate(0,${axisY})`} />
        </g>
      </svg>

      {hovered && (
        <EntryTooltip entry={hovered.entry} x={hovered.x} y={hovered.y} />
      )}

      {isEmpty && (
        <VizEmptyState
          hasAnyEntries={hasAnyEntries}
          topOffset={topOffset}
          sidebarWidth={sidebarWidth}
          sidebarSide={sidebarSide}
          editModeBannerVisible={isEditMode}
        />
      )}
    </div>
  );
}
