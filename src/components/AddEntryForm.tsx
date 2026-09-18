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
 * - onUpdate: (entry: Entry) => void - Callback to replace an existing entry
 *   by id (from App via Layout) - see ADD VS. EDIT MODE below
 * - editingEntry?: Entry | null - When present, the form runs in edit mode
 *   instead of add mode - see ADD VS. EDIT MODE below
 *
 * ADD VS. EDIT MODE:
 * This ONE component (and its ONE modal instance in Layout.tsx) handles
 * both creating a brand-new entry and editing an existing one, rather than
 * a second near-duplicate form - the two only ever differ in three places:
 * (1) the `isOpen` effect below pre-fills every field from `editingEntry`
 * instead of resetting to blank/default values, (2) Step 2's final button
 * reads "Update Entry" instead of "Add Entry", and (3) handleSubmit calls
 * `onUpdate` with the ORIGINAL entry's id preserved instead of `onSubmit`
 * with a freshly minted one. Every other field, validation rule, and the
 * "+ Add new category" flow work identically in both modes, since they
 * never look at `editingEntry` at all - reclassifying an entry into a
 * brand-new category while editing it works exactly the way picking a
 * brand-new category for a new entry does.
 *
 * `isEditMode` (derived as `editingEntry != null`, computed once near the
 * top of the component) is the single source of truth those three spots
 * branch on, so add/edit can't drift out of sync with each other.
 *
 * THEMING: this modal used to be the one remaining light/white-mode surface
 * in an otherwise dark-themed app (see index.css :root's THEME TOKENS
 * comment) - a leftover from before the "night sky" theme existed. It now
 * uses the same tokens/conventions as the rest of the app: the modal card
 * itself is --panel-bg-color-solid (same opaque surface EntryPanel.tsx's
 * expanded panels use), borders are --panel-border-color, and every
 * input/select/textarea gets an explicit `bg-[var(--field-tint-1)]` - a
 * translucent lift off the modal's own background, the same convention
 * FilterBar.tsx/ResetButton.tsx already use for surfaces that need to read
 * as distinct from their own backing - so form fields stay clearly
 * identifiable as fields rather than blending into the modal behind them.
 * Labels/body text use the same --text-color/--text-secondary-color/
 * --text-muted-color scale EntryPanel.tsx uses (--text-color for headings,
 * the dimmer two for secondary/muted text) - see index.css's THEME TOKENS
 * comment for both themes' values; the CTA buttons (Next, Create, Add/
 * Update Entry), the step indicator's active badge, checkbox accents, and
 * every input/select/textarea's focus ring all use --accent-color/
 * --accent-foreground-color - the app's one shared primary-action accent
 * token (also Layout.tsx's + button, EditModeToggle, etc.) - rather than a
 * hardcoded indigo, so this modal inverts along with everything else
 * between themes. The Tags/Mood preview chips are the one deliberate
 * exception: those use --indigo-accent-text/--teal-accent-text instead,
 * matching EntryPanel.tsx's own saved-entry chips exactly (see each
 * chip's own comment below) - they're a data-identity color, not a
 * primary-action one, so they don't follow --accent-color either.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Entry,
  MediaLink,
  MediaType,
  COMMON_MOODS,
  SUGGESTED_TAGS,
  createEntry,
} from '../types/Entry';
import { Category, DEFAULT_CATEGORIES } from '../types/Category';
import {
  loadCategories,
  addCategory,
  deleteCategory,
  getCategoryName,
  previewCategoryColorOptions,
} from '../utils/categories';
import { COUNTRIES } from '../data/countries';

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
  /** Replaces an existing entry by id - see the ADD VS. EDIT MODE comment above. */
  onUpdate: (entry: Entry) => void;
  /**
   * Deletes an existing entry by id - see the DELETE ENTRY comment below.
   * Only ever called in edit mode; add mode has no entry to delete.
   */
  onDelete: (entryId: string) => void;
  /** The entry to prefill and edit, or null/undefined for plain add mode. */
  editingEntry?: Entry | null;
  /**
   * The full, unfiltered entries array (App.tsx's own `entries` state) -
   * needed only by the DELETE ENTRY flow below, to check whether the
   * entry being deleted is the last one in its category.
   */
  entries: Entry[];
}

interface FormErrors {
  title?: string;
  endDate?: string;
}

