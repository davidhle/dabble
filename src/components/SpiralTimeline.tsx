/**
 * SpiralTimeline.tsx - Chronological Spiral Visualization of Entries
 *
 * A third way to look at `entries`, alongside StarMap.tsx's clustered
 * "constellation" and LinearTimeline.tsx's straight time axis: entries are
 * laid out along an outward-growing spiral, ordered by time the same way
 * LinearTimeline orders them along a line, but coiled into a spiral so a
 * long history still fits inside a compact canvas instead of stretching
 * off-screen. Follows the same overall shape as LinearTimeline.tsx
 * (responsive sizing, a `[0,1]`-normalized time domain, hover tooltip,
 * click-to-detail modal) and the same pan/zoom MECHANISM as StarMap.tsx
 * (a single zoomed `<g>` whose `transform` is written imperatively by
 * d3-zoom, since - like StarMap, and unlike LinearTimeline - there's no
 * axis that needs to be regenerated against a rescaled domain on every
 * zoom tick).
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
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Entry } from '../types/Entry';
import { getActivityColor } from '../utils/colors';
import EntryDetailModal from './EntryDetailModal';
// Shared with StarMap.tsx/LinearTimeline.tsx's own hover tooltip - see
// EntryTooltip.tsx's header comment for why this is a shared pattern
// across every visualization view rather than duplicated per-component.
import EntryTooltip from './EntryTooltip';

interface SpiralTimelineProps {
  entries: Entry[];
}

/** Small circle radius (px) for a single-point entry and for a range entry's end caps. */
const POINT_RADIUS = 5;

/** Stroke width (px) of a range entry's arc. */
const ARC_STROKE_WIDTH = 3.5;

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

export default function SpiralTimeline({ entries }: SpiralTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);

  // Unique per mounted instance, so the <path id="..."> the year labels'
  // <textPath> elements reference can never collide if this component
  // were ever rendered more than once on the same page.
  const spiralPathId = useId();

  // ─── Responsive sizing ───
  // Same ResizeObserver-on-a-container-ref pattern as StarMap.tsx/
  // LinearTimeline.tsx, so this view resizes correctly whenever its
  // container does rather than being sized once at mount.
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
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
  // Spans every entry's timestamp AND (when present) endTimestamp, so a
  // range entry that extends past every other entry's plain timestamp
  // still gets a domain that reaches its own end - otherwise its arc
  // would be asked to plot a t > 1, past the spiral's outer edge. Falls
  // back to a single-day domain when there's nothing to plot (mirrors
  // LinearTimeline's baseXScale fallback), and pads a single-instant
  // domain (one entry, or every entry on the same timestamp) out to a
  // full day so it doesn't collapse every point onto the same spot.
  const [minDate, maxDate] = useMemo(() => {
    const dates = entries.flatMap(entry =>
      entry.endTimestamp
        ? [new Date(entry.timestamp), new Date(entry.endTimestamp)]
        : [new Date(entry.timestamp)]
    );
    const [min, max] = d3.extent(dates);
    const domain: [Date, Date] =
      min && max ? [min, max] : [new Date(), new Date()];

    if (domain[0].getTime() === domain[1].getTime()) {
      domain[0] = d3.timeDay.offset(domain[0], -1);
      domain[1] = d3.timeDay.offset(domain[1], 1);
    }

    return domain;
  }, [entries]);

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
  // regenerated against a rescaled domain the way LinearTimeline's is,
  // so there's nothing else that needs to react to the transform.
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

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  // ─── Hover tooltip ───
  // Same shape/tracking as LinearTimeline.tsx/StarMap.tsx - see the
  // "Hover tooltip" comment in LinearTimeline.tsx.
  const [hovered, setHovered] = useState<{
    entry: Entry;
    x: number;
    y: number;
  } | null>(null);

  // ─── Click-to-detail ───
  // Reuses EntryDetailModal, same as LinearTimeline.tsx - see its own
  // header comment for why a single modal (rather than Constellation.tsx's
  // sidebar-panel-stack) is the right fit for a single-canvas view like
  // this one.
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  const isReady =
    size.width > 0 && size.height > 0 && spiralParams.maxRadius > 0;

  return (
    <div className="rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] p-6 shadow-sm">
      {entries.length === 0 ? (
        // Same empty-state messaging pattern as LinearTimeline.tsx/
        // About.tsx's post-reset banner.
        <div
          className="rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-sm text-indigo-300"
          role="status"
        >
          No entries yet. Click the + button (top right) to add your first one,
          and it'll show up here on the spiral.
        </div>
      ) : (
        <div ref={containerRef} className="relative h-[420px] w-full">
          <svg
            ref={svgRef}
            width={size.width}
            height={size.height}
            className="cursor-grab text-[var(--text-muted-color)] active:cursor-grabbing"
          >
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

                  {ranges.map(({ entry, pathD, start, end, color }) => (
                    <g
                      key={entry.id}
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
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth={ARC_STROKE_WIDTH}
                        strokeLinecap="round"
                      />
                      <circle
                        cx={start.x}
                        cy={start.y}
                        r={POINT_RADIUS}
                        fill={color}
                      />
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r={POINT_RADIUS}
                        fill={color}
                      />
                    </g>
                  ))}

                  {points.map(({ entry, x, y, color }) => (
                    <circle
                      key={entry.id}
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
                            ? { ...current, x: event.clientX, y: event.clientY }
                            : current
                        )
                      }
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setSelectedEntry(entry)}
                    />
                  ))}

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
        </div>
      )}

      <EntryDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
