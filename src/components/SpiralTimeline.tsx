/**
 * SpiralTimeline.tsx - Chronological Spiral Visualization of Entries
 *
 * A third way to look at `entries`, alongside StarMap.tsx's clustered
 * "constellation" and LinearTimeline.tsx's straight time axis: entries are
 * laid out along an outward-growing spiral, ordered by time the same way
 * LinearTimeline orders them along a line, but coiled into a spiral so a
 * long history still fits inside a compact canvas instead of stretching
 * off-screen. Follows the same overall shape as LinearTimeline.tsx
 * (responsive sizing, a `[0,1]`-normalized time domain, hover tooltip) and
 * the same pan/zoom MECHANISM as StarMap.tsx (a single zoomed `<g>` whose
 * `transform` is written imperatively by d3-zoom, since - like StarMap,
 * and unlike LinearTimeline - there's no axis that needs to be
 * regenerated against a rescaled domain on every zoom tick).
 *
 * ──────────────────────────────────────────────────────────────────────
 * PARITY WITH StarMap.tsx / LinearTimeline.tsx (VIA Spiral.tsx)
 * ──────────────────────────────────────────────────────────────────────
 * This used to be a self-contained card (`rounded-lg border ... p-6`)
 * with its own local `selectedEntry` state and a read-only
 * <EntryDetailModal> popup on click - the odd one out among the three
 * visualization views, which otherwise all shared selection/filter/sort
 * state (useEntrySelection.ts) and a sidebar panel stack
 * (SidebarPanelStack.tsx). It's now been refactored to match
 * StarMap.tsx/LinearTimeline.tsx exactly, completing parity across all
 * three views - see Spiral.tsx's own top-of-file comment for the full
 * page-level wiring (FilterBar, SidebarPanelStack, TimeRangeSelector,
 * Reset button/toast) this component now plugs into:
 *
 *   - `onEntryClick`/`openedEntryIds`/`expandedEntryId` replace the local
 *     `selectedEntry` state + <EntryDetailModal> - a click here forwards
 *     straight to useEntrySelection's `handleEntryClick`, the exact same
 *     shared open-new/expand-minimized/deselect-expanded callback
 *     StarMap's `onStarClick` and LinearTimeline's `onEntryClick` already
 *     use - see useEntrySelection.ts's CLICK OUTCOMES comment.
 *   - `filterCategories` dims (never removes) points/arcs whose
 *     activityType isn't active, the same FILTERED_OUT_OPACITY treatment
 *     StarMap/LinearTimeline give their own entries.
 *   - The OPENED-ENTRY HIGHLIGHT (glow + ring) below mirrors StarMap's
 *     stars for points, and LinearTimeline's capsules (traced along the
 *     arc's own path instead of an inflated rect, since an arc isn't a
 *     straight capsule shape) for range entries.
 *   - `sidebarWidth`/`resetViewSignal` and the CLICK-TO-CENTER/RESET-VIEW
 *     effects below are adapted directly from StarMap.tsx (not
 *     LinearTimeline's `contentOriginX` shift) - see the "FULL-BLEED
 *     CANVAS" and "CLICK-TO-CENTER" comments further down for why
 *     StarMap's approach, not LinearTimeline's, is the right fit for this
 *     view's 2D coordinate system.
 *   - `domainRange` (TimeRangeContext's `selectedRange`, via Spiral.tsx)
 *     replaces the old "extent over whatever entries I was handed" domain
 *     calculation - see the "DOMAIN COMES FROM domainRange" comment below,
 *     the same fix LinearTimeline.tsx already made for the identical
 *     structural problem.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE SPIRAL FORMULA (ARCHIMEDEAN SPIRAL) + POLAR-TO-CARTESIAN CONVERSION
 * ──────────────────────────────────────────────────────────────────────
 * Every entry (and every sample point along the spiral's own path, and
 * every year label) is positioned by the same two-step recipe, in
 * `spiralPoint` below:
 *
 *   1. Normalize its date to `t` in [0, 1]: 0 = the earliest date across
 *      all entries, 1 = the latest (see `normalize`/`domain` below - this
 *      is the exact same "normalize to a [0,1] fraction of the full date
 *      range" idea as LinearTimeline's `baseXScale`, just not expressed as
 *      a d3 scale since what follows isn't a linear pixel mapping).
 *   2. Map `t` to a point in POLAR coordinates (an angle and a radius),
 *      then convert polar -> cartesian (x, y) to actually plot it:
 *
 *        theta  = t * totalRotations * 2*PI   (angle, in radians)
 *        radius = minRadius + t * (maxRadius - minRadius)
 *        x = centerX + radius * cos(theta)
 *        y = centerY + radius * sin(theta)
 *
 *      `theta` sweeps around `totalRotations` full turns as `t` goes from
 *      0 to 1 (turning entries strung out along a "line" of time into a
 *      coil), while `radius` grows linearly from `minRadius` (near the
 *      center, t=0, the oldest entry) out to `maxRadius` (the outer edge,
 *      t=1, the most recent entry). A radius that's a LINEAR function of
 *      `theta` (as it is here, since both are linear functions of the
 *      same `t`) is the definition of an Archimedean spiral - the "coil
 *      of rope" spiral, with each successive loop the same distance
 *      further out than the last, as opposed to a logarithmic spiral
 *      (nautilus shell) whose loops grow multiplicatively.
 *
 * `totalRotations` is set to roughly the number of years the entries
 * span (see the `domain` useMemo), so each loop of the spiral reads
 * approximately as "one year" - which is also what makes the year-label
 * placement below land at one label per loop rather than piling up
 * unevenly.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FITTING THE WHOLE SPIRAL IN THE CANVAS WITHOUT ZOOMING OUT
 * ──────────────────────────────────────────────────────────────────────
 * `maxRadius` is derived from the container's OWN measured size (see the
 * `spiralParams` useMemo): half the smaller of width/height, minus a
 * fixed clearance for point radii and label text so nothing right at the
 * outer edge gets clipped. Since this is computed from the untransformed
 * canvas size and used at zoom identity (`k = 1`, no pan), the entire
 * spiral - oldest entry at the center to newest at the rim - is visible
 * the moment the view mounts, before the user pans or zooms at all.
 *
 * ──────────────────────────────────────────────────────────────────────
 * DRAWING THE SPIRAL LINE + <textPath> YEAR LABELS
 * ──────────────────────────────────────────────────────────────────────
 * The visible spiral curve is just a densely-sampled polyline: `t` is
 * walked from 0 to 1 in many small steps (`spiralSamples`), each mapped
 * through `spiralPoint`, and stitched into one SVG path `d` string of
 * `M x,y L x,y L x,y ...` segments - see `buildPolylinePath`. Because
 * every segment is a straight line, the path's total length is EXACTLY
 * the sum of each segment's Euclidean length (no curve-length
 * approximation needed) - that sum, `cumulativeLengths`, is what lets
 * `tToArcLength` convert a `t` value into the matching `startOffset`
 * (in the same px units as the path itself) for a `<textPath>`.
 *
 * A `<textPath href="#...">` lays its text starting at `startOffset`
 * along the *referenced path's own curvature* - the browser handles
 * bending each glyph to follow the spiral, which is exactly the "curve
 * along the spiral path" effect year labels need, with no manual
 * per-glyph rotation math. The one case this doesn't handle well is a
 * label whose `startOffset` lands too close to the path's very end (the
 * outermost loop, near the most recent entries): there's no path left
 * for the text to run along, so it would render compressed or cut off.
 * `hasRoomForTextPath` below guards for exactly that case; when it's
 * false, `spiralTangentAngleDeg` computes the spiral's tangent direction
 * at that `t` analytically (the derivative of the polar parametrization),
 * and the label falls back to a single plain `<text>` rotated to match
 * that tangent instead - visually consistent with the curved labels
 * even though it isn't bending letter-by-letter.
 *
 * ──────────────────────────────────────────────────────────────────────
 * RANGE ENTRIES: ARCS THAT FOLLOW THE SPIRAL, NOT STRAIGHT CHORDS
 * ──────────────────────────────────────────────────────────────────────
 * An entry with `endTimestamp` (see the field comment in types/Entry.ts)
 * spans two `t` values instead of one. A straight line between
 * `spiralPoint(tStart)` and `spiralPoint(tEnd)` would cut across empty
 * space and visually cross other loops of the spiral for anything but a
 * very short span. Instead, `sampleArcPoints` walks `t` from `tStart` to
 * `tEnd` in the same small-step, build-a-polyline way `spiralSamples`
 * does for the whole spiral - so the arc is a short run of the identical
 * parametric curve the spiral itself is drawn from, guaranteed to hug the
 * spiral's own curvature over that stretch rather than approximate it.
 *
 * ──────────────────────────────────────────────────────────────────────
 * DOMAIN COMES FROM domainRange, NOT `entries`
 * ──────────────────────────────────────────────────────────────────────
 * This used to derive `minDate`/`maxDate` from `entries`' own extent (via
 * d3.extent, including endTimestamps). Now that Spiral.tsx pre-filters
 * `entries` down to whatever TimeRangeContext's `selectedRange` is (the
 * same HARD time filter Timeline.tsx/Constellation.tsx apply - see
 * Spiral.tsx's own comment), doing the same "extent over the entries I
 * was handed" would shrink the spiral down to a SMALLER window than what
 * the user actually selected whenever the surviving entries happen to
 * cluster away from one or both edges of `domainRange` - the exact same
 * bug LinearTimeline.tsx's own "DOMAIN COMES FROM domainRange" fix
 * addresses for its axis. Building `minDate`/`maxDate` from `domainRange`
 * directly instead keeps the spiral's full extent (and therefore
 * `totalRotations`, and every year label) representing the FULL selected
 * window regardless of how the entries inside it are distributed. The
 * single-instant padding fallback stays as a defensive guard (in case
 * `domainRange.start === domainRange.end`) even though
 * TimeRangeContext's own `computeFullRange` already pads a degenerate
 * range the same way.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FULL-BLEED CANVAS + CLICK-TO-CENTER: SAME AS StarMap, NOT LinearTimeline
 * ──────────────────────────────────────────────────────────────────────
 * This used to render inside a bordered, padded card
 * (`rounded-lg border ... p-6 shadow-sm`) at a fixed `h-[420px]`, as a
 * normal-flow child of Spiral.tsx. Now that Spiral.tsx matches
 * Constellation.tsx/Timeline.tsx's page structure (floating header +
 * FilterBar above a full-bleed canvas, a sidebar overlay on top of that),
 * this component's root is `fixed inset-0`, the same "always fills the
 * entire viewport" approach StarMap.tsx uses - NOT LinearTimeline's
 * `contentOriginX` origin-shift, since that shift only makes sense for a
 * single linear axis where x position IS the data (see LinearTimeline's
 * own CANVAS ORIGIN SHIFT comment for why). A spiral is a free-form 2D
 * layout like StarMap's star field - there's no single meaningful
 * "origin" to shift - so, like StarMap, `sidebarWidth` is threaded in and
 * used only inside the CLICK-TO-CENTER target calculation below, not
 * anywhere else in this file.
 *
 * `useLayoutEffect` (not `useEffect`) for the responsive-sizing effect -
 * unlike the old bounded `h-[420px]` card, this now measures the full
 * viewport on mount, the same transient-zero-size-on-first-frame risk
 * LinearTimeline.tsx's own "MISSING DATA POINTS" comment (cause #2)
 * describes for its own full-bleed switch; `useLayoutEffect` avoids an
 * intermediate degenerate-scale paint the same way it does there.
 *
 * CLICK-TO-CENTER below is StarMap's own effect, adapted to this file's
 * coordinate system: entry world positions come from `spiralPoint`
 * instead of StarMap's jittered star (x, y), and a range entry centers on
 * the midpoint of its `tStart`/`tEnd` (the point on the spiral halfway
 * through its span) rather than a single point - the 2D equivalent of
 * LinearTimeline's own "midpoint of a range entry's start/end" choice for
 * its 1D axis.
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { Entry } from '../types/Entry';
import { DateRange } from '../context/TimeRangeContext';
import { getActivityColor } from '../utils/colors';
// Shared with StarMap.tsx/LinearTimeline.tsx's own hover tooltip - see
// EntryTooltip.tsx's header comment for why this is a shared pattern
// across every visualization view rather than duplicated per-component.
import EntryTooltip from './EntryTooltip';
import VizEmptyState, { TimeRangeSelectorRect } from './VizEmptyState';

interface SpiralTimelineProps {
  entries: Entry[];
  /**
   * Whether the RAW, unfiltered dataset (Spiral.tsx's own
   * `entries.length > 0`, not the time-filtered `entries` prop above) has
   * any entries at all - passed straight through to VizEmptyState.tsx so
   * it can distinguish "no data exists" from "filtered to nothing" - see
   * that component's own top-of-file comment for the full reasoning.
   */
  hasAnyEntries: boolean;
  /**
   * activityTypes currently "active" - see useEntrySelection.ts's
   * CATEGORY FILTER comment. Points/arcs whose activityType is NOT in
   * this list are dimmed to FILTERED_OUT_OPACITY, mirroring StarMap.tsx's
   * treatment of its stars and LinearTimeline.tsx's treatment of its
   * points/capsules.
   */
  filterCategories: string[];
  /**
   * Called with the clicked entry when a point or arc is clicked - wired
   * by Spiral.tsx to useEntrySelection's `handleEntryClick`, the same
   * shared open-new/expand-minimized/deselect-expanded callback
   * StarMap.tsx wires to `onStarClick` and LinearTimeline.tsx wires to its
   * own `onEntryClick` - see the CLICK PARITY comment at the top of this
   * file.
   */
  onEntryClick: (entry: Entry) => void;
  /**
   * IDs of entries currently "opened" (represented by a panel, expanded
   * or minimized, in Spiral.tsx's SidebarPanelStack) - same prop, same
   * source (useEntrySelection.ts), and same purpose as StarMap.tsx's
   * `openedEntryIds`: points/arcs whose id appears here render the
   * OPENED-ENTRY HIGHLIGHT below.
   */
  openedEntryIds: string[];
  /**
   * The id of the entry whose panel is currently expanded (not
   * minimized), or `null` - drives the CLICK-TO-CENTER effect below,
   * exactly like StarMap.tsx's `expandedEntryId`.
   */
  expandedEntryId: string | null;
  /**
   * The sidebar overlay's current rendered width in pixels (0 when it
   * isn't rendered) - same prop, same source (Spiral.tsx's measured
   * `sidebarWidth`), and same purpose as StarMap.tsx's `sidebarWidth`:
   * used only inside the CLICK-TO-CENTER target below to keep a centered
   * entry out from under the sidebar overlay.
   */
  sidebarWidth: number;
  /**
   * Bumped by Spiral.tsx every time its Escape-key/reset-button full
   * reset fires - see the RESET-VIEW effect below. Same counter-not-
   * boolean reasoning as StarMap.tsx's own `resetViewSignal`.
   */
  resetViewSignal: number;
  /**
   * The visible spiral window - Spiral.tsx's TimeRangeContext
   * `selectedRange`. `minDate`/`maxDate` are built from THIS now, instead
   * of `entries`' own extent - see the DOMAIN COMES FROM domainRange
   * comment above.
   */
  domainRange: DateRange;
  /**
   * The page's measured header bottom edge (Spiral.tsx's own
   * `headerLayout.top`) - used only to position VizEmptyState.tsx below
   * the header when there's nothing to show. Previously this component
   * positioned its own empty-state message at a hardcoded `top-28`,
   * which could overlap Spiral's (comparatively long, two-sentence)
   * subtitle - this measured value replaces that guess.
   */
  topOffset: number;
  /**
   * TimeRangeSelector's own card's live rendered position
   * (Spiral.tsx's own `timeRangeSelectorRect`) - passed straight through
   * to VizEmptyState.tsx so it can position its "filtered" message
   * immediately beside that card. See VizEmptyState.tsx's own
   * POSITIONING comment.
   */
  timeRangeSelectorRect: TimeRangeSelectorRect;
}

