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
 *      range, reset, or add an entry for this window. Rendered TOP-RIGHT,
 *      stacked with EditModeBanner.tsx - see the EDIT MODE STACKING
 *      comment below.
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
 * EDIT MODE STACKING: ONE SHARED TOP-RIGHT SLOT, NOT TWO INDEPENDENT
 * POSITIONS
 * ──────────────────────────────────────────────────────────────────────
 * The "filtered to nothing" message and EditModeBanner.tsx's own "Edit
 * Mode is on" notice both anchor to the exact same fixed top-right stack
 * (see utils/topRightTooltipStack.ts for the shared constants and the
 * full reasoning) - Edit Mode is completely independent of whether the
 * current time range/filters happen to exclude every entry, so either,
 * both, or neither can be showing at once. `editModeBannerVisible` (prop
 * below - each canvas just forwards the `isEditMode` flag it already
 * receives for THIS SAME reason - see e.g. StarMap.tsx's own `isEditMode`
 * prop comment) tells this message whether the stack's top slot is
 * already taken:
 *   - NOT visible: this message renders in the TOP slot itself - the
 *     exact position EditModeBanner would use if IT were the one showing.
 *   - Visible: this message shifts down by one estimated row
 *     (`EDIT_MODE_HEIGHT_ESTIMATE` + `STACK_GAP`) so it sits directly
 *     below EditModeBanner instead of overlapping it.
 * EditModeBanner is rendered by the PAGE (Constellation.tsx/Timeline.tsx/
 * Spiral.tsx), not by this component or the canvas that renders it, so
 * there's no shared flex/layout parent the two could stack through via
 * normal document flow - hence the fixed pixel math instead.
 */

import {
  EDIT_MODE_HEIGHT_ESTIMATE,
  STACK_GAP,
  TOP_SLOT,
} from '../utils/topRightTooltipStack';
import type { SidebarSide } from '../hooks/useSidebarWidth';

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
  /** Which screen edge `sidebarWidth`'s band is on - see useSidebarWidth.ts's SidebarSide comment. */
  sidebarSide: SidebarSide;
  /**
   * Whether EditModeBanner is ALSO currently occupying the shared
   * top-right stack's top slot - used only for the `hasAnyEntries ===
   * true` layout. See the EDIT MODE STACKING comment above.
   */
  editModeBannerVisible: boolean;
}

export default function VizEmptyState({
  hasAnyEntries,
  topOffset,
  sidebarWidth,
  sidebarSide,
  editModeBannerVisible,
}: VizEmptyStateProps) {
  if (hasAnyEntries) {
    const top = editModeBannerVisible
      ? TOP_SLOT + EDIT_MODE_HEIGHT_ESTIMATE + STACK_GAP
      : TOP_SLOT;

    return (
      <div
        className="pointer-events-auto fixed right-[var(--chrome-edge-gutter)] z-40 max-w-sm rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-sm text-[var(--indigo-accent-text)]"
        style={{ top }}
        role="status"
      >
        No entries match the current time range or filters. Try widening the
        selected range, pressing the reset button, or adding an entry for this
        time period.
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center px-6"
      style={{
        top: topOffset,
        left: sidebarSide === 'left' ? sidebarWidth : 0,
        right: sidebarSide === 'right' ? sidebarWidth : 0,
        bottom: 0,
      }}
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
