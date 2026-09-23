/**
 * BookmarkRail.tsx - Sticky-Note Tabs Poking Out Of The Focused Sidebar
 *
 * While an entry is focused (see FocusedEntryView.tsx), every OTHER
 * currently-selected entry gets one tab here. Clicking a tab focuses that
 * entry - wired to the same `handleExpandPanel` a minimized row uses, so
 * the canvas recenters on it (every canvas's recenter effect is keyed on
 * `expandedEntryId`) and EntrySelectionContext pushes the outgoing entry
 * onto the Undo history.
 *
 * Stage 2a: bookmarks render as one flat list, in `selectedEntries`
 * order (newest first). Grouping/stacking them by category, with
 * collapse/expand per group, comes in a follow-up step.
 *
 * ──────────────────────────────────────────────────────────────────────
 * OUTSIDE THE SIDEBAR, NOT INSIDE IT
 * ──────────────────────────────────────────────────────────────────────
 * The tabs stick out past the sidebar's RIGHT edge onto the canvas, like
 * bookmark tabs poking out of a book's pages. That can't be done from
 * inside the sidebar container itself: `.bullet-journal-surface` is
 * `overflow: hidden` (it clips its paper-texture pseudo-elements to its
 * rounded corners - see index.css), so anything overflowing it gets cut
 * off. Instead each page wraps its sidebar container in a plain
 * `relative w-fit` wrapper and renders this rail as the container's
 * SIBLING inside that wrapper. Since the wrapper shrink-wraps the
 * container, `left: 100%` here IS the sidebar's actual right edge, and it
 * tracks the sidebar's live width/position automatically (the container's
 * own measured `calc(33vw - left)` width) rather than any fixed screen
 * position.
 *
 * The rail starts a few px INSIDE that edge (`TAB_TUCK`) and paints
 * BEHIND the container (the container is `z-10`, this rail `z-0`, both
 * within the wrapper's own stacking context), so each tab reads as
 * emerging from underneath the page rather than floating next to it.
 * Each tab's left padding is widened by the same amount so its text
 * clears the tucked-under strip.
 *
 * STICKY-NOTE LOOK: each tab is a solid fill of its entry's category
 * color - the same color as its star/point/arc and its filter chip - so
 * the rail reads as a row of colored sticky notes, identical in both
 * themes. Text is `text-gray-900` regardless of theme or color, the SAME
 * contrast treatment FilterBar.tsx's active category chips use for text
 * on a solid category-color fill (see the comment on that chip's
 * className) rather than separate contrast logic here.
 *
 * SIZE: deliberately narrow - a tab peeking out, not a card. Only the
 * first few characters of the title fit; the hover tooltip carries the
 * full title and date, and the aria-label the full title.
 *
 * TOOLTIP PORTAL: the hover tooltip renders into `document.body`. The
 * wrapper this lives in has no `backdrop-filter`, so an inline `fixed`
 * tooltip would actually work today - but portaling keeps it immune to
 * whatever a page later wraps around the sidebar (a `backdrop-filter`,
 * `transform`, or `filter` ancestor re-scopes `fixed` positioning).
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Entry } from '../types/Entry';
import { SelectedEntry } from '../hooks/useEntrySelection';
import { getActivityColor } from '../utils/colors';
import EntryTooltip from './EntryTooltip';

/** How far (px) the rail starts inside the sidebar's right edge, tucked under it. */
const TAB_TUCK = 8;

interface BookmarkRailProps {
  selectedEntries: SelectedEntry[];
  /** The focused entry (`expandedEntryId`) - excluded from the rail. */
  focusedEntryId: string;
  /** Focuses a bookmarked entry - wired to `handleExpandPanel`. */
  onSelect: (entryId: string) => void;
}

export default function BookmarkRail({
  selectedEntries,
  focusedEntryId,
  onSelect,
}: BookmarkRailProps) {
  const [hovered, setHovered] = useState<{
    entry: Entry;
    x: number;
    y: number;
  } | null>(null);

  const entries = selectedEntries
    .filter(selected => selected.entry.id !== focusedEntryId)
    .map(selected => selected.entry);

  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="Other selected entries"
      // `top-5`: starts near the sidebar's top, level with its Back row.
      // Height capped to the sidebar's own height (the wrapper's), so a
      // long selection scrolls within the rail rather than trailing down
      // the canvas past the sidebar's bottom. Right padding leaves room
      // for the hover nudge and shadow, which the scroll container would
      // otherwise clip.
      className="dark-scrollbar absolute top-5 z-0 flex max-h-[calc(100%-2.5rem)] w-16 flex-col gap-1.5 overflow-y-auto py-0.5 pr-2"
      style={{ left: `calc(100% - ${TAB_TUCK}px)` }}
    >
      {entries.map(entry => (
        <button
          key={entry.id}
          type="button"
          onClick={() => {
            // The clicked tab leaves the rail (it becomes the focused
            // entry), so its mouseleave never fires - clear the tooltip
            // here instead of leaving it stranded on screen.
            setHovered(null);
            onSelect(entry.id);
          }}
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
          aria-label={`Focus ${entry.title}`}
          className="flex-shrink-0 truncate rounded-r-md py-1.5 pr-1 text-left text-[10px] font-semibold leading-tight text-gray-900 shadow-md transition-transform duration-150 hover:translate-x-1"
          style={{
            paddingLeft: TAB_TUCK + 4,
            backgroundColor: getActivityColor(entry.activityType),
          }}
        >
          {entry.title}
        </button>
      ))}

      {hovered &&
        createPortal(
          <EntryTooltip entry={hovered.entry} x={hovered.x} y={hovered.y} />,
          document.body
        )}
    </nav>
  );
}
