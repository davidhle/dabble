/**
 * defaultEntries.ts - Bundled First-Visit Default Entries
 *
 * Transforms the raw dataset in seedEntries.json into fully-formed Entry
 * objects, pointed at the fixed category ids in types/Category.ts's
 * DEFAULT_CATEGORIES ('ShuffleDance', 'HouseDance', 'CWalk'). This runs
 * once at module load (not on demand, not per-visit) since it's pure data
 * transformation with no side effects - the actual "only apply this on a
 * visitor's first-ever visit" logic lives in utils/initializeFirstVisit.ts,
 * which imports DEFAULT_ENTRIES from here.
 *
 * This replaces the old, now-removed utils/seedRealData.ts, which did the
 * same JSON-shape adaptation but as a manually-triggered one-time script
 * (a dev console command or temporary button) that created its OWN
 * category ids at runtime via addCategory(). Now that this bundled
 * dataset is a permanent part of the app rather than a one-off migration,
 * there's no need to generate ids at runtime - it can just target
 * DEFAULT_CATEGORIES' existing fixed ids directly.
 */

import { Entry, EntryLocation, MediaLink, MediaType } from '../types/Entry';
import { DEFAULT_CATEGORIES } from '../types/Category';
import seedEntries from './seedEntries.json';

/** The shape of one record in seedEntries.json. */
interface RawSeedEntry {
  id: string;
  activityType: string;
  title: string;
  description: string;
  notes: string;
  tags: string[];
  mediaLinks: { type: string; url: string; title?: string }[];
  location?: string | EntryLocation | null;
  duration?: number | null;
  mood?: string | null;
  timestamp: string;
  dateDisplay?: string | null;
  /** Optional multi-day end date - see the endTimestamp field comment in types/Entry.ts. */
  endTimestamp?: string | null;
}

/**
 * Legacy translation table: maps seedEntries.json's OLD lowercase-hyphenated
 * activityType values (e.g. 'c-walk') onto DEFAULT_CATEGORIES' actual fixed
 * ids. The live app's Export Data feature now writes activityType as the
 * category id directly, so current seed data no longer needs this table -
 * it's kept only as a fallback for any old-format seed data still floating
 * around (see toEntry's resolution order below). Hardcoded as an explicit
 * table (rather than a generic string transform) since there's no single
 * mechanical rule that turns 'c-walk' into 'CWalk' and 'house-dance' into
 * 'HouseDance' consistently.
 */
const CATEGORY_ID_BY_ACTIVITY_TYPE: Record<string, string> = {
  'house-dance': 'HouseDance',
  'c-walk': 'CWalk',
  'shuffle-dance': 'ShuffleDance',
  'pole-dance': 'PoleDance',
  'contemporary-dance': 'ContemporaryDance',
};

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

/**
 * Resolves a raw seed record's activityType to an actual category id.
 *
 * Checks in order:
 * 1. A direct match against DEFAULT_CATEGORIES' own ids - the current
 *    format, since Export Data now writes activityType as the category id
 *    itself (e.g. 'CWalk', 'ShuffleDance', or a user-created category's
 *    crypto.randomUUID() id) rather than a translated slug.
 * 2. The legacy CATEGORY_ID_BY_ACTIVITY_TYPE table, for any old-format
 *    hyphenated-slug seed data (e.g. 'c-walk') that might still exist.
 * 3. Neither resolves - fail loudly rather than silently mis-categorizing.
 */
function resolveActivityType(rawActivityType: string): string {
  if (DEFAULT_CATEGORIES.some(category => category.id === rawActivityType)) {
    return rawActivityType;
  }

  const legacyActivityType = CATEGORY_ID_BY_ACTIVITY_TYPE[rawActivityType];
  if (legacyActivityType) {
    return legacyActivityType;
  }

  throw new Error(
    `defaultEntries: no category mapped for activityType "${rawActivityType}" - add it to CATEGORY_ID_BY_ACTIVITY_TYPE`
  );
}

/** Converts one raw seed record into a fully-formed Entry. */
function toEntry(raw: RawSeedEntry): Entry {
  const activityType = resolveActivityType(raw.activityType);

  return {
    id: raw.id,
    timestamp: raw.timestamp,
    activityType,
    title: raw.title,
    description: raw.description,
    tags: raw.tags,
    mediaLinks: raw.mediaLinks.map(toMediaLink),
    notes: raw.notes,
    ...(raw.location ? { location: raw.location } : {}),
    ...(raw.duration != null ? { duration: raw.duration } : {}),
    ...(raw.mood ? { mood: [raw.mood] } : {}),
    ...(raw.dateDisplay ? { dateDisplay: raw.dateDisplay } : {}),
    ...(raw.endTimestamp ? { endTimestamp: raw.endTimestamp } : {}),
  };
}

/**
 * The bundled default entries - see this file's top comment. Consumed by
 * utils/initializeFirstVisit.ts, never directly by App.tsx/Constellation.tsx
 * (those only ever read through loadEntries(), which returns whatever's
 * actually in localStorage).
 */
export const DEFAULT_ENTRIES: Entry[] = (seedEntries as RawSeedEntry[]).map(
  toEntry
);
