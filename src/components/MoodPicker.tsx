/**
 * MoodPicker.tsx - Shared Mood Selector
 *
 * Extracted verbatim from AddEntryForm.tsx's Step 2 so AddReflectionForm.tsx
 * can reuse the exact same picker (preset COMMON_MOODS chips + custom mood
 * input) instead of a second copy that could drift out of sync. The
 * selected `moods` array is controlled by the parent; only the in-progress
 * custom mood text lives here, since nothing outside needs it.
 */

import { useState } from 'react';
import { COMMON_MOODS } from '../types/Entry';

interface MoodPickerProps {
  moods: string[];
  onChange: (moods: string[]) => void;
}

export default function MoodPicker({ moods, onChange }: MoodPickerProps) {
  const [moodInput, setMoodInput] = useState('');

  const toggleMood = (mood: string) => {
    if (moods.includes(mood)) {
      onChange(moods.filter(m => m !== mood));
    } else {
      onChange([...moods, mood]);
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
      onChange([...moods, trimmedMood]);
    }
    setMoodInput('');
  };

  const handleMoodInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMood(moodInput);
    }
  };

  return (
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
  );
}
