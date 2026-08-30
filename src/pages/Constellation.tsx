/**
 * Constellation.tsx - Star Map Page
 *
 * Renders the entries array (lifted in App.tsx) as a pannable/zoomable
 * "star map" via StarMap.tsx. See StarMap.tsx for the pan/zoom,
 * clustering, and click handling implementation details.
 *
 * App.tsx currently keeps entries only in memory, so a fresh session has
 * an empty array. Rather than let the page render an empty void, we fall
 * back to a small set of mock entries (src/utils/mockEntries.ts) purely
 * so there's something to look at and click on while testing - real
 * entries added via the '+' button take over immediately once they exist.
 *
 * ──────────────────────────────────────────────────────────────────────
 * TWO-REGION LAYOUT: SIDEBAR STATE DRIVES WIDTH
 * ──────────────────────────────────────────────────────────────────────
 * The page is split into two flex children: a left sidebar and a right
 * region holding StarMap. `selectedEntries` is the single source of truth
 * for the sidebar - there's no separate "is the sidebar open" flag,
 * because "open" is just derived from `selectedEntries.length > 0`.
 *
 * The sidebar's width is driven directly by that state: `w-0` (with
 * `overflow-hidden` so its content can't leak out) when the array is
 * empty, or a fixed `w-80` once it has at least one entry. Clicking a
 * star in StarMap opens (or re-focuses) that entry in the array (see
 * `handleStarClick` below), which flips the sidebar from 0 to 320px;
 * closing the last panel empties the array and collapses it back to 0.
 *
 * The right region uses `flex-1 min-w-0` so it always fills whatever
 * width the sidebar isn't using. `min-w-0` matters here: without it, a
 * flex item won't shrink below its content's intrinsic width, which
 * would stop the StarMap container (and therefore its <svg>) from
 * shrinking when the sidebar opens.
 *
 * StarMap itself doesn't know anything about the sidebar's width - it
 * just measures its own containing element with a ResizeObserver (see
 * StarMap.tsx) and sizes its <svg> to match. Because the sidebar's width
 * change resizes the right region's box, that ResizeObserver fires
 * automatically and StarMap's <svg> (and the star layout inside it)
 * responds without any explicit coordination from this component.
 *
 * ──────────────────────────────────────────────────────────────────────
 * PANEL STACK: SORT ORDER, EXPAND/MINIMIZE, AND THE "OPENED" HIGHLIGHT
 * ──────────────────────────────────────────────────────────────────────
 * `selectedEntries` holds `{ entry, expanded }` pairs, always kept sorted
 * newest-first by `entry.timestamp` (see `insertSortedByTimestampDesc`).
 * That sort only runs when an entry is *added* - toggling which panel is
 * expanded, or removing one, never reorders the rest of the list, so a
 * panel doesn't jump around in the stack just because the user is
 * clicking through it.
 *
 * At most one panel is expanded at a time: opening a new star, or
 * re-clicking/re-selecting an already-open one, expands that entry and
 * collapses every other one. This mirrors a lot of "accordion" UIs and
 * keeps the sidebar from growing unboundedly tall as more stars are
 * opened - only the panel currently being looked at takes up full space,
 * the rest collapse to compact rows (see EntryPanel.tsx).
 *
 * `openedEntryIds` (passed to StarMap for the highlight ring/glow around
 * "opened" stars) is *every* id in `selectedEntries`, expanded or not -
 * "opened" means "has a panel in the sidebar at all", not "is currently
 * expanded". It's derived with `useMemo` rather than tracked as separate
 * state, so it can never drift out of sync with `selectedEntries` itself.
 */

import { useMemo, useState } from 'react';
import EntryPanel from '../components/EntryPanel';
import StarMap from '../components/StarMap';
import { Entry } from '../types/Entry';
import { generateMockEntries } from '../utils/mockEntries';

interface ConstellationProps {
  entries: Entry[];
}

interface SelectedEntry {
  entry: Entry;
  expanded: boolean;
}

/**
 * Inserts `selectedEntry` into `list` and returns a new array sorted
 * newest-first by timestamp. Used only when a *new* star is opened - see
 * the panel-stack comment above for why toggling/closing never re-sorts.
 */
