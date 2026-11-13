/**
 * EntryStatusPrompt.tsx - Resolving Planned / Skipped Entries
 *
 * Rendered in FocusedEntryView.tsx's header, under the title, for an
 * entry with a status (see utils/entryStatus.ts):
 *
 *   - PLANNED, date not yet passed: nothing - the header's "Planned" chip
 *     says enough.
 *   - PLANNED, date passed: "Did this happen?" with Yes / No. Nothing is
 *     ever resolved automatically - a plan just keeps asking.
 *       Yes: clears the status. Whatever was written for the plan
 *         (description + notes) is copied into a reflection dated at the
 *         entry's createdAt, so it reads as "Before" in the Reflections
 *         tab, then the entry opens in the edit form to be filled in as
 *         what actually happened.
 *       No: marks it skipped, then (via `onSkipped`) jumps to the
 *         Reflections tab with the add form open, asking why - optional,
 *         the form can just be cancelled.
 *   - SKIPPED: "Mark as planned" (back to a plan - which asks again if
 *     its date has passed) or "Mark as happened" (same as Yes above).
 */

import { Entry, Reflection } from '../types/Entry';
import {
  hasPlannedDatePassed,
  isPlanned,
  isSkipped,
  toReflectionWrittenDate,
} from '../utils/entryStatus';

interface EntryStatusPromptProps {
  entry: Entry;
  /** App.tsx's `updateEntry` - returns false if the save failed. */
  onUpdateEntry: (entry: Entry) => boolean;
  /** Opens the entry in AddEntryForm's edit mode. */
  onEdit: (entry: Entry) => void;
  /** Called after a planned entry is marked skipped. */
  onSkipped: () => void;
}

const BUTTON_CLASSNAME =
  'rounded-md px-3 py-1 text-xs font-medium transition-colors';

export default function EntryStatusPrompt({
  entry,
  onUpdateEntry,
  onEdit,
  onSkipped,
}: EntryStatusPromptProps) {
  const isOverduePlan = hasPlannedDatePassed(entry);
  if (!isOverduePlan && !isSkipped(entry)) return null;

  const handleHappened = () => {
    const writtenBefore = [entry.description, entry.notes]
      .map(text => text.trim())
      .filter(Boolean)
      .join('\n\n');
    const beforeReflection: Reflection | null = writtenBefore
      ? {
          id: crypto.randomUUID(),
          writtenDate: toReflectionWrittenDate(
            entry.createdAt ?? new Date().toISOString()
          ),
          text: writtenBefore,
        }
      : null;

    const updated: Entry = {
      ...entry,
      status: undefined,
      reflections: beforeReflection
        ? [...(entry.reflections ?? []), beforeReflection]
        : entry.reflections,
    };
    if (onUpdateEntry(updated)) onEdit(updated);
  };

  const handleSkipped = () => {
    if (onUpdateEntry({ ...entry, status: 'skipped' })) onSkipped();
  };

  const handleReplan = () => {
    onUpdateEntry({ ...entry, status: 'planned' });
  };

  return (
    <div className="rounded-lg border border-dashed border-[var(--field-border-strong)] bg-[var(--panel-bg-color-solid)] px-3 py-2">
      {isPlanned(entry) ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[var(--text-color)]">
            Did this happen?
          </p>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={handleHappened}
              className={`${BUTTON_CLASSNAME} bg-[var(--accent-color)] text-[var(--accent-foreground-color)] hover:brightness-90`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={handleSkipped}
              className={`${BUTTON_CLASSNAME} bg-[var(--field-tint-2)] text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]`}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-[var(--text-secondary-color)]">
            This didn&apos;t happen.
          </p>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={handleReplan}
              className={`${BUTTON_CLASSNAME} bg-[var(--field-tint-2)] text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]`}
            >
              Mark as planned
            </button>
            <button
              type="button"
              onClick={handleHappened}
              className={`${BUTTON_CLASSNAME} bg-[var(--field-tint-2)] text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]`}
            >
              Mark as happened
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
