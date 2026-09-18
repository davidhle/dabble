/**
 * SidebarPanelStack.tsx - Stack Of Open Entry Panels
 *
 * Renders the stack of <EntryPanel> cards for whatever `selectedEntries`
 * useEntrySelection.ts currently holds - factored out of Constellation.tsx
 * (its original, only caller) so Timeline.tsx and Spiral.tsx can reuse the
 * exact same sidebar instead of re-implementing it. See
 * useEntrySelection.ts for the state this renders.
 *
 * NO POSITIONING/SURFACE OF ITS OWN: this used to be its own `fixed`,
 * absolutely-positioned overlay with its own width/top/left/background -
 * see Constellation.tsx's top-of-file layout comment for why that's no
 * longer the case. Every calling page now renders this INSIDE its own
 * unified `.bullet-journal-surface` container (alongside VizPageHeader/
 * FilterBar), which already owns the width/position/scroll-region/
 * background this component used to provide for itself - so this is now
 * just the panel LIST content, sized and scrolled by whatever wraps it.
 */

import EntryPanel from './EntryPanel';
import { SortMode } from './FilterBar';
import { Entry } from '../types/Entry';
import { CategoryGroup, SelectedEntry } from '../hooks/useEntrySelection';

interface SidebarPanelStackProps {
  selectedEntries: SelectedEntry[];
  sortMode: SortMode;
  categoryGroups: CategoryGroup[];
  onExpand: (entryId: string) => void;
  /** Wired to useEntrySelection's `handleMinimizePanel` - see EntryPanel.tsx. */
  onMinimize: (entryId: string) => void;
  onClose: (entryId: string) => void;
  /**
   * Opens `entry` in the shared AddEntryForm's edit mode - takes the full
   * Entry (not just an id) since that's what App.tsx's `editingEntry`
   * state needs, and this is the one place already holding each panel's
   * full entry object.
   */
  onEdit: (entry: Entry) => void;
}

export default function SidebarPanelStack({
  selectedEntries,
  sortMode,
  categoryGroups,
  onExpand,
  onMinimize,
  onClose,
  onEdit,
}: SidebarPanelStackProps) {
  return (
    <div className="flex flex-col gap-3">
      {sortMode === 'date' ? (
        <>
          {/* Makes the (already-default) ordering explicit rather than silent. */}
          <div className="flex flex-shrink-0 items-center gap-1.5 px-1 text-xs text-[var(--text-muted-color)]">
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
              onMinimize={() => onMinimize(entry.id)}
              onClose={() => onClose(entry.id)}
              onEdit={() => onEdit(entry)}
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
                onMinimize={() => onMinimize(entry.id)}
                onClose={() => onClose(entry.id)}
                onEdit={() => onEdit(entry)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
