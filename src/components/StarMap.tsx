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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Entry } from '../types/Entry';
import { Category, getCategoryDomain, getVisualStyle } from '../types/Category';
import {
  HOLLOW_POINT_STROKE_WIDTH,
  HOLLOW_WAVE_HIT_STROKE_WIDTH,
} from '../utils/hollowGlyphs';
import {
  Point,
  auroraColorAt,
  buildRibbon,
  orderAuroraCategories,
  ribbonPath,
  sampleArc,
  sampleCatmullRom,
} from '../utils/auroraRibbon';
// Activity -> color mapping lives in utils/colors.ts, not here, so that
// EntryPanel's sidebar accent bar (and anything else that needs an
// activity's color) always matches a star's color in this view - see the
// comment in colors.ts for why that mapping isn't duplicated per-component.
import { getActivityColor } from '../utils/colors';
// Shared with LinearTimeline.tsx's own hover tooltip - see
// EntryTooltip.tsx's header comment for why this is a shared pattern
// across both visualization views rather than duplicated per-component.
import EntryTooltip from './EntryTooltip';
import type { SidebarSide } from '../hooks/useSidebarWidth';
import VizEmptyState from './VizEmptyState';
import {
  FOCUSED_GLOW_OPACITY,
  FOCUSED_GLOW_STROKE_WIDTH,
  FOCUSED_RING_STROKE_WIDTH,
} from '../utils/focusHighlight';

interface StarMapProps {
  entries: Entry[];
  /**
   * The FULL, unfiltered entries list (Constellation.tsx's own `entries`,
   * not the time-filtered `entries` above) - read only to work out which
   * movement categories an aurora ribbon threads through (see AURORA
   * RIBBONS). That's a property of the orbit entry's own date span, so it
   * mustn't change with whatever time window happens to be selected.
   */
  allEntries: Entry[];
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
  /** Which screen edge `sidebarWidth`'s band is on - see useSidebarWidth.ts's SidebarSide comment. */
  sidebarSide: SidebarSide;
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
   * Whether the shared, cross-page Edit Mode flag (EditModeContext.tsx)
   * is currently on - passed straight through to VizEmptyState.tsx so its
   * "filtered" message knows whether EditModeBanner.tsx is ALSO occupying
   * the shared top-right tooltip stack's top slot (see that file's own
   * EDIT MODE STACKING comment). PURELY PRESENTATIONAL: this is NOT used
   * to change StarMap's own click behavior - that branch lives entirely
   * in Constellation.tsx's `handleCanvasEntryClick` (see
   * EditModeContext.tsx's own "WHY THIS IS A GLOBAL CLICK-BEHAVIOR
   * OVERRIDE" comment for why StarMap otherwise stays unaware Edit Mode
   * exists at all) - StarMap only needs the flag here to position a
   * tooltip correctly, the same way it already needs `hasAnyEntries`/
   * `topOffset`/`sidebarWidth` purely to hand them to VizEmptyState.
   */
  isEditMode: boolean;
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
 * swaps to a distinct, more saturated navy in light mode instead
 * (deliberately NOT --bg-color's own near-black, which reads as plain
 * black rather than blue against a bright canvas - see that token's own
 * comment in index.css for the full history/reasoning), preserving the
 * same "reads clearly against every star color AND the canvas itself"
 * goal in both themes.
 */
const OPENED_HIGHLIGHT_COLOR = 'var(--star-highlight-color)';

/**
 * Radius (px) of a hollow single-date entry's ring - a fixed size rather
 * than a solid star's seeded 2.5-5px "magnitude", since a ring needs room
 * for its cutout to read as hollow at all. Stroke width is shared with
 * Spiral/Linear (utils/hollowGlyphs.ts).
 */
const RING_RADIUS = 4.5;

/**
 * ──────────────────────────────────────────────────────────────────────
 * AURORA RIBBONS: HOLLOW RANGE ENTRIES
 * ──────────────────────────────────────────────────────────────────────
 * A hollow range entry (getVisualStyle - by default an Orbit-domain
 * category's multi-day entry: context AROUND the practice) isn't a point
 * in one cluster, so it doesn't get a star. It's drawn as an aurora: a
 * soft, wavy, gradient-filled ribbon through the clusters of the
 * MOVEMENT categories that were active while it was going on - any
 * Movement-domain category with an entry dated within (or overlapping)
 * the orbit entry's own full span, read from `allEntries` so the time
 * filter never changes which clusters it touches. The time filter still
 * decides whether the ribbon is drawn at all, since it's only built from
 * the filtered `entries`, like every other glyph.
 *   - 2+ touched categories: a Catmull-Rom curve through their cluster
 *     centers (plus a short tail past each end), starting at the
 *     category whose matching entry is earliest and then hopping to the
 *     nearest unvisited center (to keep it from zig-zagging). Each
 *     stretch between two points gets its own gradient (see AURORA
 *     COLORS), so the colors blend in visit order even when
 *     the path doubles back (one gradient across the whole ribbon would
 *     mis-assign colors there).
 *   - 1 touched category: an arc hugging the inner (canvas-center) side
 *     of that cluster, blending the orbit color into that category's.
 *   - 0 touched: a short arc floating in the open space around the canvas
 *     center, placed and shaped from the entry's id (stable across
 *     reloads), in the orbit entry's own color.
 * Geometry lives in utils/auroraRibbon.ts; colors and the rippled,
 * drifting look are covered by AURORA COLORS (in the `auroras` memo) and
 * AURORA LOOK (below). Drawn behind labels and stars, so a star on top of
 * a ribbon keeps the click.
 */
