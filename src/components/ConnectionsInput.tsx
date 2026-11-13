/**
 * ConnectionsInput.tsx - AddEntryForm's "Connections" Field
 *
 * Authored links from this entry to others (see Entry.connections and
 * utils/entryRelations.ts): a searchable picker to add one, and a short
 * "why are these linked?" note per link. The `connections` array is
 * controlled by AddEntryForm; only the search text lives here.
 *
 * Links are stored on one side but displayed on both, so links OTHER
 * entries already made to this one are listed read-only ("Linked from")
 * and left out of the picker - linking back would just duplicate them.
 */

import { useMemo, useState } from 'react';
import { Entry, EntryConnection } from '../types/Entry';
import { getActivityColor } from '../utils/colors';
import { formatEntryDate } from '../utils/formatEntryDate';

/** Most picker results shown at once. */
const MAX_RESULTS = 6;

interface ConnectionsInputProps {
  /** The entry being edited, or null when adding a new one. */
  entryId: string | null;
  /** Every entry - the picker searches them by title. */
  entries: Entry[];
  connections: EntryConnection[];
  onChange: (connections: EntryConnection[]) => void;
}

const FIELD_CLASSNAME =
  'block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]';

function EntryLabel({ entry }: { entry: Entry }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: getActivityColor(entry.activityType) }}
      />
      <span className="min-w-0 truncate text-sm text-[var(--text-color)]">
        {entry.title}
      </span>
      <span className="flex-shrink-0 text-xs text-[var(--text-muted-color)]">
        {formatEntryDate(entry)}
      </span>
    </span>
  );
}

export default function ConnectionsInput({
  entryId,
  entries,
  connections,
  onChange,
}: ConnectionsInputProps) {
  const [query, setQuery] = useState('');

  const entriesById = useMemo(
    () => new Map(entries.map(entry => [entry.id, entry])),
    [entries]
  );

  const incoming = useMemo(
    () =>
      entryId
        ? entries.flatMap(entry => {
            const connection = entry.connections?.find(
              c => c.entryId === entryId
            );
            return connection && entry.id !== entryId
              ? [{ entry, note: connection.note }]
              : [];
          })
        : [],
    [entries, entryId]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const excluded = new Set([
      ...(entryId ? [entryId] : []),
      ...connections.map(c => c.entryId),
      ...incoming.map(link => link.entry.id),
    ]);
    return entries
      .filter(
        entry =>
          !excluded.has(entry.id) && entry.title.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [query, entries, entryId, connections, incoming]);

  const addConnection = (target: Entry) => {
    onChange([
      ...connections,
      { id: crypto.randomUUID(), entryId: target.id, note: '' },
    ]);
    setQuery('');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary-color)]">
        Connections
      </label>
      <p className="mt-0.5 text-xs text-[var(--text-muted-color)]">
        Link this to another entry, with a note on why.
      </p>

      {connections.length > 0 && (
        <ul className="mt-2 space-y-2">
          {connections.map(connection => {
            const target = entriesById.get(connection.entryId);
            if (!target) return null;
            return (
              <li
                key={connection.id}
                className="rounded-md bg-[var(--field-tint-1)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <EntryLabel entry={target} />
                  <button
                    type="button"
                    onClick={() =>
                      onChange(connections.filter(c => c.id !== connection.id))
                    }
                    aria-label={`Remove connection to ${target.title}`}
                    className="ml-1 flex-shrink-0 text-red-400 hover:text-red-300"
                  >
                    &times;
                  </button>
                </div>
                <input
                  type="text"
                  value={connection.note}
                  onChange={e =>
                    onChange(
                      connections.map(c =>
                        c.id === connection.id
                          ? { ...c, note: e.target.value }
                          : c
                      )
                    )
                  }
                  placeholder="Why are these linked?"
                  aria-label={`Note for the connection to ${target.title}`}
                  className={`mt-1.5 text-sm ${FIELD_CLASSNAME}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {incoming.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-[var(--text-muted-color)]">Linked from:</p>
          <ul className="mt-1 space-y-1">
            {incoming.map(({ entry, note }) => (
              <li key={entry.id} className="px-1">
                <EntryLabel entry={entry} />
                {note && (
                  <p className="pl-4 text-xs italic text-[var(--text-secondary-color)]">
                    {note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          // Enter picks the top result rather than submitting anything.
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results[0]) addConnection(results[0]);
          }
        }}
        placeholder="Connect to another entry..."
        aria-label="Search entries to connect to"
        className={`mt-2 ${FIELD_CLASSNAME}`}
      />
      {query.trim() && (
        <ul className="mt-1 space-y-0.5 rounded-md border border-[var(--panel-border-color)] p-1">
          {results.length > 0 ? (
            results.map(entry => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => addConnection(entry)}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left hover:bg-[var(--field-tint-2)] focus-visible:bg-[var(--field-tint-2)] focus-visible:outline-none"
                >
                  <EntryLabel entry={entry} />
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-sm text-[var(--text-muted-color)]">
              No matching entries.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
