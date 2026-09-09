/**
 * initializeFirstVisit.ts - First-Visit Bundled Default Bootstrap
 *
 * ──────────────────────────────────────────────────────────────────────
 * FIRST-VISIT DEFAULT vs LOCALSTORAGE AS SOURCE OF TRUTH
 * ──────────────────────────────────────────────────────────────────────
 * This is the one piece of logic that decides between two very different
 * data sources, and it matters that it only ever fires ONCE per visitor:
 *
 *   - FIRST-EVER VISIT (no 'dabble-entries' key in localStorage at all):
 *     persist the bundled dataset (DEFAULT_CATEGORIES + DEFAULT_ENTRIES -
 *     my own real Shuffle Dance / House Dance / C-Walk history) into
 *     localStorage, so a first-time visitor sees a populated constellation
 *     instead of an empty one or old placeholder mock data.
 *   - EVERY VISIT AFTER THAT: localStorage is the source of truth, full
 *     stop. This function does nothing - loadEntries()/loadCategories()
 *     (see entriesStorage.ts/categories.ts) just read back whatever is
 *     actually stored, whether that's the untouched bundled default, the
 *     visitor's own added/edited entries and categories, or a completely
 *     empty array from an explicit "Start Your Own Constellation" reset
 *     (see the button in About.tsx) - this function can't tell those
 *     apart from each other, and deliberately doesn't try to.
 *
 * WHY THE ENTRIES KEY ALONE IS THE SIGNAL:
 * "Has this visitor already been initialized" is determined by checking
 * ONLY whether localStorage.getItem('dabble-entries') is null (the key
 * has literally never been written) vs. present (even as the string
 * '[]' - an explicit empty array, e.g. right after a reset). This is
 * exactly why the reset button in About.tsx must WRITE an empty array to
 * both keys rather than removing them - removing the entries key would
 * make this function think it's a first-ever visit again and silently
 * bring the bundled data back, defeating the entire point of "start your
 * own" (a visitor who explicitly reset wants a blank slate, not my data
 * again). Categories aren't checked separately - both are always
 * initialized together, atomically, off this one signal.
 *
 * WHEN THIS RUNS:
 * Called once from App.tsx's `entries` useState lazy initializer, so it
 * executes synchronously before the very first render - by the time
 * anything (including Constellation.tsx's own loadCategories() call) can
 * read localStorage, initialization has already either happened or been
 * skipped.
 */

import { DEFAULT_CATEGORIES } from '../types/Category';
import { DEFAULT_ENTRIES } from '../data/defaultEntries';
import { saveCategories } from './categories';
import { saveEntries, ENTRIES_STORAGE_KEY } from './entriesStorage';

export function initializeDefaultDataForFirstVisit(): void {
  const alreadyInitialized = localStorage.getItem(ENTRIES_STORAGE_KEY) !== null;
  if (alreadyInitialized) return;

  saveCategories(DEFAULT_CATEGORIES);
  saveEntries(DEFAULT_ENTRIES);
}
