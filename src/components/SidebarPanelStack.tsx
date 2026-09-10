/**
 * SidebarPanelStack.tsx - Floating Overlay Sidebar Of Open Entry Panels
 *
 * Renders the stack of <EntryPanel> cards for whatever `selectedEntries`
 * useEntrySelection.ts currently holds - factored out of Constellation.tsx
 * (its original, only caller) so Timeline.tsx (and eventually Spiral.tsx)
 * can reuse the exact same sidebar instead of re-implementing it. See
 * useEntrySelection.ts for the state this renders and Constellation.tsx's
 * top-of-file "FULL-BLEED CANVAS + FLOATING OVERLAY SIDEBAR" comment for
 * why this is a separate, absolutely-positioned overlay rather than a
 * layout sibling of a page's canvas.
 *
 * `top`/`left` are the calling page's own measured `headerLayout` (see
 * Constellation.tsx) - passed in rather than measured here, since the
 * header text/FilterBar this needs to sit below is owned by the page, not
 * this component. `ref` is forwarded to the actual scrollable container
 * DOM node so a page can measure ITS rendered width the same way
 * Constellation.tsx measures `sidebarWidth` for StarMap's click-to-center
 * math.
 */

import { forwardRef } from 'react';
import EntryPanel from './EntryPanel';
import { SortMode } from './FilterBar';
import { CategoryGroup, SelectedEntry } from '../hooks/useEntrySelection';

interface SidebarPanelStackProps {
  selectedEntries: SelectedEntry[];
  sortMode: SortMode;
  categoryGroups: CategoryGroup[];
  onExpand: (entryId: string) => void;
  onClose: (entryId: string) => void;
  /** The calling page's measured header bottom edge - see the header comment above. */
  top: number;
  /** The calling page's measured header left edge - see the header comment above. */
  left: number;
}

const SidebarPanelStack = forwardRef<HTMLDivElement, SidebarPanelStackProps>(
  function SidebarPanelStack(
    { selectedEntries, sortMode, categoryGroups, onExpand, onClose, top, left },
    ref
  ) {
    return (
      <div
        ref={ref}
        // z-30: above a canvas (z-0) and the header stack (z-10), below
        // the AddEntryForm modal (z-50).
        //
        // top/paddingLeft: positions this to start just below the header
        // stack and share its left edge, instead of overlapping or
        // misaligning with it - see the header comment above.
        //
        // w-[33vw]: a FIXED width - one third of the viewport - the SAME
        // width FilterBar's own root uses, so the category filter row,
        // sort toggle, and this panel stack all stay a consistent width
        // with each other across every page that renders them.
        //
        // bg-transparent, no shadow/border: this outer stack container has
        // no surface styling of its own - only the individual panel cards
        // inside it (EntryPanel.tsx) carry a surface, so a canvas shows
        // through the gaps between/around panels instead of behind a
        // solid sidebar-shaped box.
        //
        // dark-scrollbar (see index.css): overrides just this container's
        // scrollbar TRACK to transparent - the browser default white
        // track clashes with the dark theme - while keeping a visible
        // THUMB. A generically-named class (not sidebar-specific despite
        // this being its original use), scoped to opt-in containers only
        // - AddEntryForm.tsx's own scrollable form content reuses this
        // exact same class for the same reason, rather than a second copy
        // of this rule.
        className="dark-scrollbar fixed bottom-0 left-0 z-30 flex w-[33vw] flex-col gap-3 overflow-y-auto bg-transparent pb-3 pt-3"
        style={{ top, paddingLeft: left }}
      >
        {sortMode === 'date' ? (
          <>
            {/* Makes the (already-default) ordering explicit rather than silent. */}
            <div className="flex flex-shrink-0 items-center gap-1.5 px-1 text-xs text-gray-500">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Sorted by date (newest first)</span>
            </div>

            {selectedEntries.map(({ entry, expanded }) => (
              <EntryPanel
                key={entry.id}
                entry={entry}
                expanded={expanded}
                onExpand={() => onExpand(entry.id)}
                onClose={() => onClose(entry.id)}
              />
            ))}
          </>
        ) : (
          categoryGroups.map(({ category, entries: groupEntries }) => (
            <div key={category.id} className="flex flex-col gap-3">
              <div
                className="flex-shrink-0 rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-900"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </div>
              {groupEntries.map(({ entry, expanded }) => (
                <EntryPanel
                  key={entry.id}
                  entry={entry}
                  expanded={expanded}
                  onExpand={() => onExpand(entry.id)}
                  onClose={() => onClose(entry.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    );
  }
);

export default SidebarPanelStack;
