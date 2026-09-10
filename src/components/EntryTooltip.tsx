/**
 * EntryTooltip.tsx - Shared Hover Tooltip for Both Visualization Views
 *
 * A small floating card showing one entry's title and date, positioned
 * near wherever the cursor is hovering. Originally built inline inside
 * LinearTimeline.tsx's hover handling; extracted here once StarMap.tsx
 * needed the exact same thing, so the two visualizations - a timeline and
 * a star field, otherwise very different D3 setups - share one tooltip
 * look and feel instead of each carrying its own copy of the markup that
 * could silently drift apart. Both call sites follow the same pattern:
 * track `{ entry, x, y }` (viewport clientX/clientY from the triggering
 * mouse event) in local state on hover, clear it to `null` on mouse
 * leave, and conditionally render `<EntryTooltip .../>` only while that
 * state is set - see the "Hover tooltip" comments in LinearTimeline.tsx
 * and StarMap.tsx.
 *
 * DATE FORMAT: uses the shared formatEntryDate() utility (formatEntryDate.ts)
 * - the SAME function EntryPanel.tsx/EntryDetailModal.tsx call - rather than
 * a separate copy of the dateDisplay/single-date logic. This used to be its
 * own inline computation here that predated formatEntryDate() and never got
 * updated to know about date ranges (entries with `endTimestamp` - see its
 * field comment in types/Entry.ts), so a range entry's tooltip silently
 * showed just its start date as a single point instead of the full range
 * (e.g. "Mar 17, 2023" instead of "Mar 17 - Mar 19, 2023"). Calling the
 * shared function here too closes that gap and guarantees the tooltip can
 * never drift out of sync with the panel/modal again, no matter what
 * date-formatting rule changes in the future.
 *
 * EDGE-AWARE POSITIONING: `x`/`y` are just the raw cursor/star position,
 * not a final on-screen box origin - if placed at a flat `x + OFFSET`,
 * `y + OFFSET` unconditionally, the tooltip would render partly (or
 * fully) off-screen for anything hovered near the right or bottom edge
 * of the viewport. The layout effect below measures the tooltip's own
 * rendered size once mounted and, if the default offset placement would
 * overflow an edge, flips the tooltip to the opposite side of the cursor
 * on that axis instead (right-of-cursor -> left-of-cursor, below ->
 * above), with a final clamp as a last resort near a corner where even
 * flipping isn't enough room. Runs in `useLayoutEffect` (not `useEffect`)
 * so the position is corrected before the browser paints, avoiding a
 * visible flash at the wrong spot.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { Entry } from '../types/Entry';
import { formatEntryDate } from '../utils/formatEntryDate';

interface EntryTooltipProps {
  entry: Entry;
  /** Viewport (clientX) position to anchor near - typically the triggering mouse event's coordinates. */
  x: number;
  /** Viewport (clientY) position to anchor near. */
  y: number;
}

/** Default offset (px) from the anchor point, before edge-avoidance kicks in. */
const OFFSET = 12;

/** Minimum gap (px) kept between the tooltip and the viewport edge. */
const EDGE_MARGIN = 8;

export default function EntryTooltip({ entry, x, y }: EntryTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: x + OFFSET,
    top: y + OFFSET,
  });

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;

    const { width, height } = el.getBoundingClientRect();

    // Default placement: below-right of the anchor, same as the offset
    // LinearTimeline used before this was extracted.
    let left = x + OFFSET;
    let top = y + OFFSET;

    // Flip to the opposite side on whichever axis would otherwise overflow.
    if (left + width + EDGE_MARGIN > window.innerWidth) {
      left = x - OFFSET - width;
    }
    if (top + height + EDGE_MARGIN > window.innerHeight) {
      top = y - OFFSET - height;
    }

    // Last-resort clamp (e.g. hovering right in a corner, where even the
    // flipped placement doesn't fully fit) so the tooltip never renders
    // partially off-screen.
    left = Math.min(
      Math.max(left, EDGE_MARGIN),
      window.innerWidth - width - EDGE_MARGIN
    );
    top = Math.min(
      Math.max(top, EDGE_MARGIN),
      window.innerHeight - height - EDGE_MARGIN
    );

    setPosition({ left, top });
  }, [x, y]);

  const formattedDate = formatEntryDate(entry);

  return (
    // pointer-events-none: a hover tooltip should never itself be
    // hoverable/clickable - without this it could steal the mouseleave
    // that's supposed to dismiss it, or block a click on whatever it's
    // floating over. fixed + a viewport-space `left`/`top`: positioned
    // directly from clientX/clientY, independent of either view's own
    // pan/zoom transform or scroll position.
    <div
      ref={tooltipRef}
      // bg-[var(--panel-bg-color-solid)]: this tooltip floats directly
      // over whatever's being hovered (a dense star field, or other
      // timeline points) - the regular --panel-bg-color's subtle ~6%
      // tint left that content clearly legible right through the
      // tooltip, undermining its own job of showing a clean title/date.
      // See --panel-bg-color-solid's comment in index.css for the ~92%
      // opacity value chosen and why it's deliberately short of 100%.
      className="pointer-events-none fixed z-50 rounded-md border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] px-3 py-2 text-xs text-[var(--text-color)] shadow-lg"
      style={{ left: position.left, top: position.top }}
    >
      <div className="font-medium">{entry.title}</div>
      <div className="mt-0.5 text-[var(--text-muted-color)]">
        {formattedDate}
      </div>
    </div>
  );
}
