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
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Entry } from '../types/Entry';
import { getActivityColor } from '../utils/colors';
import EntryDetailModal from './EntryDetailModal';
// Shared with StarMap.tsx's own hover tooltip - see EntryTooltip.tsx's
// header comment for why this was pulled out into one component instead
// of each visualization keeping its own copy of the markup.
import EntryTooltip from './EntryTooltip';

interface LinearTimelineProps {
  entries: Entry[];
}

/** Plot margins - room for the axis (bottom) and so edge points aren't clipped. */
const MARGIN = { top: 24, right: 24, bottom: 40, left: 24 };

/** Hint passed to d3's axis tick generator - see the AXIS EFFECT comment above. */
const TICK_COUNT = 7;

/** Small circle radius (px) - "small circle" per entry, as opposed to StarMap's varying "magnitude" stars. */
const POINT_RADIUS = 5;

/**
 * How far the user can zoom in/out. Lower bound matches StarMap's 0.5 (so
 * "zoomed out" feels the same amount looser in both views); the upper
 * bound is much higher than StarMap's 8 because zooming a *time* axis in
 * far enough to distinguish individual days - rather than just making
 * existing shapes bigger - needs a lot more scale range.
 */
const ZOOM_SCALE_EXTENT: [number, number] = [0.5, 40];

export default function LinearTimeline({ entries }: LinearTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const axisRef = useRef<SVGGElement>(null);

  // ─── Responsive sizing ───
  // Same ResizeObserver-on-a-container-ref pattern as StarMap.tsx, so this
  // view resizes correctly whenever its container does (window resize,
  // sidebar layout changes, etc.) rather than being sized once at mount.
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

  const innerWidth = Math.max(0, size.width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, size.height - MARGIN.top - MARGIN.bottom);

  // ─── Base time scale ───
  // Maps the full date range of `entries` onto [0, innerWidth] - see the
  // "D3 scaleTime + axisBottom PATTERN" comment above. Falls back to a
  // single-day domain when there are no entries (or no room to draw) so
  // scaleTime never sees an `undefined` bound; that fallback scale is
  // never actually rendered, since the EMPTY STATE branch below returns
  // before any of it is used.
  const baseXScale = useMemo(() => {
    const [minDate, maxDate] = d3.extent(
      entries,
      entry => new Date(entry.timestamp)
    );
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

    return () => {
      svg.on('.zoom', null);
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
  // Every entry sits on one horizontal row (`innerHeight / 2`) - unlike
  // StarMap's 2D jitter, a timeline's whole point is that position along
  // the axis IS the meaningful data; a second, arbitrary dimension would
  // just add noise. Colored via the SAME utils/colors.ts lookup StarMap
  // uses for its stars, so an activity's color means the same thing in
  // both views - see the import comment above.
  const points = useMemo(
    () =>
      entries.map(entry => ({
        entry,
        cx: xScale(new Date(entry.timestamp)),
        color: getActivityColor(entry.activityType),
      })),
    [entries, xScale]
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

  // ─── Click-to-detail ───
  // Reuses EntryDetailModal as-is (see its own header comment - it was
  // built for exactly this "read-only popup for one entry" job and just
  // wasn't wired up to a click handler anywhere yet) rather than
  // Constellation.tsx's sidebar-panel-stack pattern: that pattern exists
  // to let MULTIPLE panels stay open side by side while panning around a
  // 2D star field, which has no equivalent need here - a single modal for
  // "the one point you just clicked" is simpler and sufficient.
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  const isReady = innerWidth > 0 && innerHeight > 0;

  return (
    <div className="rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] p-6 shadow-sm">
      {entries.length === 0 ? (
        // Same empty-state messaging pattern as the post-reset banner in
        // About.tsx (rounded-md border + colored border/bg/text trio) -
        // reused here rather than inventing a second visual language for
        // "there's nothing to show yet."
        <div
          className="rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-sm text-indigo-300"
          role="status"
        >
          No entries yet. Click the + button (top right) to add your first one,
          and it'll show up here on the timeline.
        </div>
      ) : (
        <div ref={containerRef} className="relative h-[420px] w-full">
          <svg
            ref={svgRef}
            width={size.width}
            height={size.height}
            className="cursor-grab text-[var(--text-muted-color)] active:cursor-grabbing"
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {isReady &&
                points.map(({ entry, cx, color }) => (
                  <circle
                    key={entry.id}
                    cx={cx}
                    cy={innerHeight / 2}
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
              <g ref={axisRef} transform={`translate(0,${innerHeight})`} />
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
