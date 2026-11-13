/**
 * RelatedEntries.tsx - The Focused Entry's "Related" Section
 *
 * Rendered at the end of EntryOriginalContent (see EntryContent.tsx).
 * Lists the entry's authored links first (with their notes - both
 * directions, see utils/entryRelations.ts), then the inferred groups
 * ("Shared tag: handstand", "Same place: Boogaloo", "Shared mood: ...").
 *
 * - Clicking a row focuses that entry through the same `handleEntryClick`
 *   a canvas click uses, so the selection stack, focus history (Undo), and
 *   time-window reveal all behave exactly as if it had been clicked there.
 * - Hovering (or keyboard-focusing) a row previews just that link's
 *   highlight on the canvas - see hooks/useRelationHighlight.ts.
 * - Long lists start collapsed to the first COLLAPSED_ROW_LIMIT rows;
 *   each inferred group is also capped (RELATED_GROUP_CAP).
 */

import { useEffect, useMemo, useState } from 'react';
import { Entry } from '../types/Entry';
import { useEntrySelectionContext } from '../context/EntrySelectionContext';
import { getEntryRelations } from '../utils/entryRelations';
import { getActivityColor } from '../utils/colors';
import { formatEntryDate } from '../utils/formatEntryDate';

/** Rows shown before "Show all" when the list is long. */
const COLLAPSED_ROW_LIMIT = 6;

interface RelatedEntriesProps {
  entry: Entry;
  /** Every entry - relations are found across all of them, not just the visible time window. */
  allEntries: Entry[];
  /** Focuses an entry - EntrySelectionContext's `handleEntryClick`. */
  onFocusEntry: (entry: Entry) => void;
  labelClassName: string;
}

interface Section {
  key: string;
  label: string;
  rows: { entry: Entry; note?: string }[];
  /** Matches beyond the group cap, shown as "+N more". */
  hidden: number;
}

export default function RelatedEntries({
  entry,
  allEntries,
  onFocusEntry,
  labelClassName,
}: RelatedEntriesProps) {
  const { setRelationPreviewEntryId } = useEntrySelectionContext();
  const [expanded, setExpanded] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const { authored, inferred } = getEntryRelations(entry, allEntries);
    return [
      ...(authored.length > 0
        ? [
            {
              key: 'linked',
              label: 'Linked',
              rows: authored.map(relation => ({
                entry: relation.entry,
                note: relation.note,
              })),
              hidden: 0,
            },
          ]
        : []),
      ...inferred.map(group => ({
        key: `${group.kind}:${group.value}`,
        label: group.label,
        rows: group.entries.map(other => ({ entry: other })),
        hidden: group.total - group.entries.length,
      })),
    ];
  }, [entry, allEntries]);

  // Never leave a preview behind once this list is gone.
  useEffect(
    () => () => setRelationPreviewEntryId(null),
    [setRelationPreviewEntryId]
  );

  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  if (totalRows === 0) return null;

  const isCollapsible = totalRows > COLLAPSED_ROW_LIMIT;
  let budget = isCollapsible && !expanded ? COLLAPSED_ROW_LIMIT : Infinity;
  const visibleSections = sections.flatMap(section => {
    if (budget <= 0) return [];
    const rows = section.rows.slice(0, budget);
    budget -= rows.length;
    return [{ ...section, rows, truncated: rows.length < section.rows.length }];
  });

  return (
    <div>
      <p className={labelClassName}>🧵 Related</p>
      <div className="mt-1.5 space-y-2.5">
        {visibleSections.map(section => (
          <div key={section.key}>
            <p className="text-[11px] font-medium text-[var(--text-muted-color)]">
              {section.label}
            </p>
            <ul className="mt-1 space-y-0.5">
              {section.rows.map(({ entry: other, note }) => (
                <li key={other.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRelationPreviewEntryId(null);
                      onFocusEntry(other);
                    }}
                    onMouseEnter={() => setRelationPreviewEntryId(other.id)}
                    onMouseLeave={() => setRelationPreviewEntryId(null)}
                    onFocus={() => setRelationPreviewEntryId(other.id)}
                    onBlur={() => setRelationPreviewEntryId(null)}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left hover:bg-[var(--field-tint-2)] focus-visible:bg-[var(--field-tint-2)] focus-visible:outline-none"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: getActivityColor(other.activityType),
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-color)]">
                          {other.title}
                        </span>
                        <span className="flex-shrink-0 text-xs text-[var(--text-muted-color)]">
                          {formatEntryDate(other)}
                        </span>
                      </span>
                      {note && (
                        <span className="block text-xs italic text-[var(--text-secondary-color)]">
                          {note}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!section.truncated && section.hidden > 0 && (
              <p className="mt-0.5 px-2 text-xs text-[var(--text-muted-color)]">
                +{section.hidden} more
              </p>
            )}
          </div>
        ))}
      </div>
      {isCollapsible && (
        <button
          type="button"
          onClick={() => setExpanded(current => !current)}
          aria-expanded={expanded}
          className="mt-1.5 px-2 text-xs font-medium text-[var(--text-muted-color)] hover:text-[var(--text-color)] hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all (${totalRows})`}
        </button>
      )}
    </div>
  );
}