/** Small circle radius (px) for a single-point entry and for a range entry's end caps. */
const POINT_RADIUS = 5;

/** Stroke width (px) of a range entry's arc. */
const ARC_STROKE_WIDTH = 3.5;

/**
 * Extra stroke width (px) added to a range entry's own colored arc when
 * it's opened - see the OPENED-ENTRY HIGHLIGHT (arc glow) comment below
 * for why a subtle thickness bump (not a dramatic one) is what actually
 * makes a highlighted arc read as connected to its start/end highlight
 * circles, rather than relying on the glow/ring alone.
 */
const OPENED_ARC_STROKE_WIDTH_BOOST = 1.5;

/**
 * ──────────────────────────────────────────────────────────────────────
 * ARC GLOW: TUNED DOWN SO THE COLOR STAYS DOMINANT
 * ──────────────────────────────────────────────────────────────────────
 * A first pass at the arc glow used `ARC_STROKE_WIDTH + 8` (11.5px) at
 * `strokeOpacity={0.5}`, blurred with `stdDeviation={3}` (see
 * GLOW_BLUR_STD_DEVIATION below). Even with the glow correctly layered
 * BEHIND the colored arc (see the render below), that combination was
 * simply too big and too bright relative to the ~5px colored arc drawn
 * on top of it: a wide, half-opaque, heavily-blurred white stroke bleeds
 * far enough past the colored arc's own edges that the two visually
 * merge into one whitish shape instead of reading as "a colored arc with
 * a soft glow behind it" - the category color (e.g. Shuffle Dance's
 * green) got washed out rather than staying the dominant, legible color.
 * The same oversized footprint also meant two selected arcs running
 * close together on the spiral (e.g. two entries from the same
 * multi-week tournament) could have their glows overlap and blur into
 * one continuous highlighted region instead of reading as two distinct
 * selections.
 *
 * `OPENED_ARC_GLOW_EXTRA_WIDTH` (8 -> 4) and `OPENED_ARC_GLOW_OPACITY`
 * (0.5 -> 0.3) below are both cut roughly in half from that first pass,
 * and `GLOW_BLUR_STD_DEVIATION` (3 -> 2) tightens the blur radius on top
 * of that - together, the glow now extends only slightly past the
 * colored arc's own (already opened-boosted) width, at a low enough
 * opacity to read as a backdrop rather than competing with the
 * full-opacity color painted over it, and with a small enough spatial
 * footprint that two nearby selected arcs' halos stay visually separate
 * instead of bleeding together.
 */
