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
 * - domain: optional broader grouping (e.g. 'Movement', 'Climbing').
 *   StarMap does NOT currently use this for automatic positioning - each
 *   category gets its own independent center point on the constellation
 *   canvas regardless of domain (a domain-based clustering layout was
 *   tried and reverted). The field is kept in the data model for a
 *   possible future feature letting a user manually drag/reposition a
 *   domain's or category's region of the sky. Deliberately separate from
 *   `color`, which is assigned independently per category (see
 *   utils/categories.ts) and has no notion of domain at all.
 */
export interface Category {
  id: string;
  name: string;
  color: string;
  domain?: string;
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
    color: '#34d399',
    domain: 'Movement',
  }, // emerald
  {
    id: 'HouseDance',
    name: 'House Dance',
    color: '#fb923c',
    domain: 'Movement',
  }, // orange
  { id: 'CWalk', name: 'C-Walk', color: '#60a5fa', domain: 'Movement' }, // blue
];
