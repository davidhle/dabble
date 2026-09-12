/**
 * VizEmptyState.tsx - Shared "Nothing To Show" Overlay For Viz Pages
 *
 * Rendered by StarMap.tsx, LinearTimeline.tsx, and SpiralTimeline.tsx
 * whenever there's nothing actually visible to plot - factored out into
 * one shared component so the wording and positioning can't drift out of
 * sync between the three canvases the way they previously had: StarMap
 * had no empty-state message at all, LinearTimeline positioned its own
 * near the top-left of the visible area, and SpiralTimeline used a
 * hardcoded `top-28 left-6` fixed position that could overlap a long
 * header/subtitle (Spiral's two-sentence subtitle plus FilterBar easily
 * runs past 112px tall).
 *
 * ──────────────────────────────────────────────────────────────────────
 * TWO DISTINCT EMPTY CONDITIONS, TWO DIFFERENT LAYOUTS
 * ──────────────────────────────────────────────────────────────────────
 * "Nothing visible" can mean two very different things, and conflating
 * them - as every canvas used to, always showing "No entries yet" in the
 * same spot - is actively misleading now that TimeRangeContext and
 * category filtering both exist:
 *
 *   1. TRULY NO ENTRIES (`hasAnyEntries === false`): the raw, unfiltered
 *      dataset itself is empty (App.tsx's own `entries` prop has length
 *      0) - e.g. right after "Start Your Own Constellation" in
 *      About.tsx. There's nothing to widen or un-filter; the fix is to
 *      add data via the '+' button. Rendered CENTERED IN THE CANVAS - the
 *      space where the visualization itself would otherwise sit is
 *      genuinely empty, so that's exactly where "there's nothing here
 *      yet, go add something" reads most naturally.
 *   2. FILTERED TO NOTHING (`hasAnyEntries === true`): the raw dataset is
 *      non-empty, but the currently selected time range
 *      (TimeRangeContext's `selectedRange`) and/or active category
 *      filters (useEntrySelection.ts's `filterCategories`) happen to
 *      exclude every entry. The data exists; the fix is to widen the
 *      range, reset, or add an entry for this window. Rendered NEXT TO
 *      TimeRangeSelector instead, at the bottom of the page - this is a
 *      deliberate change from an earlier version that also centered this
 *      message in the canvas: centering a paragraph of filter-adjustment
 *      advice in the middle of the visualization competed with (and on
 *      LinearTimeline, visually collided with) the canvas's own axis/
 *      content, and put the message far from the actual controls
 *      (FilterBar, TimeRangeSelector) it's telling the user to use.
 *      Anchoring it directly beside the control most relevant to the
 *      suggested fix (widen the time range) reads more like inline help
 *      text than a canvas overlay.
 *
 * DETECTION IS SPLIT BETWEEN THE CALLER AND THIS COMPONENT, deliberately:
 * this component only renders whichever message/layout `hasAnyEntries`
 * says to - it takes no entries data itself, so it can't independently
 * verify either condition. Each calling canvas is what actually detects
 * both:
 *
 *   - `hasAnyEntries` (prop below): the PAGE's own raw `entries.length >
 *     0`, from BEFORE TimeRangeContext's hard time-filter is applied -
 *     e.g. Constellation.tsx passes `entries.length > 0`, NOT
 *     `timeFilteredEntries.length > 0`.
 *   - Whether to render this component AT ALL is decided by each canvas
 *     itself (not a prop here): `entries.some(e =>
 *     activeCategorySet.has(e.activityType))` - "of the entries inside
 *     the current time window (the `entries` prop each canvas already
 *     receives, already time-filtered by its page), is at least one ALSO
 *     in an active category?" A `false` result covers both the time
 *     filter and the category filter being the cause, with no need to
 *     tell them apart - the fix suggested by message 2 above covers both
 *     at once regardless.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POSITIONING THE "FILTERED" MESSAGE: MEASURED, NOT GUESSED
 * ──────────────────────────────────────────────────────────────────────
 * `timeRangeSelectorRect` is TimeRangeSelector.tsx's own CARD's live
 * `getBoundingClientRect()` (`top`/`right`/`height`), measured by each
 * page (see e.g. Constellation.tsx's `timeRangeSelectorRect` state) via
 * the `ref` TimeRangeSelector.tsx now forwards to that card - NOT a fixed
 * offset or a CSS trick. This matters because the card's own rendered
 * position already varies with `sidebarWidth` (TimeRangeSelector
 * re-centers itself within a narrower `[sidebarWidth, viewport right]`
 * box as the sidebar opens/closes) and with viewport width - two boxes
 * independently `justify-center`-ed within the same available region do
 * NOT line up their edges just because they share that region (centering
 * a WIDER combined box shifts its own left edge further left than a
 * narrower box centered alone would sit), so a CSS-only "matching
 * spacer" trick can't reproduce the card's true edge. Reading its actual
 * rect directly sidesteps that entirely and stays correct at any
 * sidebar-open/closed state or viewport width.
 *
 * `top`/`height` from that same rect are used (rather than a flat
 * `bottom-*` Tailwind class) so this message's own box is vertically
 * CENTERED against the card's actual height, not just bottom-anchored to
 * the same baseline - the two can end up visibly uneven heights (the
 * card carries an svg track + a date-label row; this message is a
 * variable-length paragraph), so matching centers (not bottoms) is what
 * actually reads as "the same row."
 *
 * `availableWidth` clamps this message's own max-width to whatever room
 * is actually left between the card's right edge and the viewport's
 * right edge (minus a small margin) - without this, a wide sidebar
 * (`sidebarWidth`) combined with a narrower window could push the
 * message's fixed max-width off the right edge of the screen entirely.
 */

