/**
 * Entry.ts - Core Data Model for Dabble
 *
 * This file defines the type system for activity entries in Dabble.
 * The data model is designed to capture various "dabbling" activities
 * with flexible metadata for future features like:
 * - Activity pattern analysis
 * - Mood tracking and correlations
 * - Spatial/location-based connections
 * - Media attachments and documentation
 *
 * STATE MANAGEMENT CONTEXT:
 * These types are used by App.tsx which maintains the entries array in state.
 * Components receive entries via props (top-down data flow).
 * New entries are added via the addEntry callback passed to AddEntryForm.
 */

/**
 * ActivityType Enum
 *
 * Defines the primary categories of activities that can be tracked.
 * The 'Other' type allows for flexibility when predefined categories
 * don't fit the user's activity.
 *
 * EXTENSIBILITY NOTE:
 * When adding new activity types:
 * 1. Add the new value to this enum
 * 2. Update the ACTIVITY_TYPE_OPTIONS array below
 * 3. Consider adding appropriate default tags for the new type
 */
export enum ActivityType {
  Dance = 'Dance',
  Climbing = 'Climbing',
  LanguageLearning = 'LanguageLearning',
  Other = 'Other',
}

/**
 * Helper array for rendering ActivityType options in forms/dropdowns.
 * Provides human-readable labels separate from enum values.
 *
 * PATTERN NOTE:
 * We maintain this separately from the enum to allow for:
 * - Custom display labels (e.g., "Language Learning" vs "LanguageLearning")
 * - Ordering control in UI dropdowns
 * - Easy addition of metadata like icons or descriptions
 */
export const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: ActivityType.Dance, label: 'Dance' },
  { value: ActivityType.Climbing, label: 'Climbing' },
  { value: ActivityType.LanguageLearning, label: 'Language Learning' },
  { value: ActivityType.Other, label: 'Other' },
];

/**
 * MediaType Enum
 *
 * Defines the types of media that can be attached to an entry.
 * This helps with rendering appropriate previews/players in the UI.
 */
export enum MediaType {
  Image = 'Image',
  Video = 'Video',
  Audio = 'Audio',
  Link = 'Link',
}

/**
 * MediaLink Interface
 *
 * Represents an attached media item to an entry.
 * Supports various media types with URLs pointing to the resource.
 *
 * FUTURE CONSIDERATIONS:
 * - Could add thumbnail URL for video/image previews
 * - Could add file size for upload management
 * - Could add caption/alt text for accessibility
 */
export interface MediaLink {
  /** The type of media (determines how it's rendered) */
  type: MediaType;

  /** URL to the media resource (can be external URL or local path) */
  url: string;

  /** Optional title/description for the media */
  title?: string;
}

/**
 * Entry Interface
 *
 * The core data structure for a single activity entry in Dabble.
 * Designed to capture both structured data (for analysis) and
 * unstructured notes (for personal reflection).
 *
 * DATA FLOW:
 * 1. User fills out AddEntryForm component
 * 2. Form validates and creates Entry object with generated UUID
 * 3. addEntry callback (from App.tsx) adds entry to state array
 * 4. React re-renders components with updated entries
 * 5. entries are console.logged for debugging/verification
 *
 * STORAGE NOTE:
 * Currently entries are stored in React state (memory only).
 * For persistence, this could be extended to:
 * - localStorage (simple, client-side)
 * - IndexedDB (larger datasets, client-side)
 * - Backend API (cloud sync, multi-device)
 */
export interface Entry {
  /**
   * Unique identifier for the entry.
   * Generated using crypto.randomUUID() for guaranteed uniqueness.
   * Used as React key and for future CRUD operations.
   */
  id: string;

  /**
   * When the activity occurred.
   * Stored as ISO string for serialization compatibility.
   * Can be different from when the entry was created (backdating).
   */
  timestamp: string;

  /**
   * Primary category of the activity.
   * Used for filtering, grouping, and analysis.
   */
  activityType: ActivityType;

