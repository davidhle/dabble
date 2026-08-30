/**
 * StarMap.tsx - Constellation-Style Visualization of Entries
 *
 * Renders `entries` as a 2D field of "stars" (small circles) that a user
 * can pan and zoom around, like a star map. Entries are visually grouped
 * by activityType into loose "constellations" - a fixed point per
 * category with entries scattered around it - and clicking a star reports
 * the clicked entry to the parent via `onStarClick` (see Constellation.tsx,
 * which uses it to open an inline detail panel in a sidebar).
 *
 * ──────────────────────────────────────────────────────────────────────
 * FULL-BLEED CANVAS: SHIFT THE ZOOM TARGET, NOT THE CANVAS SIZE
 * ──────────────────────────────────────────────────────────────────────
 * StarMap's root <div> is `fixed inset-0`: it always fills the entire
 * viewport, full width and height, whether or not Constellation.tsx's
 * sidebar overlay is currently showing. This is a change from an earlier
 * version, where the container StarMap rendered into actually shrank
 * (via a CSS flex layout) whenever the sidebar opened, and StarMap
 * measured that shrinking container with a ResizeObserver to match.
 *
 * The sidebar is now a separate `fixed`, higher-z-index overlay drawn ON
 * TOP of this canvas (see Constellation.tsx) rather than a layout
 * sibling that pushes the canvas over - so the canvas's own `size` (and
 * everything computed from it: category centers, star positions, the
 * background rect) is always the *whole* window, never the narrower
 * "not covered by the sidebar" region.
 *
 * The one place this distinction still matters is auto-centering a
 * clicked star (see CLICK-TO-CENTER below): "centered" should mean
 * centered in the region the user can actually *see* the canvas through
 * - i.e. excluding whatever the sidebar overlay is covering - even
 * though the canvas underneath that overlay is still there and still
 * full-size. That's why `sidebarWidth` is threaded in as a prop and used
 * only in that one calculation, not anywhere else in this file.
 *
 * ──────────────────────────────────────────────────────────────────────
 * HOW d3-zoom's PAN/ZOOM TRANSFORM WORKS
 * ──────────────────────────────────────────────────────────────────────
 * d3.zoom() is a *behavior*: a function you `.call()` on a D3 selection
 * (here, the <svg>) that attaches its own low-level mouse/touch/wheel
 * listeners to that DOM node. It does NOT move anything itself - instead,
 * on every drag/wheel/pinch gesture it computes a `d3.ZoomTransform`
 * (`{x, y, k}`, i.e. a translate offset and a scale factor) describing how
 * far the user has panned/zoomed *so far*, and fires a 'zoom' event with
 * that transform.
 *
 * Our job is just to apply that transform to something. The convention
 * (and what we do below) is:
 *   1. Keep the <svg> itself fixed - it defines the visible "viewport".
 *   2. Put everything we want to pan/zoom inside a single child <g>
 *      ("zoom layer").
 *   3. In the 'zoom' event handler, set that <g>'s `transform` attribute
 *      to `event.transform.toString()`, which serializes to something
 *      like `translate(120,45) scale(1.8)`.
 *
 * Because SVG `transform` composes as translate-then-scale on all child
 * coordinates, this single attribute update pans/zooms every star, label,
 * and cluster inside the group without us touching their individual x/y
 * attributes. This is why star positions are computed once (in "world"
 * coordinates) and never recalculated during panning/zooming - only the
 * enclosing group's transform changes.
 *
 * We attach the zoom behavior once (in a `useEffect` with an empty
 * dependency array) so drag-to-pan and scroll-to-zoom keep working across
 * re-renders without resetting the user's current view.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CLUSTERING APPROACH: FIXED CATEGORY CENTERS + JITTER
 * ──────────────────────────────────────────────────────────────────────
 * Real constellations aren't randomly scattered - stars are grouped into
 * recognizable regions of the sky. We fake that effect cheaply:
 *
 *   1. Give each ActivityType a fixed "center point" by placing it on a
 *      circle (an orbit) around the middle of the canvas, one evenly
 *      spaced angular sector per category (360° / number of categories).
 *      This is `categoryCenters` below - it only depends on canvas size,
 *      not on the entries themselves, so a category's region of the sky
 *      stays put even as entries are added/removed.
 *   2. For each entry, look up its category's center and offset it by a
 *      small random (but *deterministic*) polar-coordinate jitter: a
 *      random angle (0-360°) and a random radius within the cluster's
 *      spread. Using `sqrt(random)` for the radius (instead of `random`
 *      directly) distributes points evenly across the disc's *area*
 *      rather than bunching them near the center - see `randomPointInDisc`.
 *
 * The jitter is seeded from the entry's stable `id` (via a tiny string
 * hash -> PRNG) rather than `Math.random()`. This matters because star
 * positions are recomputed in a `useMemo` whenever the canvas resizes -
 * if we used real randomness, every star would visibly "jump" to a new
 * random spot on every resize. Seeding by id means the same entry always
 * lands in the same relative spot within its cluster.
 *
 * Together, this reads as "activities of the same type form a loose
 * constellation," while activities of different types occupy clearly
 * separate regions of the sky - without any real force-directed layout
 * or collision simulation.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CLICK-TO-SELECT WIRING
 * ──────────────────────────────────────────────────────────────────────
 * Each star is a plain SVG <circle> with a React `onClick` handler that
 * calls `onStarClick(star.entry)`. StarMap itself holds no notion of
 * "selected" entries - that state (an array, so multiple stars can be
 * open at once) lives in the parent (Constellation.tsx), which decides
 * what to do with a clicked entry (currently: add it to a sidebar list).
 *
 * This works cleanly alongside d3-zoom's drag-to-pan because d3.zoom's
 * default `clickDistance` is 0: if the pointer moves at all between
 * mousedown and mouseup (i.e. the user was panning), d3 suppresses the
 * synthetic 'click' event that would otherwise follow, so a pan gesture
 * that happens to end on top of a star won't accidentally select it.
 * A genuine, no-movement click passes through untouched and reaches our
 * onClick handler normally.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ACTIVITY_TYPE_OPTIONS, ActivityType, Entry } from '../types/Entry';
// Activity -> color mapping lives in utils/colors.ts, not here, so that
// EntryPanel's sidebar accent bar (and anything else that needs an
// activity's color) always matches a star's color in this view - see the
// comment in colors.ts for why that mapping isn't duplicated per-component.
import { getActivityColor } from '../utils/colors';

interface StarMapProps {
  entries: Entry[];
  /** Called with the clicked entry when a star is clicked. */
  onStarClick: (entry: Entry) => void;
  /**
   * IDs of entries currently "opened" (i.e. represented by a panel,
   * expanded or minimized, in Constellation.tsx's sidebar). Stars whose
   * entry id appears here render a highlight ring/glow - purely reactive
   * to this prop; StarMap keeps no internal notion of which stars are
   * opened, so the highlight can't drift out of sync with the sidebar.
   */
  openedEntryIds: string[];
  /**
   * activityTypes currently "active" (Constellation.tsx's sidebar filter
   * toggles). Stars whose activityType is NOT in this list are dimmed to
   * FILTERED_OUT_OPACITY rather than hidden or removed - filtering here
   * is intentionally non-destructive: a filtered-out star is still
   * present in the DOM, still clickable, and if it's also an "opened"
   * star (see openedEntryIds above) its highlight ring still renders,
   * just at the dimmed opacity along with the rest of the star. This
   * mirrors Constellation.tsx's sidebar, which never closes a panel just
   * because its category gets filtered out here.
   */
  filterCategories: ActivityType[];
  /**
   * The sidebar overlay's current rendered width in pixels (0 when it
   * isn't rendered, i.e. `selectedEntries` is empty) - see the
   * "FULL-BLEED CANVAS" comment above and the CLICK-TO-CENTER comment
   * below for why this needs to be passed in explicitly now, rather than
   * being implied by the canvas's own (previously shrinking) size.
   */
  sidebarWidth: number;
}

