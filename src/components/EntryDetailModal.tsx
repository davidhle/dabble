/**
 * EntryDetailModal.tsx - Read-Only Entry Detail Popup
 *
 * A lightweight modal that shows a single entry's details: title, date,
 * activity type, tags, mood, notes, and media links.
 *
 * This mirrors the overlay pattern already used by AddEntryForm.tsx
 * (fixed inset backdrop + centered card, click-outside-to-close, click
 * inside the card doesn't propagate to the backdrop) so modals across
 * the app behave consistently.
 *
 * Not currently used by StarMap.tsx or LinearTimeline.tsx - clicking an
 * entry in either view now adds it to a SidebarPanelStack.tsx panel (see
 * useEntrySelection.ts's `handleEntryClick`) instead of opening this
 * modal. Still used as-is by SpiralTimeline.tsx, which has no equivalent
 * multi-panel sidebar need (a single point/arc click just needs "the one
 * entry you clicked," not several kept open side by side).
 *
 * MOOD / MEDIA LINKS: this used to render Tags and Notes only - `mood`
 * and `mediaLinks` were both being saved onto the entry correctly (see
 * AddEntryForm.tsx) but had nowhere to display here, the same gap
 * EntryPanel.tsx had (see its own comment on the same fix). Fixed the
 * same way - a Mood section (same chip pattern as Tags, just its own
 * color) and a Media Links section (labeled clickable link-outs via
 * utils/mediaLinks.ts's getMediaLinkLabel) - just kept in this file's own
 * existing LIGHT color palette rather than EntryPanel's dark one, since
 * this modal hasn't been migrated to the app's dark theme (unlike
 * AddEntryForm.tsx - see its own THEMING comment).
 */

import { Entry } from '../types/Entry';
import { getCategoryName } from '../utils/categories';
import { linkify, LINK_CLASSNAME } from '../utils/linkify';
import { getMediaLinkLabel } from '../utils/mediaLinks';
import { formatEntryDate } from '../utils/formatEntryDate';

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

  // Looked up from the dynamic category list rather than a fixed option
  // list, so a user-created category's name displays correctly here too.
  const displayActivityType = getCategoryName(entry.activityType);

  // See formatEntryDate for the dateDisplay / date-range / single-date
  // precedence - shows a range like "Jun 30 – Jul 2, 2023" when the entry
  // has an endTimestamp (see types/Entry.ts).
  const formattedDate = formatEntryDate(entry);

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

            {/*
             * Mood - see the MOOD / MEDIA LINKS comment at the top of this
             * file. Renders nothing at all (not an empty "Mood" label)
             * when `entry.mood` is undefined or empty. Teal rather than
             * Tags' indigo - a color no category from
             * utils/categories.ts's NEW_CATEGORY_COLOR_PALETTE cycles
             * through, so a mood chip can't be mistaken for one, same
             * reasoning as EntryPanel.tsx's own Mood section.
             */}
            {entry.mood && entry.mood.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Mood
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {entry.mood.map(mood => (
                    <span
                      key={mood}
                      className="inline-flex items-center rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700"
                    >
                      {mood}
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
                {entry.notes
                  ? linkify(entry.notes)
                  : 'No notes for this entry.'}
              </p>
            </div>

            {/*
             * Media Links - see the MOOD / MEDIA LINKS comment at the top
             * of this file. Same labeled-link-out + LINK_CLASSNAME
             * approach as EntryPanel.tsx's Media Links section - see its
             * own comment for why the label is derived from the URL's
             * hostname (utils/mediaLinks.ts) rather than trusted from
             * `media.type`.
             */}
            {entry.mediaLinks.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Media Links
                </p>
                <div className="mt-1.5 flex flex-col gap-1">
                  {entry.mediaLinks.map((media, index) => (
                    <a
                      key={index}
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm ${LINK_CLASSNAME}`}
                    >
                      {getMediaLinkLabel(media.url)}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
