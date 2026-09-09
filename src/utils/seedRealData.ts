/**
 * seedRealData.ts - One-Time MVP Data-Loading Shortcut
 *
 * NOT the general-purpose import feature. This is a stopgap to get a real
 * set of entries (src/data/seedEntries.json, exported from wherever the
 * data previously lived) into the app under a tight deadline, without
 * building a full JSON/CSV import UI first. It's meant to be run once (via
 * the "Load Real Data (dev only)" button on the About page - see
 * pages/About.tsx) and then deleted along with that button once the real
 * data has been loaded - see the removal note on that button.
 *
 * seedEntries.json's shape is close to Entry but not identical (e.g. its
 * mediaLinks use ad-hoc string `type`s like "youtube"/"instagram" rather
 * than the MediaType enum, and it has a `dateNeedsReview` field Entry
 * doesn't have), so this file's job is narrowly to adapt that one fixed
 * dataset - not to handle arbitrary/unknown input shapes the way a general
 * import feature would need to.
 */

import { Entry, MediaLink, MediaType } from '../types/Entry';
import { addCategory, loadCategories } from './categories';
import { loadEntries, saveEntries } from './entriesStorage';
import seedData from '../data/seedEntries.json';

/** The shape of one record in seedEntries.json. */
interface RawSeedEntry {
  id: string;
  activityType: string;
  title: string;
  description: string;
  notes: string;
  tags: string[];
  mediaLinks: { type: string; url: string; title?: string }[];
  location: string | null;
  duration: number | null;
  mood: string | null;
  timestamp: string;
  dateDisplay: string | null;
  dateNeedsReview: boolean;
}

/**
 * Maps seedEntries.json's ad-hoc mediaLink `type` strings onto the
 * MediaType enum Entry actually uses. Every link in this dataset is a
 * link out to an external site (YouTube, Instagram) rather than an
 * uploaded image/video/audio file, so MediaType.Link is always the right
 * target regardless of which platform it points to.
 */
function toMediaLink(raw: {
  type: string;
  url: string;
  title?: string;
}): MediaLink {
  return {
    type: MediaType.Link,
    url: raw.url,
    ...(raw.title ? { title: raw.title } : {}),
  };
}

/** Converts one raw seed record into a fully-formed Entry. */
function toEntry(raw: RawSeedEntry): Entry {
  return {
    id: raw.id,
    timestamp: raw.timestamp,
    activityType: raw.activityType,
    title: raw.title,
    description: raw.description,
    tags: raw.tags,
    mediaLinks: raw.mediaLinks.map(toMediaLink),
    notes: raw.notes,
    ...(raw.location ? { location: raw.location } : {}),
    ...(raw.duration != null ? { duration: raw.duration } : {}),
    ...(raw.mood ? { mood: [raw.mood] } : {}),
    ...(raw.dateDisplay ? { dateDisplay: raw.dateDisplay } : {}),
  };
}

/**
 * Makes sure every activityType referenced by the seed data has a matching
 * category, creating any missing ones via the categories utility (rather
 * than e.g. hand-writing a Category object here) so a fresh browser with
 * no localStorage state yet doesn't fail just because this seed script
 * happened to run before DEFAULT_CATEGORIES-adjacent setup did.
 *
 * addCategory generates its own id, so a created category is matched back
 * up to these activityType strings by name (getCategoryName/
 * getActivityColor already fall back to matching by name, not just id -
 * see utils/categories.ts and utils/colors.ts).
 */
function ensureCategoriesExist(entries: RawSeedEntry[]): void {
  const existing = loadCategories();
  const knownIds = new Set(existing.map(category => category.id));
  const knownNames = new Set(existing.map(category => category.name));

  const neededActivityTypes = new Set(entries.map(entry => entry.activityType));
  for (const activityType of neededActivityTypes) {
    if (knownIds.has(activityType) || knownNames.has(activityType)) continue;
    addCategory(activityType);
  }
}

export interface SeedResult {
  added: number;
  skipped: number;
  total: number;
}

/**
 * Loads seedEntries.json into localStorage's 'dabble-entries', merging
 * with (not replacing) whatever's already there and skipping any entry
 * whose id already exists. Also makes sure every category the seed data
 * references exists first (see ensureCategoriesExist above).
 *
 * Safe to click more than once: since it skips duplicate ids, re-running
 * it after it already succeeded just re-adds nothing.
 */
export function seedRealEntries(): SeedResult {
  const rawEntries = seedData as RawSeedEntry[];

  ensureCategoriesExist(rawEntries);

  const existingEntries = loadEntries();
  const existingIds = new Set(existingEntries.map(entry => entry.id));

  const newEntries = rawEntries
    .filter(raw => !existingIds.has(raw.id))
    .map(toEntry);

  const mergedEntries = [...existingEntries, ...newEntries];
  saveEntries(mergedEntries);

  return {
    added: newEntries.length,
    skipped: rawEntries.length - newEntries.length,
    total: mergedEntries.length,
  };
}