export interface TimeRangeSelectorRect {
  top: number;
  right: number;
  height: number;
}

/** Horizontal gap (px) between TimeRangeSelector's card and this message. */
const GAP = 16;

/**
 * Minimum clearance (px) kept between this message and the viewport's
 * right edge. Sized to clear the stacked ResetButton.tsx/ThemeToggle.tsx
 * pair's shared reserved corner (both `fixed right-6 h-11 w-11` - 24px
 * inset + 44px button = 68px), plus a small gap - not just a flat
 * screen-edge margin - since that pair sits in the same bottom-right
 * region on every page this renders on (only their relative bottom-6/
 * bottom-20 stacking order differs, which doesn't affect this horizontal
 * clearance), and without this the "beside" layout's right edge could
 * otherwise land underneath/overlapping them.
 */
const RIGHT_MARGIN = 90;

/** This message's own preferred max width (px) - shrinks below this via `availableWidth` if there isn't room. */
const PREFERRED_MAX_WIDTH = 320;

/**
 * Minimum usable width (px) to the right of TimeRangeSelector's card
 * before the "beside it" layout is abandoned in favor of stacking above
 * it instead - see the ABOVE-INSTEAD-OF-BESIDE comment below. Below this,
 * `availableWidth`'s clamp would still keep the message on-screen, but at
 * a width so narrow the text wraps into a tall, cramped column rather
 * than a readable paragraph - a real case, not a hypothetical one: with
 * the sidebar open (`sidebarWidth` ~33vw) on a ~1280px-wide viewport,
 * TimeRangeSelector's own centered card leaves only ~100-140px to its
 * right before the viewport edge.
 */
const MIN_SIDE_WIDTH = 220;

interface VizEmptyStateProps {
  /**
   * Whether the RAW (pre-time-filter) dataset has any entries at all -
   * see the TWO DISTINCT EMPTY CONDITIONS comment above for why this,
   * not the time-filtered subset a canvas actually renders, decides both
   * which message AND which layout to use.
   */
  hasAnyEntries: boolean;
  /** The page's measured header bottom edge - used only for the `hasAnyEntries === false` centered-in-canvas layout. */
  topOffset: number;
  /** The sidebar overlay's current rendered width (0 when closed) - used only for the `hasAnyEntries === false` centered-in-canvas layout. */
  sidebarWidth: number;
  /**
   * TimeRangeSelector's own card's live rendered position - used only
   * for the `hasAnyEntries === true` layout. See POSITIONING above.
   */
  timeRangeSelectorRect: TimeRangeSelectorRect;
}

export default function VizEmptyState({
  hasAnyEntries,
  topOffset,
  sidebarWidth,
  timeRangeSelectorRect,
}: VizEmptyStateProps) {
  if (hasAnyEntries) {
    const left = timeRangeSelectorRect.right + GAP;
    const availableWidth = window.innerWidth - left - RIGHT_MARGIN;

    const message = (
      <>
        No entries match the current time range or filters. Try widening the
        selected range, pressing the reset button, or adding an entry for this
        time period.
      </>
    );

    if (availableWidth < MIN_SIDE_WIDTH) {
      /**
       * ──────────────────────────────────────────────────────────────
       * ABOVE-INSTEAD-OF-BESIDE: NOT ENOUGH ROOM TO THE RIGHT
       * ──────────────────────────────────────────────────────────────
       * Falls back to centering the message in its OWN row directly
       * above TimeRangeSelector's card - same horizontal centering
       * approach TimeRangeSelector.tsx uses for itself
       * (`[sidebarWidth, viewport right]`, `justify-center`), just one
       * row higher. `bottom` (not `top`) is what's computed here,
       * anchored to TimeRangeSelector's own measured `top` edge (i.e.
       * "this message's bottom sits `GAP`px above wherever the
       * selector's card actually starts") - the selector already sits
       * near the very bottom of the viewport, so stacking a second row
       * BELOW it (rather than above) would frequently render partly
       * off-screen under the fold; there's comfortably more room
       * upward, into the canvas area, instead.
       */
      return (
        <div
          className="pointer-events-none fixed z-40 flex justify-center px-6"
          style={{
            bottom: window.innerHeight - timeRangeSelectorRect.top + GAP,
            left: sidebarWidth,
            right: 0,
          }}
        >
          <div
            className="pointer-events-auto max-w-sm rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-center text-sm text-[var(--indigo-accent-text)]"
            role="status"
          >
            {message}
          </div>
        </div>
      );
    }

    return (
      <div
        className="pointer-events-none fixed z-40 flex items-center"
        style={{
          left,
          top: timeRangeSelectorRect.top,
          height: timeRangeSelectorRect.height,
        }}
      >
        <div
          className="pointer-events-auto rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-sm text-[var(--indigo-accent-text)]"
          style={{
            maxWidth: Math.max(
              0,
              Math.min(PREFERRED_MAX_WIDTH, availableWidth)
            ),
          }}
          role="status"
        >
          {message}
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center px-6"
      style={{ top: topOffset, left: sidebarWidth, right: 0, bottom: 0 }}
    >
      <div
        className="pointer-events-auto max-w-sm rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-center text-sm text-[var(--indigo-accent-text)]"
        role="status"
      >
        No entries yet. Click the + button (top right) to add your first one,
        and it&apos;ll show up here.
      </div>
    </div>
  );
}
