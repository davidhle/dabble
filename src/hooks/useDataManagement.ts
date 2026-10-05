/**
 * useDataManagement.ts - Export / Import / "Start Your Own Constellation"
 *
 * The data-management handlers that used to live inline in Home.tsx (and
 * before that About.tsx), lifted into one hook so Home.tsx (which keeps
 * "Start Your Own Constellation") and SettingsModal.tsx (which now owns
 * Export/Import as well as its own copy of "Start Your Own") share the
 * exact same logic instead of two drifting copies. Behavior is unchanged
 * from the Home.tsx original - same confirm text, same localStorage writes,
 * same reload-driven status message handoff.
 *
 * PER-CALLER STATUS KEY:
 * Each caller passes its own `statusMessageKey`, so a message stashed right
 * before a reload is read back only by the surface that triggered it - a
 * reset started from the Settings modal reopens Settings with its message
 * (see SettingsModal.tsx), while one started from Home shows on Home, and
 * neither surface steals the other's message.
 */

import { useEffect, useRef, useState } from 'react';
import { saveCategories } from '../utils/categories';
import { saveEntries } from '../utils/entriesStorage';
import {
  applyImportedData,
  exportData,
  parseImportFile,
} from '../utils/dataTransfer';

export interface StatusMessage {
  type: 'success' | 'info' | 'error';
  text: string;
}

/** Banner styling per status type - shared so Home and Settings match. */
export const STATUS_BANNER_CLASSES: Record<StatusMessage['type'], string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  info: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-400',
};

export default function useDataManagement(statusMessageKey: string) {
  /**
   * ──────────────────────────────────────────────────────────────────────
   * STATUS MESSAGE ACROSS RELOAD
   * ──────────────────────────────────────────────────────────────────────
   * A successful "Start Your Own Constellation" reset or a successful
   * Import both need to `window.location.reload()` afterward (see each
   * handler below for why), which throws away any in-memory React state -
   * a plain `setStatusMessage(...)` right before reloading would never
   * actually be seen. Instead, the handler stashes the message in
   * localStorage under `statusMessageKey` right before reloading, and
   * this effect (which runs once on mount, i.e. also right after that
   * reload lands) reads it back, displays it, and immediately clears the
   * key so it doesn't reappear on a later, unrelated visit.
   *
   * An IMPORT ERROR does not go through this path - it's shown directly
   * via setStatusMessage in handleFileChange below, since a failed import
   * never reloads (there's nothing new to reflect) and the message can
   * just live in ordinary component state.
   */
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );

  useEffect(() => {
    const raw = localStorage.getItem(statusMessageKey);
    if (!raw) return;

    localStorage.removeItem(statusMessageKey);
    try {
      setStatusMessage(JSON.parse(raw) as StatusMessage);
    } catch {
      // Corrupt value - nothing sensible to show, just drop it.
    }
  }, [statusMessageKey]);

  /**
   * "Start Your Own Constellation" - a permanent, visitor-facing reset,
   * distinct from Constellation.tsx's <ResetButton> (which only resets
   * pan/zoom/filter/sidebar UI state, nothing persisted). This one wipes
   * the actual data: every entry and every category in localStorage.
   *
   * Writes empty arrays rather than removing the localStorage keys
   * entirely - see the "WHY THE ENTRIES KEY ALONE IS THE SIGNAL" comment
   * in utils/initializeFirstVisit.ts for why that distinction matters: a
   * present-but-empty 'dabble-entries' key is read as "this visitor has
   * already been initialized, leave them alone," while a MISSING key
   * would be read as a first-ever visit and silently bring the bundled
   * default data back - exactly what a visitor clicking "start your own"
   * does not want. This is also why the result is a GENUINELY empty
   * array rather than DEFAULT_CATEGORIES/DEFAULT_ENTRIES (my bundled
   * personal data) or any other placeholder set: the entire point of this
   * button is "let me start completely from scratch, with nothing of
   * yours in the way," so silently repopulating it with different
   * bundled content would defeat the button's own purpose just as much
   * as accidentally restoring the original bundled data would.
   *
   * Reloads afterward (rather than trying to reset in-place) so
   * App.tsx's `entries` state re-initializes from the now-empty
   * localStorage the same way a real first/next visit would, instead of
   * this hook needing its own direct line to that state.
   */
  const handleStartOwnConstellation = () => {
    const confirmed = window.confirm(
      'This will permanently delete everything currently in your constellation - all entries and categories, including the bundled example data - and start you with a completely blank one. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    saveEntries([]);
    saveCategories([]);
    localStorage.setItem(
      statusMessageKey,
      JSON.stringify({
        type: 'info',
        text: 'Your constellation is empty. Click the + button (top right) to add your first entry, or use Import Data in Settings (the gear icon, top right) if you have your own exported file to load.',
      } satisfies StatusMessage)
    );
    window.location.reload();
  };

  /** Hidden <input type="file">, opened programmatically by the caller's
   * visible "Import Data" button - see handleImportClick. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handles the file picked from handleImportClick's hidden input.
   *
   * On success: overwrites localStorage (see the "REPLACE, NOT MERGE"
   * comment in utils/dataTransfer.ts for why this is a full takeover, not
   * a merge with whatever was already there), stashes a success message
   * for the reload to pick back up (see STATUS MESSAGE ACROSS RELOAD
   * above), and reloads so every already-mounted component - including
   * App.tsx's `entries` state - re-reads the newly-imported data instead
   * of continuing to show what was on screen before the import.
   *
   * On failure: shows the error inline, in ordinary component state, and
   * deliberately does NOT reload or touch localStorage at all - whatever
   * data existed before this failed import attempt is left completely
   * untouched.
   */
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    // Reset the input immediately so picking the exact same file again
    // later still fires this handler (a native <input type="file"> only
    // fires onChange when its value actually changes).
    event.target.value = '';
    if (!file) return;

    try {
      const data = await parseImportFile(file);
      applyImportedData(data);
      localStorage.setItem(
        statusMessageKey,
        JSON.stringify({
          type: 'success',
          text: `Loaded ${data.entries.length} ${data.entries.length === 1 ? 'entry' : 'entries'}.`,
        } satisfies StatusMessage)
      );
      window.location.reload();
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Invalid file format',
      });
    }
  };

  return {
    statusMessage,
    setStatusMessage,
    handleStartOwnConstellation,
    handleExport: exportData,
    fileInputRef,
    handleImportClick,
    handleFileChange,
  };
}
