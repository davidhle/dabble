/**
 * AddEntryForm.tsx - Entry Creation Form Component
 *
 * This component provides a comprehensive form for creating new activity entries.
 * It demonstrates several key React patterns:
 *
 * STATE MANAGEMENT PATTERNS:
 * 1. Local form state - Uses useState for each form field
 *    - This keeps form data isolated until submission
 *    - Allows for validation before committing to app state
 *
 * 2. Controlled components - Each input's value is controlled by React state
 *    - Ensures single source of truth for form data
 *    - Enables real-time validation and dynamic UI updates
 *
 * 3. Lifting state up - Form doesn't manage entries array
 *    - Parent (App.tsx) owns the entries state
 *    - Form receives onSubmit callback to add new entries
 *    - This separation keeps the form reusable and testable
 *
 * FORM HANDLING PATTERNS:
 * 1. Validation on submit - Checks required fields before submission
 * 2. Field-level errors - Tracks which fields have validation errors
 * 3. Reset on cancel/submit - Clears form state after action
 *
 * PROPS FLOW:
 * - isOpen: boolean - Controls modal visibility (from Layout)
 * - onClose: () => void - Callback to close modal (from Layout)
 * - onSubmit: (entry: Entry) => void - Callback to add entry (from App via Layout)
 */

import { useState, useEffect } from 'react';
import {
  Entry,
  ActivityType,
  MediaType,
  MediaLink,
  ACTIVITY_TYPE_OPTIONS,
  COMMON_MOODS,
  SUGGESTED_TAGS,
  createEntry,
} from '../types/Entry';

/**
 * Props interface for AddEntryForm
 *
 * DESIGN DECISION:
 * We pass callbacks rather than the entries array itself because:
 * 1. Form doesn't need to read existing entries
 * 2. Minimizes re-renders (form only updates when its props change)
 * 3. Clear separation of concerns (form creates, parent stores)
 */
interface AddEntryFormProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;

  /** Callback to close the modal (triggered by Cancel or successful submit) */
  onClose: () => void;

  /** Callback to add a new entry to the app state */
  onSubmit: (entry: Entry) => void;
}

/**
 * Validation errors interface
 * Tracks which fields have validation issues
 */
interface FormErrors {
  title?: string;
  description?: string;
  activityType?: string;
  customActivityType?: string;
}

