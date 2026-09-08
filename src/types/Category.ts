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
 */
export interface Category {
  id: string;
  name: string;
  color: string;
}

/**
 * DEFAULT_CATEGORIES
 *
 * Seed data for the dynamic category list. The original seed list here
 * mirrored the old ActivityType enum (Dance, Climbing, Language Learning,
 * Other) for compatibility with entries created before categories became
 * dynamic. Those generic buckets have since been replaced by the more
 * specific practice categories users actually created via the "+ Add new
 * category" flow (see AddEntryForm.tsx) - Dance split into Shuffle Dance /
 * House Dance / Flying Pole, Climbing split into Indoor/Outdoor
 * Bouldering, and Other has no replacement (a real category is always
 * created instead of falling back to a generic bucket now).
 *
 * There's no real user data to preserve across this change (only
 * example/dummy data - see utils/mockEntries.ts), so the old Dance,
 * Climbing, and Other entries were simply dropped rather than migrated.
 * Their `color` values are still reused here for the categories that
 * replace them (e.g. Flying Pole keeps Dance's old pink), purely for
 * visual continuity with what mock data generation had already assigned
 * them - not for any compatibility requirement.
 *
 * LANGUAGE LEARNING NOTE:
 * Kept as-is (a single broad category) rather than split up like Dance
 * and Climbing were. Spanish, French, etc. could each become their own
 * category the same way Shuffle Dance and House Dance did, but that split
 * hasn't been made yet - left as a possible future change, not a decision
 * to keep it broad forever.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'LanguageLearning', name: 'Language Learning', color: '#facc15' }, // gold
  { id: 'ShuffleDance', name: 'Shuffle Dance', color: '#34d399' }, // emerald
  { id: 'HouseDance', name: 'House Dance', color: '#fb923c' }, // orange
  { id: 'CWalk', name: 'C-Walk', color: '#60a5fa' }, // blue
  { id: 'IndoorBouldering', name: 'Indoor Bouldering', color: '#f87171' }, // red
  { id: 'OutdoorBouldering', name: 'Outdoor Bouldering', color: '#c084fc' }, // purple
  { id: 'FlyingPole', name: 'Flying Pole', color: '#f472b6' }, // pink (formerly Dance's color)
];
