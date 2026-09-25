/**
 * SidebarSideToggle - flips the visualization sidebar between the left and
 * right screen edges (useSidebarWidth.ts's `side`, persisted there).
 *
 * PLACEMENT: a small round button straddling the sidebar's canvas-facing
 * edge near its bottom - sitting on SidebarResizeHandle's strip (z-30, so
 * it wins over the handle's z-20) and below BookmarkRail, whose `max-h`
 * stops short of this spot. It's rendered in the same `relative w-fit`
 * wrapper as those two, so like them it follows the edge wherever the
 * sidebar's width or side puts it. Kept out of the sidebar's own header
 * rows on purpose: FocusedEntryView's top row is already full (Back/Undo
 * on one end, Edit/Close on the other) and VizPageHeader's title row would
 * need a second layout just for this - the edge is the one spot that's the
 * same in every sidebar mode.
 *
 * The arrow points where the sidebar will GO.
 *
 * STAGE 1 ONLY: flipping the sidebar to the right does NOT yet move the
 * other right-anchored chrome out of its way - the navbar's '+' pill
 * (Layout.tsx) and the Edit Mode/Reset/Theme button stack (EditModeToggle/
 * ResetButton/ThemeToggle, plus the top-right EditModeBanner/VizEmptyState
 * banners) can overlap a right-side sidebar. Resolving that is a separate
 * follow-up step.
 */

import type { SidebarSide } from '../hooks/useSidebarWidth';

/** Button diameter (px) - centered on the edge. */
const SIZE = 24;

interface SidebarSideToggleProps {
  /** The side the sidebar is on now. */
  side: SidebarSide;
  onToggle: () => void;
}

export default function SidebarSideToggle({
  side,
  onToggle,
}: SidebarSideToggleProps) {
  const target = side === 'left' ? 'right' : 'left';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Move sidebar to the ${target}`}
      title={`Move sidebar to the ${target}`}
      className="absolute bottom-3 z-30 flex items-center justify-center rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] text-[var(--text-muted-color)] shadow-md transition-colors hover:bg-[var(--chrome-hover-bg-color)] hover:text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
      style={{
        [side === 'left' ? 'left' : 'right']: `calc(100% - ${SIZE / 2}px)`,
        width: SIZE,
        height: SIZE,
      }}
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={
            target === 'right'
              ? 'M5 12h14m-6-6 6 6-6 6'
              : 'M19 12H5m6-6-6 6 6 6'
          }
        />
      </svg>
    </button>
  );
}
