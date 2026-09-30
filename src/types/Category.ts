/**
 * Category.ts - Dynamic, User-Extensible Category Model
 *
 * Activity categories used to be a fixed ActivityType enum (see the
 * (now-legacy) enum still exported from Entry.ts for older UI that hasn't
 * been migrated yet). That worked while the app only tracked a handful of
 * hobbies, but it meant adding a category required a code change and a
 * redeploy. This file replaces the enum with a plain data shape so
 * categories can be created by the user at runtime and persisted to
 * localStorage (see src/utils/categories.ts) instead of being baked into
 * the type system.
 */

import type { Entry, VisualStyle } from './Entry';

/**
 * Category
 *
 * A single user-visible activity category.
 *
 * - id: stable identifier stored on Entry.activityType. The seeded
 *   defaults use a fixed, human-readable id (e.g. 'LanguageLearning',
 *   'ShuffleDance'); user-created categories get a generated id instead
 *   (see addCategory in utils/categories.ts).
 * - name: human-readable label shown in the UI.
 * - color: hex color used to tint stars, panels, and legends for entries
 *   in this category.
 * - domain: which of the two DOMAINS (below) this category belongs to -
 *   'Movement' (something practiced) or 'Orbit' (context around the
 *   practice). Optional on the stored shape because legacy/imported data
 *   may predate it; ALWAYS read it through getCategoryDomain(), which
 *   treats a missing (or unrecognized) value as 'Movement'. Entries carry
 *   no domain of their own - it's always derived from their category (see
 *   isOrbitEntry), so changing a category's domain needs no entry
 *   migration. The domain also sets an entry's DEFAULT visual style
 *   (see getVisualStyle), which an entry can override. Deliberately separate from `color`,
 *   which is assigned independently per category (see
 *   utils/categories.ts) and has no notion of domain at all.
 */
export interface Category {
  id: string;
  name: string;
  color: string;
  domain?: Domain;
}

/**
 * DOMAINS
 *
 * The single source of truth for the two category domains - their id,
 * user-facing label, and one-line description. Used by AddEntryForm's
 * dropdown <optgroup>s and "+ Add new category" domain picker, and by
 * ManageCategoriesModal's per-row domain toggle, so the wording only ever
 * lives here.
 */
export const DOMAINS = [
  {
    id: 'Movement',
    label: 'Movement',
    description:
      'Something you practiced or did — classes, battles, milestones in your practice.',
  },
  {
    id: 'Orbit',
    label: 'Orbit',
    description:
      'Context around your practice — life events, culture, or moments in the world that shaped it.',
  },
] as const;

export type Domain = (typeof DOMAINS)[number]['id'];

/** The domain a category without one (legacy/imported data) is treated as. */
export const DEFAULT_DOMAIN: Domain = 'Movement';

/** True when `value` is one of the known DOMAINS ids. */
export function isDomain(value: unknown): value is Domain {
  return DOMAINS.some(domain => domain.id === value);
}

/**
 * Resolves a category's domain, treating a missing or unrecognized value
 * as DEFAULT_DOMAIN ('Movement') - see the `domain` field comment above.
 * Every domain read should go through this rather than `category.domain`
 * directly.
 */
export function getCategoryDomain(category: Pick<Category, 'domain'>): Domain {
  return isDomain(category.domain) ? category.domain : DEFAULT_DOMAIN;
}

/**
 * True when `entry`'s category (looked up by id in `categories`) is in the
 * 'Orbit' domain. An entry whose category can't be found (e.g. it was
 * deleted) is NOT an orbit entry, matching getCategoryDomain's Movement
 * default.
 */
export function isOrbitEntry(
  entry: { activityType: string },
  categories: Category[]
): boolean {
  const category = categories.find(
    candidate => candidate.id === entry.activityType
  );
  return category !== undefined && getCategoryDomain(category) === 'Orbit';
}

/**
 * The visual style an entry in `activityType`'s category gets when it has
 * no explicit override: 'hollow' for Orbit-domain categories, 'solid'
 * otherwise (including a category that can't be found - see
 * isOrbitEntry).
 */
export function getDefaultVisualStyle(
  activityType: string,
  categories: Category[]
): VisualStyle {
  return isOrbitEntry({ activityType }, categories) ? 'hollow' : 'solid';
}

/**
 * Resolves an entry's visual style: its explicit `visualStyle` override if
 * set, otherwise its category's domain-derived default - the same
 * backward-compatible "optional field, derived fallback" pattern as
 * getCategoryDomain. Every solid-vs-hollow read should go through this.
 */
export function getVisualStyle(
  entry: Pick<Entry, 'activityType' | 'visualStyle'>,
  categories: Category[]
): VisualStyle {
  return entry.visualStyle === 'solid' || entry.visualStyle === 'hollow'
    ? entry.visualStyle
    : getDefaultVisualStyle(entry.activityType, categories);
}

/**
 * DEFAULT_CATEGORIES
 *
 * This is now the BUNDLED FIRST-VISIT DEFAULT - see the
 * "FIRST-VISIT DEFAULT vs LOCALSTORAGE AS SOURCE OF TRUTH" comment in
 * utils/initializeFirstVisit.ts, which persists this exact list (plus the
 * matching bundled entries in src/data/defaultEntries.ts) into
 * localStorage the very first time a visitor loads the app with no
 * existing data. From that point on it's just loadCategories()'s
 * in-memory fallback for the rare case localStorage is unreadable, since
 * real usage always has a persisted list by then.
 *
 * HISTORY: this list used to carry seven placeholder categories (Language
 * Learning, Shuffle Dance, House Dance, C-Walk, Indoor/Outdoor
 * Bouldering, Flying Pole) mirroring the old fixed ActivityType enum, back
 * when the app only had mock/example data (see the now-removed
 * utils/mockEntries.ts) and no real entries existed for any of them. Now
 * that real data exists for exactly three of those seven (see
 * src/data/seedEntries.json), the other four placeholders - which have no
 * real entries - are deliberately dropped rather than carried forward.
 * They aren't gone forever: a visitor can always recreate any of them via
 * AddEntryForm's "+ Add new category" flow once real data for them
 * exists.
 *
 * The three ids/colors kept below are UNCHANGED from that original list
 * (not reassigned or re-picked), so anything already relying on
 * 'ShuffleDance'/'HouseDance'/'CWalk' as fixed ids continues to resolve
 * exactly as before.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'ShuffleDance',
    name: 'Shuffle Dance',
    color: '#1176ce',
    domain: 'Movement',
  },
  {
    id: 'HouseDance',
    name: 'House Dance',
    color: '#fb923c',
    domain: 'Movement',
  },
  { id: 'CWalk', name: 'C-Walk', color: '#607cfa', domain: 'Movement' },
  { id: 'PoleDance', name: 'Pole Dance', color: '#f87171', domain: 'Movement' },
  {
    id: 'ContemporaryDance',
    name: 'Contemporary Dance',
    color: '#c084fc',
    domain: 'Movement',
  },
  {
    id: 'Ballet',
    name: 'Ballet',
    color: '#f0eb4c',
    domain: 'Movement',
  },
  {
    id: 'DanceResearch',
    name: 'Dance Research',
    color: '#a9f46c',
    domain: 'Orbit',
  },
  {
    id: 'Yoga',
    name: 'Yoga',
    color: '#4cf0a5',
    domain: 'Movement',
  },
];
