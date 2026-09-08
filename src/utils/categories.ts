/**
 * categories.ts - localStorage-Backed Category List
 *
 * Categories are no longer a fixed enum baked into the type system - they
 * are a plain array of Category objects persisted to localStorage, so a
 * user can add their own category at runtime without a code change. This
 * file owns reading/writing that list and generating new categories.
 *
 * Every function here reads the full list, mutates it, and writes it back
 * rather than diffing in place - the list is small (a handful of
 * categories), so treating localStorage as the single source of truth on
 * every call keeps this simple and avoids a separate in-memory cache
 * getting out of sync with what's on disk.
 */

import { Category, DEFAULT_CATEGORIES } from '../types/Category';

/** localStorage key the category list is persisted under. */
const CATEGORIES_STORAGE_KEY = 'dabble-categories';

/**
 * Palette new, user-created categories cycle through.
 *
 * Chosen to be visually distinct from each other and from the
 * DEFAULT_CATEGORIES colors, so a freshly-added category doesn't land on
 * a color a built-in category already uses.
 */
const NEW_CATEGORY_COLOR_PALETTE = [
  '#34d399', // emerald
  '#fb923c', // orange
  '#60a5fa', // blue
  '#f87171', // red
  '#c084fc', // purple
  '#4ade80', // green
  '#fbbf24', // amber
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#a3e635', // lime
  '#38bdf8', // sky blue
  '#facc15', // gold
  '#a78bfa', // violet
];

/**
 * Loads the category list from localStorage.
 *
 * Falls back to DEFAULT_CATEGORIES when nothing has been saved yet (first
 * run) or when the stored value can't be parsed, so callers always get a
 * usable list back.
 */
export function loadCategories(): Category[] {
  const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_CATEGORIES;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as Category[];
    }
  } catch {
    // Corrupt or unexpected data - fall through to the defaults below.
  }

  return DEFAULT_CATEGORIES;
}

/** Persists the given category list to localStorage. */
export function saveCategories(categories: Category[]): void {
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

/**
 * Picks the next unused color from NEW_CATEGORY_COLOR_PALETTE for a new
 * category. Exported (not just used internally by addCategory) so
 * AddEntryForm's inline "add new category" sub-form can show the color
 * swatch preview before the category is actually created - see
 * previewNextCategoryColor below.
 */
export function pickColorForNewCategory(existingCategories: Category[]): string {
  const usedColors = new Set(existingCategories.map(category => category.color));
  const unusedColor = NEW_CATEGORY_COLOR_PALETTE.find(
    color => !usedColors.has(color)
  );
  if (unusedColor) {
    return unusedColor;
  }

  // Every palette color is in use - cycle back through the palette rather
  // than throwing, so adding "just one more" category never breaks the UI.
  return NEW_CATEGORY_COLOR_PALETTE[
    existingCategories.length % NEW_CATEGORY_COLOR_PALETTE.length
  ];
}

/**
 * Creates a new category with the given name, assigns it an unused color
 * from the palette, persists the updated list, and returns the new
 * category.
 */
export function addCategory(name: string): Category {
  const existingCategories = loadCategories();

  const newCategory: Category = {
    id: crypto.randomUUID(),
    name,
    color: pickColorForNewCategory(existingCategories),
  };

  saveCategories([...existingCategories, newCategory]);

  return newCategory;
}

/**
 * Returns the color a brand-new category would be assigned right now,
 * without actually creating or persisting one.
 *
 * Used by AddEntryForm's inline "add new category" sub-form to show a
 * live swatch preview while the user is still typing a name (and might
 * cancel) - calling addCategory itself there would persist a category to
 * localStorage before the user has confirmed anything.
 */
export function previewNextCategoryColor(): string {
  return pickColorForNewCategory(loadCategories());
}

/**
 * Looks up a category's display name by id, falling back to the raw id
 * itself if no matching category exists (e.g. its category was deleted).
 * Used anywhere an Entry's activityType needs to be shown as a label
 * rather than compared/looked up for color (see getActivityColor in
 * utils/colors.ts for the color equivalent).
 */
export function getCategoryName(activityType: string): string {
  const category = loadCategories().find(
    candidate => candidate.id === activityType || candidate.name === activityType
  );
  return category?.name ?? activityType;
}