const AURORA_SAMPLES_PER_SEGMENT = 24;
const AURORA_ARC_SAMPLES = 48;
const AURORA_HALF_WIDTH_FRACTION = 0.009;
const AURORA_MIN_HALF_WIDTH = 4;
const AURORA_MAX_HALF_WIDTH = 9;
/** Side-to-side weave, as a fraction of the half-width. */
const AURORA_UNDULATION_FRACTION = 1.6;
/** One weave per this fraction of the canvas's smaller dimension. */
const AURORA_WAVELENGTH_FRACTION = 0.065;
/** Single-category arc: radius (fraction of clusterRadius) and half-sweep (radians). */
const AURORA_CLUSTER_ARC_RADIUS_FRACTION = 0.85;
const AURORA_CLUSTER_ARC_HALF_SWEEP = 0.9;
/** No-category fallback: distance from canvas center, arc radius, and sweep - all seeded per entry within these ranges. */
const AURORA_FALLBACK_MIN_DISTANCE_FRACTION = 0.04;
const AURORA_FALLBACK_MAX_DISTANCE_FRACTION = 0.12;
const AURORA_FALLBACK_ARC_RADIUS_FRACTION = 0.05;
const AURORA_FALLBACK_MIN_SWEEP = 1.6;
const AURORA_FALLBACK_MAX_SWEEP = 2.4;
/**
 * Multi-category tails: how far (fraction of clusterRadius) the ribbon
 * runs on past its first and last cluster, so the orbit's own color has
 * somewhere to live at both ends - see AURORA COLORS.
 */
const AURORA_TAIL_FRACTION = 0.6;
/**
 * AURORA LOOK: each ribbon is drawn twice through its own pair of SVG
 * filters - a crisp-ish body and a wide, faint glow under it - and both
 * start by pushing the ribbon's pixels around with Perlin-style noise
 * (feTurbulence -> feDisplacementMap), so its edges ripple organically
 * instead of following the smooth spline exactly. Turbulence is seeded
 * per entry, so no two ribbons ripple alike.
 *
 * DRIFT: the noise FIELD slides slowly back and forth under the ribbon
 * (an eased offset of the noise, x and y on different periods so the
 * motion never visibly repeats in lockstep), so the ripples flow along
 * the edges. The frequency stays fixed on purpose:
 * animating `baseFrequency` (an earlier version) rescales the whole noise
 * field around the canvas origin, so a ribbon hundreds of px from it saw
 * its pattern churn wholesale - a choppy "boiling" rather than a drift,
 * however long the cycle. Subtle by design: a few px of edge motion,
 * never enough to move the ribbon off its clusters or over neighboring
 * stars (which are drawn above it anyway). Left out entirely under
 * `prefers-reduced-motion`, leaving the same distorted shape, static.
 */
const AURORA_TURBULENCE_FREQUENCY = '0.018 0.024';
const AURORA_TURBULENCE_OCTAVES = 2;
const AURORA_DISPLACEMENT_SCALE = 14;
/** How far (px) the noise field slides at the far end of each drift cycle. */
const AURORA_DRIFT_DISTANCE = 60;
const AURORA_DRIFT_X_PERIOD_MS = 14000;
const AURORA_DRIFT_Y_PERIOD_MS = 11000;
/**
 * PERFORMANCE: an animated filter is re-rasterized - noise generation
 * included, since browsers don't cache intermediate filter results -
 * every time it changes, so the drift's cost is (animated filters on
 * screen) x (updates per second), and it grows with how many ribbons are
 * visible at once (all of them, zoomed out). Two things keep that down:
 *   - ONE shared driver (the AURORA DRIFT DRIVER effect) updates every
 *     ribbon's noise offset together, at AURORA_DRIFT_FPS rather than the
 *     display's full rate. The drift moves under 9px/s, so each step is a
 *     fraction of a pixel of noise shift - no visible stepping.
 *   - Only the BODY filter is animated. The glow is blurred so far that
 *     its ripple was invisible, so it's a plain static blur the browser
 *     can rasterize once and reuse.
 * If it's still heavy with many ribbons, AURORA_TURBULENCE_OCTAVES (2 ->
 * 1) is the next knob: it roughly halves the noise cost, at the price of
 * finer edge detail.
 */
const AURORA_DRIFT_FPS = 20;
/** What every ribbon fades from and to at its ends - see AURORA FADE in the `auroras` memo. */
const AURORA_FADE_COLOR = 'var(--bg-color)';
/** Overall ribbon opacity - softer than the 0.8 hollow waves on Spiral/Linear, but well clear of FILTERED_OUT_OPACITY. */
const AURORA_OPACITY = 0.55;
/** Body and glow blur (px) - both softer than a plain shape, the glow much wider for an atmospheric halo. */
const AURORA_SOFT_BLUR = 2;
const AURORA_GLOW_BLUR = 10;
const AURORA_GLOW_OPACITY = 0.55;
/**
 * Padding (px) around a ribbon's bounds for its filter region - room for
 * the displacement and the glow's blur, plus the drift distance: sliding
 * the noise uncovers a strip that wide along the region's top/left edge,
 * which must stay clear of the ribbon.
 */
const AURORA_FILTER_PADDING = 40 + AURORA_DRIFT_DISTANCE;

/**
 * One AURORA STREAKS ray, in its own frame (x across the ribbon, from
 * -reach to +reach; y along it): a thin band whose two edges are
 * quadratic curves bowing sideways by `bow` at the middle (0 = a straight
 * band). A filled shape rather than a stroked curve on purpose, so its
 * bounding box always spans its full thickness - which is what the shared
 * objectBoundingBox fade mask needs to cover all of it.
 */
