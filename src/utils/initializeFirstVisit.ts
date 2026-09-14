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
 *   - EVERY VISIT AFTER THAT: localStorage is the source of truth for
 *     which ENTRIES exist and what they contain - loadEntries() (see
 *     entriesStorage.ts) just reads back whatever is actually stored,
 *     whether that's the untouched bundled default, the visitor's own
 *     added/edited entries and categories, or a completely empty array
 *     from an explicit "Start Your Own Constellation" reset (see the
 *     button in About.tsx) - this function can't tell those apart from
 *     each other, and deliberately doesn't try to. The one exception is
 *     `backfillBundledFields` below, a narrow, additive-only patch for
 *     entries that are STILL the bundled ones but predate a field this
 *     bundled dataset has since started tracking - see its own comment.
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
import { loadCategories, saveCategories } from './categories';
import {
  loadEntries,
  saveEntries,
  ENTRIES_STORAGE_KEY,
} from './entriesStorage';

export function initializeDefaultDataForFirstVisit(): void {
  const alreadyInitialized = localStorage.getItem(ENTRIES_STORAGE_KEY) !== null;
  if (!alreadyInitialized) {
    saveCategories(DEFAULT_CATEGORIES);
    saveEntries(DEFAULT_ENTRIES);
    return;
  }

  backfillNewBundledDefaults();
  backfillBundledFields();
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * BACKFILLING NEWLY-ADDED BUNDLED CATEGORIES/ENTRIES FOR RETURNING VISITORS
 * ──────────────────────────────────────────────────────────────────────
 * DEFAULT_CATEGORIES/DEFAULT_ENTRIES grow over time (e.g. a new bundled
 * category like 'ContemporaryDance' and its entries, added after
 * visitors had already been initialized with an earlier, smaller
 * version of this same bundled dataset). Without this, a returning
 * visitor's already-stored copy would never pick up anything added to
 * the bundle after their first visit, since "already initialized" (see
 * above) is permanent - loadCategories()/loadEntries() would just keep
 * reading the smaller stored lists forever, even though DEFAULT_ENTRIES
 * itself has moved on.
 *
 * This only ADDS bundled categories/entries whose `id` isn't already
 * present in storage - it never touches, reorders, or removes anything
 * already stored, so a visitor's own added/edited entries and categories
 * are completely unaffected. There is no individual-entry-delete feature
 * (only the full "Start Your Own Constellation" reset in Home.tsx, which
 * writes genuinely empty arrays rather than removing the storage keys -
 * see the comment up top), so there's no "the visitor deliberately
 * removed this bundled entry" case to accidentally undo here.
 */
function backfillNewBundledDefaults(): void {
  const storedCategories = loadCategories();
  const storedCategoryIds = new Set(storedCategories.map(category => category.id));
  const missingCategories = DEFAULT_CATEGORIES.filter(
    category => !storedCategoryIds.has(category.id)
  );
  if (missingCategories.length > 0) {
    saveCategories([...storedCategories, ...missingCategories]);
  }

  const storedEntries = loadEntries();
  const storedEntryIds = new Set(storedEntries.map(entry => entry.id));
  const missingEntries = DEFAULT_ENTRIES.filter(
    entry => !storedEntryIds.has(entry.id)
  );
  if (missingEntries.length > 0) {
    saveEntries([...storedEntries, ...missingEntries]);
  }
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * BACKFILLING A NEW BUNDLED FIELD FOR RETURNING VISITORS
 * ──────────────────────────────────────────────────────────────────────
 * `endTimestamp` (see its field comment in types/Entry.ts) was added to
 * some of DEFAULT_ENTRIES/seedEntries.json after visitors had already
 * been initialized with an earlier version of that same bundled dataset.
 * Without this, a returning visitor's already-stored copy of e.g. the
 * "First (online) tournament participation: WSC" entry would keep
 * missing `endTimestamp` forever - loadEntries() has no way to know a
 * bundled field it's never seen was added after the fact, so
 * LinearTimeline.tsx/SpiralTimeline.tsx would render it as a single
 * point instead of the Oct-Nov 2021 range it actually covers, even
 * though DEFAULT_ENTRIES (built from that same seedEntries.json) has
 * always had the right value.
 *
 * This patches ONLY that gap, as narrowly as possible, so it doesn't
 * undermine the "localStorage is the source of truth" rule above any
 * more than it has to:
 *   - Only entries whose `id` matches a DEFAULT_ENTRIES entry are
 *     touched at all - a visitor's own manually-added entries (no
 *     matching bundled id) are never inspected.
 *   - Only `endTimestamp` is backfilled, and only when the stored entry
 *     doesn't already have one - a visitor who added, edited, or
 *     intentionally left off an end date on a bundled entry keeps
 *     whatever they set; this never overwrites an existing value.
 * Runs on every load (cheap - a handful of entries, no network), but
 * only re-persists via saveEntries() when something actually changed.
 */
function backfillBundledFields(): void {
  const defaultsById = new Map(DEFAULT_ENTRIES.map(entry => [entry.id, entry]));

  let didBackfill = false;
  const entries = loadEntries().map(entry => {
    const bundled = defaultsById.get(entry.id);
    if (!bundled?.endTimestamp || entry.endTimestamp) return entry;

    didBackfill = true;
    return { ...entry, endTimestamp: bundled.endTimestamp };
  });

  if (didBackfill) {
    saveEntries(entries);
  }
}