export default function AddEntryForm({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
  editingEntry,
  entries,
}: AddEntryFormProps) {
  // Single source of truth for every add/edit branch below - see the ADD
  // VS. EDIT MODE comment above.
  const isEditMode = editingEntry != null;
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
  // `newCategoryColorPreview` is whichever color is CURRENTLY selected -
  // the default (colorOptions[0]) until the user clicks a different swatch
  // in the override grid below, at which point it tracks that pick
  // instead. `colorOptions` is the fixed set of choices shown in that
  // grid: the next several colors in the golden-angle sequence (see
  // getCategoryColorOptions's own comment in utils/categories.ts) - a
  // small, distinct alternative-swatches picker, not an arbitrary
  // RGB/hex color input.
  const [newCategoryColorPreview, setNewCategoryColorPreview] = useState('');
  const [colorOptions, setColorOptions] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // ─── Date / optional time (see hasTime field comment in types/Entry.ts) ───
  // Date-only (YYYY-MM-DD, from an <input type="date">) - always shown and
  // always required to build a timestamp, whether or not a specific time
  // is also given.
  const [dateOnly, setDateOnly] = useState('');
  // Off by default: logging a past event usually means only the date is
  // known, so we don't force a time on the user. When on, `timeOnly`
  // (HH:MM, from an <input type="time">) combines with `dateOnly` to form
  // the full timestamp and hasTime is saved as true; when off, the
  // timestamp uses a placeholder midnight UTC and hasTime is saved as
  // false - see handleSubmit.
  const [hasSpecificTime, setHasSpecificTime] = useState(false);
  const [timeOnly, setTimeOnly] = useState('');

  // ─── Optional multi-day range (iCal-style) ───
  // Off by default - an entry is a single point in time unless the user
  // explicitly opts into a range. See the endTimestamp field comment in
  // types/Entry.ts for why this is optional and backward-compatible.
  // Independent of the hasSpecificTime toggle above - either can be on,
  // off, or both, without affecting the other's UI or state.
  const [isMultiDay, setIsMultiDay] = useState(false);
  // Date-only (YYYY-MM-DD, from an <input type="date">) - a multi-day span
  // is about which days it covers, not a time of day on the end date.
  const [endDate, setEndDate] = useState('');

  // ─── Structured location (country/city/place) ───
  // Three independent, optional plain-text fields rather than one
  // free-text "Location" input - see the EntryLocation comment in
  // types/Entry.ts for why (groundwork for future location-based entry
  // connections, without any geocoding/map API). Country is a dropdown
  // populated from the bundled static list in data/countries.ts; city and
  // place stay free-text since there's no bundled list for those.
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [place, setPlace] = useState('');
  const [duration, setDuration] = useState('');

  // ─── Step 2 Fields: Reflections & Media ───
  const [moods, setMoods] = useState<string[]>([]);
  // Free-text entry for a custom mood not covered by COMMON_MOODS' preset
  // chips - same "type + Enter/Add button" interaction as the Tags input
  // above, so a mood the user types is added to `moods` (and rendered
  // with the same selected-chip styling as a toggled preset) rather than
  // requiring a fixed vocabulary.
  const [moodInput, setMoodInput] = useState('');
  const [notes, setNotes] = useState('');
  const [mediaLinks, setMediaLinks] = useState<MediaLink[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');

  // ─── Form State ───
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Delete Confirmation State (edit mode only) ───
  // Whether the inline "are you sure?" confirmation step (see the DELETE
  // ENTRY comment below) is currently showing in place of the normal
  // form content. Only ever set true from edit mode's "Delete Entry"
  // button - add mode has no such button.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // ─── Transition direction for slide animation ───
  // 'forward' when going from Step 1 -> 2, 'backward' when going 2 -> 1
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>(
    'forward'
  );

  /**
   * Reset (add mode) or pre-fill (edit mode) the form when the modal
   * opens. Always starts at Step 1, whichever mode. `editingEntry` is in
   * the dependency list (not just `isOpen`) so re-prefilling still happens
   * correctly if the entry being edited changes while the modal stays
   * open - see the ADD VS. EDIT MODE comment at the top of this file.
   */
  useEffect(() => {
    if (!isOpen) return;

    setCurrentStep(1);
    setSlideDirection('forward');
    setIsAddingCategory(false);
    setNewCategoryName('');
    setTagInput('');
    setMoodInput('');
    setMediaUrl('');
    setErrors({});
    setIsConfirmingDelete(false);

    // Refresh the category list on every open (not just once on mount) so
    // a category created in an earlier session - or by mock data
    // generation - shows up without needing a page reload.
    const freshCategories = loadCategories();
    setCategories(freshCategories);

    if (editingEntry) {
      // ─── EDIT MODE: pre-fill every field from the entry being edited ───
      setActivityType(editingEntry.activityType);
      setTitle(editingEntry.title);
      setDescription(editingEntry.description);
      setTags(editingEntry.tags);
      setMoods(editingEntry.mood ?? []);
      setNotes(editingEntry.notes);
      setMediaLinks(editingEntry.mediaLinks);
      setDuration(
        editingEntry.duration != null ? String(editingEntry.duration) : ''
      );

      const location = editingEntry.location;
      if (location && typeof location === 'object') {
        setCountry(location.country ?? '');
        setCity(location.city ?? '');
        setPlace(location.place ?? '');
      } else {
        // Legacy plain-string location (see the BACKWARD COMPATIBILITY
        // comment on Entry.location in types/Entry.ts) - this form has no
        // single free-text location input to show it in as-is, so it's
        // carried into the free-text Place field rather than silently
        // dropped. Saving from here migrates it to the structured shape.
        setCountry('');
        setCity('');
        setPlace(location ?? '');
      }

      const start = new Date(editingEntry.timestamp);
      if (editingEntry.hasTime !== false) {
        // A real local time is known - format it back into the date/time
        // inputs in the viewer's own local timezone, the exact inverse of
        // how handleSubmit below builds `timestamp` from them.
        const localIso = new Date(
          start.getTime() - start.getTimezoneOffset() * 60000
        ).toISOString();
        setDateOnly(localIso.slice(0, 10));
        setTimeOnly(localIso.slice(11, 16));
        setHasSpecificTime(true);
      } else {
        // Placeholder-midnight-UTC entry (hasTime: false) - read the date
        // back in UTC, same as formatEntryDate.ts does, so it doesn't
        // shift a day for anyone west of UTC.
        setDateOnly(start.toISOString().slice(0, 10));
        setTimeOnly('');
        setHasSpecificTime(false);
      }

      if (editingEntry.endTimestamp) {
        setIsMultiDay(true);
        setEndDate(
          new Date(editingEntry.endTimestamp).toISOString().slice(0, 10)
        );
      } else {
        setIsMultiDay(false);
        setEndDate('');
      }
    } else {
      // ─── ADD MODE: blank form, defaulting the date/time to now ───
      setActivityType(freshCategories[0]?.id ?? DEFAULT_CATEGORIES[0].id);
      setTitle('');
      setDescription('');
      setTags([]);
      setMoods([]);
      setMediaLinks([]);
      setCountry('');
      setCity('');
      setPlace('');
      setDuration('');
      setNotes('');

      const now = new Date();
      const localIso = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
      ).toISOString();
      setDateOnly(localIso.slice(0, 10));
      // Prefilled so flipping "Add specific time" on starts from the
      // current time rather than an empty input.
      setTimeOnly(localIso.slice(11, 16));
      setHasSpecificTime(false);
      setIsMultiDay(false);
      setEndDate('');
    }
  }, [isOpen, editingEntry]);

  const suggestedTags = SUGGESTED_TAGS[activityType] || [];

  const isEndDateBeforeStart =
    isMultiDay && endDate !== '' && endDate < dateOnly;

  /**
   * Determines if the user can proceed from Step 1 to Step 2.
   * Activity Type always has a value (see DYNAMIC CATEGORIES comment
   * above), so Title and (when a range is enabled) a valid end date are
   * the only checks needed here.
   */
  const canProceedToStep2 = title.trim().length > 0 && !isEndDateBeforeStart;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (isEndDateBeforeStart) {
      newErrors.endDate = 'End date cannot be before the start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Toggles the "This spans multiple days" checkbox. Enabling it defaults
   * the end date to the same day as the start date (iCal-style); disabling
   * it clears endDate so a stale value can't linger if the user re-enables
   * the toggle later.
   */
  const handleToggleMultiDay = () => {
    const next = !isMultiDay;
    setIsMultiDay(next);
    setEndDate(next ? dateOnly : '');
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
      // colorOptions[0] is always the same default previewNextCategoryColor()
      // would return - computing both from one call keeps the single
      // preview swatch and the grid's first cell in sync by construction.
      const options = previewCategoryColorOptions(6);
      setColorOptions(options);
      setNewCategoryColorPreview(options[0]);
      setIsAddingCategory(true);
      return;
    }
    setActivityType(value);
  };

  /**
   * Confirms the inline "add new category" sub-form: persists a real
   * category via addCategory (assigning it whichever color is currently
   * selected - the default suggestion, or a swatch the user overrode it
   * with), then immediately selects it as this entry's activityType and
   * closes the sub-form. A blank/whitespace-only name is ignored rather
   * than creating an empty category.
   */
  const handleCreateCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    const newCategory = addCategory(trimmedName, newCategoryColorPreview);
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

    // Only set when at least one of the three fields is filled in - see
    // the EntryLocation comment in types/Entry.ts. Omitting empty
    // strings (rather than storing them as "") keeps
    // utils/formatLocation.ts's "which pieces are present" check simple.
    const trimmedCountry = country.trim();
    const trimmedCity = city.trim();
    const trimmedPlace = place.trim();
    const hasLocation = trimmedCountry || trimmedCity || trimmedPlace;

    // When "Add specific time" is off, `timeOnly` isn't meaningful, so we
    // fall back to a placeholder midnight UTC - a timestamp needs some
    // time value, but hasTime: false tells every display (see
    // formatEntryDate.ts) not to show it. When on, the date and time
    // combine as local time, matching the old datetime-local input's
    // behavior. Falls back to "now" if `dateOnly` was somehow cleared,
    // the same default createEntry itself would apply - computed as a
    // definite string (not left to createEntry) so edit mode's directly-
    // constructed Entry below satisfies its required `timestamp: string`
    // just as reliably as add mode's does.
    const timestamp = dateOnly
      ? hasSpecificTime
        ? new Date(`${dateOnly}T${timeOnly || '00:00'}`).toISOString()
        : new Date(`${dateOnly}T00:00:00Z`).toISOString()
      : new Date().toISOString();

    // Shared by both modes - see the ADD VS. EDIT MODE comment at the top
    // of this file. Only `id` (and, in edit mode, `dateDisplay` - see
    // below) differ between the two.
    const entryFields = {
      activityType,
      title: title.trim(),
      description: description.trim(),
      tags,
      mediaLinks,
      location: hasLocation
        ? {
            ...(trimmedCountry ? { country: trimmedCountry } : {}),
            ...(trimmedCity ? { city: trimmedCity } : {}),
            ...(trimmedPlace ? { place: trimmedPlace } : {}),
          }
        : undefined,
      duration: duration ? parseInt(duration, 10) : undefined,
      notes: notes.trim(),
      mood: moods.length > 0 ? moods : undefined,
      timestamp,
      hasTime: hasSpecificTime,
      // Only set when the user opted into a range via the "This spans
      // multiple days" toggle - see the endTimestamp field comment in
      // types/Entry.ts for why this stays undefined otherwise.
      endTimestamp:
        isMultiDay && endDate
          ? new Date(`${endDate}T00:00:00`).toISOString()
          : undefined,
    };

    if (isEditMode && editingEntry) {
      // EDIT MODE: replace-by-id via onUpdate, rather than createEntry's
      // "mint a brand-new id" behavior - see updateEntry's own comment in
      // App.tsx for why that's what turns this into a replace instead of
      // an append. `dateDisplay` is carried over unchanged since this form
      // has no field to edit or clear it (see its comment in
      // types/Entry.ts) - without this it would silently disappear from
      // any entry that had one the moment it was edited.
      onUpdate({
        ...entryFields,
        id: editingEntry.id,
        dateDisplay: editingEntry.dateDisplay,
      });
    } else {
      onSubmit(createEntry(entryFields));
    }

    resetForm();
    setIsSubmitting(false);
    onClose();
  };

  // useCallback (not a plain function) so handleCancel below - and in
  // turn the ESCAPE-TO-CANCEL effect further down, which needs a stable
  // reference to correctly depend on it - doesn't get a new function
  // identity, and re-attach its window listener, on every render.
  const resetForm = useCallback(() => {
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
    setMoodInput('');
    setMediaLinks([]);
    setCountry('');
    setCity('');
    setPlace('');
    setDuration('');
    setNotes('');
    setDateOnly('');
    setHasSpecificTime(false);
    setTimeOnly('');
    setIsMultiDay(false);
    setEndDate('');
    setMediaUrl('');
    setErrors({});
  }, [categories]);

  const handleCancel = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  /**
   * ─── DELETE ENTRY (edit mode only) ───
   *
   * Edit mode's footer replaces the "Cancel" button (which add mode keeps
   * as-is) with a "Delete Entry" button - see the footer JSX below. That
   * button doesn't delete immediately; it flips `isConfirmingDelete` on,
   * which swaps the modal's content/footer over to an inline two-step
   * confirmation (see the JSX further down) rather than a native
   * `window.confirm()`, matching the rest of this app's own modal-native
   * confirmation UI instead of a browser-chrome dialog.
   *
   * ORPHANED-CATEGORY CASCADE CHECK - WHY EDIT MODE ONLY:
   * Deleting an entry can leave its category with zero remaining entries.
   * Add mode never deletes anything - there's no entry to check here at
   * all - so this cascade only ever needs to exist on the edit-mode path,
   * and is written as a plain derived value (not stored state) gated on
   * `isEditMode`/`editingEntry` rather than a separate function called
   * from add mode's code path, which doesn't exist. The check itself
   * counts how many entries in the FULL `entries` array (not just this
   * modal's own form fields) share `editingEntry.activityType`, excluding
   * `editingEntry` itself (the one about to be removed) - if that count
   * is zero, this entry is the category's last one, and deleting it needs
   * to take the category down with it so the category list never keeps
   * around an empty, unusable category nobody can see any entries for.
   * The confirmation step below surfaces this to the user BEFORE they
   * confirm (so deleting a category is never a surprise), and
   * handleConfirmDelete actually performs the cascade below.
   */
  const isLastEntryInCategory =
    isEditMode &&
    editingEntry != null &&
    entries.every(
      entry =>
        entry.id === editingEntry.id ||
        entry.activityType !== editingEntry.activityType
    );

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  /** Backs out of the confirmation step ("Keep Entry"), returning to the normal edit form. */
  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  const handleConfirmDelete = () => {
    if (!editingEntry) return;

    // See the ORPHANED-CATEGORY CASCADE CHECK comment above - this is the
    // one place that check's result is actually acted on, rather than
    // just displayed.
    if (isLastEntryInCategory) {
      deleteCategory(editingEntry.activityType);
    }

    onDelete(editingEntry.id);
    resetForm();
    setIsConfirmingDelete(false);
    onClose();
  };

  // ─── ESCAPE-TO-CANCEL ───
  //
  // Pressing Escape while this modal is open should just cancel it (same
  // as clicking Cancel/×) - and do NOTHING else. Left alone, it wouldn't:
  // EntrySelectionContext.tsx's own Escape handling (collapse an expanded
  // sidebar panel, or the two-press full canvas reset) is a plain
  // BUBBLE-phase `window.addEventListener('keydown', ...)`, registered as
  // soon as its provider mounts - which is well before this modal ever
  // opens, since that provider wraps the page sitting BEHIND it. A second
  // bubble-phase listener registered here, on the same `window` target,
  // would run AFTER that earlier one in a plain keydown - too late to stop
  // it via `stopPropagation()` (which only blocks propagation to nodes/
  // phases still ahead of it, not other listeners already invoked on the
  // very same node) - so Escape would still collapse a panel or advance
  // the reset countdown UNDERNEATH this modal while also (or instead of)
  // closing it.
  //
  // Registering this listener in the CAPTURE phase (the `true` 3rd arg)
  // sidesteps that: capture-phase listeners on `window` always fire
  // before ANY bubble-phase listener anywhere in the tree - including
  // that other bubble-phase listener also on `window` - regardless of
  // which was registered first. Calling `stopPropagation()` here during
  // capture halts the event before it ever reaches the bubble phase, so
  // that other handler never runs at all while this modal is open.
  //
  // ONE exception: while the inline "add new category" sub-form's own
  // name input has focus, Escape should cancel just THAT sub-form (see
  // its own `onKeyDown` above), not the whole modal - this effect
  // deliberately ignores Escape when the event's target is that specific
  // input, letting it fall through to that input's own (bubble-phase)
  // handler instead, which stops propagation itself once it's done.
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if ((event.target as HTMLElement | null)?.id === 'newCategoryName') {
        return;
      }

      event.stopPropagation();
      handleCancel();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, handleCancel]);

  // ─── Tag Management ───

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
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
      setMoods(moods.filter(m => m !== mood));
    } else {
      setMoods([...moods, mood]);
    }
  };

  // Mirrors addTag's shape exactly (trim, ignore blank/duplicate, clear the
  // input) so a custom mood is added with the same interaction as a tag -
  // the one difference is moods aren't lowercased, since (unlike tags)
  // they're displayed back to the user as typed ("Excited", not
  // "excited") to match COMMON_MOODS' own capitalized presets.
  const addMood = (mood: string) => {
    const trimmedMood = mood.trim();
    if (trimmedMood && !moods.includes(trimmedMood)) {
      setMoods([...moods, trimmedMood]);
    }
    setMoodInput('');
  };

  const handleMoodInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMood(moodInput);
    }
  };

  // ─── Media Link Management ───
  //
  // INVESTIGATION NOTE (media links "not appearing" after submit): tracing
  // this end to end - addMediaLink below pushes onto `mediaLinks` state,
  // handleSubmit passes that same array straight into createEntry's
  // `mediaLinks` field with no transformation, and entriesStorage.ts's
  // saveEntries just JSON.stringifies the whole entry - confirms a media
  // link added here (via the "Add" button) DOES reach localStorage intact.
  // The actual bug was downstream: EntryPanel.tsx (the shared sidebar
  // panel Constellation.tsx/Timeline.tsx both render) had no Media Links
  // section at all, so a correctly-saved link had nowhere to display - see
  // EntryPanel.tsx's own comment on its new Media Links section.

  const addMediaLink = () => {
    if (mediaUrl.trim()) {
      const newMedia: MediaLink = {
        // Was `'Video' as any` - an `any` escape hatch that happened to
        // match MediaType.Video's runtime value regardless of the actual
        // URL's platform (an Instagram or TikTok link would still be
        // stored typed as "Video"). Using the enum member directly fixes
        // the type-checking bypass; getMediaLinkLabel in
        // utils/mediaLinks.ts (used by EntryPanel.tsx's display) derives
        // the platform label from the URL's own hostname instead of
        // trusting this field, since this form has no per-platform input
        // to set it accurately anyway.
        type: MediaType.Video,
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
     *
     * NO onClick HERE (deliberately): clicking the dark overlay outside
     * the card does NOT close the form - only Escape (see the ESCAPE-TO-
     * CANCEL effect above), the header's × button, or a Cancel button
     * do. This prevents an accidental stray click outside the card from
     * silently discarding an in-progress add/edit. The inner card below
     * still calls `e.stopPropagation()` on its own clicks - now mostly
     * defensive (there's no longer a backdrop handler for a click to
     * reach), but harmless to keep, and it'd matter again if this
     * overlay ever gained its own click behavior in the future.
     */
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
      <div className="flex h-full items-center justify-center p-4">
        <div
          className="flex w-[90vw] max-w-[500px] flex-col rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] shadow-xl"
          style={{ maxHeight: '60vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* ─── Modal Header with Step Indicator ─── */}
          <div className="flex-shrink-0 border-b border-[var(--panel-border-color)] px-6 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-color)]">
                {isConfirmingDelete
                  ? 'Delete Entry?'
                  : currentStep === 1
                    ? 'Activity Details'
                    : 'Reflections & Media'}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-[var(--text-muted-color)] hover:text-[var(--text-secondary-color)]"
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

            {/* Step Indicator - hidden during the delete confirmation step, which isn't part of either step. */}
            {!isConfirmingDelete && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      currentStep === 1
                        ? 'bg-[var(--accent-color)] text-[var(--accent-foreground-color)]'
                        : 'text-[var(--accent-color)]'
                    }`}
                    style={
                      currentStep === 1
                        ? undefined
                        : {
                            backgroundColor:
                              'color-mix(in srgb, var(--accent-color) 20%, transparent)',
                          }
                    }
                  >
                    1
                  </div>
                  <span
                    className={`text-xs ${
                      currentStep === 1
                        ? 'font-medium text-[var(--text-color)]'
                        : 'text-[var(--text-muted-color)]'
                    }`}
                  >
                    Details
                  </span>
                </div>
                <div className="h-px flex-1 bg-[var(--field-tint-2)]" />
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      currentStep === 2
                        ? 'bg-[var(--accent-color)] text-[var(--accent-foreground-color)]'
                        : 'bg-[var(--field-tint-2)] text-[var(--text-muted-color)]'
                    }`}
                  >
                    2
                  </div>
                  <span
                    className={`text-xs ${
                      currentStep === 2
                        ? 'font-medium text-[var(--text-color)]'
                        : 'text-[var(--text-muted-color)]'
                    }`}
                  >
                    Reflections
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ─── Scrollable Form Content ─── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/*
             * dark-scrollbar (see index.css): reuses the exact same
             * scrollbar treatment SidebarPanelStack.tsx's own
             * `overflow-y-auto` container already uses - a transparent
             * scrollbar TRACK (the browser default white one clashes
             * with the dark theme) with a subtle, still-visible THUMB -
             * rather than a second copy of that rule for this modal's
             * own scrolling Step 1/Step 2 content. Keeps every
             * scrollable container in the app's dark theme looking
             * consistent.
             */}
            <div className="dark-scrollbar flex-1 overflow-y-auto px-6 py-4">
              {isConfirmingDelete && editingEntry ? (
                /* ═══════════════════════════════════════════
                 * DELETE CONFIRMATION STEP (edit mode only)
                 * Inline, modal-native confirmation - see the DELETE
                 * ENTRY comment above handleDeleteClick for why this
                 * exists instead of a native confirm() dialog, and why
                 * the orphaned-category warning below only ever applies
                 * in edit mode.
                 * ═══════════════════════════════════════════ */
                <div className="space-y-4">
                  <div
                    className="rounded-md border p-4"
                    style={{
                      borderColor:
                        'color-mix(in srgb, #ef4444 40%, transparent)',
                      backgroundColor:
                        'color-mix(in srgb, #ef4444 10%, transparent)',
                    }}
                  >
                    <p className="text-sm font-medium text-red-400">
                      This will permanently delete "{editingEntry.title}".
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary-color)]">
                      This action cannot be undone.
                    </p>
                    {isLastEntryInCategory && (
                      <p className="mt-3 text-sm font-medium text-red-400">
                        This is the last entry in{' '}
                        {getCategoryName(editingEntry.activityType)} - deleting
                        it will also remove this category.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
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
                          className="block text-sm font-medium text-[var(--text-secondary-color)]"
                        >
                          Activity Type <span className="text-red-400">*</span>
                        </label>
                        <select
                          id="activityType"
                          value={activityType}
                          onChange={e =>
                            handleActivityTypeChange(e.target.value)
                          }
                          className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                        >
                          {categories.map(category => (
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
                        <div
                          className="rounded-md border p-3"
                          style={{
                            borderColor:
                              'color-mix(in srgb, var(--accent-color) 30%, transparent)',
                            backgroundColor:
                              'color-mix(in srgb, var(--accent-color) 10%, transparent)',
                          }}
                        >
                          <label
                            htmlFor="newCategoryName"
                            className="block text-sm font-medium text-[var(--text-secondary-color)]"
                          >
                            New category name
                          </label>
                          <div className="mt-1 flex items-center gap-2">
                            {/* Color swatch preview - the color this category
                              will be assigned, shown before it's created. */}
                            <span
                              className="h-6 w-6 flex-shrink-0 rounded-full border border-[var(--field-border-strong)]"
                              style={{
                                backgroundColor: newCategoryColorPreview,
                              }}
                              aria-hidden="true"
                            />
                            <input
                              type="text"
                              id="newCategoryName"
                              autoFocus
                              value={newCategoryName}
                              onChange={e => setNewCategoryName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateCategory();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  // stopPropagation (not just preventDefault) -
                                  // this Escape is scoped to cancelling ONLY
                                  // this sub-form. Without it, the event would
                                  // still bubble up into the ESCAPE-TO-CANCEL
                                  // effect below/EntrySelectionContext.tsx's
                                  // own window listener and additionally close
                                  // the whole modal (or reach past it into the
                                  // canvas's reset logic), instead of just
                                  // collapsing this one inline form back down.
                                  e.stopPropagation();
                                  handleCancelAddCategory();
                                }
                              }}
                              placeholder="e.g., Pottery, Skateboarding"
                              className="block flex-1 rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                            />
                          </div>

                          {/*
                           * Manual color override: a small grid of the next
                           * few colors in the golden-angle sequence (see
                           * getCategoryColorOptions in utils/categories.ts),
                           * not an arbitrary RGB/hex picker - clicking one
                           * just swaps which procedurally-generated color is
                           * selected. The swatch preview above always
                           * reflects the current pick, so this grid's
                           * highlighted cell and that preview never disagree.
                           */}
                          {colorOptions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {colorOptions.map(colorOption => (
                                <button
                                  key={colorOption}
                                  type="button"
                                  onClick={() =>
                                    setNewCategoryColorPreview(colorOption)
                                  }
                                  aria-label={`Use color ${colorOption}`}
                                  aria-pressed={
                                    newCategoryColorPreview === colorOption
                                  }
                                  className="h-6 w-6 flex-shrink-0 rounded-full border-2 transition-transform hover:scale-110"
                                  style={{
                                    backgroundColor: colorOption,
                                    borderColor:
                                      newCategoryColorPreview === colorOption
                                        ? 'var(--text-color)'
                                        : 'transparent',
                                  }}
                                />
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleCancelAddCategory}
                              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text-muted-color)] hover:bg-[var(--field-tint-2)]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleCreateCategory}
                              disabled={!newCategoryName.trim()}
                              className="rounded-md bg-[var(--accent-color)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground-color)] hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="block text-sm font-medium text-[var(--text-secondary-color)]"
                        >
                          Title <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="title"
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          placeholder="Brief summary of your activity"
                          className={`mt-1 block w-full rounded-md border bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:outline-none focus:ring-1 ${
                            errors.title
                              ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                              : 'border-[var(--panel-border-color)] focus:border-[var(--accent-color)] focus:ring-[var(--accent-color)]'
                          }`}
                        />
                        {errors.title && (
                          <p className="mt-1 text-sm text-red-400">
                            {errors.title}
                          </p>
                        )}
                      </div>

                      {/* Tags */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-color)]">
                          Tags
                        </label>
                        <div className="mt-1">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tagInput}
                              onChange={e => setTagInput(e.target.value)}
                              onKeyDown={handleTagInputKeyDown}
                              placeholder="Add tags (press Enter)"
                              className="block flex-1 rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                            />
                            <button
                              type="button"
                              onClick={() => addTag(tagInput)}
                              className="rounded-md bg-[var(--field-tint-2)] px-4 py-2 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]"
                            >
                              Add
                            </button>
                          </div>

                          {tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {tags.map(tag => (
                                <span
                                  key={tag}
                                  // Same bg-indigo-400/20 + text-[var(--indigo-
                                  // accent-text)] pill EntryPanel.tsx uses for
                                  // this exact entry's tags once saved, so the
                                  // preview while composing already looks like
                                  // the real thing. --indigo-accent-text (not
                                  // --accent-color) deliberately - this is the
                                  // app's informational "tag" identity, kept
                                  // separate from the primary-action accent -
                                  // see index.css's own comment on that token.
                                  className="inline-flex items-center rounded-full bg-indigo-400/20 px-3 py-1 text-sm font-medium text-[var(--indigo-accent-text)]"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    className="ml-1 text-[var(--indigo-accent-text)] hover:opacity-80"
                                  >
                                    &times;
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {suggestedTags.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-[var(--text-muted-color)]">
                                Suggestions:
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {suggestedTags
                                  .filter(tag => !tags.includes(tag))
                                  .slice(0, 6)
                                  .map(tag => (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => addTag(tag)}
                                      className="rounded-full border border-[var(--field-border-strong)] px-2 py-0.5 text-xs text-[var(--text-muted-color)] hover:bg-[var(--field-tint-2)]"
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
                          htmlFor="dateOnly"
                          className="block text-sm font-medium text-[var(--text-secondary-color)]"
                        >
                          Date
                        </label>
                        <input
                          type="date"
                          id="dateOnly"
                          value={dateOnly}
                          onChange={e => setDateOnly(e.target.value)}
                          className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                        />

                        {/*
                         * Optional specific time - off by default, since
                         * logging a past event usually means only the date
                         * is known. See the hasTime field comment in
                         * types/Entry.ts. Independent of the "This spans
                         * multiple days" toggle below - each renders its own
                         * checkbox + conditional input, so neither's UI
                         * affects the other's.
                         */}
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="hasSpecificTime"
                            checked={hasSpecificTime}
                            onChange={e => setHasSpecificTime(e.target.checked)}
                            className="h-4 w-4 rounded border-[var(--field-border-strong)] bg-[var(--field-tint-1)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                          />
                          <label
                            htmlFor="hasSpecificTime"
                            className="text-sm text-[var(--text-muted-color)]"
                          >
                            Add specific time
                          </label>
                        </div>

                        {hasSpecificTime && (
                          <div className="mt-2">
                            <label
                              htmlFor="timeOnly"
                              className="block text-sm font-medium text-[var(--text-secondary-color)]"
                            >
                              Time
                            </label>
                            <input
                              type="time"
                              id="timeOnly"
                              value={timeOnly}
                              onChange={e => setTimeOnly(e.target.value)}
                              className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                            />
                          </div>
                        )}

                        {/*
                         * Optional multi-day range, iCal-style: off by
                         * default (entry stays a single point in time), and
                         * only reveals an end date picker when checked. See
                         * the endTimestamp field comment in types/Entry.ts.
                         */}
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="isMultiDay"
                            checked={isMultiDay}
                            onChange={handleToggleMultiDay}
                            className="h-4 w-4 rounded border-[var(--field-border-strong)] bg-[var(--field-tint-1)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                          />
                          <label
                            htmlFor="isMultiDay"
                            className="text-sm text-[var(--text-muted-color)]"
                          >
                            This spans multiple days
                          </label>
                        </div>

                        {isMultiDay && (
                          <div className="mt-2">
                            <label
                              htmlFor="endDate"
                              className="block text-sm font-medium text-[var(--text-secondary-color)]"
                            >
                              End date
                            </label>
                            <input
                              type="date"
                              id="endDate"
                              value={endDate}
                              onChange={e => setEndDate(e.target.value)}
                              className={`mt-1 block w-full rounded-md border bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:outline-none focus:ring-1 ${
                                errors.endDate || isEndDateBeforeStart
                                  ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                                  : 'border-[var(--panel-border-color)] focus:border-[var(--accent-color)] focus:ring-[var(--accent-color)]'
                              }`}
                            />
                            {(errors.endDate || isEndDateBeforeStart) && (
                              <p className="mt-1 text-sm text-red-400">
                                {errors.endDate ||
                                  'End date cannot be before the start date'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/*
                       * Structured location: three independent optional
                       * fields (Country dropdown, City/Place free-text)
                       * instead of one "Location" text input - see the
                       * EntryLocation comment in types/Entry.ts. Country
                       * gets a bundled static dropdown (data/countries.ts);
                       * City and Place stay free-text since there's no
                       * bundled list for those.
                       */}
                      <div>
                        <label
                          htmlFor="country"
                          className="block text-sm font-medium text-[var(--text-secondary-color)]"
                        >
                          Country
                        </label>
                        <select
                          id="country"
                          value={country}
                          onChange={e => setCountry(e.target.value)}
                          className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                        >
                          <option value="">Select a country</option>
                          {COUNTRIES.map(countryName => (
                            <option key={countryName} value={countryName}>
                              {countryName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="city"
                            className="block text-sm font-medium text-[var(--text-secondary-color)]"
                          >
                            City (optional)
                          </label>
                          <input
                            type="text"
                            id="city"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            placeholder="e.g., Paris"
                            className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="place"
                            className="block text-sm font-medium text-[var(--text-secondary-color)]"
                          >
                            Place or venue (optional)
                          </label>
                          <input
                            type="text"
                            id="place"
                            value={place}
                            onChange={e => setPlace(e.target.value)}
                            placeholder="e.g., Djoon Club"
                            className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                          />
                        </div>
                      </div>

                      {/* Duration */}
                      <div>
                        <label
                          htmlFor="duration"
                          className="block text-sm font-medium text-[var(--text-secondary-color)]"
                        >
                          Duration (min)
                        </label>
                        <input
                          type="number"
                          id="duration"
                          value={duration}
                          onChange={e => setDuration(e.target.value)}
                          placeholder="Minutes"
                          min="0"
                          className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                        />
                      </div>

                      {/* Description (optional) */}
                      <div>
                        <label
                          htmlFor="description"
                          className="block text-sm font-medium text-[var(--text-secondary-color)]"
                        >
                          Description
                        </label>
                        <textarea
                          id="description"
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          rows={3}
                          placeholder="What did you do? What happened?"
                          className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:outline-none focus:ring-1 focus:border-[var(--accent-color)] focus:ring-[var(--accent-color)]"
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
                        <label className="block text-sm font-medium text-[var(--text-secondary-color)]">
                          Mood
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {COMMON_MOODS.map(mood => (
                            <button
                              key={mood}
                              type="button"
                              onClick={() => toggleMood(mood)}
                              // bg-teal-400/20 + text-[var(--teal-accent-text)]
                              // (not --accent-color) deliberately - the same
                              // Mood pill EntryPanel.tsx uses for this exact
                              // entry's moods once saved (see its own
                              // comment), so the preview while composing
                              // already looks like the real thing, and Mood
                              // stays visually distinct from a plain
                              // primary-action control.
                              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                                moods.includes(mood)
                                  ? 'bg-teal-400/20 text-[var(--teal-accent-text)]'
                                  : 'bg-[var(--field-tint-2)] text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]'
                              }`}
                            >
                              {mood}
                            </button>
                          ))}
                          {/*
                           * Custom (non-preset) moods the user has typed in
                           * below - rendered with the exact same selected-
                           * chip classNames as a toggled COMMON_MOODS button
                           * above, and removed the same way (click to
                           * toggle off via the shared toggleMood), so a
                           * custom mood is visually and behaviorally
                           * indistinguishable from a preset one once added.
                           */}
                          {moods
                            .filter(mood => !COMMON_MOODS.includes(mood))
                            .map(mood => (
                              <button
                                key={mood}
                                type="button"
                                onClick={() => toggleMood(mood)}
                                className="rounded-full bg-teal-400/20 px-3 py-1 text-sm font-medium text-[var(--teal-accent-text)] transition-colors"
                              >
                                {mood}
                              </button>
                            ))}
                        </div>

                        {/*
                         * Custom mood text input - same interaction pattern
                         * as the Tags input on Step 1 (type + Enter, or
                         * click Add) rather than a separate "Other" field,
                         * so a mood not covered by the preset chips above
                         * is just as quick to add as a tag is.
                         */}
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={moodInput}
                            onChange={e => setMoodInput(e.target.value)}
                            onKeyDown={handleMoodInputKeyDown}
                            placeholder="Add a custom mood (press Enter)"
                            className="block flex-1 rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                          />
                          <button
                            type="button"
                            onClick={() => addMood(moodInput)}
                            className="rounded-md bg-[var(--field-tint-2)] px-4 py-2 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label
                          htmlFor="notes"
                          className="block text-sm font-medium text-[var(--text-secondary-color)]"
                        >
                          Notes
                        </label>
                        <textarea
                          id="notes"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          rows={3}
                          placeholder="What did you learn? How do you feel about it?"
                          className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                        />
                      </div>

                      {/* Media Links (YouTube/Vimeo URLs) */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary-color)]">
                          Media Links
                        </label>
                        <p className="mt-0.5 text-xs text-[var(--text-muted-color)]">
                          Add a link - YouTube, Vimeo, Instagram, etc.
                        </p>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="url"
                            value={mediaUrl}
                            onChange={e => setMediaUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="block flex-1 rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                          />
                          <button
                            type="button"
                            onClick={addMediaLink}
                            disabled={!mediaUrl.trim()}
                            className="rounded-md bg-[var(--field-tint-2)] px-4 py-2 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)] disabled:cursor-not-allowed disabled:opacity-50"
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
                                className="flex items-center justify-between rounded-md bg-[var(--field-tint-1)] px-3 py-2"
                              >
                                <span className="truncate text-sm text-[var(--text-secondary-color)]">
                                  {media.url}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeMediaLink(index)}
                                  className="ml-2 flex-shrink-0 text-red-400 hover:text-red-300"
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
                        <label className="block text-sm font-medium text-[var(--text-secondary-color)]">
                          Photos
                        </label>
                        <div className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--field-border-strong)] bg-[var(--field-tint-1)] px-6 py-8">
                          {/* Greyed-out camera/image icon */}
                          <svg
                            className="h-10 w-10 text-[var(--text-muted-color)]"
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
                          <p className="mt-2 text-sm text-[var(--text-muted-color)]">
                            Photo upload coming soon
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── Footer: Navigation Buttons ─── */}
            <div className="flex-shrink-0 border-t border-[var(--panel-border-color)] px-6 py-4">
              <div className="flex justify-between">
                {isConfirmingDelete ? (
                  <>
                    {/*
                     * Delete confirmation footer: "Keep Entry" (left) backs
                     * out to the normal edit form without deleting
                     * anything; "Confirm Delete" (right) actually performs
                     * the delete (and, per handleConfirmDelete, the
                     * orphaned-category cascade alongside it).
                     */}
                    <button
                      type="button"
                      onClick={handleCancelDelete}
                      className="rounded-md border border-[var(--panel-border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-1)]"
                    >
                      Keep Entry
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:brightness-90"
                    >
                      Confirm Delete
                    </button>
                  </>
                ) : currentStep === 1 ? (
                  <>
                    {/*
                     * Step 1, left button: edit mode replaces "Cancel"
                     * with "Delete Entry" - see the DELETE ENTRY comment
                     * above handleDeleteClick. Add mode keeps plain
                     * Cancel, unchanged.
                     */}
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={handleDeleteClick}
                        className="rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
                      >
                        Delete Entry
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="rounded-md border border-[var(--panel-border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-1)]"
                      >
                        Cancel
                      </button>
                    )}
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
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        canProceedToStep2
                          ? 'bg-[var(--accent-color)] text-[var(--accent-foreground-color)] hover:brightness-90'
                          : 'cursor-not-allowed bg-[var(--field-tint-2)] text-[var(--text-muted-color)]'
                      }`}
                    >
                      Next
                    </button>
                  </>
                ) : (
                  <>
                    {/* Step 2: Back (left) + Add/Update Entry (right) */}
                    <button
                      type="button"
                      onClick={handleBack}
                      className="rounded-md border border-[var(--panel-border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-1)]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={e => handleSubmit(e)}
                      disabled={isSubmitting}
                      className="rounded-md bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground-color)] hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting
                        ? isEditMode
                          ? 'Updating...'
                          : 'Saving...'
                        : isEditMode
                          ? 'Update Entry'
                          : 'Add Entry'}
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
