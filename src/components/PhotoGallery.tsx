/**
 * PhotoGallery.tsx - An Entry's Photos In The Sidebar, Plus Lightbox
 *
 * Rendered at the top of EntryOriginalContent (see EntryContent.tsx). One
 * photo shows full-width; several show as a small square-cropped grid.
 * Clicking any opens the Lightbox below at that photo.
 *
 * LIGHTBOX PORTAL: rendered into document.body, not inline - the sidebar
 * surface uses `backdrop-filter`, which makes it the containing block for
 * `position: fixed` descendants (the same reason AddEntryForm's modal is
 * mounted up in Layout.tsx), so an inline fixed overlay would be clipped
 * to the sidebar instead of covering the screen.
 *
 * ESCAPE: closes the lightbox ONLY. EntrySelectionContext.tsx has a
 * bubble-phase window Escape listener that would otherwise also exit
 * focused mode (or start the two-press reset) underneath - so, exactly
 * like AddEntryForm.tsx's ESCAPE-TO-CANCEL effect, this listens in the
 * capture phase and stops propagation before that listener ever runs.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EntryPhoto } from '../types/Entry';

export default function PhotoGallery({ photos }: { photos: EntryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);

  if (photos.length === 0) return null;

  return (
    <>
      {photos.length === 1 ? (
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          className="block w-full overflow-hidden rounded-lg border border-[var(--panel-border-color)]"
          aria-label={photos[0].caption || 'Open photo'}
        >
          <img
            src={photos[0].dataUrl}
            alt={photos[0].caption ?? ''}
            className="max-h-80 w-full object-cover"
          />
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              className="overflow-hidden rounded-md border border-[var(--panel-border-color)]"
              aria-label={photo.caption || `Open photo ${index + 1}`}
            >
              <img
                src={photo.dataUrl}
                alt={photo.caption ?? ''}
                className="aspect-square w-full object-cover transition-opacity hover:opacity-85 motion-reduce:transition-none"
              />
            </button>
          ))}
        </div>
      )}

      {openIndex !== null && (
        <Lightbox
          photos={photos}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={close}
        />
      )}
    </>
  );
}

interface LightboxProps {
  photos: EntryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

function Lightbox({ photos, index, onIndexChange, onClose }: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const hasMultiple = photos.length > 1;

  const step = useCallback(
    (delta: number) =>
      onIndexChange((index + delta + photos.length) % photos.length),
    [index, photos.length, onIndexChange]
  );

  // Capture phase + stopPropagation - see ESCAPE in the top-of-file
  // comment. Arrow keys are swallowed too, so nothing underneath reacts.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      } else if (hasMultiple && event.key === 'ArrowLeft') {
        event.stopPropagation();
        step(-1);
      } else if (hasMultiple && event.key === 'ArrowRight') {
        event.stopPropagation();
        step(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, step, hasMultiple]);

  // Move focus into the dialog, and hand it back to whatever opened it
  // (the thumbnail) on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  if (!photo) return null;

  const navButtonClassName =
    'absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/75';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || 'Photo'}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/85 p-4"
    >
      <img
        src={photo.dataUrl}
        alt={photo.caption ?? ''}
        onClick={event => event.stopPropagation()}
        className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
      {(photo.caption || hasMultiple) && (
        <p
          onClick={event => event.stopPropagation()}
          className="mt-3 max-w-xl text-center text-sm text-white/90"
        >
          {photo.caption}
          {hasMultiple && (
            <span className="ml-2 text-white/60">
              {index + 1} / {photos.length}
            </span>
          )}
        </p>
      )}

      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/75"
      >
        &times;
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              step(-1);
            }}
            aria-label="Previous photo"
            className={`${navButtonClassName} left-4`}
          >
            &lsaquo;
          </button>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              step(1);
            }}
            aria-label="Next photo"
            className={`${navButtonClassName} right-4`}
          >
            &rsaquo;
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
