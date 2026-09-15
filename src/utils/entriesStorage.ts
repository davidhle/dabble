/**
 * entriesStorage.ts - localStorage-Backed Entries List
 *
 * Mirrors utils/categories.ts's read/write-the-whole-list pattern, applied
 * to entries instead of categories: App.tsx initializes its `entries`
 * state from loadEntries() and persists back via saveEntries() on every
 * change (previously entries lived in memory only and were lost on
 * refresh). Extracted into its own file rather than inlined in App.tsx so
 * other code that needs to read/write the exact same storage - the
 * first-visit bootstrap (utils/initializeFirstVisit.ts) and the "Start
 * Your Own Constellation" reset (pages/About.tsx) - can go through the
 * same helpers instead of duplicating the key name and parsing logic.
 */

import { Entry } from '../types/Entry';

/** localStorage key the entries array is persisted under. */
export const ENTRIES_STORAGE_KEY = 'dabble-entries';

/**
 * MOOD MIGRATION: fixes entries already persisted with the
 * defaultEntries.ts double-wrap bug, where `mood: [raw.mood]` wrapped an
 * already-array mood value in another array (e.g.
 * `[["Excited", "Curious", "Frustrated"]]` instead of
 * `["Excited", "Curious", "Frustrated"]`). EntryPanel.tsx's
 * `entry.mood.map(...)` would then iterate once over the outer array and
 * render the inner array as a single chip, which React renders as its
 * elements concatenated with no separator (e.g. "ExcitedCuriousFrustrated").
 *
 * `.flat(Infinity)` is a safe no-op on an already-flat mood array (same
 * elements, same length), so this only changes entries actually affected
 * by the bug - `changed` reports whether it did, so loadEntries can decide
 * whether a re-save is needed.
 */
function normalizeEntryMood(entry: Entry): { entry: Entry; changed: boolean } {
  if (!Array.isArray(entry.mood)) return { entry, changed: false };

  const flattened = (entry.mood as unknown[]).flat(Infinity) as string[];
  if (JSON.stringify(flattened) === JSON.stringify(entry.mood)) {
    return { entry, changed: false };
  }

  return { entry: { ...entry, mood: flattened }, changed: true };
}

/**
 * Loads the entries array from localStorage. Falls back to an empty array
 * when nothing has been saved yet (first run) or the stored value can't be
 * parsed, so callers always get a usable array back.
 *
 * Also runs normalizeEntryMood over every entry (see its comment) and, if
 * any entry's mood was actually fixed up, persists the corrected array back
 * via saveEntries so the one-time migration doesn't have to re-run - and so
 * anything else reading dabble-entries directly (e.g. Export Data) sees the
 * fix too - on every subsequent load.
 */
export function loadEntries(): Entry[] {
  const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = (parsed as Entry[]).map(normalizeEntryMood);
      const entries = normalized.map(result => result.entry);
      if (normalized.some(result => result.changed)) {
        saveEntries(entries);
      }
      return entries;
    }
  } catch {
    // Corrupt or unexpected data - fall through to the empty array below.
  }

  return [];
}

/** Persists the given entries array to localStorage. */
export function saveEntries(entries: Entry[]): void {
  localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
}

/**
 * DELETED-ENTRY TOMBSTONES
 *
 * A separate, append-only list of entry ids the user has explicitly
 * deleted (see AddEntryForm's DELETE ENTRY flow) - persisted independently
 * of `entries` itself, and consulted by
 * utils/initializeFirstVisit.ts's backfillNewBundledDefaults.
 *
 * WHY THIS EXISTS: that backfill function re-adds any bundled
 * DEFAULT_ENTRIES entry whose id is missing from stored `entries`, on the
 * theory that "missing" only ever means "added to the bundle after this
 * visitor's last load" (see its own comment - written before an
 * individual-entry-delete feature existed, which it explicitly assumed
 * away: "no 'the visitor deliberately removed this bundled entry' case to
 * accidentally undo here"). Now that AddEntryForm can delete any entry,
 * including one of the bundled ones, that assumption no longer holds: a
 * bundled entry's id would go missing from `entries` for a second reason -
 * the visitor deleted it - which is indistinguishable from "not yet
 * backfilled" without this list. Recording the id here lets that backfill
 * tell the two apart and skip re-adding an id the visitor deleted on
 * purpose, without weakening the "add anything new to the bundle" behavior
 * it exists for. A purely user-created entry's id was never in
 * DEFAULT_ENTRIES to begin with, so deleting one never needs this list at
 * all - it's only ever consulted against bundled ids.
 */
const DELETED_ENTRY_IDS_STORAGE_KEY = 'dabble-deleted-entry-ids';

/** Loads the tombstone list of deleted entry ids, or [] if none recorded/parseable. */
export function loadDeletedEntryIds(): string[] {
  const raw = localStorage.getItem(DELETED_ENTRY_IDS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as string[];
    }
  } catch {
    // Corrupt or unexpected data - fall through to the empty array below.
  }

  return [];
}

/** Appends `entryId` to the tombstone list (a no-op if already recorded). */
export function recordDeletedEntryId(entryId: string): void {
  const existing = loadDeletedEntryIds();
  if (existing.includes(entryId)) return;
  localStorage.setItem(
    DELETED_ENTRY_IDS_STORAGE_KEY,
    JSON.stringify([...existing, entryId])
  );
}
