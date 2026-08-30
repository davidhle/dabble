/**
 * colors.ts - Shared ActivityType -> Color Mapping
 *
 * The single source of truth for which color represents each
 * ActivityType. Centralized here (rather than duplicated as inline
 * constants in every component that needs an activity's color) so that
 * StarMap's stars, the sidebar's EntryPanel accent bars, and anything
 * else added later (legends, charts, etc.) can never drift out of sync
 * with each other - a color changed once here updates everywhere it's
 * used, instead of requiring a hunt through each component for its own
 * copy of the mapping.
 */

import { ActivityType } from '../types/Entry';

/** Fixed color per activity type, used to tint stars, panels, and legends. */
export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  [ActivityType.Dance]: '#f472b6', // pink
  [ActivityType.Climbing]: '#38bdf8', // sky blue
  [ActivityType.LanguageLearning]: '#facc15', // gold
  [ActivityType.Other]: '#a78bfa', // violet
};

/** Fallback color for any activityType not present in ACTIVITY_COLORS. */
export const DEFAULT_ACTIVITY_COLOR = '#e5e7eb';

/** Looks up an entry's activityType color, falling back to a neutral gray. */
export function getActivityColor(activityType: ActivityType): string {
  return ACTIVITY_COLORS[activityType] ?? DEFAULT_ACTIVITY_COLOR;
}