function streakPath({
  reach,
  thickness,
  bow,
}: {
  reach: number;
  thickness: number;
  bow: number;
}): string {
  const half = thickness / 2;
  // A quadratic's control point sits at twice the peak offset.
  const control = bow * 2;
  const f = (value: number) => value.toFixed(2);
  return (
    `M${f(-reach)},${f(-half)} Q0,${f(control - half)} ${f(reach)},${f(-half)} ` +
    `L${f(reach)},${f(half)} Q0,${f(control + half)} ${f(-reach)},${f(half)} Z`
  );
}

/** An SVG-id-safe version of an entry id. */
function svgIdSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * AURORA STREAKS: soft rays of light crossing the ribbon - perpendicular
 * to its local direction, like the vertical rays of a real aurora
 * curtain - brightest on the ribbon's path and fading to nothing outward
 * on both sides (one shared mask, `aurora-streak-mask`, fades every streak
 * along its own length). The aim is a continuous, uneven HAZE, not
 * countable "legs":
 *   - CLUSTERED PLACEMENT: cluster centers land along the ribbon at
 *     exponentially distributed gaps (mean AURORA_STREAK_CLUSTER_GAP_PX),
 *     so some sit close together and others leave real gaps; each
 *     cluster scatters a few streaks around its center (Gaussian spread),
 *     which overlap heavily.
 *   - LOW OPACITY + HEAVY BLUR: each streak alone is faint; overlapping
 *     ones build up into denser glow, and the wide blur merges neighbors.
 *   - PROMINENCE: one skewed random value per streak drives its reach,
 *     thickness and brightness together, so most are short and faint and
 *     a few are long and bright - rather than everything mildly varied.
 *   - ARCHED vs STRAIGHT: about AURORA_STREAK_ARCH_CHANCE of them bow
 *     gently sideways (a quadratic curve) instead of running straight.
 *     Both are the same shape - a thin band whose two edges are quadratic
 *     curves, with a bow of 0 for straight ones - so they share the
 *     exact same mask, blur, opacity, coloring and drift, and read as one
 *     effect.
 * Each streak takes the ribbon's own blended color at its spot
 * (auroraColorAt in utils/auroraRibbon.ts), so a multi-color ribbon's
 * haze shifts color along it. All randomness is seeded per entry (stable
 * across reloads). Drawn inside the ribbon's animated body filter, so the
 * streaks ripple with the shared drift (and sit still under
 * `prefers-reduced-motion`) without any animation of their own; they take
 * no pointer events, so the ribbon's hit area and the stars above are
 * unaffected.
 */
/** Mean gap (px of ribbon length) between cluster centers - exponentially distributed, so gaps vary a lot. */
const AURORA_STREAK_CLUSTER_GAP_PX = 32;
/** Streaks per cluster, uniformly in [MIN, MAX]. */
const AURORA_STREAK_CLUSTER_MIN_SIZE = 1;
const AURORA_STREAK_CLUSTER_MAX_SIZE = 6;
/** Standard deviation (px of ribbon length) of a streak's offset from its cluster center. */
const AURORA_STREAK_CLUSTER_SPREAD_PX = 7;
/**
 * Fraction of the ribbon's length (centered) that carries full-strength
 * streaks; they ease out over the rest, split between the two ends.
 */
const AURORA_STREAK_COVERAGE = 0.45;
/**
 * PROMINENCE skew: prominence = random^this, so values pile up near 0
 * (short/faint) with a long tail toward 1 (long/bright).
 */
const AURORA_STREAK_PROMINENCE_SKEW = 1.8;
/** Reach (each side of the path) as a multiple of the ribbon's full half-width, from prominence 0 -> 1 - scaled down only by the COVERAGE envelope. */
const AURORA_STREAK_MIN_REACH_FACTOR = 1.2;
const AURORA_STREAK_MAX_REACH_FACTOR = 9;
const AURORA_STREAK_MIN_REACH_PX = 6;
const AURORA_STREAK_MIN_THICKNESS = 1.5;
const AURORA_STREAK_MAX_THICKNESS = 7;
const AURORA_STREAK_MIN_OPACITY = 0.1;
const AURORA_STREAK_MAX_OPACITY = 0.45;
/** Independent +/- jitter (fraction) on each of reach/thickness/brightness, so prominence isn't the whole story. */
const AURORA_STREAK_JITTER = 0.25;
/** Share of streaks drawn arched, and their bow range as a fraction of reach (sign random). */
const AURORA_STREAK_ARCH_CHANCE = 0.4;
const AURORA_STREAK_MIN_BOW = 0.08;
const AURORA_STREAK_MAX_BOW = 0.22;
/**
 * Extra blur (px) on the streaks alone, on top of the body filter's
 * AURORA_SOFT_BLUR they share with the ribbon - wide, so neighbors merge
 * into haze. A static filter, so it adds no animation of its own.
 */
const AURORA_STREAK_BLUR = 6;
/**
 * The ribbon's hit area: its own shape PLUS an invisible stroke this wide
 * around it, so it stays easy to hover/click now that the visible ribbon
 * is thin (same width as the hollow waves' hit stroke on Spiral/Linear).
 */
