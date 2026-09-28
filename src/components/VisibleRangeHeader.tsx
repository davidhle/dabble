/**
 * VisibleRangeHeader.tsx - The Viz Pages' "Currently Showing" Date Range
 *
 * A small floating card in the top corner opposite the sidebar showing
 * TimeRangeContext's `selectedRange` - the window the page's viz
 * (StarMap/LinearTimeline/SpiralTimeline) is currently drawing - so the range stays readable without looking down at
 * TimeRangeSelector's brush labels (and reads as the "title" of a year
 * glyph click-to-scope).
 *
 * Styled as a sibling of the sidebar container in each viz page: the same
 * `.bullet-journal-surface` paper/dot-grid background, border, radius and
 * shadow. The text matches FocusedEntryView.tsx's opened-entry title -
 * same `--font-heading` (index.css gives it to every h1/h2), size,
 * weight and `--viz-header-text-shadow`.
 *
 * POSITION: `top` is the sidebar container's own measured top, so the two
 * cards line up across the screen; the side flips with the sidebar
 * (SidebarSideToggle.tsx) so they never overlap. It sits in the same
 * corner as the top-right tooltip stack (utils/topRightTooltipStack.ts)
 * when the sidebar is on the left - `onBottomChange` reports this card's
 * live bottom edge so the page can drop that stack below it.
 */

import { useLayoutEffect, useRef } from 'react';
import type { DateRange } from '../context/TimeRangeContext';
import type { SidebarSide } from '../hooks/useSidebarWidth';
import { formatDateRange } from '../utils/formatEntryDate';

interface VisibleRangeHeaderProps {
  range: DateRange;
  /** Viewport y (px) of the card's top edge - the page's `containerLayout.top`. */
  top: number;
  /** The sidebar's side - the card takes the OPPOSITE top corner. */
  sidebarSide: SidebarSide;
  /** Called with the card's bottom edge (viewport px) whenever it moves or resizes. */
  onBottomChange: (bottom: number) => void;
}

export default function VisibleRangeHeader({
  range,
  top,
  sidebarSide,
  onBottomChange,
}: VisibleRangeHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onBottomChange(el.getBoundingClientRect().bottom);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [top, onBottomChange]);

  return (
    // Positioning lives on this wrapper, not the card: `.bullet-journal-
    // surface` sets its own `position: relative` (for its texture layers),
    // which would override a `fixed` class on the same element.
    <div
      ref={ref}
      className={`fixed z-10 ${
        sidebarSide === 'left'
          ? 'right-[var(--edge-gutter)]'
          : 'left-[var(--edge-gutter)]'
      }`}
      style={{ top }}
    >
      <div className="bullet-journal-surface rounded-2xl border border-[var(--panel-border-color)] px-5 py-3 shadow-lg backdrop-blur-sm">
        <h2
          className="whitespace-nowrap text-2xl font-bold text-[var(--text-color)]"
          style={{ textShadow: 'var(--viz-header-text-shadow)' }}
          aria-label={`Showing ${formatDateRange(range.start, range.end)}`}
        >
          {formatDateRange(range.start, range.end)}
        </h2>
      </div>
    </div>
  );
}
