/**
 * Layout.tsx - Main Application Layout with Navigation
 *
 * This component serves as the shell for the entire application, providing:
 * - Consistent navigation header across all pages
 * - '+' button to add new entries (opens modal form)
 * - Container for page content via React Router's Outlet
 *
 * STATE MANAGEMENT ARCHITECTURE:
 *
 * The Layout receives one entries-related prop from App.tsx:
 * - onAddEntry: Callback to add new entries to the app state
 *
 * Local state managed here:
 * - isModalOpen: Controls visibility of the AddEntryForm modal
 *
 * DATA FLOW:
 * 1. User clicks '+' button -> isModalOpen = true
 * 2. AddEntryForm renders in modal
 * 3. User fills form and submits
 * 4. onAddEntry callback is called (passes entry up to App.tsx)
 * 5. Modal closes (isModalOpen = false)
 *
 * PROPS VS LOCAL STATE DECISION:
 * - Modal open/close state is LOCAL because:
 *   - Only Layout needs to know about modal visibility
 *   - No other component cares if the modal is open
 *   - Keeps state close to where it's used
 *
 * - Entries array is in PARENT (App.tsx) because:
 *   - Multiple components may need access to entries
 *   - Entries need to persist across page navigation
 *   - Centralized state makes debugging easier
 */

import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import AddEntryForm from './AddEntryForm';
import ThemeToggle from './ThemeToggle';
import { Entry } from '../types/Entry';

/** Props interface for Layout component */
interface LayoutProps {
  /** Callback to add a new entry to the app state (defined in App.tsx) */
  onAddEntry: (entry: Entry) => void;
  /** Callback to replace an existing entry (by id) in the app state (defined in App.tsx) */
  onUpdateEntry: (entry: Entry) => void;
  /** The entry currently open in AddEntryForm's edit mode, or null - see App.tsx's `editingEntry` state. */
  editingEntry: Entry | null;
  /** Setter for `editingEntry` (App.tsx's `setEditingEntry`) - used here to clear it once the form closes. */
  onEditEntry: (entry: Entry | null) => void;
}