const OPENED_ARC_GLOW_EXTRA_WIDTH = 4;
const OPENED_ARC_GLOW_OPACITY = 0.3;
const GLOW_BLUR_STD_DEVIATION = 2;

/**
 * ──────────────────────────────────────────────────────────────────────
 * ARC ENDPOINT GLOW: THE ACTUAL REMAINING SOURCE OF "WHITE OVERPOWERS
 * THE COLOR" - A SEPARATE GLOW ELEMENT THE FIRST TUNING PASS MISSED
 * ──────────────────────────────────────────────────────────────────────
 * The arc's own path glow above (OPENED_ARC_GLOW_EXTRA_WIDTH/_OPACITY)
 * was tuned down, but a range entry's two start/end highlight circles
 * (rendered further below, one per endpoint) use a COMPLETELY SEPARATE
 * glow - inherited unchanged from StarMap.tsx's own per-star glow values
 * (`POINT_RADIUS + 5` radius, `strokeWidth={4}`, `strokeOpacity={0.6}`).
 * That first pass fixed the LINE's color but left these two circles at
 * their original, much brighter/wider settings - and since EVERY visible
 * selected arc necessarily shows two of these large glowing rings
 * bookending it, they - not the line - are what actually dominated the
 * shape's overall appearance, which is why the "glow overpowers the
 * color" complaint persisted even after the line itself was already
 * rendering its category color correctly (confirmed directly: DOM order
 * for the line/glow was already correct - glow first, colored line
 * second - so this endpoint glow, not a layering bug, was the real
 * remaining cause).
 *
 * Tuned to the same restrained magnitude as the line's own glow -
 * `OPENED_ARC_GLOW_OPACITY` (0.3) reused directly rather than a second,
 * separately-tunable opacity constant, so the line and its endpoints
 * always read as ONE consistently-toned highlight instead of two
 * independently-drifting glow strengths.
 */
