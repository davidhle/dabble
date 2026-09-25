/**
 * AddReflectionForm.tsx - Add A Dated Follow-Up Reflection To An Entry
 *
 * STAGE 1 (data model + basic functionality): a small form rendered inline
 * in EntryPanel.tsx that appends one Reflection (see types/Entry.ts) to an
 * existing entry. Deliberately separate from AddEntryForm.tsx - a
 * reflection belongs to its parent entry, so there's no title, category,
 * or multi-step flow. Mood and media links reuse the exact same
 * MoodPicker.tsx / MediaLinksInput.tsx components AddEntryForm uses.
 * Stage 2 will rework where this is shown, as part of a dedicated
 * full-sidebar entry view.
 *
 * DATE RANGE: writtenDate is backdatable, but can't be earlier than the
 * parent entry's own date (its endTimestamp if it spans multiple days,
 * otherwise its timestamp) - a reflection can't predate the thing it
 * reflects on - and can't be later than today.
 *
 * ADD VS. EDIT MODE: passing `reflection` pre-fills every field from it
 * and saves with that reflection's own id, so the caller can replace it in
 * place in `entry.reflections`. The same date range applies in both modes.
 */

import { useState } from 'react';
import { Entry, MediaLink, Reflection } from '../types/Entry';
import MoodPicker from './MoodPicker';
import MediaLinksInput from './MediaLinksInput';

/** An ISO timestamp's calendar date (YYYY-MM-DD) in the viewer's local timezone. */
function toLocalDateString(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

/**
 * The earliest allowed writtenDate for a reflection on `entry`, read back
 * the same way AddEntryForm.tsx's edit mode reads each field: endTimestamp
 * is stored at local midnight, and timestamp is local unless
 * hasTime === false (placeholder midnight UTC - see types/Entry.ts).
 */
function getMinReflectionDate(entry: Entry): string {
  if (entry.endTimestamp) {
    return toLocalDateString(new Date(entry.endTimestamp));
  }
  const start = new Date(entry.timestamp);
  return entry.hasTime === false
    ? start.toISOString().slice(0, 10)
    : toLocalDateString(start);
}

interface AddReflectionFormProps {
  entry: Entry;
  /** The reflection being edited - omit to add a new one. */
  reflection?: Reflection;
  /** Called with the new/edited reflection; the caller persists it onto `entry`. */
  onSave: (reflection: Reflection) => void;
  onCancel: () => void;
}

export default function AddReflectionForm({
  entry,
  reflection,
  onSave,
  onCancel,
}: AddReflectionFormProps) {
  const minDate = getMinReflectionDate(entry);
  const maxDate = toLocalDateString(new Date());

  // writtenDate is stored at midnight UTC, so its UTC date is the picked date.
  const [writtenDate, setWrittenDate] = useState(
    reflection ? reflection.writtenDate.slice(0, 10) : maxDate
  );
  const [moods, setMoods] = useState<string[]>(reflection?.mood ?? []);
  const [text, setText] = useState(reflection?.text ?? '');
  const [mediaLinks, setMediaLinks] = useState<MediaLink[]>(
    reflection?.mediaLinks ?? []
  );
  // Scopes the input ids to this form, since an edit form and the add
  // form for the same entry could otherwise share them.
  const idSuffix = reflection ? reflection.id : entry.id;
  const [errors, setErrors] = useState<{ writtenDate?: string; text?: string }>(
    {}
  );

  const validate = () => {
    const newErrors: typeof errors = {};
    // YYYY-MM-DD strings compare correctly as plain strings.
    if (!writtenDate) {
      newErrors.writtenDate = 'Pick the date this reflection was written.';
    } else if (writtenDate < minDate) {
      newErrors.writtenDate = `Can't be before the entry itself (${minDate}).`;
    } else if (writtenDate > maxDate) {
      newErrors.writtenDate = "Can't be in the future.";
    }
    if (!text.trim()) {
      newErrors.text = 'Write something for this reflection.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      id: reflection?.id ?? crypto.randomUUID(),
      // Placeholder midnight UTC, like an Entry with hasTime: false.
      writtenDate: new Date(`${writtenDate}T00:00:00Z`).toISOString(),
      text: text.trim(),
      // Omitted when empty, matching how AddEntryForm treats Entry.mood.
      mood: moods.length > 0 ? moods : undefined,
      mediaLinks: mediaLinks.length > 0 ? mediaLinks : undefined,
    });
  };

  const fieldClassName =
    'mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-[var(--text-color)] shadow-sm focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]';

  return (
    <div
      className="space-y-4 rounded-md border p-3"
      style={{ borderColor: 'var(--panel-border-color)' }}
    >
      <div>
        <label
          htmlFor={`reflection-date-${idSuffix}`}
          className="block text-sm font-medium text-[var(--text-secondary-color)]"
        >
          Written on
        </label>
        <input
          id={`reflection-date-${idSuffix}`}
          type="date"
          value={writtenDate}
          min={minDate}
          max={maxDate}
          onChange={e => setWrittenDate(e.target.value)}
          className={fieldClassName}
        />
        {errors.writtenDate && (
          <p className="mt-1 text-sm text-red-400">{errors.writtenDate}</p>
        )}
      </div>

      <MoodPicker moods={moods} onChange={setMoods} />

      <div>
        <label
          htmlFor={`reflection-text-${idSuffix}`}
          className="block text-sm font-medium text-[var(--text-secondary-color)]"
        >
          Reflection
        </label>
        <textarea
          id={`reflection-text-${idSuffix}`}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="Looking back, how do you feel about this now?"
          className={fieldClassName}
        />
        {errors.text && (
          <p className="mt-1 text-sm text-red-400">{errors.text}</p>
        )}
      </div>

      <MediaLinksInput mediaLinks={mediaLinks} onChange={setMediaLinks} />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-[var(--field-tint-2)] px-4 py-2 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground-color)] hover:brightness-90"
        >
          {reflection ? 'Save Changes' : 'Save Reflection'}
        </button>
      </div>
    </div>
  );
}
