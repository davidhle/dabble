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
   *
   * DYNAMIC CATEGORIES:
   * This is a plain string referencing a category id from the dynamic,
   * localStorage-backed category list (see types/Category.ts and
   * utils/categories.ts) rather than a fixed enum, so new categories can
   * be created at runtime (see AddEntryForm.tsx's "+ Add new category"
   * flow) without a code change. There used to also be a separate
   * `customActivityType` field for a one-off "Other, please specify"
   * name - that's gone now, since creating a real category (with its own
   * id, name, and color) replaces the need for a free-text escape hatch.
   * DEFAULT_CATEGORIES' ids match the values the old fixed ActivityType
   * enum used to have, so entries created before categories became
   * dynamic still resolve to the same category (and color) with no data
   * migration required.
   */
  activityType: string;

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

  /**
   * Human-readable, imprecise date label (e.g. "October - November 2021"),
   * shown in place of `timestamp`'s exact formatted date wherever an entry's
   * date is displayed. Optional - only set for entries whose real date is
   * only known approximately (e.g. old data backfilled from memory), where
   * `timestamp` still holds a best-guess exact date for sorting/positioning
   * but isn't precise enough to show to the user as-is.
   */
  dateDisplay?: string;

  /**
   * Optional end of a multi-day activity, ISO string format like `timestamp`.
   *
   * OPTIONAL & BACKWARD-COMPATIBLE:
   * This is iCal-style - an entry is a single point in time by default, and
   * only becomes a date range when this is explicitly set (via the "This
   * spans multiple days" toggle in AddEntryForm.tsx). Existing entries
   * created before this field existed simply don't have it, and continue
   * to render as single-point-in-time events with no data migration
   * needed. When present, `timestamp` is the range's start and this is its
   * (inclusive) end - see EntryDetailModal.tsx / EntryPanel.tsx for how the
   * range is displayed.
   */
  endTimestamp?: string;
}

/**
 * Helper function to create a new Entry with defaults.
 * Generates UUID and sets timestamp to current time.
 *
 * USAGE:
 * const entry = createEntry({
 *   activityType: "ShuffleDance", // a category id from utils/categories.ts
 *   title: "Running man practice",
 *   description: "Learned a new footwork combo",
 *   tags: ["shuffle", "beginner"],
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
 * Suggested tags by activity category.
 * Provides contextual suggestions in the form UI.
 *
 * DYNAMIC CATEGORIES:
 * Keyed by category id (a plain string) rather than the old ActivityType
 * enum, so this only needs to cover the built-in DEFAULT_CATEGORIES ids
 * here. A category the user creates at runtime simply has no entry in
 * this map - AddEntryForm.tsx already falls back to an empty suggestion
 * list (`SUGGESTED_TAGS[activityType] || []`) for that case, so a missing
 * key is expected, not an error.
 */
export const SUGGESTED_TAGS: Record<string, string[]> = {
  ShuffleDance: ['running-man', 'practice', 'social', 'battle'],
  HouseDance: ['groove', 'jacking', 'practice', 'class'],
  CWalk: ['footwork', 'tutorial', 'practice'],
  IndoorBouldering: [
    'bouldering',
    'indoor',
    'kilter',
    'V0',
    'V1',
    'V2',
    'V3',
    'V4',
    'V5+',
  ],
  OutdoorBouldering: ['bouldering', 'outdoor', 'top-rope', 'lead', 'highball'],
  FlyingPole: ['spins', 'invert', 'conditioning', 'practice'],
  LanguageLearning: [
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
};
