/**
 * entryRelations.ts - Connections Between Entries
 *
 * Two kinds of link, both shown in the sidebar's "Related" section (see
 * RelatedEntries.tsx) and on the canvases while an entry is focused:
 *
 *   - AUTHORED: an Entry's own `connections` (see EntryConnection in
 *     types/Entry.ts), written in the edit form with a note. Stored on one
 *     side only but SYMMETRIC in display: if A links to B, B's panel lists
 *     A too, with the same note.
 *   - INFERRED: computed, never stored - other entries sharing at least
 *     one tag, the same place, or a mood, grouped by what's shared.
 *
 * An entry linked by hand isn't repeated in the inferred groups. Each
 * inferred group is capped (closest in time first), so one very common
 * tag or mood can't flood the list.
 */

import { Entry, EntryLocation } from '../types/Entry';

/** Most entries listed per inferred group. */
export const RELATED_GROUP_CAP = 8;

export interface AuthoredRelation {
  entry: Entry;
  note: string;
  /** Whether the link is stored on the OTHER entry (it links to this one). */
  incoming: boolean;
}

export type InferredKind = 'tag' | 'place' | 'mood';

export interface InferredGroup {
  kind: InferredKind;
  /** The shared value, as displayed ("handstand", "Boogaloo"). */
  value: string;
  /** "Shared tag: handstand" etc. */
  label: string;
  entries: Entry[];
  /** How many matched before RELATED_GROUP_CAP trimmed the list. */
  total: number;
}

export interface EntryRelations {
  authored: AuthoredRelation[];
  inferred: InferredGroup[];
}

const KIND_LABELS: Record<InferredKind, string> = {
  tag: 'Shared tag',
  place: 'Same place',
  mood: 'Shared mood',
};

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * An entry's place, for "Same place" matching: the structured `place`
 * field, or a legacy free-text location string (see Entry.location) as a
 * whole. City/country alone are too broad to count as the same place.
 */
function getPlace(entry: Entry): string | undefined {
  const location = entry.location;
  if (!location) return undefined;
  const place =
    typeof location === 'string' ? location : (location as EntryLocation).place;
  return place?.trim() || undefined;
}

/** Every link involving `entry`, in both directions, one per other entry. */
export function getAuthoredRelations(
  entry: Entry,
  entries: Entry[]
): AuthoredRelation[] {
  const byId = new Map(entries.map(other => [other.id, other]));
  const relations = new Map<string, AuthoredRelation>();

  for (const connection of entry.connections ?? []) {
    const other = byId.get(connection.entryId);
    if (!other || other.id === entry.id || relations.has(other.id)) continue;
    relations.set(other.id, {
      entry: other,
      note: connection.note,
      incoming: false,
    });
  }

  for (const other of entries) {
    if (other.id === entry.id || relations.has(other.id)) continue;
    const connection = other.connections?.find(c => c.entryId === entry.id);
    if (connection) {
      relations.set(other.id, {
        entry: other,
        note: connection.note,
        incoming: true,
      });
    }
  }

  return [...relations.values()];
}

/** Authored links first, then inferred groups (tags, place, moods). */
export function getEntryRelations(
  entry: Entry,
  entries: Entry[]
): EntryRelations {
  const authored = getAuthoredRelations(entry, entries);
  const excluded = new Set([entry.id, ...authored.map(r => r.entry.id)]);
  const candidates = entries.filter(other => !excluded.has(other.id));
  const time = new Date(entry.timestamp).getTime();
  const byCloseness = (a: Entry, b: Entry) =>
    Math.abs(new Date(a.timestamp).getTime() - time) -
    Math.abs(new Date(b.timestamp).getTime() - time);

  const groupsFor = (
    kind: InferredKind,
    values: string[],
    valuesOf: (other: Entry) => string[]
  ): InferredGroup[] =>
    values.flatMap(value => {
      const key = normalize(value);
      const matches = candidates
        .filter(other => valuesOf(other).some(v => normalize(v) === key))
        .sort(byCloseness);
      if (matches.length === 0) return [];
      return [
        {
          kind,
          value,
          label: `${KIND_LABELS[kind]}: ${value}`,
          entries: matches.slice(0, RELATED_GROUP_CAP),
          total: matches.length,
        },
      ];
    });

  const place = getPlace(entry);
  const inferred = [
    ...groupsFor('tag', entry.tags, other => other.tags),
    ...groupsFor('place', place ? [place] : [], other => {
      const otherPlace = getPlace(other);
      return otherPlace ? [otherPlace] : [];
    }),
    ...groupsFor('mood', entry.mood ?? [], other => other.mood ?? []),
  ];

  return { authored, inferred };
}

/**
 * Ids related to `entry`, split by kind - what the canvases highlight
 * while it's focused. An id in `authored` is never also in `inferred`.
 */
export function getRelatedEntryIds(
  entry: Entry,
  entries: Entry[]
): { authored: Set<string>; inferred: Set<string> } {
  const { authored, inferred } = getEntryRelations(entry, entries);
  return {
    authored: new Set(authored.map(r => r.entry.id)),
    inferred: new Set(
      inferred.flatMap(group => group.entries.map(other => other.id))
    ),
  };
}

/** Every distinct tag used by any entry, sorted - for the form's tag autocomplete. */
export function getAllTags(entries: Entry[]): string[] {
  return [
    ...new Set(entries.flatMap(entry => entry.tags.map(normalize))),
  ].sort();
}

/** `entries` minus any connections pointing at `deletedId` - see App.tsx's deleteEntry. */
export function removeConnectionsTo(
  entries: Entry[],
  deletedId: string
): Entry[] {
  return entries.map(entry =>
    entry.connections?.some(c => c.entryId === deletedId)
      ? {
          ...entry,
          connections: entry.connections.filter(c => c.entryId !== deletedId),
        }
      : entry
  );
}
