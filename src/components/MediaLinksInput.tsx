/**
 * MediaLinksInput.tsx - Shared Media Links Input
 *
 * Extracted verbatim from AddEntryForm.tsx's Step 2 so AddReflectionForm.tsx
 * can reuse the exact same URL input + added-links list. The `mediaLinks`
 * array is controlled by the parent; only the in-progress URL text lives
 * here.
 *
 * INVESTIGATION NOTE (media links "not appearing" after submit): tracing
 * this end to end - addMediaLink below pushes onto the parent's
 * `mediaLinks`, AddEntryForm's handleSubmit passes that same array
 * straight into createEntry's `mediaLinks` field with no transformation,
 * and entriesStorage.ts's saveEntries just JSON.stringifies the whole
 * entry - confirms a media link added here (via the "Add" button) DOES
 * reach localStorage intact. The actual bug was downstream: EntryPanel.tsx
 * (the shared sidebar panel Constellation.tsx/Timeline.tsx both render)
 * had no Media Links section at all, so a correctly-saved link had nowhere
 * to display - see EntryPanel.tsx's own comment on its Media Links section.
 */

import { useState } from 'react';
import { MediaLink, MediaType } from '../types/Entry';

interface MediaLinksInputProps {
  mediaLinks: MediaLink[];
  onChange: (mediaLinks: MediaLink[]) => void;
}

export default function MediaLinksInput({
  mediaLinks,
  onChange,
}: MediaLinksInputProps) {
  const [mediaUrl, setMediaUrl] = useState('');

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
        // trusting this field, since this input has no per-platform
        // option to set it accurately anyway.
        type: MediaType.Video,
        url: mediaUrl.trim(),
      };
      onChange([...mediaLinks, newMedia]);
      setMediaUrl('');
    }
  };

  const removeMediaLink = (index: number) => {
    onChange(mediaLinks.filter((_, i) => i !== index));
  };

  return (
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
  );
}
