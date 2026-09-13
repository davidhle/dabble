/**
 * App.tsx - Root Application Component
 *
 * This is the top-level component that:
 * 1. Manages global application state (entries array)
 * 2. Sets up React Router for client-side navigation
 * 3. Provides state and callbacks to child components via props
 *
 * STATE MANAGEMENT ARCHITECTURE:
 *
 * The application follows a "lifting state up" pattern where:
 * - App.tsx holds the canonical entries array in useState
 * - Child components receive entries (or callbacks) via props
 * - Updates flow upward via callback functions
 *
 * WHY THIS PATTERN?
 * - Single source of truth: Only one place to look for entries
 * - Predictable updates: All changes go through one setState
 * - Easy debugging: console.log in one place shows all changes
 * - Testable: Components don't depend on global state
 *
 * ALTERNATIVE APPROACHES (for future scaling):
 * 1. Context API - If many deeply nested components need entries
 * 2. Redux/Zustand - If state logic becomes complex
 * 3. React Query - If entries come from a backend API
 *
 * CURRENT DATA FLOW:
 *
 *                    App.tsx
 *                   /        \
 *           [entries]    [addEntry]
 *                 |           |
 *              Layout ←───────┘
 *                 |
 *          AddEntryForm
 *
 * 1. entries state lives in App.tsx
 * 2. addEntry callback is passed to Layout
 * 3. Layout passes it to AddEntryForm
 * 4. Form calls addEntry with new entry
 * 5. App.tsx updates state, triggering re-render
 * 6. useEffect logs entries to console
 */

import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Timeline from './pages/Timeline';
import Spiral from './pages/Spiral';
import Constellation from './pages/Constellation';
import About from './pages/About';
import { Entry } from './types/Entry';
import { loadEntries, saveEntries } from './utils/entriesStorage';
import { initializeDefaultDataForFirstVisit } from './utils/initializeFirstVisit';
import { TimeRangeProvider } from './context/TimeRangeContext';
import { EntrySelectionProvider } from './context/EntrySelectionContext';
import { EditModeProvider } from './context/EditModeContext';