const OPENED_ARC_ENDPOINT_GLOW_RADIUS_EXTRA = 3; // was POINT_RADIUS + 5
const OPENED_ARC_ENDPOINT_GLOW_STROKE_WIDTH = 3; // was 4

/**
 * How far the spiral's innermost loop (t=0, the oldest entry) sits from
 * dead-center, as a fraction of `maxRadius`. Zero would pile the very
 * earliest entries on top of each other at a single point; a small
 * positive gap (like a vinyl record's center hole) keeps them
 * distinguishable.
 */
const MIN_RADIUS_RATIO = 0.15;

/**
 * Clearance (px) reserved between the spiral's outermost loop
 * (`maxRadius`) and the container's edge - room for point radii, arc end
 * caps, and year-label text so nothing at the rim gets visually clipped.
 */
const RADIUS_PADDING = 40;

/** Roughly how many straight segments make up one full loop of the main spiral path - tuned for a visibly smooth curve without an excessive path string. */
const SAMPLES_PER_ROTATION = 48;

/** Hard cap on total main-spiral samples, so a very long-spanning (many-year) timeline doesn't build an unreasonably large path string. */
const MAX_SPIRAL_SAMPLES = 2000;

/** Segments-per-rotation used when sampling one range entry's (typically much shorter) arc - lower than the main spiral's since an arc only covers a fraction of a loop. */
const ARC_SAMPLES_PER_ROTATION = 32;
const MIN_ARC_SAMPLES = 6;
const MAX_ARC_SAMPLES = 200;

/**
 * Minimum remaining path length (px) a year label's `startOffset` needs
 * for its `<textPath>` to have room to render - see the "DRAWING THE
 * SPIRAL LINE" comment above for why labels near the very end of the
 * spiral fall back to a plain rotated `<text>` instead.
 */
const YEAR_LABEL_MIN_PATH_ROOM = 28;

/** How far the user can zoom in/out - same range StarMap.tsx uses for its own 2D pannable canvas. */
const ZOOM_SCALE_EXTENT: [number, number] = [0.5, 8];

/** Average milliseconds in a year (accounts for leap years) - used only to estimate `totalRotations`. */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Angle (radians) the spiral starts at for t=0 - purely cosmetic (starts pointing straight up rather than right). */
const SPIRAL_START_ANGLE = -Math.PI / 2;

/** Opacity applied to a point/arc whose category is filtered out - same value as StarMap.tsx's/LinearTimeline.tsx's FILTERED_OUT_OPACITY. */
const FILTERED_OUT_OPACITY = 0.15;

/**
 * Neutral, bright highlight color for the "opened entry" ring/glow - same
 * color, same reasoning as StarMap.tsx's/LinearTimeline.tsx's own
 * OPENED_HIGHLIGHT_COLOR: deliberately not tied to any activityType
 * color, so it reads clearly against every entry color.
 */
const OPENED_HIGHLIGHT_COLOR = '#ffffff';

interface SpiralParams {
  centerX: number;
  centerY: number;
  minRadius: number;
  maxRadius: number;
  totalRotations: number;
}

/** Polar -> cartesian mapping for a normalized time fraction `t` - see the top-of-file "SPIRAL FORMULA" comment. */
function spiralPoint(
  t: number,
  params: SpiralParams
): { x: number; y: number } {
  const { centerX, centerY, minRadius, maxRadius, totalRotations } = params;
  const radius = minRadius + t * (maxRadius - minRadius);
  const theta = SPIRAL_START_ANGLE + t * totalRotations * Math.PI * 2;
  return {
    x: centerX + radius * Math.cos(theta),
    y: centerY + radius * Math.sin(theta),
  };
}

