/**
 * entriesStorage.ts - localStorage-Backed Entries List
 *
 * Mirrors utils/categories.ts's read/write-the-whole-list pattern, applied
 * to entries instead of categories: App.tsx initializes its `entries`
 * state from loadEntries() and persists back via saveEntries() on every
 * change (previously entries lived in memory only and were lost on
 * refresh). Extracted into its own file rather than inlined in App.tsx so
 * utils/seedRealData.ts's one-time seed script can read/write the exact
 * same storage through the same helpers, instead of duplicating the key
 * name and parsing logic.
 */

import { Entry } from '../types/Entry';

/** localStorage key the entries array is persisted under. */
export const ENTRIES_STORAGE_KEY = 'dabble-entries';

/**
 * Loads the entries array from localStorage. Falls back to an empty array
 * when nothing has been saved yet (first run) or the stored value can't be
 * parsed, so callers always get a usable array back.
 */
export function loadEntries(): Entry[] {
  const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as Entry[];
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
