/**
 * FocusedEntryView.tsx - Full-Sidebar Takeover For One Expanded Entry
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACES
 * ──────────────────────────────────────────────────────────────────────
 * Expanding an entry (clicking its star/point/arc, or a minimized row in
 * SidebarPanelStack.tsx) used to grow that entry's panel inline within the
 * stack, squeezed underneath the page title, category filters, and sort
 * toggle. Now the ENTIRE sidebar switches to this view instead: each page
 * (Constellation/Timeline/Spiral) renders this in place of its
 * VizPageHeader + FilterBar + SidebarPanelStack whenever
 * `expandedEntryId` is set. There's no separate "focused mode" flag -
 * see EntrySelectionContext.tsx's FOCUSED MODE comment for why an
 * expanded entry IS focused mode.
 *
 * Layout, top to bottom:
 *   - A controls row: Back (exits focused mode and clears the history
 *     stack), Undo (steps back to the previously focused entry), then
 *     Edit/Close for this entry on the right.
 *   - This entry's own title as the heading, and the same "category ·
 *     date · location" subtitle line the old expanded panel showed.
 *   - An Original / Reflections toggle, styled like FilterBar's By Date /
 *     By Category sort toggle.
 *   - The scrollable body: EntryContent.tsx's EntryOriginalContent or
 *     EntryReflections, depending on the toggle.
 *
 * Renders a Fragment of two siblings (fixed header, then a `flex-1
 * overflow-y-auto` body) so it slots into each page's unified
 * `.bullet-journal-surface` flex container exactly the way that page's
 * own header block + scroll region do. `headerRef` lets the page keep
 * measuring its `topOffset` off whichever header block is currently
 * mounted - see Constellation.tsx's `headerContentRef`.
 *
 * TOGGLE STATE: `view` is local state that defaults to 'original'. The
 * page unmounts this component whenever focused mode ends, so every fresh
 * entry into focused mode starts on Original; switching between entries
 * via a bookmark or Undo keeps whichever tab is open (handy for reading
 * reflections across several entries in a row). The body scroll region
 * and the reflections tab ARE keyed on the entry id, though, so switching
 * entries resets scroll position and discards a half-written reflection
 * form rather than carrying it over onto a different entry.
 *
 * BOOKMARK RAIL: the tabs for the other selected entries are NOT part of
 * this component - they poke out past the sidebar's right edge, which
 * content inside the (`overflow: hidden`) sidebar container can't do, so
 * each page renders BookmarkRail.tsx as the container's sibling instead.
 * See that file.
 */

import { Ref, useState } from 'react';
import { Entry } from '../types/Entry';
import { SelectedEntry } from '../hooks/useEntrySelection';
import { getActivityColor } from '../utils/colors';
import { getCategoryName } from '../utils/categories';
import { formatEntryDate } from '../utils/formatEntryDate';
import { formatLocationDisplay } from '../utils/formatLocation';
import { EntryOriginalContent, EntryReflections } from './EntryContent';
import IconButton from './IconButton';

type FocusedView = 'original' | 'reflections';

interface FocusedEntryViewProps {
  /** The full selection - the focused entry is looked up from it. */
  selectedEntries: SelectedEntry[];
  /** `expandedEntryId` - the entry this view is focused on. */
  focusedEntryId: string;
  /** Attached to the header block, for the page's `topOffset` measurement. */
  headerRef: Ref<HTMLDivElement>;
  canUndo: boolean;
  onBack: () => void;
  onUndo: () => void;
  /** Opens this entry in the shared AddEntryForm's edit mode - see App.tsx's `editingEntry`. */
  onEdit: (entry: Entry) => void;
  /** Removes this entry from the selection (which also exits focused mode). */
  onClose: (entryId: string) => void;
  /** App.tsx's `updateEntry` - used to save reflections. */
  onUpdateEntry: (entry: Entry) => void;
}

export default function FocusedEntryView({
  selectedEntries,
  focusedEntryId,
  headerRef,
  canUndo,
  onBack,
  onUndo,
  onEdit,
  onClose,
  onUpdateEntry,
}: FocusedEntryViewProps) {
  const [view, setView] = useState<FocusedView>('original');

  const entry = selectedEntries.find(
    selected => selected.entry.id === focusedEntryId
  )?.entry;

  if (!entry) return null;

  // Same "category · date · location" subtitle the old expanded panel
  // header showed - location appended only when present.
  const formattedLocation = formatLocationDisplay(entry.location);

  return (
    <>
      <div ref={headerRef} className="flex-shrink-0 space-y-4 p-4">
        <div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 flex items-center gap-1 rounded-full py-1 pl-1.5 pr-2.5 text-sm font-medium text-[var(--text-muted-color)] hover:bg-[var(--field-tint-2)] hover:text-[var(--text-color)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
            <IconButton
              onClick={onUndo}
              label="Undo (previous entry)"
              disabled={!canUndo}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                />
              </svg>
            </IconButton>

            <div className="ml-auto flex items-center gap-0.5">
              <IconButton
                onClick={() => onEdit(entry)}
                label={`Edit ${entry.title}`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                  />
                </svg>
              </IconButton>
              <IconButton
                onClick={() => onClose(entry.id)}
                label={`Close ${entry.title}`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </IconButton>
            </div>
          </div>

          {/*
           * Same size/color/text-shadow as VizPageHeader's page title,
           * since this heading takes that title's place. `break-words`
           * so a long (or space-less) title wraps instead of overflowing
           * the sidebar.
           */}
          <h1
            className="mt-2 break-words text-2xl font-bold text-[var(--text-color)]"
            style={{ textShadow: 'var(--viz-header-text-shadow)' }}
          >
            {entry.title}
          </h1>
          <p
            className="mt-1 text-sm text-[var(--text-secondary-color)]"
            style={{ textShadow: 'var(--viz-header-text-shadow)' }}
          >
            {getCategoryName(entry.activityType)} &middot;{' '}
            {formatEntryDate(entry)}
            {formattedLocation && <> &middot; {formattedLocation}</>}
          </p>
        </div>

        {/* Same track/pill styling as FilterBar's sort-mode toggle. */}
        <div className="flex gap-1 rounded-lg bg-[var(--panel-bg-color-solid)] p-1">
          {(['original', 'reflections'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                view === mode
                  ? 'bg-[var(--accent-color)] text-[var(--accent-foreground-color)]'
                  : 'text-[var(--text-muted-color)] hover:text-[var(--text-color)]'
              }`}
            >
              {mode === 'original' ? 'Original' : 'Reflections'}
            </button>
          ))}
        </div>
      </div>

      {/*
       * Keyed on the entry id - see the TOGGLE STATE comment at the top of
       * this file. The inner card keeps the old expanded panel's opaque
       * surface and category-colored left accent bar, so the content stays
       * legible over the canvas and still carries the category color.
       */}
      <div
        key={entry.id}
        className="dark-scrollbar flex-1 overflow-y-auto px-4 pb-4"
      >
        <div
          className="rounded-lg border bg-[var(--panel-bg-color-solid)] px-4 py-3 shadow-sm"
          style={{
            borderColor: 'var(--panel-border-color)',
            borderLeftColor: getActivityColor(entry.activityType),
            borderLeftWidth: 4,
          }}
        >
          {view === 'original' ? (
            <EntryOriginalContent entry={entry} />
          ) : (
            <EntryReflections entry={entry} onUpdate={onUpdateEntry} />
          )}
        </div>
      </div>
    </>
  );
}