export default function AddEntryForm({
  isOpen,
  onClose,
  onSubmit,
}: AddEntryFormProps) {
  /**
   * FORM STATE
   *
   * Each field has its own useState hook. This pattern:
   * - Makes it clear what state exists
   * - Allows independent updates (no spread operators needed)
   * - Enables field-specific validation logic
   *
   * Alternative approaches:
   * - Single state object: Less verbose but requires spreading
   * - useReducer: Better for complex state logic
   * - Form library (react-hook-form): Better for large forms
   */

  // Required fields
  const [activityType, setActivityType] = useState<ActivityType>(
    ActivityType.Dance
  );
  const [customActivityType, setCustomActivityType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Array fields (tags, moods, media)
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState(''); // Temporary input for adding tags
  const [moods, setMoods] = useState<string[]>([]);
  const [mediaLinks, setMediaLinks] = useState<MediaLink[]>([]);

  // Optional fields
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState('');

  // Media input state (temporary, for adding new media)
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.Link);
  const [mediaTitle, setMediaTitle] = useState('');

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * EFFECT: Reset form when modal opens
   *
   * This ensures a fresh form each time the modal opens.
   * We set timestamp to current datetime for convenience.
   */
  useEffect(() => {
    if (isOpen) {
      // Set default timestamp to now (formatted for datetime-local input)
      const now = new Date();
      const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setTimestamp(localDatetime);
    }
  }, [isOpen]);

  /**
   * EFFECT: Update suggested tags when activity type changes
   *
   * This provides contextual tag suggestions based on the selected activity.
   * Users can still add custom tags not in the suggestions.
   */
  const suggestedTags = SUGGESTED_TAGS[activityType] || [];

  /**
   * Validates the form and returns whether it's valid
   * Sets error messages for invalid fields
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Title is required
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    // Description is required
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    // Custom activity type required when "Other" is selected
    if (activityType === ActivityType.Other && !customActivityType.trim()) {
      newErrors.customActivityType =
        'Please specify the activity type';
    }

    setErrors(newErrors);

    // Form is valid if no errors
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles form submission
   *
   * FLOW:
   * 1. Prevent default form behavior
   * 2. Validate all fields
   * 3. If valid, create Entry object and call onSubmit
   * 4. Reset form and close modal
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Create the entry using our helper function
    // This generates the UUID and handles timestamp
    const entry = createEntry({
      activityType,
      customActivityType:
        activityType === ActivityType.Other ? customActivityType : undefined,
      title: title.trim(),
      description: description.trim(),
      tags,
      mediaLinks,
      location: location.trim() || undefined,
      duration: duration ? parseInt(duration, 10) : undefined,
      notes: notes.trim(),
      mood: moods.length > 0 ? moods : undefined,
      timestamp: timestamp ? new Date(timestamp).toISOString() : undefined,
    });

    // Call parent's onSubmit callback
    // This adds the entry to App.tsx state
    onSubmit(entry);

    // Reset form state
    resetForm();

    setIsSubmitting(false);

    // Close the modal
    onClose();
  };

  /**
   * Resets all form fields to initial values
   * Called after successful submit or on cancel
   */
  const resetForm = () => {
    setActivityType(ActivityType.Dance);
    setCustomActivityType('');
    setTitle('');
    setDescription('');
    setTags([]);
    setTagInput('');
    setMoods([]);
    setMediaLinks([]);
    setLocation('');
    setDuration('');
    setNotes('');
    setTimestamp('');
    setMediaUrl('');
    setMediaType(MediaType.Link);
    setMediaTitle('');
    setErrors({});
  };

  /**
   * Handles cancel button click
   * Resets form and closes modal
   */
  const handleCancel = () => {
    resetForm();
    onClose();
  };

  /**
   * TAG MANAGEMENT FUNCTIONS
   *
   * Tags are stored as an array of strings.
   * These functions handle adding/removing tags.
   */

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  /**
   * MOOD MANAGEMENT FUNCTIONS
   *
   * Moods work like tags but with predefined suggestions.
   */

  const toggleMood = (mood: string) => {
    if (moods.includes(mood)) {
      setMoods(moods.filter((m) => m !== mood));
    } else {
      setMoods([...moods, mood]);
    }
  };

  /**
   * MEDIA LINK MANAGEMENT FUNCTIONS
   *
   * Media links have type, url, and optional title.
   */

  const addMediaLink = () => {
    if (mediaUrl.trim()) {
      const newMedia: MediaLink = {
        type: mediaType,
        url: mediaUrl.trim(),
        title: mediaTitle.trim() || undefined,
      };
      setMediaLinks([...mediaLinks, newMedia]);
      setMediaUrl('');
      setMediaTitle('');
    }
  };

  const removeMediaLink = (index: number) => {
    setMediaLinks(mediaLinks.filter((_, i) => i !== index));
  };

  // Don't render anything if modal is closed
  if (!isOpen) return null;

  return (
    /**
     * MODAL STRUCTURE
     *
     * The modal uses a fixed overlay pattern:
     * - Outer div: Fixed position overlay with semi-transparent background
     * - Inner div: Centered modal container with form content
     *
     * Click on overlay closes modal (but not click on form itself)
     */
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50"
      onClick={handleCancel}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()} // Prevent close on form click
        >
          {/* Modal Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Add New Entry
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Activity Type Selection */}
            <div>
              <label
                htmlFor="activityType"
                className="block text-sm font-medium text-gray-700"
              >
                Activity Type *
              </label>
              <select
                id="activityType"
                value={activityType}
                onChange={(e) =>
                  setActivityType(e.target.value as ActivityType)
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {ACTIVITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Activity Type (shown when "Other" is selected) */}
            {activityType === ActivityType.Other && (
              <div>
                <label
                  htmlFor="customActivityType"
                  className="block text-sm font-medium text-gray-700"
                >
                  Specify Activity Type *
                </label>
                <input
                  type="text"
                  id="customActivityType"
                  value={customActivityType}
                  onChange={(e) => setCustomActivityType(e.target.value)}
                  placeholder="e.g., Photography, Cooking, Music"
                  className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                    errors.customActivityType
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                />
                {errors.customActivityType && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.customActivityType}
                  </p>
                )}
              </div>
            )}

            {/* Timestamp */}
            <div>
              <label
                htmlFor="timestamp"
                className="block text-sm font-medium text-gray-700"
              >
                When did this happen?
              </label>
              <input
                type="datetime-local"
                id="timestamp"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700"
              >
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your activity"
                className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                  errors.title
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Description *
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What did you do? What happened?"
                className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                  errors.description
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tags
              </label>
              <div className="mt-1">
                {/* Tag Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Add tags (press Enter)"
                    className="block flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(tagInput)}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>

                {/* Selected Tags */}
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 text-indigo-500 hover:text-indigo-700"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested Tags */}
                {suggestedTags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Suggestions:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {suggestedTags
                        .filter((tag) => !tags.includes(tag))
                        .slice(0, 6)
                        .map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTag(tag)}
                            className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                          >
                            + {tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location and Duration (side by side) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-700"
                >
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where did this happen?"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="duration"
                  className="block text-sm font-medium text-gray-700"
                >
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="How long?"
                  min="0"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Mood */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mood
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {COMMON_MOODS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => toggleMood(mood)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      moods.includes(mood)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700"
              >
                Reflections & Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="What did you learn? How do you feel about it?"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Media Links */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Media Links
              </label>
              <div className="mt-1 space-y-2">
                {/* Add Media Input */}
                <div className="flex gap-2">
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as MediaType)}
                    className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={MediaType.Link}>Link</option>
                    <option value={MediaType.Image}>Image</option>
                    <option value={MediaType.Video}>Video</option>
                    <option value={MediaType.Audio}>Audio</option>
                  </select>
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="URL"
                    className="block flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={addMediaLink}
                    disabled={!mediaUrl.trim()}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                {/* Optional media title */}
                <input
                  type="text"
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="Media title (optional)"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                {/* Added Media List */}
                {mediaLinks.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {mediaLinks.map((media, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                      >
                        <span className="text-sm text-gray-700">
                          <span className="font-medium">[{media.type}]</span>{' '}
                          {media.title || media.url}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMediaLink(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
