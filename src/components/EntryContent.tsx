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
 *     Each reflection has its own edit/delete icons - edit swaps it for
 *     AddReflectionForm pre-filled in place; delete asks for a lightweight
 *     inline confirm (no two-step flow like deleting a whole entry).
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
import IconButton from './IconButton';

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
   * `updateEntry`. Used to add, edit, and delete reflections.
   */
  onUpdate: (entry: Entry) => void;
}

/**
 * Which AddReflectionForm is open, if any: 'new' for the add form, or the
 * id of the reflection being edited. One at a time, so opening one closes
 * any other.
 */
type OpenForm = 'new' | string | null;

export function EntryReflections({ entry, onUpdate }: EntryReflectionsProps) {
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );

  const reflections = entry.reflections ?? [];

  // Chronological (oldest first). ISO strings sort correctly as strings.
  const sortedReflections = [...reflections].sort((a, b) =>
    a.writtenDate.localeCompare(b.writtenDate)
  );

  const handleSaveNew = (reflection: Reflection) => {
    onUpdate({ ...entry, reflections: [...reflections, reflection] });
    setOpenForm(null);
  };

  // AddReflectionForm keeps the edited reflection's id, so match on it.
  const handleSaveEdit = (edited: Reflection) => {
    onUpdate({
      ...entry,
      reflections: reflections.map(reflection =>
        reflection.id === edited.id ? edited : reflection
      ),
    });
    setOpenForm(null);
  };

  const handleConfirmDelete = (reflectionId: string) => {
    onUpdate({
      ...entry,
      reflections: reflections.filter(
        reflection => reflection.id !== reflectionId
      ),
    });
    setConfirmingDeleteId(null);
  };

  const openEditForm = (reflectionId: string) => {
    setConfirmingDeleteId(null);
    setOpenForm(reflectionId);
  };

  return (
    <div className="space-y-3">
      {sortedReflections.length > 0 ? (
        <div className="space-y-3">
          {sortedReflections.map(reflection =>
            openForm === reflection.id ? (
              <AddReflectionForm
                key={reflection.id}
                entry={entry}
                reflection={reflection}
                onSave={handleSaveEdit}
                onCancel={() => setOpenForm(null)}
              />
            ) : (
              <div
                key={reflection.id}
                className="border-l-2 pl-3"
                style={{ borderColor: 'var(--panel-border-color)' }}
              >
                {/*
                 * Date on the left, edit/delete on the right - the same
                 * layout as FocusedEntryView's controls row. The negative
                 * margin keeps the 28px icon buttons from padding out the
                 * date line.
                 */}
                <div className="flex items-center gap-1">
                  <p className="text-xs text-[var(--text-muted-color)]">
                    {/* Date-only, stored at midnight UTC - see Reflection.writtenDate. */}
                    {formatSingleDate(new Date(reflection.writtenDate), false)}
                  </p>
                  <div className="-my-1.5 ml-auto flex items-center gap-0.5">
                    <IconButton
                      onClick={() => openEditForm(reflection.id)}
                      label="Edit reflection"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                        />
                      </svg>
                    </IconButton>
                    <IconButton
                      onClick={() => setConfirmingDeleteId(reflection.id)}
                      label="Delete reflection"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </IconButton>
                  </div>
                </div>
                {confirmingDeleteId === reflection.id && (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2">
                    <p className="text-sm text-[var(--text-secondary-color)]">
                      Are you sure?
                    </p>
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="rounded-md border border-[var(--panel-border-color)] px-3 py-1 text-xs font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-1)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(reflection.id)}
                        className="rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white hover:brightness-90"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
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
            )
          )}
        </div>
      ) : (
        openForm !== 'new' && (
          <p className="text-sm text-[var(--text-muted-color)]">
            No reflections on this entry yet.
          </p>
        )
      )}

      {openForm === 'new' ? (
        <AddReflectionForm
          entry={entry}
          onSave={handleSaveNew}
          onCancel={() => setOpenForm(null)}
        />
      ) : (
        openForm === null && (
          <button
            type="button"
            onClick={() => setOpenForm('new')}
            className="rounded-md bg-[var(--field-tint-2)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-color)] hover:bg-[var(--field-tint-3)]"
          >
            + Add Reflection
          </button>
        )
      )}
    </div>
  );
}