function App() {
  /**
   * ENTRIES STATE
   *
   * This is the primary application state - an array of Entry objects.
   * Initialized lazily from localStorage (see PERSISTENCE below) rather
   * than an empty array, so a returning user's entries survive a refresh.
   *
   * STATE IMMUTABILITY:
   * We always create new arrays when updating (via spread or concat)
   * rather than mutating the existing array. This:
   * - Ensures React detects changes and re-renders
   * - Makes state changes predictable and traceable
   * - Enables potential future optimizations (memoization)
   *
   * PERSISTENCE:
   * Entries are persisted to localStorage under 'dabble-entries' (see
   * utils/entriesStorage.ts) - initialized here via useState's lazy
   * initializer form (a function, not a call) so loadEntries() only runs
   * once on mount rather than on every render, and saved back via the
   * dedicated useEffect below whenever `entries` changes.
   *
   * FIRST-VISIT DEFAULT:
   * initializeDefaultDataForFirstVisit() runs first, inside this same
   * lazy initializer - see utils/initializeFirstVisit.ts for the full
   * first-visit-default-vs-localStorage-source-of-truth explanation. In
   * short: on a visitor's first-ever load (no 'dabble-entries' key yet)
   * it persists a bundled real dataset (and matching categories) into
   * localStorage before loadEntries() below ever reads it; on every
   * subsequent load it's a no-op and loadEntries() just returns whatever
   * is actually stored - the visitor's own data, or a deliberately empty
   * array from an explicit reset (see the "Start Your Own Constellation"
   * button in About.tsx).
   */
  const [entries, setEntries] = useState<Entry[]>(() => {
    initializeDefaultDataForFirstVisit();
    return loadEntries();
  });

  /**
   * EFFECT: Persist entries to localStorage whenever they change
   *
   * Separate from the logging effect below (different concern: this one
   * has an actual side effect other code depends on, not just debugging
   * output) even though both key off the same `entries` dependency.
   */
  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  /**
   * EFFECT: Log entries whenever they change
   *
   * This effect runs after every render where entries has changed.
   * Useful for debugging and verifying state updates.
   *
   * The dependency array [entries] means:
   * - Effect runs on mount (initial render)
   * - Effect runs whenever entries reference changes
   * - Effect does NOT run for other state/prop changes
   *
   * WHY USEEFFECT FOR LOGGING?
   * - console.log in render body runs on EVERY render
   * - useEffect with deps only runs when entries actually change
   * - Cleaner separation of "what to render" vs "side effects"
   */
  useEffect(() => {
    /**
     * Log format designed for easy debugging:
     * - Clear header for visual scanning
     * - Entry count for quick verification
     * - Full entries array for detailed inspection
     *
     * In production, you might:
     * - Remove these logs entirely
     * - Send to an analytics service
     * - Only log in development mode
     */
    console.log('===== ENTRIES STATE UPDATED =====');
    console.log(`Total entries: ${entries.length}`);
    console.log('Entries array:', entries);

    // Log each entry individually for easier inspection
    if (entries.length > 0) {
      console.log('Latest entry:', entries[entries.length - 1]);
    }

    console.log('=================================');
  }, [entries]);

  /**
   * ADD ENTRY CALLBACK
   *
   * This function is passed down to Layout → AddEntryForm.
   * It adds a new entry to the entries array.
   *
   * IMPLEMENTATION NOTES:
   *
   * 1. We use the functional form of setState: (prev) => newState
   *    This ensures we're working with the latest state value,
   *    which is important if multiple rapid updates occur.
   *
   * 2. We spread the previous array and add the new entry at the end.
   *    This creates a NEW array, ensuring React detects the change.
   *
   * 3. The function is defined here (not inline in JSX) for:
   *    - Readability
   *    - Potential memoization with useCallback
   *    - Easier testing
   *
   * CALLBACK STABILITY:
   * Currently this function is recreated on every render.
   * If performance becomes an issue (unlikely with few entries),
   * wrap with useCallback:
   *
   * const addEntry = useCallback((entry: Entry) => {
   *   setEntries((prev) => [...prev, entry]);
   * }, []);
   */
  const addEntry = (entry: Entry) => {
    setEntries(prevEntries => {
      const newEntries = [...prevEntries, entry];

      // Additional logging at the point of update
      console.log('Adding new entry:', entry);
      console.log('New entries count:', newEntries.length);

      return newEntries;
    });
  };

  /**
   * EDITING STATE
   *
   * The single entry (if any) currently open in AddEntryForm's edit mode -
   * null means the form, if open at all, is in its normal 'add' mode. Set
   * by clicking the edit (pencil) button on an EXPANDED sidebar panel (see
   * EntryPanel.tsx -> SidebarPanelStack.tsx -> each visualization page's
   * `onEditEntry` prop below), and cleared by Layout.tsx once the form
   * closes (Cancel, the backdrop, or a successful Update).
   *
   * Lives here (not in Layout, which actually renders AddEntryForm)
   * because entries state does too, and because the pencil button that
   * sets it lives several layers below Layout, in each page's sidebar -
   * passing it down as a prop the same way `entries` itself already is
   * (see the Route elements below) needs no new plumbing (Outlet context,
   * another provider) beyond what's already here.
   */
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  /**
   * UPDATE ENTRY CALLBACK
   *
   * The edit counterpart to addEntry above - REPLACES the entry whose id
   * matches `updatedEntry.id` in place, rather than appending a new one.
   * AddEntryForm's edit mode always preserves the original entry's id (see
   * its own ADD VS. EDIT MODE comment), so this only ever matches exactly
   * one entry; every other entry in the array passes through untouched.
   */
  const updateEntry = (updatedEntry: Entry) => {
    setEntries(prevEntries =>
      prevEntries.map(entry =>
        entry.id === updatedEntry.id ? updatedEntry : entry
      )
    );
  };

  /**
   * RENDER
   *
   * The component tree structure:
   *
   * TimeRangeProvider (shared time-range filter - see its own top-of-file
   *   comment for why it wraps the router rather than living inside a page)
   *   └── HashRouter (enables client-side routing)
   *         └── Routes (route matching container)
   *               └── Route path="/" (matches all routes starting with /)
   *                     └── Layout (navbar + outlet, receives onAddEntry)
   *                           ├── Route index (/) → Home
   *                           ├── Route /linear → Timeline
   *                           └── Route /about → About
   *
   * PASSING PROPS TO LAYOUT:
   * We pass onAddEntry to Layout via the element prop.
   * React Router v6 requires this pattern for passing props
   * to route components.
   *
   * FUTURE CONSIDERATIONS:
   * If more components need access to entries, we could:
   * 1. Pass entries to Layout and use Outlet context
   * 2. Create an EntriesContext provider here (TimeRangeProvider below is
   *    exactly this pattern already, just scoped to the time-range slice
   *    of state rather than `entries` itself - see its own comment)
   * 3. Use a state management library
   */
  return (
    // TimeRangeProvider, EntrySelectionProvider, AND EditModeProvider all
    // wrap EVERYTHING that follows, including HashRouter itself - see
    // TimeRangeContext.tsx's top-of-file "WHY THIS LIVES ABOVE THE ROUTER"
    // comment (and EntrySelectionContext.tsx's/EditModeContext.tsx's own,
    // identical-in-spirit comments) for why: a provider that's a PARENT of
    // the router never unmounts when routes change (only the router's own
    // children do), so `selectedRange`, the sidebar's selection/filter/sort
    // state, AND `isEditMode` all survive navigating between
    // Constellation/Timeline/Spiral instead of resetting every time. The
    // first two are passed the same `entries` state this component already
    // owns - see each context file for what it derives from that
    // (fullRange; categories) - EditModeProvider needs no such input, since
    // `isEditMode` is just a standalone flag.
    <TimeRangeProvider entries={entries}>
      <EntrySelectionProvider entries={entries}>
        <EditModeProvider>
          {/* HashRouter (URLs like /dabble/#/constellation) instead of BrowserRouter
          is a deliberate trade-off for static GitHub Pages hosting: Pages has no
          server-side rewrite rule, so a direct load or refresh of a BrowserRouter
          path like /dabble/constellation would 404. The hash portion of the URL
          never reaches the server, so GitHub Pages just serves index.html and
          React Router handles the rest client-side. Given the deployment
          timeline, this was chosen over adding a 404.html redirect workaround. */}
          <HashRouter>
            <Routes>
              {/**
               * Parent route with Layout
               *
               * The Layout component wraps all child routes, providing:
               * - Consistent navbar across all pages
               * - AddEntry modal accessible from any page
               * - Main content container
               *
               * The onAddEntry prop enables the Layout (and its AddEntryForm)
               * to add entries to the state managed here.
               */}
              <Route
                path="/"
                element={
                  <Layout
                    onAddEntry={addEntry}
                    onUpdateEntry={updateEntry}
                    editingEntry={editingEntry}
                    onEditEntry={setEditingEntry}
                  />
                }
              >
                {/**
                 * Child routes render inside Layout's <Outlet />
                 *
                 * These components could receive entries as props if needed.
                 * Currently they don't need entries, but here's how you'd do it:
                 *
                 * <Route
                 *   index
                 *   element={<Home entries={entries} />}
                 * />
                 *
                 * Or use Outlet context in Layout to pass data.
                 */}
                <Route index element={<Home />} />
                <Route path="about" element={<About />} />
                <Route
                  path="constellation"
                  element={
                    <Constellation
                      entries={entries}
                      onEditEntry={setEditingEntry}
                    />
                  }
                />
                <Route
                  path="linear"
                  element={
                    <Timeline entries={entries} onEditEntry={setEditingEntry} />
                  }
                />
                <Route
                  path="spiral"
                  element={
                    <Spiral entries={entries} onEditEntry={setEditingEntry} />
                  }
                />
              </Route>
            </Routes>
          </HashRouter>
        </EditModeProvider>
      </EntrySelectionProvider>
    </TimeRangeProvider>
  );
}

export default App;
