/**
 * dataTransfer.ts - Full Export/Import of localStorage Data
 *
 * Lets a visitor take their entries + categories out of this browser's
 * localStorage as a portable JSON file, and load that same file back in -
 * either on the same device after clearing site data, or on a different
 * device/browser entirely. Pairs with the "Start Your Own Constellation"
 * reset (see About.tsx): export before resetting to keep a backup, or
 * import right after resetting to load someone else's (or your own
 * previously-exported) data into the now-blank slate.
 *
 * REPLACE, NOT MERGE:
 * applyImportedData() calls saveEntries()/saveCategories() with the
 * imported arrays directly, overwriting whatever was already in
 * localStorage rather than concatenating with it. This is deliberate: an
 * import is framed as "load this file's constellation," not "add these
 * entries to what I already have." Merging would silently risk duplicate
 * entries (same id appearing twice) or, worse, category id collisions
 * between two independently-created datasets where the same id string
 * means two different categories - there's no reliable way to reconcile
 * that automatically. A full takeover has one unambiguous outcome: after
 * import, localStorage contains exactly what the file said, no more, no
 * less. A visitor who wants to keep their current data too should export
 * it first (or avoid importing over it) rather than relying on this
 * function to merge safely.
 */

import { Category } from '../types/Category';
import { Entry } from '../types/Entry';
import { loadCategories, saveCategories } from './categories';
import { loadEntries, saveEntries } from './entriesStorage';

/** The full shape of one exported/imported data file. */
export interface DabbleExportData {
  entries: Entry[];
  categories: Category[];
}

/**
 * Reads the current localStorage entries + categories and triggers a
 * browser download of them as one JSON file named
 * dabble-export-YYYY-MM-DD.json (today's actual date, not the data's).
 *
 * Builds a Blob + temporary object URL + throwaway <a download> element
 * rather than navigating the page - the standard client-side-only way to
 * trigger a file save with no server involved, and it never leaves a
 * stray element or URL behind (both are cleaned up immediately after the
 * synchronous click()).
 */
export function exportData(): void {
  const data: DabbleExportData = {
    entries: loadEntries(),
    categories: loadCategories(),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const today = new Date();
  const dateStamp = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const link = document.createElement('a');
  link.href = url;
  link.download = `dabble-export-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Minimum shape a parsed entry needs to be trusted - matches the fields
 * everything downstream (sorting by timestamp, coloring/labeling by
 * activityType, displaying a title) actually depends on being present
 * and the right type. Every OTHER Entry field (description, notes, tags,
 * mediaLinks, etc.) is optional/defaulted-friendly enough that a missing
 * one wouldn't crash the app, so it's not worth rejecting a whole file
 * over.
 */
function isValidEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.activityType === 'string' &&
    typeof candidate.title === 'string'
  );
}

/** Minimum shape a parsed category needs - see isValidEntry above. */
function isValidCategory(value: unknown): value is Category {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.color === 'string'
  );
}

/**
 * Type guard for a whole parsed import file: an object with an `entries`
 * array and a `categories` array, where every element of each passes its
 * respective per-item shape check above. Exported mainly for testing -
 * parseImportFile() below is what callers actually use.
 */
export function isValidExportData(value: unknown): value is DabbleExportData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.entries) &&
    Array.isArray(candidate.categories) &&
    candidate.entries.every(isValidEntry) &&
    candidate.categories.every(isValidCategory)
  );
}

/**
 * Reads and parses a File the visitor picked (via an <input type="file">),
 * rejecting with a short, user-displayable message for anything that
 * isn't valid JSON in the expected shape - a malformed/unreadable file
 * and a well-formed-but-wrong-shape JSON file both surface as the same
 * "Invalid file format" message, since neither is actionable for the
 * visitor beyond "pick a real export file."
 */
export function parseImportFile(file: File): Promise<DabbleExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!isValidExportData(parsed)) {
          reject(new Error('Invalid file format'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error('Invalid file format'));
      }
    };

    reader.onerror = () => reject(new Error('Invalid file format'));
    reader.readAsText(file);
  });
}

/**
 * Overwrites localStorage's entries and categories with `data` - see the
 * "REPLACE, NOT MERGE" comment at the top of this file for why this is a
 * full takeover rather than a merge. Caller is responsible for reloading
 * the view afterward (see About.tsx) so every already-mounted component
 * re-reads from localStorage instead of continuing to show stale state.
 */
export function applyImportedData(data: DabbleExportData): void {
  saveEntries(data.entries);
  saveCategories(data.categories);
}
