/**
 * AddEntryForm.tsx - Two-Step Entry Creation Form Component
 *
 * This component provides a two-step modal form for creating new activity entries.
 *
 * STEP NAVIGATION FLOW:
 * 1. Step 1 ("Activity Details") collects core activity info: type, title, tags,
 *    date, location, duration, and description.
 * 2. The "Next" button is visually disabled AND non-functional until the
 *    required field (Title) is filled. This gives the user immediate
 *    feedback about what's needed before they can proceed.
 * 3. Step 2 ("Reflections & Media") collects optional reflections: mood, notes,
 *    media links (YouTube/Vimeo), and has a placeholder for photo uploads.
 * 4. The "Back" button returns to Step 1 without losing any entered data.
 * 5. "Add Entry" on Step 2 submits the complete form.
 *
 * DYNAMIC CATEGORIES:
 * The Activity Type dropdown used to be a fixed list (ACTIVITY_TYPE_OPTIONS,
 * backed by the ActivityType enum), with a hardcoded "Other" option that
 * revealed a free-text "customActivityType" field for anything that didn't
 * fit the fixed list. That whole "Other + custom name" escape hatch has
 * been replaced with a real category creation flow: the dropdown is now
 * populated from the dynamic, localStorage-backed category list (see
 * utils/categories.ts), with a trailing "+ Add new category" option. Picking
 * it reveals an inline sub-form (name input + auto-assigned color swatch
 * preview); confirming it creates a brand new first-class category via
 * addCategory - with its own id, name, and color - and immediately selects
 * it, rather than just stashing a one-off string on the entry. This means
 * a category the user types once is available (and consistently colored)
 * for every future entry, not just the one being created right now.
 *
 * VALIDATION LOGIC:
 * - Activity Type always has a value (defaults to the first category in the
 *   list), so it no longer needs its own required-field check - creating a
 *   category is a separate, self-contained action from filling out this
 *   validation-checked field.
 * - Title is required and must be non-empty.
 * - On final submit, validation runs again to catch edge cases.
 *
 * STATE MANAGEMENT PATTERNS:
 * - All form state persists across steps (no data loss when navigating back/forward)
 * - Form resets completely when the modal closes or on successful submission
 * - Step state resets to 1 when the modal re-opens
 *
 * PROPS FLOW:
 * - isOpen: boolean - Controls modal visibility (from Layout)
 * - onClose: () => void - Callback to close modal (from Layout)
 * - onSubmit: (entry: Entry) => void - Callback to add entry (from App via Layout)
 */

import { useState, useEffect } from 'react';
import { Entry, MediaLink, COMMON_MOODS, SUGGESTED_TAGS, createEntry } from '../types/Entry';
import { Category, DEFAULT_CATEGORIES } from '../types/Category';
import {
  loadCategories,
  addCategory,
  previewNextCategoryColor,
} from '../utils/categories';

/**
 * Sentinel <option> value for the trailing "+ Add new category" dropdown
 * entry. Chosen to be extremely unlikely to collide with a real category
 * id (a crypto.randomUUID() or a DEFAULT_CATEGORIES id like "FlyingPole").
 * Never actually stored as an entry's activityType - selecting it only
 * opens the inline sub-form below; see handleActivityTypeChange.
 */
const ADD_NEW_CATEGORY_VALUE = '__add_new_category__';

interface AddEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: Entry) => void;
}

interface FormErrors {
  title?: string;
}

