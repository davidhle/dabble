/**
 * colors.ts - Shared Activity Category -> Color Mapping
 *
 * The single source of truth for which color represents each activity
 * category. Centralized here (rather than duplicated as inline constants
 * in every component that needs a category's color) so that StarMap's
 * stars, the sidebar's EntryPanel accent bars, and anything else added
 * later (legends, charts, etc.) can never drift out of sync with each
 * other - a color changed once here updates everywhere it's used, instead
 * of requiring a hunt through each component for its own copy of the
 * mapping.
 *
 * DYNAMIC CATEGORIES:
 * Colors used to live in a hardcoded Record<ActivityType, string> keyed
 * by the fixed ActivityType enum. Now that categories are a
 * user-extensible, localStorage-backed list (see utils/categories.ts)
 * rather than a fixed enum, colors are looked up from that list instead.
 * getActivityColor keeps its existing (activityType: string) -> string
 * signature, so StarMap, the sidebar panels, and everywhere else that
 * calls it don't need to change.
 */

import { loadCategories } from './categories';

/** Fallback color for any activityType not matched by a known category. */
export const DEFAULT_ACTIVITY_COLOR = '#e5e7eb';

/** Looks up a category's color by id (or name), falling back to a neutral gray. */
export function getActivityColor(activityType: string): string {
  const categories = loadCategories();
  const category = categories.find(
    candidate => candidate.id === activityType || candidate.name === activityType
  );
  return category?.color ?? DEFAULT_ACTIVITY_COLOR;
}
