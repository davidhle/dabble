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
 * The Layout receives entries-related props from App.tsx:
 * - onAddEntry: Callback to add new entries to the app state
 * - entries: The full entries array. Layout doesn't render or transform
 *   this itself - it only needs `entries.length` (via `showMockDataBanner`
 *   below) to decide whether to show the "showing example data" badge
 *   next to the '+' button, which only makes sense on the Constellation
 *   route (checked via `useLocation()`) since that's the only page that
 *   falls back to mock data when entries is empty (see Constellation.tsx).
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
import { Link, Outlet, useLocation } from 'react-router-dom';
import AddEntryForm from './AddEntryForm';
import { Entry } from '../types/Entry';

/**
 * Props interface for Layout component
 *
 * DESIGN NOTE:
 * Layout doesn't transform or render `entries` itself - it's here only
 * so Layout can read `entries.length` for the mock-data navbar badge
 * (see `showMockDataBanner` below). Everything else about entries
 * (creating them) still flows one-way through `onAddEntry`.
 */
interface LayoutProps {
  /** Callback to add a new entry to the app state (defined in App.tsx) */
  onAddEntry: (entry: Entry) => void;
  /** The full entries array (defined in App.tsx) - see DESIGN NOTE above. */
  entries: Entry[];
}

export default function Layout({ onAddEntry, entries }: LayoutProps) {
  const location = useLocation();

  /**
   * Whether to show the "showing example data" badge next to the '+'
   * button. Moved here from Constellation.tsx so it renders as part of
   * the navbar's flex row instead of floating over the starfield (see
   * Constellation.tsx's `usingMockData`, which still separately decides
   * whether the star map itself falls back to mock entries - the two are
   * the same underlying condition, just each component reading `entries`
   * for its own purpose, not shared state).
   */
  const showMockDataBanner =
    location.pathname === '/constellation' && entries.length === 0;
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
   * Called by AddEntryForm on cancel or successful submit
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
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
    // bg-[var(--bg-color)]: this outer shell (not just the <nav> below,
    // which already used this token) used to be a plain light bg-gray-50 -
    // that would still show through behind/around Home.tsx/Chart.tsx/
    // About.tsx's content (the padding around `main` below, and any
    // shorter-than-viewport page) even after the navbar and those pages'
    // own content went dark, since none of them set a background of their
    // own. Same theme token as everything else - see index.css :root -
    // so the whole shell now matches uniformly.
    <div className="min-h-screen bg-[var(--bg-color)]">
      {/*
       * Navigation Bar
       * relative z-10: Constellation.tsx's StarMap now renders a `fixed`
       * full-viewport canvas (z-0). CSS always paints positioned elements
       * above non-positioned ones regardless of DOM order, so without an
       * explicit position + z-index here, that canvas would render on
       * top of this non-positioned navbar and cover it. z-10 keeps the
       * navbar on top, same tier as Constellation's page header/FilterBar
       * (also z-10); both stay below the sidebar overlay (z-30) and the
       * AddEntryForm modal (z-50).
       *
       * bg-[var(--bg-color)]: same theme token as StarMap's canvas and
       * the Constellation sidebar (see index.css :root), so the navbar
       * matches rather than being a separate white bar - text-gray-500/
       * hover:text-gray-700 (tuned for a white background) are adjusted
       * to text-gray-400/hover:text-gray-200 below to stay legible
       * against this now-dark background.
       */}
      <nav className="relative z-10 bg-[var(--bg-color)] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            {/* Left side: Logo and navigation links */}
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <span className="text-xl font-bold text-indigo-600">
                  Dabble
                </span>
              </div>
              <div className="ml-6 flex space-x-8">
                <Link
                  to="/"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-400 hover:border-gray-500 hover:text-gray-200"
                >
                  Home
                </Link>
                <Link
                  to="/chart"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-400 hover:border-gray-500 hover:text-gray-200"
                >
                  Chart
                </Link>
                <Link
                  to="/constellation"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-400 hover:border-gray-500 hover:text-gray-200"
                >
                  Constellation
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-400 hover:border-gray-500 hover:text-gray-200"
                >
                  About
                </Link>
              </div>
            </div>

            {/* Right side: mock-data badge (Constellation only) + Add Entry button */}
            <div className="flex items-center gap-3">
              {showMockDataBanner && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  Showing example data - add an entry to see your own
                </span>
              )}
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
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/**
         * OUTLET - React Router's placeholder for nested routes
         *
         * This renders the component for the current route:
         * - "/" renders Home
         * - "/chart" renders Chart
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
       * - isOpen: Controls visibility (from local state)
       * - onClose: Callback to close modal (local handler)
       * - onSubmit: Callback to add entry (passed from App.tsx)
       */}
      <AddEntryForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddEntry}
      />
    </div>
  );
}
