/**
 * Layout.tsx - Main Application Layout with Navigation
 *
 * This component serves as the shell for the entire application, providing:
 * - Consistent navigation header across all pages
 * - '+' button to add new entries (opens modal form)
 * - Gear button to open the Settings modal (SettingsModal.tsx)
 * - Container for page content via React Router's Outlet
 *
 * STATE MANAGEMENT ARCHITECTURE:
 *
 * The Layout receives one entries-related prop from App.tsx:
 * - onAddEntry: Callback to add new entries to the app state
 *
 * Local state managed here:
 * - isModalOpen: Controls visibility of the AddEntryForm modal
 * - isSettingsOpen: Controls visibility of the SettingsModal
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

import { useCallback, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import AddEntryForm from './AddEntryForm';
import ManageCategoriesModal from './ManageCategoriesModal';
import SettingsModal from './SettingsModal';
import ThemeToggle from './ThemeToggle';
import { Entry } from '../types/Entry';
import { useEntrySelectionContext } from '../context/EntrySelectionContext';

/** Props interface for Layout component */
interface LayoutProps {
  /** The full, unfiltered entries array (App.tsx's own `entries` state) - passed through to AddEntryForm, which needs it to check whether an entry being deleted is the last one in its category. */
  entries: Entry[];
  /** Callback to add a new entry to the app state (defined in App.tsx) */
  onAddEntry: (entry: Entry) => void;
  /** Callback to replace an existing entry (by id) in the app state (defined in App.tsx) */
  onUpdateEntry: (entry: Entry) => void;
  /** Callback to remove an entry (by id) from the app state (defined in App.tsx) */
  onDeleteEntry: (entryId: string) => void;
  /** The entry currently open in AddEntryForm's edit mode, or null - see App.tsx's `editingEntry` state. */
  editingEntry: Entry | null;
  /** Setter for `editingEntry` (App.tsx's `setEditingEntry`) - used here to clear it once the form closes. */
  onEditEntry: (entry: Entry | null) => void;
}

/** Routes whose page is a full-bleed canvas + left sidebar - see `main` below. */
const VIZ_PATHS = new Set(['/constellation', '/linear', '/spiral']);

/**
 * Center-pill link styling. Active: an accent capsule with
 * --accent-foreground-color text - the same text-on-accent pairing
 * FilterBar's active chips and the '+' button use, since --accent-color
 * flips light/dark per theme (see index.css). NavLink sets
 * `aria-current="page"` on the active one too.
 */
function vizNavLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-[var(--accent-color)] text-[var(--accent-foreground-color)] shadow-sm'
      : 'text-[var(--text-muted-color)] hover:text-[var(--text-color)]'
  }`;
}

export default function Layout({
  entries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  editingEntry,
  onEditEntry,
}: LayoutProps) {
  // Read directly from the context (not the per-page useEntrySelection
  // hook) so this doesn't register/unregister a page-level `onFullReset`
  // handler here - Layout isn't a page, and doing so via the thin hook
  // would clobber whichever page (Constellation/Timeline/Spiral) is
  // currently mounted and has already registered its own canvas reset -
  // see EntrySelectionContext.tsx's "onFullReset STAYS PAGE-SPECIFIC"
  // comment. `handleClosePanel` itself doesn't touch that registration,
  // so reading it straight from the context is safe here.
  const {
    handleClosePanel,
    isManageCategoriesModalOpen,
    closeManageCategoriesModal,
    refreshCategories,
  } = useEntrySelectionContext();

  // The three visualization pages anchor their sidebar to the screen's
  // left edge (see `main` below) rather than to a centered content column.
  const { pathname } = useLocation();
  const isVizPage = VIZ_PATHS.has(pathname);
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

  /** Settings modal visibility - same local-state reasoning as isModalOpen above. */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

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

  /**
   * Handles a confirmed entry deletion from AddEntryForm's edit-mode
   * "Delete Entry" flow. Two things need to happen beyond removing the
   * entry from App.tsx's state (onDeleteEntry): if that entry's panel is
   * currently open in the sidebar stack, it needs to come out of there
   * too - `handleClosePanel` is the exact same removal EntryPanel.tsx's
   * own close button already triggers, so a deleted entry disappears from
   * the sidebar the same way a manually-closed one does. (AddEntryForm
   * itself calls onClose to dismiss the modal once this returns.)
   */
  const handleDeleteEntry = (entryId: string) => {
    onDeleteEntry(entryId);
    handleClosePanel(entryId);
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
       *   - RIGHT: the Settings gear + the '+' add-entry button - actions
       *     rather than places to navigate to, visually distinct from both
       *     link groups by being their own pill rather than just the
       *     rightmost items in a shared bar.
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
        {/*
         * Full viewport width (no `max-w-7xl` column), inset by
         * --edge-gutter (index.css) - so the left/right pills sit a
         * viewport-scaled distance from the true screen edges rather than
         * drifting inward toward a centered 1280px column on wide monitors.
         */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 px-[var(--edge-gutter)] pt-4">
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
            {/*
             * style (not a Tailwind class): --font-wordmark (Chonburi -
             * see index.css's own comment) has no Tailwind utility of its
             * own, the same reason VizPageHeader.tsx reaches for inline
             * `style` to apply its own CSS-variable-driven text-shadow.
             * A distinct display face from --font-heading's 'Bree Serif',
             * reserved just for this one brand mark rather than general
             * heading use. text-[var(--accent-color)] (not a hardcoded
             * text-indigo-600) so this stays in sync with every other
             * control that uses the app's one shared accent token - see
             * that variable's own comment in index.css. Lowercase
             * 'dabble' (not 'Dabble') is a deliberate brand-mark styling
             * choice, independent of Title (page titles, etc.) casing.
             */}
            <Link
              to="/"
              className="text-lg font-bold text-[var(--accent-color)]"
              style={{ fontFamily: 'var(--font-wordmark)' }}
            >
              dabble
            </Link>
            <Link
              to="/about"
              className="text-sm font-medium text-[var(--text-muted-color)] transition-colors hover:text-[var(--text-color)]"
            >
              About
            </Link>
          </div>

          {/*
           * CENTER PILL: the three visualization views, as a segmented
           * control - the current page's link gets an inner accent-filled
           * capsule (`vizNavLinkClass`). Padding moves from the pill onto
           * each link so the capsule hugs just its own label while the
           * pill keeps its old overall size.
           */}
          <div
            className="pointer-events-auto flex items-center gap-1 justify-self-center rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] p-1.5 shadow-lg backdrop-blur"
            aria-label="Visualization views"
          >
            <NavLink to="/constellation" className={vizNavLinkClass}>
              Constellation
            </NavLink>
            <NavLink to="/linear" className={vizNavLinkClass}>
              Linear Timeline
            </NavLink>
            <NavLink to="/spiral" className={vizNavLinkClass}>
              Spiral Timeline
            </NavLink>
          </div>

          {/* RIGHT PILL: Settings gear + '+' add-entry button */}
          <div className="pointer-events-auto flex items-center gap-1 justify-self-end rounded-full border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] p-1.5 shadow-lg backdrop-blur">
            {/**
             * ADD ENTRY BUTTON
             *
             * This '+' button is the primary entry point for creating new entries.
             * Design considerations:
             * - Positioned on the right for visibility and common UX patterns
             * - Uses --accent-color (the app's one shared accent token -
             *   see index.css) to match brand and indicate primary action;
             *   --accent-foreground-color for the icon/text on top of it,
             *   since --accent-color itself flips light/dark per theme
             *   (see that token's own comment for why a fixed text-white
             *   wouldn't stay legible in both)
             * - Circle shape with '+' icon follows common mobile/web patterns
             * - hover:brightness-90 darkens whichever accent shade is
             *   currently active, rather than a hardcoded hover shade
             *   (Tailwind's indigo-700) that only made sense for one fixed
             *   accent color
             * - aria-label for accessibility (screen readers)
             *
             * EditModeBanner.tsx/VizEmptyState.tsx's shared top-right
             * tooltip stack (see utils/topRightTooltipStack.ts) anchors
             * directly below THIS button/pill - its `TOP_SLOT` constant
             * assumes this pill's own top offset (`pt-4`) and height
             * (`p-1.5` around these `h-10` buttons), so changing either
             * here means revisiting that constant too. The pill's WIDTH
             * doesn't matter to it: that stack is anchored by its right
             * edge, so the gear button widening the pill leftward never
             * moves it.
             */}
            {/*
             * SETTINGS BUTTON - same h-10 circle as '+' (so the pill's
             * height, and TOP_SLOT above, are unchanged) but a quiet,
             * non-accent style: it's secondary to the primary '+' action.
             * Hover treatment matches IconButton.tsx.
             */}
            <button
              type="button"
              onClick={openSettings}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted-color)] transition-colors hover:bg-[var(--field-tint-2)] hover:text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              aria-label="Settings"
              title="Settings"
            >
              {/* Gear icon (Heroicons outline cog-6-tooth) */}
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </button>
            <button
              onClick={handleOpenModal}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-color)] text-[var(--accent-foreground-color)] shadow-md transition-all hover:shadow-lg hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
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
       * needs updating if this value changes.
       *
       * Horizontal: Home/About keep the centered `mx-auto max-w-7xl`
       * reading column. The three visualization pages instead span the
       * full viewport inset by --edge-gutter (the same token the navbar
       * uses), so their sidebar lines up under the left nav pill and hugs
       * the screen edge on wide monitors. Their own `containerLayout.left`
       * measurement picks up whichever applies - nothing there hardcodes it.
       */}
      <main
        className={
          isVizPage
            ? // overflow-x-clip: a right-side sidebar slid mostly off-screen
              // when collapsed (index.css's COLLAPSED SIDEBAR) would
              // otherwise add a horizontal scrollbar.
              'overflow-x-clip px-[var(--edge-gutter)] pb-8 pt-24'
            : 'mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8'
        }
      >
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
        onDelete={handleDeleteEntry}
        editingEntry={editingEntry}
        entries={entries}
      />

      {/**
       * MANAGE CATEGORIES MODAL
       *
       * Opened by FilterBar's pencil button (on whichever page is
       * currently mounted) via EntrySelectionContext's
       * `isManageCategoriesModalOpen`/`openManageCategoriesModal` - see
       * that context's own comment for why this modal is mounted HERE
       * rather than inside FilterBar itself (the same
       * `backdrop-filter`-containing-block reason AddEntryForm's modal
       * above already needs to live at this level, not nested inside a
       * page's own blurred container). `entries` is this same Layout's
       * own prop, already the exact full/unfiltered array
       * ManageCategoriesModal needs to count each category's entries.
       */}
      <ManageCategoriesModal
        isOpen={isManageCategoriesModalOpen}
        onClose={closeManageCategoriesModal}
        entries={entries}
        onCategoriesChanged={refreshCategories}
      />

      {/**
       * SETTINGS MODAL
       *
       * Opened by the gear button in the right navbar pill. Mounted here,
       * like the two modals above, so it works from every page and sits
       * outside any page's own blurred container. Always mounted (it
       * renders nothing while closed) so it can reopen itself after an
       * import/reset reload - see SettingsModal.tsx's DATA SECTION comment.
       */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onOpen={openSettings}
        onClose={closeSettings}
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
