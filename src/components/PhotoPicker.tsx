/**
 * PhotoPicker.tsx - AddEntryForm's Photo Attachments Field
 *
 * Replaces the old "Photo upload coming soon" placeholder. Picked images
 * are downscaled and re-encoded in the browser (see utils/photos.ts) and
 * kept as data URLs on the entry - there's no upload step, since there's
 * no backend; everything lives in localStorage like the rest of the entry.
 *
 * The `photos` array is controlled by AddEntryForm. New photos are handed
 * back through `onAdd` (not a whole-array onChange) because processing is
 * async: the parent appends with a functional update, so a photo that
 * finishes after the user removed another one, edited a caption, or
 * stepped Back to Step 1 (unmounting this) still lands correctly.
 *
 * STORAGE HINT: localStorage's ~5MB quota is shared by everything, so the
 * hint under the picker shows roughly how much is in use, counting photos
 * added in this form that aren't saved yet - see utils/safeStorage.ts.
 */

import { useMemo, useRef, useState } from 'react';
import { EntryPhoto } from '../types/Entry';
import { processPhotoFile } from '../utils/photos';
import {
  APPROX_STORAGE_QUOTA_CHARS,
  formatStorageSize,
  getStorageUsageChars,
} from '../utils/safeStorage';

interface PhotoPickerProps {
  photos: EntryPhoto[];
  /** Appends newly processed photos. */
  onAdd: (photos: EntryPhoto[]) => void;
  onRemove: (photoId: string) => void;
  onCaptionChange: (photoId: string, caption: string) => void;
  /**
   * Photos already in localStorage (the entry being edited's saved
   * photos) - excluded from the "unsaved" part of the storage hint since
   * getStorageUsageChars already counts them.
   */
  savedPhotos?: EntryPhoto[];
}

export default function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  onCaptionChange,
  savedPhotos,
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedNames, setFailedNames] = useState<string[]>([]);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Reset so picking the same file again still fires onChange.
    event.target.value = '';
    if (files.length === 0) return;

    setFailedNames([]);
    setPendingCount(count => count + files.length);

    const results = await Promise.allSettled(files.map(processPhotoFile));
    const added = results.flatMap(result =>
      result.status === 'fulfilled' ? [result.value] : []
    );
    const failed = files
      .filter((_, index) => results[index].status === 'rejected')
      .map(file => file.name);

    if (added.length > 0) onAdd(added);
    setFailedNames(failed);
    setPendingCount(count => count - files.length);
  };

  const storageHint = useMemo(() => {
    const savedIds = new Set(savedPhotos?.map(photo => photo.id));
    const unsavedChars = photos
      .filter(photo => !savedIds.has(photo.id))
      .reduce((sum, photo) => sum + photo.dataUrl.length, 0);
    const used = getStorageUsageChars() + unsavedChars;
    return {
      text: `~${formatStorageSize(used)} of ~${formatStorageSize(APPROX_STORAGE_QUOTA_CHARS)} storage used`,
      isNearlyFull: used > APPROX_STORAGE_QUOTA_CHARS * 0.85,
    };
  }, [photos, savedPhotos]);

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-secondary-color)]">
        Photos
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {photos.length > 0 && (
        <div className="mt-1 grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={photo.id} className="min-w-0">
              <div className="relative">
                <img
                  src={photo.dataUrl}
                  alt={photo.caption || `Photo ${index + 1}`}
                  className="aspect-square w-full rounded-md border border-[var(--panel-border-color)] object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemove(photo.id)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80"
                >
                  &times;
                </button>
              </div>
              <input
                type="text"
                value={photo.caption ?? ''}
                onChange={e => onCaptionChange(photo.id, e.target.value)}
                placeholder="Caption"
                aria-label={`Caption for photo ${index + 1}`}
                className="mt-1 block w-full rounded-md border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-2 py-1 text-xs text-[var(--text-color)] focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pendingCount > 0}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--field-border-strong)] bg-[var(--field-tint-1)] px-4 py-3 text-sm text-[var(--text-muted-color)] hover:bg-[var(--field-tint-2)] hover:text-[var(--text-secondary-color)] disabled:cursor-wait disabled:opacity-60"
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
        {pendingCount > 0
          ? `Processing ${pendingCount} photo${pendingCount === 1 ? '' : 's'}...`
          : photos.length > 0
            ? 'Add more photos'
            : 'Add photos'}
      </button>

      {failedNames.length > 0 && (
        <p className="mt-1 text-xs text-red-400">
          Couldn&apos;t read {failedNames.join(', ')} - try a JPEG or PNG.
        </p>
      )}

      <p
        className={`mt-1 text-xs ${
          storageHint.isNearlyFull
            ? 'text-amber-500'
            : 'text-[var(--text-muted-color)]'
        }`}
      >
        {storageHint.text}
      </p>
    </div>
  );
}
