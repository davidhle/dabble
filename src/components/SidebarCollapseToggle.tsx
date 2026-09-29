/**
 * SidebarCollapseToggle - hides (and brings back) the visualization
 * sidebar (useSidebarWidth.ts's `collapsed`, persisted there).
 *
 * PLACEMENT: the mirror image of SidebarSideToggle - same size, look and
 * height, but straddling the sidebar's SCREEN-facing edge instead of its
 * canvas-facing one, with the arrow pointing at the screen edge the
 * sidebar tucks away toward. Half of it overhangs into --edge-gutter,
 * which is never narrower than half the button.
 *
 * COLLAPSED: the page doesn't unmount the sidebar - its wrapper gets
 * `data-sidebar-collapsed` and index.css hides every child except this
 * button (tagged `data-collapse-toggle`). So the container keeps its box
 * (the pages' layout measurements stay valid) and this button stays put
 * right where it was clicked, arrow flipped to point back inward.
 */

import type { SidebarSide } from '../hooks/useSidebarWidth';

/** Button diameter (px) - matches SidebarSideToggle. */
const SIZE = 24;

interface SidebarCollapseToggleProps {
  /** The side the sidebar is on - the button sits on that screen-facing edge. */
  side: SidebarSide;
  collapsed: boolean;
  onToggle: () => void;
}

export default function SidebarCollapseToggle({
  side,
  collapsed,
  onToggle,
}: SidebarCollapseToggleProps) {
  // Hiding points toward the sidebar's own screen edge; showing points back out.
  const pointsLeft = (side === 'left') !== collapsed;
  const label = collapsed ? 'Show sidebar' : 'Hide sidebar';

  return (
    <button
      type="button"
      data-collapse-toggle
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="absolute bottom-3 z-30 flex items-center justify-center rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] text-[var(--text-muted-color)] shadow-md transition-colors hover:bg-[var(--chrome-hover-bg-color)] hover:text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
      style={{
        [side === 'left' ? 'right' : 'left']: `calc(100% - ${SIZE / 2}px)`,
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
          d={pointsLeft ? 'M19 12H5m6-6-6 6 6 6' : 'M5 12h14m-6-6 6 6-6 6'}
        />
      </svg>
    </button>
  );
}
