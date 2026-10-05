/**
 * Home.tsx - Landing / Introduction Page
 *
 * This page is the primary landing/introduction page for the MVP: it's
 * what a first-time visitor sees, so it carries the project's "what is
 * this and why" framing plus the "Start Your Own Constellation" reset.
 * About.tsx is reserved for project history and roadmap instead - see its
 * own top-of-file comment.
 *
 * DATA MANAGEMENT:
 * Export/Import now live only in the Settings modal (gear icon, top-right
 * navbar pill - see SettingsModal.tsx). "Start Your Own Constellation"
 * stays here as well as in Settings, since it's the call to action this
 * page's welcome copy leads into. The handler and the reload-driven status
 * message handoff are shared with Settings via hooks/useDataManagement.ts.
 */

import useDataManagement, {
  STATUS_BANNER_CLASSES,
} from '../hooks/useDataManagement';

/**
 * localStorage key the reset reload uses to hand a status message to the
 * NEXT page load - see useDataManagement's STATUS MESSAGE ACROSS RELOAD
 * comment for why this can't just be React state.
 */
const STATUS_MESSAGE_KEY = 'dabble-status-message';

export default function Home() {
  const { statusMessage, handleStartOwnConstellation } =
    useDataManagement(STATUS_MESSAGE_KEY);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-color)]">
        Welcome to Dabble
      </h1>

      <div className="space-y-4">
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
          className={`rounded-md border p-3 text-sm ${STATUS_BANNER_CLASSES[statusMessage.type]}`}
          role="status"
        >
          {statusMessage.text}
        </div>
      )}

      <div className="mt-8 rounded-md border border-red-500/40 bg-red-500/5 p-4">
        <h2 className="text-lg font-semibold text-[var(--text-color)]">
          Start Your Own Constellation
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted-color)]">
          This app comes pre-loaded with my own dance history as example data.
          If you'd rather track your own activities from scratch, this
          permanently clears everything - all entries and categories - and
          starts you with a blank constellation. To keep a backup first, or to
          load a previously exported file afterward, use Export Data and Import
          Data in Settings (the gear icon, top right).
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