function insertSortedByTimestampDesc(
  list: SelectedEntry[],
  selectedEntry: SelectedEntry
): SelectedEntry[] {
  return [...list, selectedEntry].sort(
    (a, b) =>
      new Date(b.entry.timestamp).getTime() -
      new Date(a.entry.timestamp).getTime()
  );
}

export default function Constellation({ entries }: ConstellationProps) {
  const usingMockData = entries.length === 0;

  // Only generate mock entries once, not on every render, and only when
  // they're actually needed.
  const mockEntries = useMemo(() => generateMockEntries(), []);

  const displayedEntries = usingMockData ? mockEntries : entries;

  // The sidebar's panel stack - see the panel-stack comment above for the
  // sort-order and expand/collapse rules this state follows.
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);

  const handleStarClick = (entry: Entry) => {
    setSelectedEntries(prev => {
      const alreadyOpen = prev.some(selected => selected.entry.id === entry.id);

      if (alreadyOpen) {
        // Already in the stack: just switch which panel is expanded.
        // No duplicate, no reorder.
        return prev.map(selected => ({
          ...selected,
          expanded: selected.entry.id === entry.id,
        }));
      }

      // A newly opened star: collapse every existing panel, then insert
      // this one (expanded) back into chronological order.
      const collapsedRest = prev.map(selected => ({
        ...selected,
        expanded: false,
      }));
      return insertSortedByTimestampDesc(collapsedRest, {
        entry,
        expanded: true,
      });
    });
  };

  // Also used when a minimized panel row in the sidebar is clicked - same
  // "expand this one, collapse the rest, don't reorder" rule as re-clicking
  // an already-open star.
  const handleExpandPanel = (entryId: string) => {
    setSelectedEntries(prev =>
      prev.map(selected => ({
        ...selected,
        expanded: selected.entry.id === entryId,
      }))
    );
  };

  const handleClosePanel = (entryId: string) => {
    setSelectedEntries(prev =>
      prev.filter(selected => selected.entry.id !== entryId)
    );
  };

  // Every entry currently represented by a sidebar panel (expanded or
  // minimized) - see the panel-stack comment above for why this covers
  // both, and why it's derived rather than separately tracked.
  const openedEntryIds = useMemo(
    () => selectedEntries.map(selected => selected.entry.id),
    [selectedEntries]
  );

  const hasSelection = selectedEntries.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Constellation</h1>
        {usingMockData && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Showing example data - add an entry to see your own
          </span>
        )}
      </div>
      <p className="text-gray-600">
        Drag to pan, scroll to zoom, and click a star to see the entry behind
        it.
      </p>

      <div className="flex h-[70vh] w-full gap-4">
        {/*
         * Left region: width 0 (and clipped) when nothing is selected,
         * fixed width once selectedEntries has content. See the layout
         * comment at the top of this file for why width is derived
         * directly from `selectedEntries` rather than a separate flag.
         */}
        <div
          // Same --bg-color token as StarMap's <svg> background (see
          // index.css :root), so the sidebar blends into the canvas
          // instead of reading as a separate white card.
          className={`flex-shrink-0 overflow-hidden rounded-lg bg-[var(--bg-color)] transition-[width] duration-200 ${
            hasSelection ? 'w-80' : 'w-0'
          }`}
        >
          <div className="flex h-full w-80 flex-col gap-3 overflow-y-auto p-3">
            {selectedEntries.map(({ entry, expanded }) => (
              <EntryPanel
                key={entry.id}
                entry={entry}
                expanded={expanded}
                onExpand={() => handleExpandPanel(entry.id)}
                onClose={() => handleClosePanel(entry.id)}
              />
            ))}
          </div>
        </div>

        {/*
         * Right region: fills whatever width the sidebar isn't using.
         * `min-w-0` lets this flex item actually shrink below its
         * content's intrinsic width when the sidebar opens - StarMap's
         * ResizeObserver picks up the resulting size change and resizes
         * its <svg> to match (see StarMap.tsx).
         */}
        <div className="h-full min-w-0 flex-1 overflow-hidden rounded-lg shadow">
          <StarMap
            entries={displayedEntries}
            onStarClick={handleStarClick}
            openedEntryIds={openedEntryIds}
          />
        </div>
      </div>
    </div>
  );
}