/**
 * Analytic tangent direction (in degrees, for an SVG `rotate()`) of the
 * spiral curve at `t` - the derivative of the polar parametrization used
 * by `spiralPoint`, via the standard product rule for a curve traced by
 * (r(t)*cos(theta(t)), r(t)*sin(theta(t))). Both r(t) and theta(t) are
 * linear in `t` here, so dr/dt and dtheta/dt are just constants. Used
 * only for the plain-<text> fallback label - see the top-of-file
 * "<textPath> YEAR LABELS" comment.
 */
function spiralTangentAngleDeg(t: number, params: SpiralParams): number {
  const { minRadius, maxRadius, totalRotations } = params;
  const radius = minRadius + t * (maxRadius - minRadius);
  const theta = SPIRAL_START_ANGLE + t * totalRotations * Math.PI * 2;
  const dRadius = maxRadius - minRadius;
  const dTheta = totalRotations * Math.PI * 2;
  const dx = dRadius * Math.cos(theta) - radius * Math.sin(theta) * dTheta;
  const dy = dRadius * Math.sin(theta) + radius * Math.cos(theta) * dTheta;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Stitches a list of points into one straight-segmented SVG path `d` string. */
function buildPolylinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

/**
 * Samples the spiral curve between two `t` values (inclusive) - used to
 * draw a range entry's arc. See the top-of-file "RANGE ENTRIES" comment
 * for why this (walking the same parametric curve over a short span)
 * rather than a straight line between the two endpoints.
 */
function sampleArcPoints(
  tStart: number,
  tEnd: number,
  params: SpiralParams
): { x: number; y: number }[] {
  const t0 = Math.min(tStart, tEnd);
  const t1 = Math.max(tStart, tEnd);
  const span = t1 - t0;
  const segmentCount = Math.min(
    MAX_ARC_SAMPLES,
    Math.max(
      MIN_ARC_SAMPLES,
      Math.round(span * params.totalRotations * ARC_SAMPLES_PER_ROTATION)
    )
  );

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    const t = t0 + (span * i) / segmentCount;
    points.push(spiralPoint(t, params));
  }
  return points;
}

