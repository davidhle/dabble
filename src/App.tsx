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
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Chart from './pages/Chart';
import About from './pages/About';
import { Entry } from './types/Entry';

function App() {
  /**
   * ENTRIES STATE
   *
   * This is the primary application state - an array of Entry objects.
   * Initialized as an empty array.
   *
   * STATE IMMUTABILITY:
   * We always create new arrays when updating (via spread or concat)
   * rather than mutating the existing array. This:
   * - Ensures React detects changes and re-renders
   * - Makes state changes predictable and traceable
   * - Enables potential future optimizations (memoization)
   *
   * PERSISTENCE NOTE:
   * Currently entries are stored only in memory and lost on refresh.
   * To persist entries, you could:
   * - Save to localStorage in useEffect
   * - Initialize from localStorage in useState
   * - Sync with a backend API
   */
  const [entries, setEntries] = useState<Entry[]>([]);

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
    setEntries((prevEntries) => {
      const newEntries = [...prevEntries, entry];

      // Additional logging at the point of update
      console.log('Adding new entry:', entry);
      console.log('New entries count:', newEntries.length);

      return newEntries;
    });
  };

  /**
   * RENDER
   *
   * The component tree structure:
   *
   * BrowserRouter (enables client-side routing)
   *   └── Routes (route matching container)
   *         └── Route path="/" (matches all routes starting with /)
   *               └── Layout (navbar + outlet, receives onAddEntry)
   *                     ├── Route index (/) → Home
   *                     ├── Route /chart → Chart
   *                     └── Route /about → About
   *
   * PASSING PROPS TO LAYOUT:
   * We pass onAddEntry to Layout via the element prop.
   * React Router v6 requires this pattern for passing props
   * to route components.
   *
   * FUTURE CONSIDERATIONS:
   * If more components need access to entries, we could:
   * 1. Pass entries to Layout and use Outlet context
   * 2. Create an EntriesContext provider here
   * 3. Use a state management library
   */
  return (
    <BrowserRouter>
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
        <Route path="/" element={<Layout onAddEntry={addEntry} />}>
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
          <Route path="chart" element={<Chart />} />
          <Route path="about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
