/**
 * EntryDetailModal.tsx - Read-Only Entry Detail Popup
 *
 * A lightweight modal that shows a single entry's details: title, date,
 * activity type, tags, and notes.
 *
 * This mirrors the overlay pattern already used by AddEntryForm.tsx
 * (fixed inset backdrop + centered card, click-outside-to-close, click
 * inside the card doesn't propagate to the backdrop) so modals across
 * the app behave consistently.
 *
 * Not currently used by StarMap.tsx - clicking a star there now adds the
 * entry to Constellation.tsx's sidebar (see EntryPanel.tsx) instead of
 * opening this modal. Kept around as the base this file's content was
 * adapted from, and in case a future overlay-style detail view is needed.
 */

import { ACTIVITY_TYPE_OPTIONS, Entry } from '../types/Entry';

interface EntryDetailModalProps {
  /** The entry to display. When null, the modal renders nothing. */
  entry: Entry | null;
  /** Called when the modal should close (backdrop click or close button). */
  onClose: () => void;
}

export default function EntryDetailModal({
  entry,
  onClose,
}: EntryDetailModalProps) {
  if (!entry) return null;

  const activityLabel =
    ACTIVITY_TYPE_OPTIONS.find(option => option.value === entry.activityType)
      ?.label ?? entry.activityType;

  // "Other" entries store their real category name separately, so prefer
  // that over the generic "Other" label when it's available.
  const displayActivityType =
    entry.customActivityType && entry.customActivityType.trim().length > 0
      ? entry.customActivityType
      : activityLabel;

  const formattedDate = new Date(entry.timestamp).toLocaleDateString(
    undefined,
    {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div className="flex h-full items-center justify-center p-4">
        <div
          className="w-[90vw] max-w-[420px] rounded-lg bg-white shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {/* ─── Header ─── */}
          <div className="flex items-start justify-between border-b px-6 pt-5 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {entry.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {displayActivityType} &middot; {formattedDate}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
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

          {/* ─── Body ─── */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
            {entry.tags.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Tags
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {entry.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Notes
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">
                {entry.notes || 'No notes for this entry.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