/** Opacity applied to a star whose category is filtered out. */
const FILTERED_OUT_OPACITY = 0.15;

/**
 * Neutral, bright highlight color for the "opened star" ring/glow.
 * Deliberately not tied to any activityType color (see utils/colors.ts) -
 * it needs to read clearly against *every* star color, including the
 * LanguageLearning category's own gold (#facc15), so a warm gold
 * highlight would blend into that one category instead of standing out.
 */
const OPENED_HIGHLIGHT_COLOR = '#ffffff';

/**
 * Tiny deterministic string hash (djb2 variant) -> 32-bit seed.
 * Used so each entry's jitter is stable across re-renders instead of
 * reshuffling every time star positions are recomputed.
 */
function hashStringToSeed(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * mulberry32 - a small, fast seeded PRNG.
 * Given the same seed it always produces the same sequence of [0, 1)
 * floats, which is what lets star jitter be "random-looking" yet stable.
 */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks a uniformly-distributed random point within a disc of the given
 * radius, centered at (0, 0). Using sqrt(random()) for the radius (rather
 * than random() directly) avoids over-concentrating points near the
 * center, which is what a naive polar-coordinate jitter would otherwise do.
 */
function randomPointInDisc(random: () => number, radius: number) {
  const angle = random() * Math.PI * 2;
  const r = Math.sqrt(random()) * radius;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export default function StarMap({
  entries,
  onStarClick,
  openedEntryIds,
  filterCategories,
  sidebarWidth,
}: StarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  // Holds the same zoom *behavior* instance attached to the <svg> below, so
  // click-to-center (see handleStarClick) can programmatically drive it
  // later, outside of the 'zoom' event handler that normally drives it.
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);

  // ─── Responsive sizing ───
  // The root <div> is `fixed inset-0` (see "FULL-BLEED CANVAS" above), so
  // this always measures the full viewport - it no longer shrinks when
  // the sidebar overlay opens. Still tracked via ResizeObserver (rather
  // than reading window.innerWidth/Height directly) so window resizes
  // continue to update it live, same as before.
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

  // ─── Pan/zoom behavior ───
  // Attached once (see the big comment above) so the user's current
  // pan/zoom position survives entries/size changing and re-rendering.
  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomLayer = d3.select(zoomLayerRef.current);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8]) // how far the user can zoom out/in
      .on('zoom', event => {
        // This is the only place star coordinates get transformed -
        // individual star <circle> positions never change.
        zoomLayer.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    // Detach the zoom listeners if StarMap unmounts.
    return () => {
      svg.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  /**
   * ──────────────────────────────────────────────────────────────────────
   * CLICK-TO-CENTER: PROGRAMMATIC PAN VIA d3-zoom's `.transform()`
   * ──────────────────────────────────────────────────────────────────────
   * Everywhere else in this file, the zoom transform is *read* - it's
   * whatever the 'zoom' event above last reported from a user drag/wheel
   * gesture. Here we go the other direction: we compute a target
   * `d3.ZoomTransform` ourselves and hand it to the zoom behavior, which
   * applies it exactly as if the user had produced it by gesture (firing
   * the same 'zoom' events, so `zoomLayer`'s transform attribute above
   * stays in sync automatically - no separate state to manage).
   *
   * The zoom behavior exposes this as `zoomBehavior.transform`, a function
   * you `.call()` on a selection the same way you'd call the behavior
   * itself. Calling it on a plain selection (`svg.call(zoom.transform, t)`)
   * jumps instantly to transform `t`. Calling it on a *transition*
   * (`svg.transition().call(zoom.transform, t)`) instead animates: d3
   * interpolates between the current transform and `t` (translate and
   * scale together) over the transition's duration, dispatching 'zoom'
   * events on every tick - which is what makes the pan glide smoothly
   * instead of jumping.
   *
   * A `d3.ZoomTransform` is `{ x, y, k }` and maps a *world* coordinate
   * (star.x, star.y) to a *screen* coordinate via
   * `screen = k * world + (x, y)`. We want the clicked star to land at
   * some target screen point, at the *current* zoom level k (only the pan
   * changes, not the scale). Solving for the translate that satisfies
   * `k * star + (x, y) = target` gives `(x, y) = target - k * star`, which
   * is exactly what composing
   * `zoomIdentity.translate(target).scale(k).translate(-star)` produces
   * (d3's Transform methods compose left-to-right, each one folding into
   * the running x/y/k rather than overwriting it).
   *
   * WHY THE TARGET IS NOT SIMPLY (width / 2, height / 2) ANYMORE:
   * Before the "FULL-BLEED CANVAS" change (see the top-of-file comment),
   * the canvas's own `size` *was* the visible viz region - the container
   * physically shrank when the sidebar opened - so its literal center
   * was already the right target. Now `size` is always the full window,
   * so (width / 2, height / 2) would center a star under the sidebar
   * overlay half the time, not in the region the user can actually see
   * the canvas through. The fix is to bias the target rightward by half
   * the sidebar's width: the visible band runs from x = sidebarWidth to
   * x = width, so its midpoint is `sidebarWidth + (width - sidebarWidth) / 2`.
   * The y target is untouched (`height / 2`) since the sidebar overlay
   * only covers the left edge, not the top or bottom.
   */
  const handleStarClick = (star: { entry: Entry; x: number; y: number }) => {
    onStarClick(star.entry);

    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior) return;

    const { width, height } = size;
    if (width === 0 || height === 0) return;

    const targetX = sidebarWidth + (width - sidebarWidth) / 2;
    const targetY = height / 2;

    const currentTransform = d3.zoomTransform(svgNode);

    const centeredTransform = d3.zoomIdentity
      .translate(targetX, targetY)
      .scale(currentTransform.k) // preserve the user's current zoom level
      .translate(-star.x, -star.y);

    d3.select(svgNode)
      .transition()
      .duration(650) // 500-750ms: smooth, not sluggish
      .call(zoomBehavior.transform, centeredTransform);
  };

  // ─── Category centers (the "constellation anchors") ───
  const categoryCenters = useMemo(() => {
    const { width, height } = size;
    const centers = {} as Record<ActivityType, { x: number; y: number }>;
    if (width === 0 || height === 0) return centers;

    const centerX = width / 2;
    const centerY = height / 2;
    // Orbit radius: how far each category's anchor sits from the canvas
    // center. Scaled to the smaller dimension so it fits any aspect ratio.
    const orbitRadius = Math.min(width, height) * 0.32;
    const categoryCount = ACTIVITY_TYPE_OPTIONS.length;

    ACTIVITY_TYPE_OPTIONS.forEach((option, index) => {
      // Evenly spaced angular sectors around the circle, one per category.
      const angle = (index / categoryCount) * Math.PI * 2 - Math.PI / 2;
      centers[option.value] = {
        x: centerX + Math.cos(angle) * orbitRadius,
        y: centerY + Math.sin(angle) * orbitRadius,
      };
    });

    return centers;
  }, [size]);

  // ─── Star positions ───
  // Each entry's final (x, y) = its category's fixed center + a small,
  // id-seeded random offset (the "jitter" that makes it look like a
  // loosely scattered cluster rather than a single stacked point).
  const stars = useMemo(() => {
    const { width, height } = size;
    if (width === 0 || height === 0) return [];

    const clusterRadius = Math.min(width, height) * 0.14;

    return entries.map(entry => {
      const center = categoryCenters[entry.activityType] ?? {
        x: width / 2,
        y: height / 2,
      };
      const random = mulberry32(hashStringToSeed(entry.id));
      const offset = randomPointInDisc(random, clusterRadius);
      // A little extra seeded randomness so stars vary in size ("magnitude")
      // instead of all being identical dots.
      const radius = 2.5 + random() * 2.5;

      return {
        entry,
        x: center.x + offset.x,
        y: center.y + offset.y,
        radius,
        color: getActivityColor(entry.activityType),
      };
    });
  }, [entries, categoryCenters, size]);

  const isReady = size.width > 0 && size.height > 0;

  // Set for O(1) membership checks per star, rebuilt only when the prop
  // itself changes.
  const openedEntryIdSet = useMemo(
    () => new Set(openedEntryIds),
    [openedEntryIds]
  );
  const activeCategorySet = useMemo(
    () => new Set(filterCategories),
    [filterCategories]
  );

  return (
    // `fixed inset-0` (not a layout child) - see "FULL-BLEED CANVAS"
    // above. z-0 is the base layer: Layout.tsx's navbar, Constellation's
    // header text, FilterBar, and the sidebar overlay all render above
    // this with their own higher z-index.
    <div ref={containerRef} className="fixed inset-0 z-0">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        // Shared theme token (see index.css :root) rather than a hardcoded
        // hex value - lets the sidebar match this exactly, and centralizes
        // both for a future dark/light mode toggle.
        className="cursor-grab bg-[var(--bg-color)] active:cursor-grabbing"
      >
        <defs>
          {/* Subtle radial vignette so the sky feels deeper toward the edges. */}
          <radialGradient id="sky-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#141a35" />
            <stop offset="100%" stopColor="#05070f" />
          </radialGradient>
          {/*
           * Soft blur used behind opened stars' highlight ring, so it
           * reads as a glow rather than a hard-edged circle. Combined
           * with a crisp (unblurred) ring drawn on top of the star - see
           * the stars.map() below.
           */}
          <filter
            id="opened-star-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <rect
          width={size.width}
          height={size.height}
          fill="url(#sky-vignette)"
        />

        {/*
         * The "zoom layer": the single group whose transform is rewritten
         * by the d3-zoom handler above. Everything meant to pan/zoom
         * together (cluster labels + stars) lives inside it.
         */}
        <g ref={zoomLayerRef}>
          {isReady &&
            ACTIVITY_TYPE_OPTIONS.map(option => {
              const center = categoryCenters[option.value];
              if (!center) return null;
              return (
                <text
                  key={option.value}
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  className="pointer-events-none select-none fill-white/30 text-xs uppercase tracking-widest"
                >
                  {option.label}
                </text>
              );
            })}

          {stars.map(({ entry, x, y, radius, color }) => {
            const isOpened = openedEntryIdSet.has(entry.id);
            const isFilteredOut = !activeCategorySet.has(entry.activityType);
            return (
              // Opacity is set on the whole group (glow + star + ring)
              // rather than per-circle, so a filtered-out star's "opened"
              // highlight dims along with it instead of staying full
              // brightness - see the filterCategories prop comment above.
              // Filtered-out stars keep their onClick below: filtering is
              // visual-only here, not an interaction block, so a user can
              // still click a dimmed star to open its panel.
              <g
                key={entry.id}
                style={{ opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1 }}
                className="transition-opacity duration-200"
              >
                {isOpened && (
                  // Soft blurred halo, behind the star.
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 5}
                    fill="none"
                    stroke={OPENED_HIGHLIGHT_COLOR}
                    strokeWidth={4}
                    strokeOpacity={0.6}
                    filter="url(#opened-star-glow)"
                    className="pointer-events-none"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
                  stroke={color}
                  strokeOpacity={0.35}
                  strokeWidth={4}
                  className="cursor-pointer"
                  onClick={() => handleStarClick({ entry, x, y })}
                >
                  <title>{entry.title}</title>
                </circle>
                {isOpened && (
                  // Crisp thin ring on top, for a defined edge against the glow.
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 3}
                    fill="none"
                    stroke={OPENED_HIGHLIGHT_COLOR}
                    strokeWidth={1.5}
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