  /**
   * Custom activity type name when activityType is 'Other'.
   * Allows users to define their own categories.
   * Optional - only used when activityType === ActivityType.Other
   */
  customActivityType?: string;

  /**
   * Brief title/summary of the activity.
   * Displayed in lists and cards for quick scanning.
   */
  title: string;

  /**
   * Longer description of what was done.
   * Supports multi-line text for detailed documentation.
   */
  description: string;

  /**
   * Array of tags for sub-categorization.
   * Examples: ["salsa", "bachata"] for Dance, ["bouldering", "V4"] for Climbing
   * Enables fine-grained filtering and pattern discovery.
   */
  tags: string[];

  /**
   * Attached media items (photos, videos, links).
   * Documents the activity with visual/audio evidence.
   */
  mediaLinks: MediaLink[];

  /**
   * Where the activity took place.
   * Optional - useful for location-based patterns and memories.
   * Could be enhanced with coordinates for mapping features.
   */
  location?: string;

  /**
   * How long the activity lasted in minutes.
   * Optional - useful for time tracking and progress analysis.
   */
  duration?: number;

  /**
   * Personal reflections, learnings, or detailed thoughts.
   * Separate from description to distinguish "what happened"
   * from "what I think/feel about it".
   */
  notes: string;

  /**
   * Emotional state during/after the activity.
   * Array allows for multiple moods (e.g., ["excited", "tired"]).
   * Optional - useful for mood tracking and correlation analysis.
   *
   * FUTURE USE:
   * - Correlate mood with activity types
   * - Track emotional patterns over time
   * - Suggest activities based on desired mood
   */
  mood?: string[];
}

/**
 * Helper function to create a new Entry with defaults.
 * Generates UUID and sets timestamp to current time.
 *
 * USAGE:
 * const entry = createEntry({
 *   activityType: ActivityType.Dance,
 *   title: "Salsa class",
 *   description: "Learned new turn pattern",
 *   tags: ["salsa", "beginner"],
 *   notes: "Getting better at leading!"
 * });
 *
 * @param partial - Partial entry data (required fields must be provided)
 * @returns Complete Entry object with generated id and timestamp
 */
export function createEntry(
  partial: Omit<Entry, 'id' | 'timestamp'> & { timestamp?: string }
): Entry {
  return {
    id: crypto.randomUUID(),
    timestamp: partial.timestamp || new Date().toISOString(),
    ...partial,
  };
}

/**
 * Common mood options for UI suggestions.
 * Users can also enter custom moods not in this list.
 *
 * PATTERN NOTE:
 * This provides a starting point for mood selection while
 * allowing flexibility for personal expression.
 */
export const COMMON_MOODS = [
  'Excited',
  'Happy',
  'Calm',
  'Focused',
  'Tired',
  'Frustrated',
  'Accomplished',
  'Curious',
  'Anxious',
  'Relaxed',
];

/**
 * Suggested tags by activity type.
 * Provides contextual suggestions in the form UI.
 *
 * EXTENSIBILITY:
 * Add new activity types here when extending ActivityType enum.
 */
export const SUGGESTED_TAGS: Record<ActivityType, string[]> = {
  [ActivityType.Dance]: [
    'shuffle',
    'house',
    'pole',
    'practice',
    'social',
    'class',
    'battle',
  ],
  [ActivityType.Climbing]: [
    'bouldering',
    'top-rope',
    'lead',
    'outdoor',
    'indoor',
    'V0',
    'V1',
    'V2',
    'V3',
    'V4',
    'V5+',
    'kilter'
  ],
  [ActivityType.LanguageLearning]: [
    'spanish',
    'french',
    'vietnamese',
    'german',
    'vocabulary',
    'grammar',
    'speaking',
    'listening',
    'reading',
    'writing',
  ],
  [ActivityType.Other]: ['hobby', 'learning', 'practice', 'project', 'creative'],
};