const AURORA_HIT_STROKE_WIDTH = HOLLOW_WAVE_HIT_STROKE_WIDTH;

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
  allEntries,
  hasAnyEntries,
  categories,
  onStarClick,
  openedEntryIds,
  expandedEntryId,
  filterCategories,
  sidebarWidth,
  sidebarSide,
  resetViewSignal,
  topOffset,
  isEditMode,
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
  //
  // `useLayoutEffect`, NOT `useEffect`: this used to be a plain
  // `useEffect`, which meant `size` (and therefore `stars`/
  // `categoryCenters`, and the CLICK-TO-CENTER effect's own zero-size
  // guard below) stayed at its initial `{0, 0}` for the entire first
  // passive-effect flush after mount - LinearTimeline.tsx's own MISSING
  // DATA POINTS comment (cause #2) already documents this exact "size
  // effect runs too late" failure mode for that view. It went unnoticed
  // here as long as CLICK-TO-CENTER only ever ran in response to a live
  // click (by which point a later render had long since corrected
  // `size`) - but now that `expandedEntryId` can already be non-null the
  // very first time StarMap mounts (an entry expanded on a different
  // page, persisted via EntrySelectionContext - see that file's
  // "RECENTERING ON MOUNT" comment), CLICK-TO-CENTER's FIRST guaranteed
  // run happens inside that same first effect flush, when `size` was
  // still `{0, 0}` under the old `useEffect` - its own zero-size guard
  // would then skip the recenter, permanently, since `expandedEntryId`
  // doesn't change again just because `size` is corrected in a following
  // render (unlike `sidebarWidth` - see CLICK-TO-CENTER's own comment on
  // its dependency array - `size` isn't one of this effect's
  // dependencies, so there's no later re-fire to fall back on the way
  // there is for a late-arriving `sidebarWidth`). `useLayoutEffect`
  // measures (and corrects) `size` synchronously before that first
  // passive-effect flush ever runs, matching LinearTimeline.tsx's/
  // SpiralTimeline.tsx's own responsive-sizing effects, so
  // CLICK-TO-CENTER's mount-time run already sees the correct size.
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
   * `stars`/`size` are deliberately left OUT of the dependency array -
   * they're read from whatever the latest render happened to close over,
   * but the pan should only ever be *triggered* by the expanded entry
   * actually changing, not by e.g. a window resize recomputing `stars`
   * while the same entry stays expanded.
   *
   * `sidebarWidth` IS a dependency, though (unlike `stars`/`size`) - this
   * used to intentionally exclude it too, on the reasoning above, but that
   * has a race condition on the very FIRST entry a page mounts with
   * already expanded (either the first-ever click on THIS page, or now -
   * see EntrySelectionContext.tsx's "RECENTERING ON MOUNT" comment -
   * arriving already-expanded from a DIFFERENT page via the shared
   * selection context): `expandedEntryId` and `hasSelection` both flip to
   * their new values in the SAME render, but Constellation.tsx's own
   * `sidebarWidth` state is still 0 at that point - a real measurement
   * only lands in a LATER, separate commit, once its ResizeObserver
   * callback fires against the now-mounted SidebarPanelStack DOM node.
   * Since `targetX` reads `sidebarWidth` directly, this effect firing on
   * that render would center against the stale value (0) - i.e. the
   * canvas's full-width center, which sits partly UNDER the sidebar
   * overlay - instead of the correct sidebar-excluded center, and
   * (without `sidebarWidth` as a dependency) never get a second chance to
   * correct itself, since `expandedEntryId` doesn't change again just
   * because `sidebarWidth` later does. SpiralTimeline.tsx's own identical
   * effect already documents this exact race and fixes it the same way -
   * see its "CLICK-TO-CENTER" comment for the full reasoning (including
   * why d3's `.transition()` makes the correction read as one smooth pan
   * converging on the right spot, not a visible double jump, once the
   * real width lands and this effect re-fires).
   */
  useEffect(() => {
    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior || !expandedEntryId) return;

    // A star/ring, or an aurora's own midpoint (see AURORA RIBBONS).
    const star =
      stars.find(candidate => candidate.entry.id === expandedEntryId) ??
      auroras
        .filter(candidate => candidate.entry.id === expandedEntryId)
        .map(candidate => candidate.midpoint)[0];
    if (!star) return;

    const { width, height } = size;
    if (width === 0 || height === 0) return;

    // Center in whatever the sidebar's band leaves free - to its right
    // when the sidebar is on the left, to its left when it's on the right.
    const targetX =
      sidebarSide === 'left'
        ? sidebarWidth + (width - sidebarWidth) / 2
        : (width - sidebarWidth) / 2;
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
  }, [expandedEntryId, sidebarWidth, sidebarSide]);

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

    // Hollow RANGE entries are auroras, not stars - see AURORA RIBBONS.
    // Hollow single-date entries stay here (same seeded position, drawn
    // as a ring instead of a dot - see the `hollow` flag below).
    const starEntries = entries.filter(
      entry =>
        !entry.endTimestamp || getVisualStyle(entry, categories) === 'solid'
    );
    return starEntries.map(entry => {
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
        hollow: getVisualStyle(entry, categories) === 'hollow',
      };
    });
    // `categories` is also what makes a ManageCategoriesModal recolor/
    // re-domain (which never touches `entries`) recompute each star's
    // color and solid/hollow style immediately.
  }, [entries, categoryCenters, size, clusterRadius, categories]);

  // ─── Aurora ribbons ─── see the AURORA RIBBONS comment at the top.
  const auroras = useMemo(() => {
    const { width, height } = size;
    if (width === 0 || height === 0) return [];
    const minDimension = Math.min(width, height);
    const halfWidth = Math.min(
      AURORA_MAX_HALF_WIDTH,
      Math.max(AURORA_MIN_HALF_WIDTH, minDimension * AURORA_HALF_WIDTH_FRACTION)
    );
    const movementCategoryIds = new Set(
      categories
        .filter(category => getCategoryDomain(category) === 'Movement')
        .map(category => category.id)
    );

    return entries
      .filter(
        entry =>
          entry.endTimestamp && getVisualStyle(entry, categories) === 'hollow'
      )
      .map(entry => {
        const visited = orderAuroraCategories(
          entry,
          allEntries,
          movementCategoryIds,
          categoryCenters
        );

        const random = mulberry32(hashStringToSeed(`${entry.id}:aurora`));
        const phase = random() * Math.PI * 2;

        // Centerline + where each colored stretch starts/ends on it.
        // AURORA COLORS: the orbit entry's OWN category color anchors the
        // gradient - both ends, and the middle of every stretch between
        // two clusters - with each touched movement category's color
        // surfacing where the ribbon crosses its cluster. So it reads as
        // "this orbit category" first, woven with what it touched.
        const orbitColor = getActivityColor(entry.activityType);
        let centerline: Point[];
        let stretches: { from: number; to: number; colors: string[] }[];
        if (visited.length >= 2) {
          const centers = visited.map(id => categoryCenters[id]);
          // Tails past the first/last cluster, pointing away from the
          // neighboring one - where the orbit color sits at each end.
          const tail = (end: Point, neighbor: Point): Point => {
            const dx = end.x - neighbor.x;
            const dy = end.y - neighbor.y;
            const length = Math.hypot(dx, dy) || 1;
            const reach = clusterRadius * AURORA_TAIL_FRACTION;
            return {
              x: end.x + (dx / length) * reach,
              y: end.y + (dy / length) * reach,
            };
          };
          const anchors = [
            tail(centers[0], centers[1]),
            ...centers,
            tail(centers[centers.length - 1], centers[centers.length - 2]),
          ];
          centerline = sampleCatmullRom(anchors, AURORA_SAMPLES_PER_SEGMENT);
          const clusterColors = visited.map(id => getActivityColor(id));
          stretches = anchors.slice(0, -1).map((_, k) => ({
            from: k * AURORA_SAMPLES_PER_SEGMENT,
            to: (k + 1) * AURORA_SAMPLES_PER_SEGMENT,
            colors:
              k === 0
                ? [orbitColor, clusterColors[0]]
                : k === anchors.length - 2
                  ? [clusterColors[k - 1], orbitColor]
                  : [clusterColors[k - 1], orbitColor, clusterColors[k]],
          }));
        } else if (visited.length === 1) {
          const center = categoryCenters[visited[0]];
          const inward = center.angle + Math.PI;
          centerline = sampleArc(
            center,
            clusterRadius * AURORA_CLUSTER_ARC_RADIUS_FRACTION,
            inward - AURORA_CLUSTER_ARC_HALF_SWEEP,
            inward + AURORA_CLUSTER_ARC_HALF_SWEEP,
            AURORA_ARC_SAMPLES
          );
          stretches = [
            {
              from: 0,
              to: AURORA_ARC_SAMPLES,
              colors: [orbitColor, getActivityColor(visited[0]), orbitColor],
            },
          ];
        } else {
          const distance =
            minDimension *
            (AURORA_FALLBACK_MIN_DISTANCE_FRACTION +
              random() *
                (AURORA_FALLBACK_MAX_DISTANCE_FRACTION -
                  AURORA_FALLBACK_MIN_DISTANCE_FRACTION));
          const direction = random() * Math.PI * 2;
          const sweep =
            AURORA_FALLBACK_MIN_SWEEP +
            random() * (AURORA_FALLBACK_MAX_SWEEP - AURORA_FALLBACK_MIN_SWEEP);
          const startAngle = random() * Math.PI * 2;
          centerline = sampleArc(
            {
              x: width / 2 + Math.cos(direction) * distance,
              y: height / 2 + Math.sin(direction) * distance,
            },
            minDimension * AURORA_FALLBACK_ARC_RADIUS_FRACTION,
            startAngle,
            startAngle + sweep,
            AURORA_ARC_SAMPLES
          );
          stretches = [
            { from: 0, to: AURORA_ARC_SAMPLES, colors: [orbitColor] },
          ];
        }

        // AURORA FADE: every ribbon starts and ends in the theme's
        // background color, so it fades in from the canvas and back out
        // instead of starting/ending on a solid hue - and a one-color
        // ribbon reads as a glow (background -> color -> background)
        // rather than a flat wash. The first stretch gains the leading
        // stop and the last the trailing one (the same stretch when
        // there's only one). A CSS variable, so it follows the theme.
        stretches[0].colors = [AURORA_FADE_COLOR, ...stretches[0].colors];
        const lastStretch = stretches[stretches.length - 1];
        lastStretch.colors = [...lastStretch.colors, AURORA_FADE_COLOR];

        const ribbon = buildRibbon(centerline, {
          halfWidth,
          undulationAmplitude: halfWidth * AURORA_UNDULATION_FRACTION,
          wavelength: minDimension * AURORA_WAVELENGTH_FRACTION,
          phase,
        });
        const idBase = `aurora-${svgIdSafe(entry.id)}`;

        // AURORA STREAKS - see that comment at the top.
        const streakRandom = mulberry32(
          hashStringToSeed(`${entry.id}:streaks`)
        );
        const streaks: {
          x: number;
          y: number;
          angle: number;
          reach: number;
          thickness: number;
          /** Sideways bow (px) at the streak's middle - 0 for a straight one. */
          bow: number;
          color: string;
          opacity: number;
        }[] = [];
        // Each sample's position along the ribbon (0-1, by arc length),
        // for the coverage envelope below.
        const arcLengths = [0];
        for (let k = 1; k < ribbon.centers.length; k++) {
          arcLengths.push(
            arcLengths[k - 1] +
              Math.hypot(
                ribbon.centers[k].x - ribbon.centers[k - 1].x,
                ribbon.centers[k].y - ribbon.centers[k - 1].y
              )
          );
        }
        const totalLength = arcLengths[arcLengths.length - 1] || 1;
        const edgeFraction = (1 - AURORA_STREAK_COVERAGE) / 2;
        const between = (min: number, max: number, t: number) =>
          min + (max - min) * t;
        const jittered = (value: number) =>
          value * (1 + (streakRandom() * 2 - 1) * AURORA_STREAK_JITTER);
        // A standard-normal draw (Box-Muller) from the seeded generator.
        const gaussian = () =>
          Math.sqrt(-2 * Math.log(1 - streakRandom())) *
          Math.cos(2 * Math.PI * streakRandom());

        // CLUSTERED PLACEMENT: exponential gaps between cluster centers,
        // then a Gaussian scatter of streaks around each.
        const positions: number[] = [];
        for (
          let clusterAt =
            -Math.log(1 - streakRandom()) * AURORA_STREAK_CLUSTER_GAP_PX;
          clusterAt < totalLength;
          clusterAt +=
            -Math.log(1 - streakRandom()) * AURORA_STREAK_CLUSTER_GAP_PX
        ) {
          const size = Math.round(
            between(
              AURORA_STREAK_CLUSTER_MIN_SIZE,
              AURORA_STREAK_CLUSTER_MAX_SIZE,
              streakRandom()
            )
          );
          for (let n = 0; n < size; n++) {
            const at = clusterAt + gaussian() * AURORA_STREAK_CLUSTER_SPREAD_PX;
            if (at > 0 && at < totalLength) positions.push(at);
          }
        }

        for (const at of positions) {
          // The sample at (or just before) this length, interpolated
          // toward the next one for the exact spot.
          let low = 0;
          let high = arcLengths.length - 1;
          while (high - low > 1) {
            const mid = (low + high) >> 1;
            if (arcLengths[mid] <= at) low = mid;
            else high = mid;
          }
          const span = arcLengths[high] - arcLengths[low] || 1;
          const t = (at - arcLengths[low]) / span;
          const center = {
            x: between(ribbon.centers[low].x, ribbon.centers[high].x, t),
            y: between(ribbon.centers[low].y, ribbon.centers[high].y, t),
          };
          const normal = ribbon.normals[low];

          // COVERAGE envelope: 1 across the central AURORA_STREAK_COVERAGE
          // of the ribbon, easing to 0 over the remaining stretch at each
          // end.
          const along = at / totalLength;
          const envelope =
            edgeFraction <= 0
              ? 1
              : d3.easeSinInOut(
                  Math.min(1, along / edgeFraction, (1 - along) / edgeFraction)
                );

          const stretch =
            stretches.find(({ from, to }) => low >= from && low <= to) ??
            stretches[stretches.length - 1];
          // Only the COLOR is taken from the gradient - its end fade is
          // replaced by the coverage envelope above.
          const { color } = auroraColorAt(
            center,
            centerline[stretch.from],
            centerline[stretch.to],
            stretch.colors,
            AURORA_FADE_COLOR
          );

          // PROMINENCE drives reach/thickness/brightness together. All
          // random numbers are drawn before any skip, so every other
          // streak's values stay put.
          const prominence = Math.pow(
            streakRandom(),
            AURORA_STREAK_PROMINENCE_SKEW
          );
          const reach = jittered(
            Math.max(
              AURORA_STREAK_MIN_REACH_PX,
              halfWidth *
                between(
                  AURORA_STREAK_MIN_REACH_FACTOR,
                  AURORA_STREAK_MAX_REACH_FACTOR,
                  prominence
                )
            )
          );
          const thickness = jittered(
            between(
              AURORA_STREAK_MIN_THICKNESS,
              AURORA_STREAK_MAX_THICKNESS,
              prominence
            )
          );
          const brightness = Math.min(
            1,
            jittered(
              between(
                AURORA_STREAK_MIN_OPACITY,
                AURORA_STREAK_MAX_OPACITY,
                prominence
              )
            )
          );
          const arched = streakRandom() < AURORA_STREAK_ARCH_CHANCE;
          const bowFraction = between(
            AURORA_STREAK_MIN_BOW,
            AURORA_STREAK_MAX_BOW,
            streakRandom()
          );
          const bowSign = streakRandom() < 0.5 ? -1 : 1;
          if (envelope <= 0.02) continue;

          const scaledReach = reach * envelope;
          streaks.push({
            x: center.x,
            y: center.y,
            angle: (Math.atan2(normal.y, normal.x) * 180) / Math.PI,
            reach: scaledReach,
            thickness,
            bow: arched ? bowSign * bowFraction * scaledReach : 0,
            color,
            opacity: brightness * envelope,
          });
        }

        // Filter region in canvas px (not the default % of the bounding
        // box, which would clip a near-horizontal ribbon's ripple/glow),
        // covering the streaks' tips too.
        const streakTips = streaks.flatMap(({ x, y, angle, reach }) => {
          const radians = (angle * Math.PI) / 180;
          const ox = Math.cos(radians) * reach;
          const oy = Math.sin(radians) * reach;
          return [
            { x: x + ox, y: y + oy },
            { x: x - ox, y: y - oy },
          ];
        });
        const bounds = [...ribbon.left, ...ribbon.right, ...streakTips];
        const xs = bounds.map(point => point.x);
        const ys = bounds.map(point => point.y);
        const minX = Math.min(...xs) - AURORA_FILTER_PADDING;
        const minY = Math.min(...ys) - AURORA_FILTER_PADDING;

        return {
          entry,
          path: ribbonPath(ribbon),
          midpoint: ribbon.midpoint,
          filterIdBase: idBase,
          filterRegion: {
            x: minX,
            y: minY,
            width: Math.max(...xs) + AURORA_FILTER_PADDING - minX,
            height: Math.max(...ys) + AURORA_FILTER_PADDING - minY,
          },
          turbulenceSeed: Math.floor(random() * 1000),
          streaks,
          segments: stretches.map(({ from, to, colors }, index) => ({
            path: ribbonPath(ribbon, from, to),
            gradientId: `${idBase}-${index}`,
            start: centerline[from],
            end: centerline[to],
            colors,
          })),
        };
      });
  }, [entries, allEntries, categories, categoryCenters, size, clusterRadius]);

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
  // AURORA LOOK's drift is skipped under `prefers-reduced-motion` - kept
  // in state (and followed live) so toggling the OS setting applies
  // without a reload.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setPrefersReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  /**
   * AURORA DRIFT DRIVER - the one loop that animates every ribbon (see
   * AURORA LOOK's DRIFT and PERFORMANCE). Writes the same offset straight
   * onto each body filter's tagged <feOffset> - DOM attributes, not React
   * state, so a tick never re-renders StarMap. Each axis eases there and
   * back as `(1 - cos) / 2`, which has no corners at the turnarounds.
   * requestAnimationFrame already pauses in background tabs; under
   * `prefers-reduced-motion` the loop doesn't run and the noise sits at
   * its resting offset.
   */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const setOffset = (dx: number, dy: number) => {
      svg.querySelectorAll('feOffset[data-aurora-drift]').forEach(node => {
        node.setAttribute('dx', dx.toFixed(2));
        node.setAttribute('dy', dy.toFixed(2));
      });
    };
    if (prefersReducedMotion) {
      setOffset(0, 0);
      return;
    }

    const ease = (now: number, period: number) =>
      (AURORA_DRIFT_DISTANCE * (1 - Math.cos((2 * Math.PI * now) / period))) /
      2;
    let frame = 0;
    let lastTick = -Infinity;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - lastTick < 1000 / AURORA_DRIFT_FPS) return;
      lastTick = now;
      setOffset(
        ease(now, AURORA_DRIFT_X_PERIOD_MS),
        ease(now, AURORA_DRIFT_Y_PERIOD_MS)
      );
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [prefersReducedMotion]);

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
        // canvas-vignette-bg (see index.css): a plain CSS background, not
        // an SVG <radialGradient>/<rect> pair (which this used to paint
        // itself) - so this canvas's vignette is generated by the EXACT
        // same code path as Layout.tsx's shell/navbar and
        // LinearTimeline.tsx's/SpiralTimeline.tsx's own canvases, instead
        // of a second, separately-defined gradient that could (and did:
        // SVG's objectBoundingBox-unit gradient doesn't map to CSS's
        // radial-gradient() the same way) drift out of visual sync with
        // theirs. See that class's own comment in index.css.
        className="canvas-vignette-bg cursor-grab active:cursor-grabbing"
      >
        <defs>
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
          {/*
           * AURORA LOOK - per ribbon, a body filter (noise displacement
           * for rippled edges, then a soft blur) and a static glow filter
           * (a wide blur) - see PERFORMANCE for why only the body moves.
           */}
          {auroras.flatMap(({ filterIdBase, filterRegion, turbulenceSeed }) => [
            <filter
              key={`${filterIdBase}-body`}
              id={`${filterIdBase}-body`}
              filterUnits="userSpaceOnUse"
              {...filterRegion}
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={AURORA_TURBULENCE_FREQUENCY}
                numOctaves={AURORA_TURBULENCE_OCTAVES}
                seed={turbulenceSeed}
                result="staticNoise"
              />
              {/* DRIFT - moved by the shared AURORA DRIFT DRIVER, never per ribbon. */}
              <feOffset
                data-aurora-drift=""
                in="staticNoise"
                dx={0}
                dy={0}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={AURORA_DISPLACEMENT_SCALE}
                xChannelSelector="R"
                yChannelSelector="G"
                result="rippled"
              />
              <feGaussianBlur in="rippled" stdDeviation={AURORA_SOFT_BLUR} />
            </filter>,
            // Static - see PERFORMANCE above.
            <filter
              key={`${filterIdBase}-glow`}
              id={`${filterIdBase}-glow`}
              filterUnits="userSpaceOnUse"
              {...filterRegion}
            >
              <feGaussianBlur stdDeviation={AURORA_GLOW_BLUR} />
            </filter>,
          ])}
          {/*
           * AURORA STREAKS' shared fade: in each streak's own (unrotated)
           * box, transparent at both ends, solid at the middle - where
           * the streak crosses the ribbon's path.
           */}
          <linearGradient id="aurora-streak-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity={0} />
            <stop offset="0.5" stopColor="white" stopOpacity={1} />
            <stop offset="1" stopColor="white" stopOpacity={0} />
          </linearGradient>
          <filter
            id="aurora-streak-blur"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation={AURORA_STREAK_BLUR} />
          </filter>
          <mask id="aurora-streak-mask" maskContentUnits="objectBoundingBox">
            <rect width={1} height={1} fill="url(#aurora-streak-fade)" />
          </mask>
          {/* One gradient per ribbon stretch, laid along that stretch's own two ends - see AURORA COLORS. */}
          {auroras.flatMap(({ segments }) =>
            segments.map(({ gradientId, start, end, colors }) => (
              <linearGradient
                key={gradientId}
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              >
                {colors.map((color, index) => (
                  <stop
                    key={index}
                    offset={
                      colors.length === 1 ? 0 : index / (colors.length - 1)
                    }
                    stopColor={color}
                  />
                ))}
              </linearGradient>
            ))
          )}
        </defs>

        {/*
         * The "zoom layer": the single group whose transform is rewritten
         * by the d3-zoom handler above. Everything meant to pan/zoom
         * together (cluster labels + stars) lives inside it.
         */}
        <g ref={zoomLayerRef}>
          {/*
           * AURORA RIBBONS - see that comment at the top. Behind labels
           * and stars. The colored stretches sit in ONE group carrying
           * the opacity, so where two stretches meet they don't double
           * up into a darker seam. The opened highlight follows the
           * stars' recipe: a blurred highlight-colored glow behind, a
           * crisp thin outline on top.
           */}
          {isReady &&
            auroras.map(({ entry, path, segments, filterIdBase, streaks }) => {
              const isOpened = openedEntryIdSet.has(entry.id);
              const isFocused = entry.id === expandedEntryId;
              const isFilteredOut = !activeCategorySet.has(entry.activityType);
              const fills = segments.map(segment => (
                <path
                  key={segment.gradientId}
                  d={segment.path}
                  fill={`url(#${segment.gradientId})`}
                />
              ));
              return (
                <g
                  key={entry.id}
                  style={{ opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1 }}
                  className="transition-opacity duration-200"
                >
                  {isOpened && (
                    <path
                      d={path}
                      fill="none"
                      stroke={OPENED_HIGHLIGHT_COLOR}
                      strokeWidth={
                        (isFocused ? FOCUSED_GLOW_STROKE_WIDTH : 4) * 2
                      }
                      strokeOpacity={isFocused ? FOCUSED_GLOW_OPACITY : 0.6}
                      strokeLinejoin="round"
                      filter="url(#opened-star-glow)"
                      className="pointer-events-none"
                    />
                  )}
                  <g opacity={AURORA_OPACITY} className="pointer-events-none">
                    <g
                      opacity={AURORA_GLOW_OPACITY}
                      filter={`url(#${filterIdBase}-glow)`}
                    >
                      {fills}
                    </g>
                    <g filter={`url(#${filterIdBase}-body)`}>
                      {fills}
                      {/* AURORA STREAKS - see that comment at the top. */}
                      <g filter="url(#aurora-streak-blur)">
                        {streaks.map((streak, index) => (
                          <path
                            key={index}
                            d={streakPath(streak)}
                            fill={streak.color}
                            opacity={streak.opacity}
                            mask="url(#aurora-streak-mask)"
                            transform={`translate(${streak.x.toFixed(2)},${streak.y.toFixed(2)}) rotate(${streak.angle.toFixed(1)})`}
                          />
                        ))}
                      </g>
                    </g>
                  </g>
                  {isOpened && (
                    <path
                      d={path}
                      fill="none"
                      stroke={OPENED_HIGHLIGHT_COLOR}
                      strokeWidth={isFocused ? FOCUSED_RING_STROKE_WIDTH : 1.5}
                      strokeLinejoin="round"
                      className="pointer-events-none"
                    />
                  )}
                  {/* The whole ribbon as one hit target, over the blurred fills - widened by an invisible stroke (AURORA_HIT_STROKE_WIDTH). */}
                  <path
                    d={path}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={AURORA_HIT_STROKE_WIDTH}
                    strokeLinejoin="round"
                    className="cursor-pointer"
                    onClick={() => onStarClick(entry)}
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
                </g>
              );
            })}

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

          {stars.map(({ entry, x, y, radius: starRadius, color, hollow }) => {
            // A hollow single-date entry is a ring (see RING_RADIUS) at
            // the same seeded spot a star would take; everything else
            // here - highlight, hover, click - is shared.
            const radius = hollow ? RING_RADIUS : starRadius;
            const isOpened = openedEntryIdSet.has(entry.id);
            // FOCUSED ENTRY: the one the sidebar's FocusedEntryView is
            // showing gets a brighter opened highlight - see
            // utils/focusHighlight.ts.
            const isFocused = entry.id === expandedEntryId;
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
                    strokeWidth={isFocused ? FOCUSED_GLOW_STROKE_WIDTH : 4}
                    strokeOpacity={isFocused ? FOCUSED_GLOW_OPACITY : 0.6}
                    filter="url(#opened-star-glow)"
                    className="pointer-events-none"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={hollow ? 'var(--bg-color)' : color}
                  stroke={color}
                  strokeOpacity={hollow ? 1 : 0.35}
                  strokeWidth={hollow ? HOLLOW_POINT_STROKE_WIDTH : 4}
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
                    strokeWidth={isFocused ? FOCUSED_RING_STROKE_WIDTH : 1.5}
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
          sidebarSide={sidebarSide}
          editModeBannerVisible={isEditMode}
        />
      )}
    </div>
  );
}
