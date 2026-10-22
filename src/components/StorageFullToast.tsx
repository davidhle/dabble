/**
 * StorageFullToast.tsx - "Storage Is Full" Warning
 *
 * Shown by App.tsx whenever saving entries to localStorage fails (see its
 * COMMIT ENTRIES comment) - in practice because photos have filled the
 * ~5MB quota. The change that failed was never applied, so whatever form
 * the user was in is still open with their work in it; this just tells
 * them why and what to do about it.
 *
 * Same floating pill look as ResetToast.tsx, but z-[60] so it sits ABOVE
 * the AddEntryForm modal (z-50) - that's where most failed saves happen -
 * and dismissable, auto-hiding after a few seconds.
 */

import { useEffect } from 'react';
import { STORAGE_FULL_MESSAGE } from '../utils/safeStorage';

const AUTO_DISMISS_MS = 8000;

interface StorageFullToastProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function StorageFullToast({
  visible,
  onDismiss,
}: StorageFullToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timeout = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-red-500/40 bg-[var(--panel-bg-color-solid)] py-2 pl-4 pr-2 text-sm text-[var(--text-color)] shadow-lg backdrop-blur"
      >
        <span>{STORAGE_FULL_MESSAGE}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted-color)] hover:bg-[var(--field-tint-2)] hover:text-[var(--text-color)]"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