export default function SpiralTimeline({
  entries,
  hasAnyEntries,
  filterCategories,
  onEntryClick,
  openedEntryIds,
  expandedEntryId,
  sidebarWidth,
  resetViewSignal,
  domainRange,
  topOffset,
  timeRangeSelectorRect,
}: SpiralTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  // Holds the same zoom *behavior* instance attached to the <svg> below, so
  // CLICK-TO-CENTER/RESET-VIEW (see below) can programmatically drive it
  // later, outside of the 'zoom' event handler that normally drives it -
  // same role as StarMap.tsx's own `zoomBehaviorRef`.
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);

  // Unique per mounted instance, so the <path id="..."> the year labels'
  // <textPath> elements reference can never collide if this component
  // were ever rendered more than once on the same page.
  const spiralPathId = useId();

  // ─── Responsive sizing ───
  // Same ResizeObserver-on-a-container-ref pattern as StarMap.tsx/
  // LinearTimeline.tsx - now measuring the full viewport (see the
  // FULL-BLEED CANVAS comment above), so this uses `useLayoutEffect`, not
  // `useEffect`, for the same first-frame reason LinearTimeline.tsx does.
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

  // ─── Date domain ───
  // See the DOMAIN COMES FROM domainRange comment above - this no longer
  // derives from `entries`' own extent.
  const [minDate, maxDate] = useMemo(() => {
    const domain: [Date, Date] = [domainRange.start, domainRange.end];

    if (domain[0].getTime() === domain[1].getTime()) {
      domain[0] = d3.timeDay.offset(domain[0], -1);
      domain[1] = d3.timeDay.offset(domain[1], 1);
    }

    return domain;
  }, [domainRange]);

  const normalize = (date: Date): number => {
    const span = maxDate.getTime() - minDate.getTime();
    return span === 0 ? 0 : (date.getTime() - minDate.getTime()) / span;
  };

  // ─── Spiral parameters ───
  // `totalRotations` is roughly the number of years the domain spans
  // (see the top-of-file SPIRAL FORMULA comment), floored at 1 full loop
  // so even a short-lived history still reads as a spiral rather than a
  // single tight arc. `maxRadius`/`minRadius` are scaled off the
  // container's own measured size - see the "FITTING THE WHOLE SPIRAL"
  // comment above.
  const spiralParams = useMemo<SpiralParams>(() => {
    const yearsSpanned = (maxDate.getTime() - minDate.getTime()) / MS_PER_YEAR;
    const totalRotations = Math.max(1, yearsSpanned);
    const maxRadius = Math.max(
      0,
      Math.min(size.width, size.height) / 2 - RADIUS_PADDING
    );

    return {
      centerX: size.width / 2,
      centerY: size.height / 2,
      minRadius: maxRadius * MIN_RADIUS_RATIO,
      maxRadius,
      totalRotations,
    };
  }, [size, minDate, maxDate]);

  // ─── Main spiral path ───
  // Densely sampled polyline approximation of the spiral curve itself -
  // see "DRAWING THE SPIRAL LINE" above for why a polyline's length is
  // exact (not approximate) and how that feeds year-label positioning.
  const spiralSampleCount = Math.min(
    MAX_SPIRAL_SAMPLES,
    Math.max(64, Math.round(spiralParams.totalRotations * SAMPLES_PER_ROTATION))
  );

  const spiralSamples = useMemo(() => {
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= spiralSampleCount; i++) {
      samples.push(spiralPoint(i / spiralSampleCount, spiralParams));
    }
    return samples;
  }, [spiralSampleCount, spiralParams]);

  const spiralPathD = useMemo(
    () => buildPolylinePath(spiralSamples),
    [spiralSamples]
  );

  // Cumulative Euclidean distance up to each sample - since every
  // segment is straight, this sum IS the path's exact length at that
  // sample, in the same units `<textPath startOffset>` expects.
  const cumulativeLengths = useMemo(() => {
    const lengths = [0];
    for (let i = 1; i < spiralSamples.length; i++) {
      const prev = spiralSamples[i - 1];
      const curr = spiralSamples[i];
      lengths.push(
        lengths[i - 1] + Math.hypot(curr.x - prev.x, curr.y - prev.y)
      );
    }
    return lengths;
  }, [spiralSamples]);

  const totalPathLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0;

  /** Interpolates a `t` (0-1) fraction to its arc-length position along `spiralPathD`. */
  const tToArcLength = (t: number): number => {
    const index = t * spiralSampleCount;
    const i0 = Math.floor(index);
    const i1 = Math.min(spiralSampleCount, i0 + 1);
    const frac = index - i0;
    const len0 = cumulativeLengths[i0] ?? 0;
    const len1 = cumulativeLengths[i1] ?? len0;
    return len0 + (len1 - len0) * frac;
  };

  // ─── Year labels ───
  // One label per calendar year the domain touches, positioned at that
  // year's Jan 1 (clamped into [minDate, maxDate] for the first/last
  // partial years) - see "DRAWING THE SPIRAL LINE" above for the
  // textPath/fallback split.
  const yearLabels = useMemo(() => {
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();
    const span = maxDate.getTime() - minDate.getTime();
    const labels: { year: number; t: number }[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const boundaryTime = Math.min(
        Math.max(new Date(year, 0, 1).getTime(), minDate.getTime()),
        maxDate.getTime()
      );
      labels.push({
        year,
        t: span === 0 ? 0 : (boundaryTime - minDate.getTime()) / span,
      });
    }
    return labels;
  }, [minDate, maxDate]);

  // ─── Sorted entries ───
  // Chronological draw order, same as LinearTimeline's implicit ordering
  // (entries already sorted by position along its axis) - so later
  // entries draw on top of earlier ones where circles/arcs overlap.
  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [entries]
  );

  // Set for O(1) membership checks per point/arc - same pattern as
  // StarMap.tsx's activeCategorySet/LinearTimeline.tsx's own.
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

  // Set for O(1) membership checks per point/arc - same pattern, same
  // source, and same purpose as StarMap.tsx's own `openedEntryIdSet`.
  const openedEntryIdSet = useMemo(
    () => new Set(openedEntryIds),
    [openedEntryIds]
  );

  // ─── Single-point entries (no endTimestamp) ───
  const points = useMemo(
    () =>
      sortedEntries
        .filter(entry => !entry.endTimestamp)
        .map(entry => ({
          entry,
          ...spiralPoint(normalize(new Date(entry.timestamp)), spiralParams),
          color: getActivityColor(entry.activityType),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedEntries, spiralParams, minDate, maxDate]
  );

  // ─── Range entries (with endTimestamp) ───
  // Each becomes an arc following the spiral's own curvature between its
  // start and end t - see the top-of-file "RANGE ENTRIES" comment.
  // `midpoint` (the point halfway along the arc's own span, by `t`) is
  // used only by the CLICK-TO-CENTER effect below - the 2D equivalent of
  // LinearTimeline's "center a range entry on the midpoint of its
  // start/end timestamps" choice.
  const ranges = useMemo(
    () =>
      sortedEntries
        .filter(entry => entry.endTimestamp)
        .map(entry => {
          const tStart = normalize(new Date(entry.timestamp));
          const tEnd = normalize(new Date(entry.endTimestamp as string));
          const arcPoints = sampleArcPoints(tStart, tEnd, spiralParams);
          return {
            entry,
            pathD: buildPolylinePath(arcPoints),
            start: arcPoints[0],
            end: arcPoints[arcPoints.length - 1],
            midpoint: spiralPoint((tStart + tEnd) / 2, spiralParams),
            color: getActivityColor(entry.activityType),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedEntries, spiralParams, minDate, maxDate]
  );

  // ─── Pan/zoom behavior ───
  // Same mechanism as StarMap.tsx: attached once, and the 'zoom' handler
  // writes the transform directly onto `zoomLayerRef`'s <g> rather than
  // going through React state - there's no axis here that needs to be
  // regenerated against a rescaled domain the way LinearTimeline's is, so
  // there's nothing else that needs to react to the transform.
  // `zoomBehaviorRef` is stashed (unlike the pre-parity version) so
  // CLICK-TO-CENTER/RESET-VIEW below can drive it programmatically.
  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomLayer = d3.select(zoomLayerRef.current);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_SCALE_EXTENT)
      .on('zoom', event => {
        zoomLayer.attr('transform', event.transform.toString());
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
   * CLICK-TO-CENTER: PROGRAMMATIC PAN VIA d3-zoom's `.transform()`, TIED TO
   * THE EXPANDED-ENTRY STATE CHANGE
   * ──────────────────────────────────────────────────────────────────────
   * Adapted from StarMap.tsx's own CLICK-TO-CENTER effect - see its
   * comment for the full reasoning (why this lives in an effect keyed on
   * `expandedEntryId` rather than the click handler, and why the target
   * isn't simply the canvas center). The only difference in the target
   * MATH is *where* a target entry's world (x, y) comes from: a point uses
   * its own `spiralPoint` output directly; a range entry uses `midpoint`
   * (see the `ranges` useMemo above) instead of a single endpoint, so
   * centering a long-duration entry doesn't push most of its arc off to
   * one side of the target.
   *
   * `sidebarWidth` IS A DEPENDENCY HERE - UNLIKE StarMap.tsx's OWN EFFECT:
   * StarMap deliberately excludes it (see that file's comment: "the pan
   * should only ever be triggered by the expanded entry actually changing,
   * not by e.g. a window resize"), but that omission has a race condition
   * on the very FIRST entry ever opened: `expandedEntryId` flips to a
   * real id and `hasSelection` flips true in the SAME render (both come
   * from the same useEntrySelection.ts state update), but the sidebar's
   * ACTUAL rendered pixel width isn't known yet - Spiral.tsx's own
   * `sidebarWidth` state still measures 0 until its ResizeObserver
   * callback fires against the now-mounted SidebarPanelStack DOM node,
   * which lands in a LATER, separate commit. Since `targetX` reads
   * `sidebarWidth` directly, this effect firing on that first render would
   * center against the stale pre-open value (0) - i.e. the full canvas
   * center - instead of the correct sidebar-excluded center, exactly the
   * bug this fixes. Including `sidebarWidth` here means the effect fires
   * AGAIN once the real measured width lands a moment later, recentering
   * onto the correct target - the identical fix (and identical staleness
   * cause) LinearTimeline.tsx's own AUTO-RECENTER effect already documents
   * for its `contentOriginX`/`innerWidth`. d3's `.transition()` simply
   * redirects the still-in-flight first animation toward the corrected
   * target rather than restarting it, so this reads as one smooth pan
   * converging on the right spot, not a visible double jump. On every
   * SUBSEQUENT click (sidebar already open, `sidebarWidth` unchanged by
   * this expand), this dependency is a no-op - the effect only actually
   * re-fires when `sidebarWidth`'s value itself changes, which also means
   * resizing the window while a panel is open correctly re-centers as the
   * sidebar's rendered width changes with it. `points`/`ranges`/`size`
   * stay excluded, same as StarMap's own `stars`/`size` - see StarMap's
   * comment for why this should only re-run for a real "recenter" signal
   * (the expanded entry changing, or the sidebar's width changing),
   * not every render that happens to touch one of the values it reads.
   */
  useEffect(() => {
    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior || !expandedEntryId) return;

    const point = points.find(
      candidate => candidate.entry.id === expandedEntryId
    );
    const range = point
      ? undefined
      : ranges.find(candidate => candidate.entry.id === expandedEntryId);
    const world = point ?? range?.midpoint;
    if (!world) return;

    const { width, height } = size;
    if (width === 0 || height === 0) return;

    const targetX = sidebarWidth + (width - sidebarWidth) / 2;
    const targetY = height / 2;

    const currentTransform = d3.zoomTransform(svgNode);

    const centeredTransform = d3.zoomIdentity
      .translate(targetX, targetY)
      .scale(currentTransform.k) // preserve the user's current zoom level
      .translate(-world.x, -world.y);

    d3.select(svgNode)
      .transition()
      .duration(650) // 500-750ms: smooth, not sluggish, same as StarMap's
      .call(zoomBehavior.transform, centeredTransform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEntryId, sidebarWidth]);

  /**
   * ─── RESET-VIEW: PROGRAMMATIC PAN/ZOOM RESET, TIED TO `resetViewSignal` ───
   * Identical to StarMap.tsx's own RESET-VIEW effect - see its comment for
   * why `isFirstResetSignal` skips the very first run.
   */
  const isFirstResetSignal = useRef(true);
  useEffect(() => {
    if (isFirstResetSignal.current) {
      isFirstResetSignal.current = false;
      return;
    }

    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior) return;

    d3.select(svgNode)
      .transition()
      .duration(650)
      .call(zoomBehavior.transform, d3.zoomIdentity);
  }, [resetViewSignal]);

  // ─── Hover tooltip ───
  // Same shape/tracking as LinearTimeline.tsx/StarMap.tsx - see the
  // "Hover tooltip" comment in LinearTimeline.tsx.
  const [hovered, setHovered] = useState<{
    entry: Entry;
    x: number;
    y: number;
  } | null>(null);

  const isReady =
    size.width > 0 && size.height > 0 && spiralParams.maxRadius > 0;

  return (
    // `fixed inset-0` (not a layout child) - see the FULL-BLEED CANVAS
    // comment above. z-0, same base layer as StarMap.tsx/LinearTimeline.tsx:
    // Spiral.tsx's floating header and sidebar overlay both render above
    // this with their own higher z-index.
    <div ref={containerRef} className="fixed inset-0 z-0 bg-[var(--bg-color)]">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="cursor-grab text-[var(--text-muted-color)] active:cursor-grabbing"
      >
        <defs>
          {/*
           * Soft blur used behind opened entries' highlight ring, so it
           * reads as a glow rather than a hard-edged shape - same
           * pattern as StarMap.tsx's `opened-star-glow`/
           * LinearTimeline.tsx's `opened-point-glow` (kept as a separate
           * id here since defs ids are scoped per-<svg>, not shared
           * across components). `stdDeviation` uses
           * GLOW_BLUR_STD_DEVIATION (2, tuned down from an initial 3) -
           * see the ARC GLOW comment above `OPENED_ARC_GLOW_EXTRA_WIDTH`
           * for why: a smaller blur radius keeps each opened entry's
           * halo from spreading far enough to wash out its own color or
           * bleed into a nearby opened arc's halo.
           */}
          <filter
            id="opened-spiral-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation={GLOW_BLUR_STD_DEVIATION} />
          </filter>
        </defs>
        <g ref={zoomLayerRef}>
          {isReady && (
            <>
              <path
                id={spiralPathId}
                d={spiralPathD}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.5}
              />

              {ranges.map(({ entry, pathD, start, end, color }) => {
                const isOpened = openedEntryIdSet.has(entry.id);
                const isFilteredOut = !activeCategorySet.has(
                  entry.activityType
                );
                return (
                  // OPENED-ENTRY HIGHLIGHT: one group per range, opacity
                  // applied once to the whole group (glow + arc + ring +
                  // end caps) so a filtered-out arc's highlight dims
                  // along with it - same structure as StarMap.tsx's
                  // per-star <g>/LinearTimeline.tsx's per-range <g>.
                  <g
                    key={entry.id}
                    style={{
                      opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                    }}
                    className="cursor-pointer transition-opacity duration-200"
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
                  >
                    {isOpened && (
                      // OPENED-ENTRY HIGHLIGHT (arc glow) - LAYERING:
                      // this glow <path> is deliberately the FIRST child
                      // rendered inside this <g>, BEFORE the colored arc
                      // <path> below it - in SVG (as in HTML), a later
                      // sibling paints ON TOP of an earlier one, so
                      // ordering the glow first is what puts it BEHIND
                      // the colored arc, the same "glow element added to
                      // the DOM before the main shape" layering
                      // StarMap.tsx's per-star <g> and the point
                      // highlight below both use (glow circle, then the
                      // solid point, then the ring). Traced along the
                      // SAME path the colored arc itself uses (an arc
                      // isn't a straight capsule, so there's no simple
                      // inflated-rect outline the way
                      // LinearTimeline.tsx's capsuleOutlineRect draws
                      // one). Width/opacity/blur are all
                      // OPENED_ARC_GLOW_*/GLOW_BLUR_STD_DEVIATION - see
                      // the "ARC GLOW: TUNED DOWN" comment above
                      // OPENED_ARC_GLOW_EXTRA_WIDTH for the specific
                      // values and why they were tuned down from a
                      // first, too-strong attempt.
                      <path
                        d={pathD}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={
                          ARC_STROKE_WIDTH + OPENED_ARC_GLOW_EXTRA_WIDTH
                        }
                        strokeLinecap="round"
                        strokeOpacity={OPENED_ARC_GLOW_OPACITY}
                        filter="url(#opened-spiral-glow)"
                        className="pointer-events-none"
                      />
                    )}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={color}
                      // Full opacity, painted AFTER (on top of) the glow
                      // above - the category color is what should read
                      // as the dominant, legible color of the arc, with
                      // the glow only a backdrop peeking out past its
                      // edges. Subtly thicker while opened (see
                      // OPENED_ARC_STROKE_WIDTH_BOOST's own comment) so
                      // it still reads as connected to the
                      // equally-emphasized start/end highlight circles.
                      strokeOpacity={1}
                      strokeWidth={
                        isOpened
                          ? ARC_STROKE_WIDTH + OPENED_ARC_STROKE_WIDTH_BOOST
                          : ARC_STROKE_WIDTH
                      }
                      strokeLinecap="round"
                    />
                    {isOpened && (
                      // OPENED-ENTRY HIGHLIGHT (arc ring): a thin, crisp
                      // bright stroke traced along the same path, drawn
                      // AFTER (on top of) the colored arc above for a
                      // defined edge against the glow - same visual role
                      // as StarMap's/LinearTimeline's own ring.
                      <path
                        d={pathD}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        className="pointer-events-none"
                      />
                    )}
                    {[start, end].map((endpoint, index) => (
                      <g key={index}>
                        {isOpened && (
                          // See the "ARC ENDPOINT GLOW" comment above
                          // OPENED_ARC_ENDPOINT_GLOW_RADIUS_EXTRA - this
                          // used to be a much bigger/brighter glow
                          // (radius +5, opacity 0.6) than the arc's own
                          // line glow, and since every selected arc
                          // shows two of these, THEY were the actual
                          // dominant "white overpowers the color"
                          // element, not the line.
                          <circle
                            cx={endpoint.x}
                            cy={endpoint.y}
                            r={
                              POINT_RADIUS +
                              OPENED_ARC_ENDPOINT_GLOW_RADIUS_EXTRA
                            }
                            fill="none"
                            stroke={OPENED_HIGHLIGHT_COLOR}
                            strokeWidth={OPENED_ARC_ENDPOINT_GLOW_STROKE_WIDTH}
                            strokeOpacity={OPENED_ARC_GLOW_OPACITY}
                            filter="url(#opened-spiral-glow)"
                            className="pointer-events-none"
                          />
                        )}
                        <circle
                          cx={endpoint.x}
                          cy={endpoint.y}
                          r={POINT_RADIUS}
                          fill={color}
                        />
                        {isOpened && (
                          <circle
                            cx={endpoint.x}
                            cy={endpoint.y}
                            r={POINT_RADIUS + 3}
                            fill="none"
                            stroke={OPENED_HIGHLIGHT_COLOR}
                            strokeWidth={1.5}
                            className="pointer-events-none"
                          />
                        )}
                      </g>
                    ))}
                  </g>
                );
              })}

              {points.map(({ entry, x, y, color }) => {
                const isOpened = openedEntryIdSet.has(entry.id);
                const isFilteredOut = !activeCategorySet.has(
                  entry.activityType
                );
                return (
                  // OPENED-ENTRY HIGHLIGHT: same per-entry <g> + opacity
                  // + glow/ring structure as StarMap.tsx's stars.map().
                  <g
                    key={entry.id}
                    style={{
                      opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                    }}
                    className="transition-opacity duration-200"
                  >
                    {isOpened && (
                      <circle
                        cx={x}
                        cy={y}
                        r={POINT_RADIUS + 5}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={4}
                        strokeOpacity={0.6}
                        filter="url(#opened-spiral-glow)"
                        className="pointer-events-none"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
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
                            ? {
                                ...current,
                                x: event.clientX,
                                y: event.clientY,
                              }
                            : current
                        )
                      }
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => onEntryClick(entry)}
                    />
                    {isOpened && (
                      <circle
                        cx={x}
                        cy={y}
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

              {yearLabels.map(({ year, t }) => {
                const arcLength = tToArcLength(t);
                const hasRoomForTextPath =
                  totalPathLength > 0 &&
                  arcLength <= totalPathLength - YEAR_LABEL_MIN_PATH_ROOM;

                if (hasRoomForTextPath) {
                  return (
                    <text
                      key={year}
                      className="pointer-events-none select-none fill-white/40 text-[10px] uppercase tracking-widest"
                    >
                      <textPath
                        href={`#${spiralPathId}`}
                        startOffset={arcLength}
                      >
                        {year}
                      </textPath>
                    </text>
                  );
                }

                // Fallback: textPath has no room to run (this year's
                // label lands too close to the spiral's outer end) -
                // see the top-of-file "<textPath> YEAR LABELS" comment.
                const { x, y } = spiralPoint(t, spiralParams);
                const angle = spiralTangentAngleDeg(t, spiralParams);
                return (
                  <text
                    key={year}
                    x={x}
                    y={y}
                    dy={-6}
                    textAnchor="middle"
                    transform={`rotate(${angle}, ${x}, ${y})`}
                    className="pointer-events-none select-none fill-white/40 text-[10px] uppercase tracking-widest"
                  >
                    {year}
                  </text>
                );
              })}
            </>
          )}
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
          timeRangeSelectorRect={timeRangeSelectorRect}
        />
      )}
    </div>
  );
}
