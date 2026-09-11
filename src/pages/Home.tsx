/**
 * Home.tsx - Landing / Introduction Page
 *
 * This page is now the primary landing/introduction page for the MVP: it's
 * what a first-time visitor sees, so it carries the project's "what is
 * this and why" framing plus the data-management actions (Export, Import,
 * Start Your Own Constellation) that used to live on About.tsx. About.tsx
 * is reserved for project history and roadmap instead - see its own
 * top-of-file comment.
 *
 * DATA MANAGEMENT MOVED FROM About.tsx:
 * The STATUS_MESSAGE_KEY/statusMessage plumbing, handleStartOwnConstellation,
 * and the Import/Export handlers below are relocated verbatim from
 * About.tsx (same behavior, same reload-driven status message handoff) -
 * this file didn't exist as their owner before, so moving them here just
 * changes which page renders the buttons and reads the post-reload status
 * message back, not what any of it does.
 */

import { useEffect, useRef, useState } from 'react';
import { saveCategories } from '../utils/categories';
import { saveEntries } from '../utils/entriesStorage';
import {
  applyImportedData,
  exportData,
  parseImportFile,
} from '../utils/dataTransfer';

/**
 * localStorage key the reset/import reload uses to hand a status message
 * to the NEXT page load - see the STATUS MESSAGE ACROSS RELOAD comment
 * below for why this can't just be React state.
 */
const STATUS_MESSAGE_KEY = 'dabble-status-message';

interface StatusMessage {
  type: 'success' | 'info' | 'error';
  text: string;
}

export default function Home() {
  /**
   * ──────────────────────────────────────────────────────────────────────
   * STATUS MESSAGE ACROSS RELOAD
   * ──────────────────────────────────────────────────────────────────────
   * A successful "Start Your Own Constellation" reset or a successful
   * Import both need to `window.location.reload()` afterward (see each
   * handler below for why), which throws away any in-memory React state -
   * a plain `setStatusMessage(...)` right before reloading would never
   * actually be seen. Instead, the handler stashes the message in
   * localStorage under STATUS_MESSAGE_KEY right before reloading, and
   * this effect (which runs once on mount, i.e. also right after that
   * reload lands) reads it back, displays it, and immediately clears the
   * key so it doesn't reappear on a later, unrelated visit to this page.
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
    const raw = localStorage.getItem(STATUS_MESSAGE_KEY);
    if (!raw) return;

    localStorage.removeItem(STATUS_MESSAGE_KEY);
    try {
      setStatusMessage(JSON.parse(raw) as StatusMessage);
    } catch {
      // Corrupt value - nothing sensible to show, just drop it.
    }
  }, []);

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
   * this component needing its own direct line to that state.
   */
  const handleStartOwnConstellation = () => {
    const confirmed = window.confirm(
      'This will permanently delete everything currently in your constellation - all entries and categories, including the bundled example data - and start you with a completely blank one. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    saveEntries([]);
    saveCategories([]);
    localStorage.setItem(
      STATUS_MESSAGE_KEY,
      JSON.stringify({
        type: 'info',
        text: 'Your constellation is empty. Click the + button (top right) to add your first entry, or use Import Data below if you have your own exported file to load.',
      } satisfies StatusMessage)
    );
    window.location.reload();
  };

  /** Hidden <input type="file">, opened programmatically by the visible
   * "Import Data" button below - see handleImportClick. */
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
        STATUS_MESSAGE_KEY,
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

  const statusBannerClasses: Record<StatusMessage['type'], string> = {
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    info: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
    error: 'border-red-500/40 bg-red-500/10 text-red-400',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-color)]">
        Welcome to Dabble
      </h1>

      <div className="max-w-2xl space-y-4">
        <p className="text-lg text-[var(--text-muted-color)]">
          This project was inspired by my master's thesis project, where I
          prototyped an interactive system that would enable dance practitioners
          to visualize and trace the trajectories of their careers, highlighting
          moments, both dance and non-dance related, that they deemed valuable
          for their own archive.
        </p>
        <p className="text-lg text-[var(--text-muted-color)]">
          Inspired by my own trajectories into dance practices and other
          activities, I created Dabble to prototype this into a web application
          for my own archiving and visualization exploration.
        </p>
        <p className="text-lg text-[var(--text-muted-color)]">
          The data that is presented here is my own personal data. If you're
          curious about trying this out yourself, you can start one yourself by
          resetting the data here, and adding your own data from your hobbies
          and practices! Think of it like a digital journal to track progress
          and moments.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`rounded-md border p-3 text-sm ${statusBannerClasses[statusMessage.type]}`}
          role="status"
        >
          {statusMessage.text}
        </div>
      )}

      <div className="mt-8 rounded-md border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-[var(--text-color)]">
          Backup &amp; Restore
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted-color)]">
          Export everything - entries and categories - as a single JSON file you
          can keep as a backup or move to another device. Import replaces
          whatever is currently loaded with the contents of the file you pick,
          so it's also how you'd load your own exported data back in (e.g. after
          using "Start Your Own Constellation" below).
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportData}
            className="rounded-md border-2 border-indigo-500 bg-transparent px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/10"
          >
            Export Data
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-md border-2 border-indigo-500 bg-transparent px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/10"
          >
            Import Data
          </button>
          {/* Hidden - triggered programmatically by the "Import Data"
           * button above via fileInputRef, so the visible control can be
           * styled consistently with Export Data rather than showing the
           * browser's default file-input chrome. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="mt-8 rounded-md border border-red-500/40 bg-red-500/5 p-4">
        <h2 className="text-lg font-semibold text-[var(--text-color)]">
          Start Your Own Constellation
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted-color)]">
          This app comes pre-loaded with my own dance history as example data.
          If you'd rather track your own activities from scratch, this
          permanently clears everything - all entries and categories - and
          starts you with a blank constellation.
        </p>
        <button
          type="button"
          onClick={handleStartOwnConstellation}
          className="mt-3 rounded-md border-2 border-red-500 bg-transparent px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
        >
          Start Your Own Constellation
        </button>
      </div>

      <p className="mt-8 text-sm text-[var(--text-muted-color)]">
        Learn more about the story of this project, version history, and
        upcoming plans for it in the About tab.
      </p>
    </div>
  );
}