export default function Layout({
  onAddEntry,
  onUpdateEntry,
  editingEntry,
  onEditEntry,
}: LayoutProps) {
  /**
   * LOCAL STATE: Modal visibility
   *
   * This state is purely UI-related and doesn't need to be
   * lifted to the parent. The modal's open/close state:
   * - Doesn't affect other components
   * - Doesn't need to persist across navigation
   * - Is entirely contained within this component's domain
   */
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Opens the entry form modal
   * Called when user clicks the '+' button in the navbar
   */
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  /**
   * Closes the entry form modal
   * Called by AddEntryForm on cancel or successful submit.
   *
   * ADD VS. EDIT: AddEntryForm renders through this ONE modal regardless
   * of mode (see `isOpen`/`editingEntry` on the AddEntryForm below), so
   * this one handler needs to close whichever mode is actually active -
   * clearing `editingEntry` (back to add-mode's null) when a specific
   * entry was being edited, or just hiding the modal via `isModalOpen`
   * when it was in plain add mode.
   */
  const handleCloseModal = () => {
    if (editingEntry) {
      onEditEntry(null);
    } else {
      setIsModalOpen(false);
    }
  };

  /**
   * Handles new entry submission
   *
   * This function acts as an intermediary between the form and App.tsx.
   * It could be extended to:
   * - Show success notifications
   * - Handle errors
   * - Perform optimistic updates
   *
   * Currently it simply passes the entry up to the parent's handler.
   */
  const handleAddEntry = (entry: Entry) => {
    onAddEntry(entry);
    // Modal closing is handled by AddEntryForm calling onClose
  };

  return (
    // canvas-vignette-bg (see index.css): this outer shell used to be a
    // flat bg-[var(--bg-color)] - which would still show through behind/
    // around Home.tsx/About.tsx's content (the padding around `main`
    // below, and any shorter-than-viewport page) as a visibly FLATTER
    // background than StarMap.tsx's own vignetted canvas on Constellation.
    // This shell paints the exact same radial vignette StarMap does - see
    // .canvas-vignette-bg's own comment in index.css for why
    // `background-attachment: fixed` is what keeps the two perfectly
    // seamless with each other despite being separate elements. The
    // navbar below no longer paints its own copy of this (see its own
    // comment) - now that it's three separate floating pills rather than
    // one solid bar, this shell's own background is what shows through
    // the transparent gaps between/around them.
    <div className="canvas-vignette-bg min-h-screen">
      {/*
       * ─────────────────────────────────────────────────────────────
       * NAVIGATION: THREE FLOATING PILLS, NOT ONE SOLID BAR
       * ─────────────────────────────────────────────────────────────
       * Three independent capsule-shaped groups instead of one
       * full-width bar (Open Foundry's navbar pattern), grouped by what
       * each link actually DOES rather than by left/right positioning
       * alone:
       *   - LEFT: 'Dabble' (the home link - clicking the wordmark itself
       *     now navigates to '/', replacing the old separate "Home" text
       *     link entirely) + 'About' - the two non-visualization,
       *     informational pages.
       *   - CENTER: the three visualization views (Constellation, Linear
       *     Timeline, Spiral Timeline) - grouped together since they're
       *     the app's actual content views, distinct from the
       *     informational pages on the left. No divider needed between
       *     them the way the old single-bar layout needed one between
       *     Home/About and this group - three separate pills ARE the
       *     divider now.
       *   - RIGHT: the '+' add-entry button alone - the one action
       *     (create something) rather than a place to navigate to,
       *     visually distinct from both link groups by being its own
       *     pill rather than just the rightmost item in a shared bar.
       *
       * TRANSPARENT NEGATIVE SPACE - MUST STAY CLICK/DRAG-THROUGH:
       * `<nav>` itself is `pointer-events-none` and paints no background
       * of its own - it's purely a positioning/landmark wrapper, not a
       * visible bar. Only each individual pill re-enables
       * `pointer-events-auto`. This matters because StarMap.tsx/
       * LinearTimeline.tsx/SpiralTimeline.tsx's canvases render `fixed
       * inset-0` UNDERNEATH this nav (z-0 vs. z-10) - the old navbar was
       * fully OPAQUE and covered its entire strip, so it never mattered
       * that a plain full-width `<nav>` div also captures pointer events
       * across its whole box by default (transparent background does NOT
       * stop hit-testing - only `pointer-events: none` does). Now that
       * the space between/around the three pills is meant to show (and
       * stay interactive with) the canvas underneath, a naively opaque-
       * looking-but-still-hit-testing full-width wrapper would silently
       * swallow every drag/click/scroll in that entire top strip except
       * where a pill happens to sit - exactly the bug this
       * pointer-events-none/pointer-events-auto split prevents.
       *
       * z-10: same tier as before - above a canvas (z-0), below the
       * sidebar overlay (z-30) and the AddEntryForm modal (z-50). `fixed`
       * (not the old normal-flow block) since three separately-shaped
       * pills can't stack into a single predictable height the way one
       * `h-16` bar did - `main`'s own `pt-24` below compensates with a
       * fixed clearance instead of relying on flow height.
       */}
      <nav
        className="pointer-events-none fixed inset-x-0 top-0 z-10"
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-start gap-4 px-4 pt-4 sm:px-6 lg:px-8">
          {/*
           * Shared pill styling across all three: `--panel-bg-color-solid`
           * + `--panel-border-color` + `shadow-lg` + `backdrop-blur` is
           * the exact same "floating chrome sitting directly over a
           * canvas" language ResetButton.tsx/ThemeToggle.tsx already use,
           * reused here rather than inventing a second visual style for
           * the same kind of floating object. `rounded-full` (not
           * `rounded-lg`/`rounded-xl`) is what makes each a true
           * capsule/pill given their fixed heights, matching Open
           * Foundry's fully-rounded segments.
           */}

          {/* LEFT PILL: Dabble (home) + About */}
          <div
            className="pointer-events-auto flex items-center gap-6 justify-self-start rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] px-5 py-2.5 shadow-lg backdrop-blur"
            aria-label="Site links"
          >
            <Link to="/" className="text-lg font-bold text-indigo-600">
              Dabble
            </Link>
            <Link
              to="/about"
              className="text-sm font-medium text-[var(--text-muted-color)] transition-colors hover:text-[var(--text-color)]"
            >
              About
            </Link>
          </div>

          {/* CENTER PILL: the three visualization views */}
          <div
            className="pointer-events-auto flex items-center gap-6 justify-self-center rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] px-5 py-2.5 shadow-lg backdrop-blur"
            aria-label="Visualization views"
          >
            <Link
              to="/constellation"
              className="text-sm font-medium text-[var(--text-muted-color)] transition-colors hover:text-[var(--text-color)]"
            >
              Constellation
            </Link>
            <Link
              to="/linear"
              className="text-sm font-medium text-[var(--text-muted-color)] transition-colors hover:text-[var(--text-color)]"
            >
              Linear Timeline
            </Link>
            <Link
              to="/spiral"
              className="text-sm font-medium text-[var(--text-muted-color)] transition-colors hover:text-[var(--text-color)]"
            >
              Spiral Timeline
            </Link>
          </div>

          {/* RIGHT PILL: '+' add-entry button alone */}
          <div className="pointer-events-auto flex items-center justify-self-end rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] p-1.5 shadow-lg backdrop-blur">
            {/**
             * ADD ENTRY BUTTON
             *
             * This '+' button is the primary entry point for creating new entries.
             * Design considerations:
             * - Positioned on the right for visibility and common UX patterns
             * - Uses indigo color to match brand and indicate primary action
             * - Circle shape with '+' icon follows common mobile/web patterns
             * - Hover state provides visual feedback
             * - aria-label for accessibility (screen readers)
             *
             * EditModeBanner.tsx/VizEmptyState.tsx's shared top-right
             * tooltip stack (see utils/topRightTooltipStack.ts) anchors
             * directly below THIS button/pill - its `TOP_SLOT` constant
             * assumes this pill's own top offset (`pt-4`) and height
             * (`p-1.5` around this `h-10` button), so changing either
             * here means revisiting that constant too.
             */}
            <button
              onClick={handleOpenModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label="Add new entry"
              title="Add new entry"
            >
              {/* Plus icon using SVG for crisp rendering at any size */}
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      {/*
       * pt-24 (not the old py-8's uniform top/bottom): the navbar above
       * is now `fixed` (out of normal document flow) instead of a
       * `h-16` block pushing this down for free - see the nav's own
       * comment for why three independently-shaped pills can't do that
       * the way one fixed-height bar could. This fixed clearance keeps
       * page content (and Constellation.tsx/Timeline.tsx/Spiral.tsx's
       * own measured header block - see e.g. Constellation.tsx's
       * `headerLayout` comment) starting safely below the tallest pill
       * regardless, and remains a LIVE measurement wherever it reads off
       * this element's actual rendered position, so nothing downstream
       * needs updating if this value changes. `px-4 sm:px-6 lg:px-8`/
       * `mx-auto max-w-7xl` are unchanged from before - Constellation.tsx's
       * own `left` measurement comment explicitly depends on this exact
       * horizontal class set staying put.
       */}
      <main className="mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {/**
         * OUTLET - React Router's placeholder for nested routes
         *
         * This renders the component for the current route:
         * - "/" renders Home
         * - "/linear" renders Timeline
         * - "/about" renders About
         *
         * The Layout wraps all routes, so the navbar persists
         * while the content below changes based on navigation.
         */}
        <Outlet />
      </main>

      {/**
       * ADD ENTRY FORM MODAL
       *
       * The modal is rendered here at the Layout level because:
       * 1. It should be accessible from any page (via the '+' button)
       * 2. It overlays the entire app, not just specific pages
       * 3. Its state (open/close) is managed by Layout
       *
       * Props passed to AddEntryForm:
       * - isOpen: Controls visibility - true for plain add mode
       *   (isModalOpen, from local state) OR edit mode (editingEntry set,
       *   from App.tsx)
       * - onClose: Callback to close modal (local handleCloseModal, which
       *   itself picks the right thing to clear - see its own comment)
       * - onSubmit: Callback to add a brand-new entry (passed from App.tsx)
       * - onUpdate: Callback to replace-by-id an existing entry (passed
       *   from App.tsx) - used instead of onSubmit whenever `editingEntry`
       *   is set
       * - editingEntry: The entry being edited, or null for add mode - see
       *   AddEntryForm.tsx's own ADD VS. EDIT MODE comment for how it
       *   changes the form's behavior
       */}
      <AddEntryForm
        isOpen={isModalOpen || editingEntry !== null}
        onClose={handleCloseModal}
        onSubmit={handleAddEntry}
        onUpdate={onUpdateEntry}
        editingEntry={editingEntry}
      />

      {/*
       * Rendered here (not per-page like ResetButton) so the toggle is
       * available on every page, including Home/About - see
       * ThemeToggle.tsx's own header comment for its positioning relative
       * to ResetButton's bottom-right corner.
       */}
      <ThemeToggle />
    </div>
  );
}
