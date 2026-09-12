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
 *   1. Give each category a fixed "center point" by placing it on a
 *      circle (an orbit) around the middle of the canvas, one evenly
 *      spaced angular sector per category (360° / number of categories).
 *      This is `categoryCenters` below - it only depends on canvas size
 *      and the category list, not on the entries themselves, so a
 *      category's region of the sky stays put even as entries are
 *      added/removed. (Category also carries an optional `domain` field -
 *      see types/Category.ts - but it isn't used for positioning here; see
 *      the NOTE ON `domain` comment above `categoryCenters` below.)
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
 * open at once) lives in useEntrySelection.ts, and `onStarClick` is that
 * hook's `handleEntryClick` passed straight through by Constellation.tsx -
 * see its CLICK OUTCOMES comment for what a click actually does (open,
 * expand, or deselect, depending on the entry's current state).
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
import { Entry } from '../types/Entry';
import { Category } from '../types/Category';
// Activity -> color mapping lives in utils/colors.ts, not here, so that
// EntryPanel's sidebar accent bar (and anything else that needs an
// activity's color) always matches a star's color in this view - see the
// comment in colors.ts for why that mapping isn't duplicated per-component.
import { getActivityColor } from '../utils/colors';
// Shared with LinearTimeline.tsx's own hover tooltip - see
// EntryTooltip.tsx's header comment for why this is a shared pattern
// across both visualization views rather than duplicated per-component.
import EntryTooltip from './EntryTooltip';
import VizEmptyState, { TimeRangeSelectorRect } from './VizEmptyState';

interface StarMapProps {
  entries: Entry[];
  /**
   * Whether the RAW, unfiltered dataset (Constellation.tsx's own
   * `entries.length > 0`, not the time-filtered `entries` prop above) has
   * any entries at all - passed straight through to VizEmptyState.tsx so
   * it can distinguish "no data exists" from "filtered to nothing" - see
   * that component's own top-of-file comment for the full reasoning.
   */
  hasAnyEntries: boolean;
  /**
   * The dynamic category list - one "constellation anchor" is laid out per
   * category here (see categoryCenters below), rather than per fixed
   * ActivityType. Passed down from Constellation.tsx (which owns loading
   * it) so it isn't independently reloaded here.
   */
  categories: Category[];
  /**
   * Called with the clicked entry when a star is clicked - wired by
   * Constellation.tsx directly to useEntrySelection.ts's
   * `handleEntryClick`, which already implements the full open-new /
   * expand-minimized / deselect-expanded decision (see that hook's CLICK
   * OUTCOMES comment) - StarMap forwards every click to it unconditionally
   * and holds no click-branching logic of its own anymore.
   */
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
   * The id of the single entry whose panel is currently expanded (not
   * minimized) in Constellation.tsx's sidebar, or `null` if none is. Used
   * here only to drive the CLICK-TO-CENTER effect below - centering runs
   * off *this prop changing*, not off the click event itself, so it fires
   * the same way whether the expand was caused by clicking the star
   * directly or by clicking its minimized row in the sidebar. (The
   * open-new/expand/deselect decision that changes this prop in the first
   * place is useEntrySelection.ts's `handleEntryClick` - see its CLICK
   * OUTCOMES comment - not anything StarMap itself computes.)
   */
  expandedEntryId: string | null;
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
  filterCategories: string[];
  /**
   * The sidebar overlay's current rendered width in pixels (0 when it
   * isn't rendered, i.e. `selectedEntries` is empty) - see the
   * "FULL-BLEED CANVAS" comment above and the CLICK-TO-CENTER comment
   * below for why this needs to be passed in explicitly now, rather than
   * being implied by the canvas's own (previously shrinking) size.
   */
  sidebarWidth: number;
  /**
   * Bumped (incremented) by Constellation.tsx every time its Escape-key
   * full reset fires - see the RESET-VIEW effect below. A counter rather
   * than a boolean/timestamp so two resets in a row (however unlikely)
   * each still produce a distinct value and therefore each still trigger
   * the effect, the same reason a "signal" counter is used instead of a
   * one-shot flag anywhere else React state needs to represent "an event
   * just happened" rather than "a value changed."
   */
  resetViewSignal: number;
  /**
   * The page's measured header bottom edge (Constellation.tsx's own
   * `headerLayout.top`) - used only to position VizEmptyState.tsx below
   * the header when there's nothing to show; StarMap's own star
   * positions/layout don't need this (see the FULL-BLEED CANVAS comment
   * above for why StarMap, unlike LinearTimeline, has never needed a
   * vertical exclusion of its own).
   */
  topOffset: number;
  /**
   * TimeRangeSelector's own card's live rendered position
   * (Constellation.tsx's own `timeRangeSelectorRect`) - passed straight
   * through to VizEmptyState.tsx so it can position its "filtered"
   * message immediately beside that card. See VizEmptyState.tsx's own
   * POSITIONING comment.
   */
  timeRangeSelectorRect: TimeRangeSelectorRect;
}

/** Opacity applied to a star whose category is filtered out. */
const FILTERED_OUT_OPACITY = 0.15;

/**
 * Extra clearance (px, in world/SVG units - unaffected by zoom scale)
 * between where a category's stars can reach (`clusterRadius`, see the
 * `stars` useMemo) and where its label sits. Added on top of
 * `clusterRadius` rather than used as a fixed label position, so the label
 * always clears the *outer edge* of the star jitter disc, not just its
 * center - see LABEL POSITIONING below.
 */
const LABEL_CLEARANCE = 16;

/**
 * Neutral, bright highlight color for the "opened star" ring/glow.
 * Deliberately not tied to any activityType color (see utils/colors.ts) -
 * it needs to read clearly against *every* star color, including the
 * LanguageLearning category's own gold (#facc15), so a warm gold
 * highlight would blend into that one category instead of standing out.
 * A theme token (--star-highlight-color, see index.css), not a fixed hex
 * value - white glows brightly against the dark theme's night sky but
 * would nearly vanish against the light theme's cream canvas, so this
 * flips to a dark ink color in light mode instead, preserving the same
 * "reads clearly against every star color AND the canvas itself" goal.
 */
const OPENED_HIGHLIGHT_COLOR = 'var(--star-highlight-color)';

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
  hasAnyEntries,
  categories,
  onStarClick,
  openedEntryIds,
  expandedEntryId,
  filterCategories,
  sidebarWidth,
  resetViewSignal,
  topOffset,
  timeRangeSelectorRect,
}: StarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  // Holds the same zoom *behavior* instance attached to the <svg> below, so
  // click-to-center (see the CLICK-TO-CENTER effect below) can
  // programmatically drive it later, outside of the 'zoom' event handler
  // that normally drives it.
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
   * STAR CLICK OUTCOMES: NOW OWNED BY useEntrySelection.ts
   * ──────────────────────────────────────────────────────────────────────
   * Clicking a star used to mean one of three different things -
   * open/expand/deselect - decided HERE, via a local `handleStarClick`
   * wrapper that compared `entry.id` against `expandedEntryId` and called
   * either `onStarClick` or a separate `onStarDeselect` prop. That
   * three-way decision is now made entirely inside
   * useEntrySelection.ts's `handleEntryClick` (see its own CLICK OUTCOMES
   * comment for the full open-new / expand-minimized / deselect-expanded
   * breakdown) - Constellation.tsx passes that single function straight
   * through as `onStarClick`, so every star click here forwards to it
   * unconditionally (see the `onClick` below), with no branching left in
   * this file. This is also what LinearTimeline.tsx's points/capsules
   * call for their own clicks, via the same hook - one shared
   * implementation instead of two copies of this logic drifting apart.
   *
   * Cases 1 and 2 (open new / expand minimized) both result in this
   * entry becoming (or staying) the expanded panel, so both should
   * pan/center the canvas on it. Case 3 (deselect) is a close, not an
   * open, so it must NOT trigger that pan - see the CLICK-TO-CENTER
   * effect below for why centering is wired to react to that shared
   * "becomes expanded" outcome (`expandedEntryId` changing) directly,
   * rather than being triggered from the click itself.
   */

  /**
   * ──────────────────────────────────────────────────────────────────────
   * CLICK-TO-CENTER: PROGRAMMATIC PAN VIA d3-zoom's `.transform()`, TIED
   * TO THE EXPANDED-ENTRY STATE CHANGE
   * ──────────────────────────────────────────────────────────────────────
   * This used to run directly inside `handleStarClick` above, right after
   * calling `onStarClick`. That worked for a direct star click, but meant
   * expanding a panel by clicking its *minimized row in the sidebar*
   * (Constellation.tsx's `handleExpandPanel`, which never goes through
   * this file at all) never panned the canvas, even though the visible
   * result - some entry becoming the expanded panel - is identical either
   * way. Rather than duplicate the centering call at every place that can
   * cause an expand, it's pulled out into this effect and keyed on
   * `expandedEntryId` itself: whatever caused that prop to change to a
   * new, non-null id - a direct star click (case 1/2 above) or a sidebar
   * row click - this fires exactly the same way, once, in one place. A
   * deselect (case 3 above) sets `expandedEntryId` to `null` (nothing
   * becomes newly expanded), so the `!expandedEntryId` guard below means
   * closing a panel never triggers this pan, matching the "don't recenter
   * when closing" requirement.
   *
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
   * `screen = k * world + (x, y)`. We want the newly-expanded entry's star
   * to land at some target screen point, at the *current* zoom level k
   * (only the pan changes, not the scale). Solving for the translate that
   * satisfies `k * star + (x, y) = target` gives
   * `(x, y) = target - k * star`, which is exactly what composing
   * `zoomIdentity.translate(target).scale(k).translate(-star)` produces
   * (d3's Transform methods compose left-to-right, each one folding into
   * the running x/y/k rather than overwriting it).
   *
   * WHY THE TARGET IS NOT SIMPLY (width / 2, height / 2):
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
   *
   * This effect intentionally depends on `expandedEntryId` alone, not on
   * `stars`/`size`/`sidebarWidth` too - those are read from whatever the
   * latest render happened to close over, but the pan should only ever be
   * *triggered* by the expanded entry actually changing, not by e.g. a
   * window resize recomputing `stars` while the same entry stays expanded.
   */
  useEffect(() => {
    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior || !expandedEntryId) return;

    const star = stars.find(
      candidate => candidate.entry.id === expandedEntryId
    );
    if (!star) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEntryId]);

  /**
   * ─── RESET-VIEW: PROGRAMMATIC PAN/ZOOM RESET, TIED TO `resetViewSignal` ───
   * Mirrors CLICK-TO-CENTER above (same `zoomBehavior.transform` +
   * transition mechanism), but drives the transform back to
   * `d3.zoomIdentity` (no pan, no zoom) instead of centering a star -
   * this is what "reset pan/zoom" means for Constellation.tsx's
   * Escape-key full reset.
   *
   * `isFirstResetSignal` skips the very first run: `resetViewSignal`
   * starts at 0 (a real, non-null number), so without this guard the
   * effect would fire once on mount too - unlike the CLICK-TO-CENTER
   * effect above, which is naturally skipped on mount by its
   * `!expandedEntryId` guard (`expandedEntryId` starts `null`). A plain
   * counter has no such "nothing happened yet" value to guard on, so the
   * skip has to be tracked explicitly instead.
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

  // ─── Star jitter radius ───
  // How far an individual entry can land from its category's center point
  // (see `randomPointInDisc` below) - hoisted out of the `stars` useMemo so
  // the label-avoidance logic (see `categoryCenters` below) can size its
  // padding off the *same* radius stars actually scatter within, instead
  // of a second, potentially-inconsistent guess at how big a cluster gets.
  const clusterRadius = useMemo(
    () => Math.min(size.width, size.height) * 0.14,
    [size]
  );

  // ─── Category centers (the "constellation anchors") ───
  //
  // Each category gets its own fixed center point, independent of every
  // other category, spread evenly around an orbit of the canvas center -
  // one evenly spaced angular sector per category (360° / number of
  // categories). `categoryCenters` only depends on canvas size and the
  // category list, not on the entries themselves, so a category's region
  // of the sky stays put even as entries are added/removed.
  //
  // NOTE ON `domain`: Category carries an optional `domain` field (see
  // types/Category.ts) that is deliberately NOT used here. An earlier
  // version of this computation grouped categories sharing a `domain` into
  // their own sub-cluster (a domain-level "macro" position with each
  // category sub-positioned around it), but that made a category's spot in
  // the sky depend on which other categories happened to share its domain
  // - reverted back to this simpler one-center-per-category layout, which
  // keeps every category's cluster equally distinct regardless of domain.
  // `domain` stays on the data model for a possible future feature -
  // letting a user manually drag/reposition a domain's or category's
  // region of the sky - it's just not read by the automatic layout below.
  const categoryCenters = useMemo(() => {
    const { width, height } = size;
    // Keyed by string (rather than ActivityType) since Entry.activityType
    // is now a plain string referencing a dynamic category id/name.
    // `angle` is stashed alongside each center so label placement (see the
    // LABEL POSITIONING render logic below) can push a label further out
    // along the same direction the category was placed in, rather than
    // guessing a fixed direction that might run straight into a sibling
    // category's cluster.
    const centers = {} as Record<
      string,
      { x: number; y: number; angle: number }
    >;
    if (width === 0 || height === 0) return centers;

    const centerX = width / 2;
    const centerY = height / 2;
    // Orbit radius: how far each category's anchor sits from the canvas
    // center. Scaled to the smaller dimension so it fits any aspect ratio.
    const orbitRadius = Math.min(width, height) * 0.32;
    const categoryCount = categories.length;
    if (categoryCount === 0) return centers;

    categories.forEach((category, index) => {
      // Evenly spaced angular sectors around the circle, one per category.
      const angle = (index / categoryCount) * Math.PI * 2 - Math.PI / 2;
      centers[category.id] = {
        x: centerX + Math.cos(angle) * orbitRadius,
        y: centerY + Math.sin(angle) * orbitRadius,
        angle,
      };
    });

    return centers;
  }, [size, categories]);

  // ─── Star positions ───
  // Each entry's final (x, y) = its category's fixed center + a small,
  // id-seeded random offset (the "jitter" that makes it look like a
  // loosely scattered cluster rather than a single stacked point).
  const stars = useMemo(() => {
    const { width, height } = size;
    if (width === 0 || height === 0) return [];

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
  }, [entries, categoryCenters, size, clusterRadius]);

  const isReady = size.width > 0 && size.height > 0;

  // Set for O(1) membership checks per star, rebuilt only when the prop
  // itself changes.
  const openedEntryIdSet = useMemo(
    () => new Set(openedEntryIds),
    [openedEntryIds]
  );
  // Set<string> (rather than Set<ActivityType>) since Entry.activityType
  // is now a plain string referencing a dynamic category id/name.
  const activeCategorySet = useMemo(
    () => new Set<string>(filterCategories),
    [filterCategories]
  );

  // Whether there's anything actually visible to plot right now - "of the
  // entries inside the current time window (already time-filtered by
  // Constellation.tsx before reaching this `entries` prop), is at least
  // one ALSO in an active category?" See VizEmptyState.tsx's own
  // top-of-file comment for why this single check covers both the time
  // filter and the category filter as a possible cause, and why
  // `hasAnyEntries` (the RAW, pre-time-filter count) is threaded in
  // separately to decide which of its two messages to show.
  const isEmpty = useMemo(
    () => !entries.some(entry => activeCategorySet.has(entry.activityType)),
    [entries, activeCategorySet]
  );

  // ─── Hover tooltip ───
  // Same shape and same viewport-clientX/clientY-based tracking
  // LinearTimeline.tsx uses for its own hover state - see the "Hover
  // tooltip" comment there. This is entirely independent of
  // `openedEntryIds`/`expandedEntryId` (the click-to-open-panel highlight
  // ring below) and of `onStarClick` - hovering never opens or closes a
  // panel, and opening/closing a panel doesn't touch this state, so the
  // tooltip layers on top of the existing click/highlight behavior rather
  // than interacting with it at all.
  const [hovered, setHovered] = useState<{
    entry: Entry;
    x: number;
    y: number;
  } | null>(null);

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
          {/*
           * Subtle radial vignette so the sky/page feels deeper toward the
           * edges - theme tokens (--starmap-vignette-start/-end, see
           * index.css) rather than fixed hex stops, so this reads as a
           * gentle deepening of the light theme's own cream tone too,
           * instead of staying a night-sky navy gradient regardless of
           * theme.
           */}
          <radialGradient id="sky-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="var(--starmap-vignette-start)" />
            <stop offset="100%" stopColor="var(--starmap-vignette-end)" />
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
          {/*
           * ────────────────────────────────────────────────────────────
           * LABEL POSITIONING: OUTSIDE THE CLUSTER, NOT AT ITS CENTER
           * ────────────────────────────────────────────────────────────
           * A category's stars are jittered up to `clusterRadius` away
           * from `center` (see the `stars` useMemo above) - so a label
           * drawn AT `center`, like the old single-point version did, sits
           * in the densest part of that disc and gets buried under stars
           * as entries are added. Instead, each label is pushed out along
           * `center.angle` - the same direction categoryCenters placed
           * this category in relative to the canvas center - by
           * `clusterRadius + LABEL_CLEARANCE`. That guarantees the label
           * always lands just outside the star disc's outer edge, with a
           * fixed minimum gap to the nearest possible star, regardless of
           * how many entries that category ends up with (the jitter disc's
           * radius is fixed; only its density grows). Pushing along each
           * category's own placement angle (rather than a single fixed
           * direction, e.g. always "up") also naturally fans sibling
           * labels apart from one another, the same way it fans their star
           * clusters apart.
           */}
          {isReady &&
            categories.map(category => {
              const center = categoryCenters[category.id];
              if (!center) return null;
              const labelDistance = clusterRadius + LABEL_CLEARANCE;
              const labelX = center.x + Math.cos(center.angle) * labelDistance;
              const labelY = center.y + Math.sin(center.angle) * labelDistance;
              return (
                <text
                  key={category.id}
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  fill="var(--viz-label-color)"
                  className="pointer-events-none select-none text-xs uppercase tracking-widest"
                >
                  {category.name}
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
                  onClick={() => onStarClick(entry)}
                  // Same hover handlers (and the EDIT: no more native
                  // <title> element - see the "Hover tooltip" comment
                  // above) as LinearTimeline.tsx's points: track the
                  // hovered entry + cursor position in state, cleared on
                  // mouse leave, and let <EntryTooltip> below render from
                  // it. The old <title>{entry.title}</title> child (the
                  // browser's own delayed tooltip) is removed - it would
                  // now just duplicate this richer tooltip's title/date,
                  // popping up a second, plainer one on top of it.
                  onMouseEnter={event =>
                    setHovered({ entry, x: event.clientX, y: event.clientY })
                  }
                  onMouseMove={event =>
                    setHovered(current =>
                      current && current.entry.id === entry.id
                        ? { ...current, x: event.clientX, y: event.clientY }
                        : current
                    )
                  }
                  onMouseLeave={() => setHovered(null)}
                />
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

      {/*
       * Rendered outside the <svg> - EntryTooltip positions itself via
       * `fixed` + viewport clientX/clientY (see its header comment), so it
       * doesn't need to live inside the zoomed/panned SVG coordinate
       * space, only above it (z-50, same as LinearTimeline.tsx's).
       */}
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
