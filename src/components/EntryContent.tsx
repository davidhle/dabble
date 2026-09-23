/**
 * EntryContent.tsx - An Entry's Full-Detail Body Sections
 *
 * The two bodies FocusedEntryView.tsx's Original/Reflections toggle
 * switches between. Both used to live inline in EntryPanel.tsx's EXPANDED
 * layout; they moved here when expansion became a full-sidebar takeover
 * (see FocusedEntryView.tsx) and EntryPanel was reduced to just the
 * minimized row.
 *
 *   - EntryOriginalContent: the entry's own content - Tags, Mood,
 *     Description, Notes, Media Links - rendered exactly as the expanded
 *     panel always did.
 *   - EntryReflections: the Stage 1 reflections list + "Add Reflection"
 *     form, now on its own tab instead of trailing the entry's content.
 *
 * SECTION LABEL EMOJI: each section label is prefixed with one small emoji
 * (🏷️/💫/📝/💭/🔗/🪞) - a purely cosmetic touch to break up what's
 * otherwise an all-caps text-only label.
 *
 * MOOD / MEDIA LINKS: both follow the same "label + content, render
 * nothing at all when empty" pattern Tags uses. Mood chips are teal rather
 * than Tags' indigo or any color from NEW_CATEGORY_COLOR_PALETTE
 * (utils/categories.ts) - a color no category can ever be assigned, so a
 * mood chip can never be mistaken for a category-colored one.
 */

import { useState } from 'react';
import { Entry, Reflection } from '../types/Entry';
import { linkify, LINK_CLASSNAME } from '../utils/linkify';
import { getMediaLinkLabel } from '../utils/mediaLinks';
import { formatSingleDate } from '../utils/formatEntryDate';
import AddReflectionForm from './AddReflectionForm';

const SECTION_LABEL_CLASSNAME =
  'text-xs font-medium uppercase tracking-wide text-[var(--text-muted-color)]';

export function EntryOriginalContent({ entry }: { entry: Entry }) {
  return (
    <div className="space-y-3">
      {entry.tags.length > 0 && (
        <div>
          <p className={SECTION_LABEL_CLASSNAME}>🏷️ Tags</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {entry.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-indigo-400/20 px-3 py-1 text-sm font-medium text-[var(--indigo-accent-text)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/*
       * `entry.mood` is optional and, per AddEntryForm.tsx, never saved as
       * an empty array - the length check is still here defensively so
       * this renders NOTHING (not an empty "Mood" label) for any
       * falsy/empty value.
       */}
      {entry.mood && entry.mood.length > 0 && (
        <div>
          <p className={SECTION_LABEL_CLASSNAME}>💫 Mood</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {entry.mood.map(mood => (
              <span
                key={mood}
                className="inline-flex items-center rounded-full bg-teal-400/20 px-3 py-1 text-sm font-medium text-[var(--teal-accent-text)]"
              >
                {mood}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className={SECTION_LABEL_CLASSNAME}>📝 Description</p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--text-secondary-color)]">
          {entry.description
            ? linkify(entry.description)
            : 'No description for this entry.'}
        </p>
      </div>

      <div>
        <p className={SECTION_LABEL_CLASSNAME}>💭 Notes</p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--text-secondary-color)]">
          {entry.notes ? linkify(entry.notes) : 'No notes for this entry.'}
        </p>
      </div>

      {/*
       * Each link renders as a labeled link-out ("View on Instagram")
       * rather than the raw URL - getMediaLinkLabel derives the platform
       * from the URL's own hostname, since AddEntryForm.tsx always saves
       * `media.type` as "Video" regardless of the actual platform (see its
       * addMediaLink comment). Same target/rel/LINK_CLASSNAME styling
       * linkify.ts uses for a URL inside free-text notes/description.
       */}
      {entry.mediaLinks.length > 0 && (
        <div>
          <p className={SECTION_LABEL_CLASSNAME}>🔗 Media Links</p>
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
  );
}

interface EntryReflectionsProps {
  entry: Entry;
  /**
   * Persists a modified copy of this entry (same id) - wired to App.tsx's
   * `updateEntry`. Used to append a new reflection.
   */
  onUpdate: (entry: Entry) => void;
}

export function EntryReflections({ entry, onUpdate }: EntryReflectionsProps) {
  const [isAddingReflection, setIsAddingReflection] = useState(false);

  // Chronological (oldest first). ISO strings sort correctly as strings.
  const sortedReflections = [...(entry.reflections ?? [])].sort((a, b) =>
    a.writtenDate.localeCompare(b.writtenDate)
  );

  const handleSaveReflection = (reflection: Reflection) => {
    onUpdate({
      ...entry,
      reflections: [...(entry.reflections ?? []), reflection],
    });
    setIsAddingReflection(false);
  };

  return (
    <div className="space-y-3">
      {sortedReflections.length > 0 ? (
        <div className="space-y-3">
          {sortedReflections.map(reflection => (
            <div
              key={reflection.id}
              className="border-l-2 pl-3"
              style={{ borderColor: 'var(--panel-border-color)' }}
            >
              <p className="text-xs text-[var(--text-muted-color)]">
                {/* Date-only, stored at midnight UTC - see Reflection.writtenDate. */}
                {formatSingleDate(new Date(reflection.writtenDate), false)}
              </p>
              {reflection.mood && reflection.mood.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {reflection.mood.map(mood => (
                    <span
                      key={mood}
                      className="inline-flex items-center rounded-full bg-teal-400/20 px-2.5 py-0.5 text-xs font-medium text-[var(--teal-accent-text)]"
                    >
                      {mood}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary-color)]">
                {linkify(reflection.text)}
              </p>
              {reflection.mediaLinks && reflection.mediaLinks.length > 0 && (
                <div className="mt-1 flex flex-col gap-1">
                  {reflection.mediaLinks.map((media, index) => (
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
              )}
            </div>
          ))}
        </div>
      ) : (
        !isAddingReflection && (
          <p className="text-sm text-[var(--text-muted-color)]">
            No reflections on this entry yet.
          </p>
        )
      )}

      {isAddingReflection ? (
        <AddReflectionForm
          entry={entry}
          onSave={handleSaveReflection}
          onCancel={() => setIsAddingReflection(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsAddingReflection(true)}
          className="rounded-md bg-[var(--field-tint-2)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]"
        >
          + Add Reflection
        </button>
      )}
    </div>
  );
}
