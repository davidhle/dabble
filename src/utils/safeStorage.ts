/**
 * safeStorage.ts - Quota-Safe localStorage Writes
 *
 * localStorage has a ~5MB per-origin quota, and photo attachments (stored
 * as JPEG data URLs on each entry - see EntryPhoto in types/Entry.ts) make
 * actually hitting it realistic. A raw `localStorage.setItem` throws a
 * QuotaExceededError once full, which - uncaught inside an event handler or
 * effect - would break whatever UI triggered it (even something as small as
 * toggling the theme). Every write in the app goes through safeSetItem
 * instead, which reports failure as a `false` return the caller can act on.
 */

/** Shown wherever a save fails because storage is full. */
export const STORAGE_FULL_MESSAGE =
  'Storage is full – export your data and remove some photos';

/**
 * The quota browsers typically give localStorage, in characters (Chrome
 * and Firefox count UTF-16 code units, ~5M of them). Only used for the
 * approximate "storage used" hint in PhotoPicker.tsx - the real limit is
 * whatever setItem actually throws at.
 */
export const APPROX_STORAGE_QUOTA_CHARS = 5 * 1024 * 1024;

/** localStorage.setItem that returns false instead of throwing. */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Failed to save "${key}" to localStorage:`, error);
    return false;
  }
}

/**
 * Approximate characters currently stored in localStorage (keys +
 * values). Data URLs are plain ASCII, so for photos this is also roughly
 * their size in bytes. Cheap enough to call on render: it's just a length
 * sum over a handful of keys.
 */
export function getStorageUsageChars(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    // Storage unavailable - report nothing used rather than throwing.
  }
  return total;
}

/** Formats a character/byte count as "1.2 MB" / "340 KB". */
export function formatStorageSize(chars: number): string {
  if (chars >= 1024 * 1024) return `${(chars / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(chars / 1024))} KB`;
}