export default function AddEntryForm({
  isOpen,
  onClose,
  onSubmit,
}: AddEntryFormProps) {
  // ─── Step Navigation State ───
  // Tracks which step the user is on (1 or 2)
  const [currentStep, setCurrentStep] = useState(1);

  // ─── Step 1 Fields: Activity Details ───
  // The dynamic category list itself - loaded fresh whenever the modal
  // opens (see the isOpen effect below) so a category created in a
  // previous session, or via mock data generation, is reflected here.
  const [categories, setCategories] = useState<Category[]>(() =>
    loadCategories()
  );
  const [activityType, setActivityType] = useState<string>(
    DEFAULT_CATEGORIES[0].id
  );

  // ─── "+ Add new category" inline sub-form state ───
  // Shown instead of (not alongside) the old "Other" custom-name field -
  // see the DYNAMIC CATEGORIES comment at the top of this file.
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  // Computed once when the sub-form opens (not on every keystroke) since
  // the color a new category will get depends only on which colors
  // existing categories already use, not on the name being typed.
  const [newCategoryColorPreview, setNewCategoryColorPreview] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');

  // ─── Step 2 Fields: Reflections & Media ───
  const [moods, setMoods] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [mediaLinks, setMediaLinks] = useState<MediaLink[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');

  // ─── Form State ───
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Transition direction for slide animation ───
  // 'forward' when going from Step 1 -> 2, 'backward' when going 2 -> 1
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>(
    'forward'
  );

  /**
   * Reset form and step when modal opens.
   * Always start at Step 1 with a fresh form.
   */
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSlideDirection('forward');
      const now = new Date();
      const localDatetime = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16);
      setTimestamp(localDatetime);

      // Refresh the category list on every open (not just once on mount)
      // so a category created in an earlier session - or by mock data
      // generation - shows up without needing a page reload.
      const freshCategories = loadCategories();
      setCategories(freshCategories);
      setActivityType(freshCategories[0]?.id ?? DEFAULT_CATEGORIES[0].id);
    }
  }, [isOpen]);

  const suggestedTags = SUGGESTED_TAGS[activityType] || [];

  /**
   * Determines if the user can proceed from Step 1 to Step 2.
   * Activity Type always has a value (see DYNAMIC CATEGORIES comment
   * above), so only Title needs to be checked here.
   */
  const canProceedToStep2 = title.trim().length > 0;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles a selection on the Activity Type dropdown.
   *
   * The trailing "+ Add new category" option is a sentinel, not a real
   * category - selecting it opens the inline sub-form (below) and
   * computes what color the new category would get, but does NOT change
   * `activityType` itself. Since the <select>'s `value` stays bound to
   * the unchanged `activityType`, the dropdown visually snaps back to
   * whatever was selected before, which is the desired effect: the "+"
   * option is an action, not a persistent selection.
   */
  const handleActivityTypeChange = (value: string) => {
    if (value === ADD_NEW_CATEGORY_VALUE) {
      setNewCategoryColorPreview(previewNextCategoryColor());
      setIsAddingCategory(true);
      return;
    }
    setActivityType(value);
  };

  /**
   * Confirms the inline "add new category" sub-form: persists a real
   * category via addCategory (assigning it the previewed color), then
   * immediately selects it as this entry's activityType and closes the
   * sub-form. A blank/whitespace-only name is ignored rather than
   * creating an empty category.
   */
  const handleCreateCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    const newCategory = addCategory(trimmedName);
    setCategories(loadCategories());
    setActivityType(newCategory.id);
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  const handleCancelAddCategory = () => {
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  /**
   * Handles moving from Step 1 to Step 2.
   * Only proceeds if required fields are filled (enforced by canProceedToStep2).
   */
  const handleNext = () => {
    if (!canProceedToStep2) return;
    setSlideDirection('forward');
    setCurrentStep(2);
  };

  /**
   * Handles moving back from Step 2 to Step 1.
   * All form data is preserved — nothing is cleared.
   */
  const handleBack = () => {
    setSlideDirection('backward');
    setCurrentStep(1);
  };

  const handleSubmit = (_e: React.MouseEvent) => {
    if (!validateForm()) {
      // If validation fails on submit (edge case), go back to step 1
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);

    const entry = createEntry({
      activityType,
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

    onSubmit(entry);
    resetForm();
    setIsSubmitting(false);
    onClose();
  };

  const resetForm = () => {
    setCurrentStep(1);
    setSlideDirection('forward');
    setActivityType(categories[0]?.id ?? DEFAULT_CATEGORIES[0].id);
    setIsAddingCategory(false);
    setNewCategoryName('');
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
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  // ─── Tag Management ───

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

  // ─── Mood Management ───

  const toggleMood = (mood: string) => {
    if (moods.includes(mood)) {
      setMoods(moods.filter((m) => m !== mood));
    } else {
      setMoods([...moods, mood]);
    }
  };

  // ─── Media Link Management ───

  const addMediaLink = () => {
    if (mediaUrl.trim()) {
      const newMedia: MediaLink = {
        type: 'Video' as any,
        url: mediaUrl.trim(),
      };
      setMediaLinks([...mediaLinks, newMedia]);
      setMediaUrl('');
    }
  };

  const removeMediaLink = (index: number) => {
    setMediaLinks(mediaLinks.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    /**
     * MODAL STRUCTURE
     *
     * Fixed overlay with centered modal card.
     * - max-h-[60vh]: Modal takes at most 60% of viewport height
     * - overflow-y-auto on the content area: scrolls internally, not the page
     * - Responsive width: w-[90vw] on mobile, max-w-[500px] on desktop
     */
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50"
      onClick={handleCancel}
    >
      <div className="flex h-full items-center justify-center p-4">
        <div
          className="flex w-[90vw] max-w-[500px] flex-col rounded-lg bg-white shadow-xl"
          style={{ maxHeight: '60vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ─── Modal Header with Step Indicator ─── */}
          <div className="flex-shrink-0 border-b px-6 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentStep === 1 ? 'Activity Details' : 'Reflections & Media'}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
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

            {/* Step Indicator */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    currentStep === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-600'
                  }`}
                >
                  1
                </div>
                <span
                  className={`text-xs ${
                    currentStep === 1
                      ? 'font-medium text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  Details
                </span>
              </div>
              <div className="h-px flex-1 bg-gray-200" />
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    currentStep === 2
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  2
                </div>
                <span
                  className={`text-xs ${
                    currentStep === 2
                      ? 'font-medium text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  Reflections
                </span>
              </div>
            </div>
          </div>

          {/* ─── Scrollable Form Content ─── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/*
               * Step content wrapper with CSS transition.
               * Uses opacity + translateX for a smooth slide/fade effect.
               * slideDirection controls whether content slides left or right.
               */}
              <div
                className="transition-all duration-300 ease-in-out"
                style={{
                  animation:
                    slideDirection === 'forward'
                      ? 'slideInFromRight 0.3s ease-out'
                      : 'slideInFromLeft 0.3s ease-out',
                }}
                key={currentStep}
              >
                {currentStep === 1 ? (
                  /* ═══════════════════════════════════════════
                   * STEP 1: Activity Details
                   * Required: Activity Type, Title
                   * Optional: Tags, Date, Location, Duration, Description
                   * ═══════════════════════════════════════════ */
                  <div className="space-y-4">
                    {/* Activity Type Selection */}
                    <div>
                      <label
                        htmlFor="activityType"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Activity Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="activityType"
                        value={activityType}
                        onChange={(e) =>
                          handleActivityTypeChange(e.target.value)
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                        {/*
                         * Trailing sentinel option - visually set apart
                         * (italic + a leading "+") from the real
                         * categories above it. See handleActivityTypeChange
                         * for why picking this doesn't set `activityType`.
                         */}
                        <option
                          value={ADD_NEW_CATEGORY_VALUE}
                          style={{ fontStyle: 'italic' }}
                        >
                          + Add new category
                        </option>
                      </select>
                    </div>

                    {/*
                     * Inline "add new category" sub-form - replaces the old
                     * "Other, please specify a custom name" field. Shown
                     * only while the user is actively naming a new
                     * category; confirming or cancelling closes it again.
                     */}
                    {isAddingCategory && (
                      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                        <label
                          htmlFor="newCategoryName"
                          className="block text-sm font-medium text-gray-700"
                        >
                          New category name
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          {/* Color swatch preview - the color this category
                              will be assigned, shown before it's created. */}
                          <span
                            className="h-6 w-6 flex-shrink-0 rounded-full border border-black/10"
                            style={{ backgroundColor: newCategoryColorPreview }}
                            aria-hidden="true"
                          />
                          <input
                            type="text"
                            id="newCategoryName"
                            autoFocus
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateCategory();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelAddCategory();
                              }
                            }}
                            placeholder="e.g., Pottery, Skateboarding"
                            className="block flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelAddCategory}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={!newCategoryName.trim()}
                            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Title */}
                    <div>
                      <label
                        htmlFor="title"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Title <span className="text-red-500">*</span>
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
                        <p className="mt-1 text-sm text-red-600">
                          {errors.title}
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Tags
                      </label>
                      <div className="mt-1">
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

                        {suggestedTags.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500">
                              Suggestions:
                            </p>
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

                    {/* Date Picker */}
                    <div>
                      <label
                        htmlFor="timestamp"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Date
                      </label>
                      <input
                        type="datetime-local"
                        id="timestamp"
                        value={timestamp}
                        onChange={(e) => setTimestamp(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
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
                          placeholder="Where?"
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="duration"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Duration (min)
                        </label>
                        <input
                          type="number"
                          id="duration"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          placeholder="Minutes"
                          min="0"
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Description (optional) */}
                    <div>
                      <label
                        htmlFor="description"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Description
                      </label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder="What did you do? What happened?"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  /* ═══════════════════════════════════════════
                   * STEP 2: Reflections & Media
                   * All fields optional: Mood, Notes, Media Links, Photo placeholder
                   * ═══════════════════════════════════════════ */
                  <div className="space-y-4">
                    {/* Mood Selector */}
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
                        Notes
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

                    {/* Media Links (YouTube/Vimeo URLs) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Media Links
                      </label>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Add YouTube or Vimeo URLs
                      </p>
                      <div className="mt-1 flex gap-2">
                        <input
                          type="url"
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
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

                      {/* Added Media List */}
                      {mediaLinks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {mediaLinks.map((media, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                            >
                              <span className="truncate text-sm text-gray-700">
                                {media.url}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeMediaLink(index)}
                                className="ml-2 flex-shrink-0 text-red-500 hover:text-red-700"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/*
                     * Photo Upload Placeholder
                     *
                     * WHY THIS IS A PLACEHOLDER:
                     * Photo uploads require backend storage (e.g., Cloudflare R2, AWS S3)
                     * to handle file persistence, resizing, and delivery. This placeholder
                     * reserves the UI space and communicates intent to users while the
                     * backend infrastructure is being set up.
                     *
                     * TODO: Implement photo upload when backend/R2 storage is set up
                     * - Add file input with drag-and-drop support
                     * - Integrate with R2/S3 for storage
                     * - Add image preview thumbnails
                     * - Handle upload progress and errors
                     */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Photos
                      </label>
                      <div className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8">
                        {/* Greyed-out camera/image icon */}
                        <svg
                          className="h-10 w-10 text-gray-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-gray-400">
                          Photo upload coming soon
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Footer: Navigation Buttons ─── */}
            <div className="flex-shrink-0 border-t px-6 py-4">
              <div className="flex justify-between">
                {currentStep === 1 ? (
                  <>
                    {/* Step 1: Cancel (left) + Next (right) */}
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    {/*
                     * Next button is both visually greyed out AND non-functional
                     * when required fields (Activity Type + Title) aren't filled.
                     * This uses the disabled attribute for accessibility and the
                     * opacity/cursor styles for visual feedback.
                     */}
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!canProceedToStep2}
                      className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                        canProceedToStep2
                          ? 'bg-indigo-600 hover:bg-indigo-700'
                          : 'cursor-not-allowed bg-gray-300'
                      }`}
                    >
                      Next
                    </button>
                  </>
                ) : (
                  <>
                    {/* Step 2: Back (left) + Add Entry (right) */}
                    <button
                      type="button"
                      onClick={handleBack}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e)}
                      disabled={isSubmitting}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : 'Add Entry'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS keyframes for step transition animations */}
      <style>{`
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
