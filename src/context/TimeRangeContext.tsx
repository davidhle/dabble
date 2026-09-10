/**
 * TimeRangeContext.tsx - Shared, Cross-Page Time-Range Filter
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS LIVES ABOVE THE ROUTER, NOT INSIDE A PAGE
 * ──────────────────────────────────────────────────────────────────────
 * `selectedRange` is a user selection (dragged out on TimeRangeSelector.tsx's
 * brush) that should survive navigating away and back - e.g. narrowing the
 * Timeline view to 2023, clicking over to Constellation to look something
 * up, then clicking back to Timeline, should NOT have silently reset back
 * to the full range. If this state lived inside Timeline.tsx (the page
 * component) instead, React Router would unmount that component - and
 * therefore its state - every time the route changed away from it, so the
 * selection would be lost on every navigation.
 *
 * `TimeRangeProvider` is mounted in App.tsx wrapping `<HashRouter>`, at the
 * same level `entries` state already lives at (see App.tsx's own
 * comments) - a provider wrapping the router is a sibling-in-spirit of the
 * router's OWN persistence: routes mount/unmount as children of it, but
 * the provider component itself never does, so `selectedRange` (and
 * `fullRange`, computed from `entries`, which ALSO lives above the
 * router) survive every navigation for free, without needing localStorage
 * or a URL param to persist across route changes.
 *
 * Currently only Timeline.tsx actually reads/uses this context -
 * Constellation.tsx and Spiral.tsx don't filter by it (see Timeline.tsx's
 * own top-of-file comment for the full wiring) - but it's provided
 * app-wide from the start specifically so any of them could start
 * consuming the SAME shared selection later without replumbing where the
 * state lives.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Entry } from '../types/Entry';

export interface DateRange {
  start: Date;
  end: Date;
}

interface TimeRangeContextValue {
  /** The min/max date across ALL entries - see computeFullRange below. Never narrows; only widens as entries are added. */
  fullRange: DateRange;
  /** The user's current time-range selection - defaults to `fullRange` until narrowed via TimeRangeSelector.tsx's brush. */
  selectedRange: DateRange;
  /** Narrows (or widens) `selectedRange` - called by TimeRangeSelector.tsx on brush change. */
  setSelectedRange: (range: DateRange) => void;
  /**
   * Snaps `selectedRange` back to `fullRange` AND clears the "has the user
   * customized this" flag that `setSelectedRange` sets - see
   * `isCustomRangeRef` below for why that distinction matters. Called by
   * Timeline.tsx's `resetAll` (via useEntrySelection.ts's `onFullReset`)
   * so the bottom-right reset button/Escape's full reset also puts the
   * brush back to showing everything, not just the panel stack/filters.
   */
  resetToFullRange: () => void;
}

const TimeRangeContext = createContext<TimeRangeContextValue | null>(null);

/**
 * Computes the min/max Date spanned by `entries`, INCLUDING each range
 * entry's `endTimestamp` alongside every entry's plain `timestamp` - the
 * same reasoning LinearTimeline.tsx's `baseXScale` domain calculation
 * used to use before it switched to `domainRange` (see that file's
 * comment): a range entry whose end reaches past every other entry's
 * timestamp would otherwise get left out of `fullRange` entirely, even
 * though its span genuinely extends the dataset's true full extent.
 *
 * Falls back to a padded one-day window around "now" when there are no
 * entries at all (a visitor who reset to a blank slate - see the "Start
 * Your Own Constellation" button in About.tsx), so `fullRange` is always
 * a valid, non-degenerate range for TimeRangeSelector.tsx's brush to have
 * a domain to work with, never `undefined`.
 */
function computeFullRange(entries: Entry[]): DateRange {
  const dates = entries.flatMap(entry =>
    entry.endTimestamp
      ? [new Date(entry.timestamp), new Date(entry.endTimestamp)]
      : [new Date(entry.timestamp)]
  );

  if (dates.length === 0) {
    const now = new Date();
    return {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  let start = dates[0];
  let end = dates[0];
  for (const date of dates) {
    if (date.getTime() < start.getTime()) start = date;
    if (date.getTime() > end.getTime()) end = date;
  }

  // A single-instant range (one entry, or every entry on the same
  // timestamp) padded out to a full day - mirrors LinearTimeline.tsx's
  // own single-instant-domain fallback, so a lone entry still gives
  // TimeRangeSelector.tsx's brush a real, draggable width to work with
  // instead of a zero-width domain.
  if (start.getTime() === end.getTime()) {
    start = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

interface TimeRangeProviderProps {
  /** The full, unfiltered entries array (App.tsx's own `entries` state) - used only to compute `fullRange`. */
  entries: Entry[];
  children: ReactNode;
}

export function TimeRangeProvider({
  entries,
  children,
}: TimeRangeProviderProps) {
  const fullRange = useMemo(() => computeFullRange(entries), [entries]);

  const [selectedRange, setSelectedRangeState] = useState<DateRange>(fullRange);

  /**
   * Whether the user has ever manually narrowed `selectedRange` (dragged
   * TimeRangeSelector.tsx's brush) - a ref, not state, since flipping it
   * shouldn't itself cause a re-render; it only gates what the effect
   * below does the NEXT time `fullRange` changes.
   *
   * Until this is true, `selectedRange` keeps auto-tracking `fullRange` -
   * e.g. adding a brand-new entry that widens the dataset should widen
   * the still-"default" selection right along with it, the same way it
   * would if the user had never touched the brush at all. Once the user
   * DOES narrow the selection, though, that auto-tracking stops
   * permanently for the rest of the session: a newly added entry outside
   * the user's deliberately narrowed window shouldn't silently yank their
   * selection back out to the full range out from under them.
   */
  const isCustomRangeRef = useRef(false);

  // `useCallback` with empty deps - this only ever touches a ref and a
  // setState setter, both stable across renders, so the function itself
  // can stay one stable reference for the lifetime of the provider. That
  // stability matters beyond just avoiding wasted renders: TimeRangeSelector.tsx's
  // brush-(re)creation effect depends on this function, and recreating a
  // d3-brush (detaching/reattaching its listeners) on every unrelated
  // provider render - which an inline, non-memoized function here would
  // cause, since context consumers re-render whenever the provider's
  // value object identity changes - would be needless churn.
  const setSelectedRange = useCallback((range: DateRange) => {
    isCustomRangeRef.current = true;
    setSelectedRangeState(range);
  }, []);

  /**
   * RESET INCLUDES THE BRUSH: unlike `setSelectedRange(fullRange)` - which
   * would ALSO mark `isCustomRangeRef` true, since it goes through the
   * same setter a manual drag does - this clears that flag back to
   * `false` too, not just the value. That distinction matters: a plain
   * "set the range to fullRange" (e.g. a user coincidentally dragging the
   * brush all the way back out by hand) should still count as a
   * deliberate customization - it stays pinned even if a later-added
   * entry would otherwise widen `fullRange` further, exactly like any
   * other manual narrowing would. A FULL RESET is different in intent:
   * it means "go back to the default, untouched state entirely," which
   * should resume auto-tracking `fullRange` the same way a fresh page
   * load would, not leave behind a new pinned selection that just
   * happens to currently equal the full range.
   */
  const resetToFullRange = useCallback(() => {
    isCustomRangeRef.current = false;
    setSelectedRangeState(fullRange);
  }, [fullRange]);

  useEffect(() => {
    if (!isCustomRangeRef.current) {
      setSelectedRangeState(fullRange);
    }
    // Deliberately depends on `fullRange` alone - see the comment on
    // `isCustomRangeRef` above for why this shouldn't also re-run just
    // because `setSelectedRange` was called (that's what sets the ref
    // that makes this a no-op going forward, not something that should
    // re-trigger it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullRange]);

  // Memoized so the context value's own identity only changes when
  // `fullRange`/`selectedRange` actually do (`setSelectedRange` is
  // already stable - see above) - otherwise every consumer (and any
  // effect that depends on the value it reads, like the brush
  // (re)creation effect) would re-run on every provider render for no
  // reason, the same concern as `setSelectedRange`'s own memoization.
  const value = useMemo(
    () => ({ fullRange, selectedRange, setSelectedRange, resetToFullRange }),
    [fullRange, selectedRange, setSelectedRange, resetToFullRange]
  );

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
    </TimeRangeContext.Provider>
  );
}

/**
 * Reads the shared time-range filter - throws if used outside
 * `TimeRangeProvider` (see App.tsx for where it's mounted), the same
 * fail-fast pattern any other required-context hook uses rather than
 * silently returning a default.
 */
// A context file exporting both its Provider component and the hook that
// reads it is the standard React pattern; splitting them into separate
// files just to satisfy fast-refresh's "one file, one component" rule
// would make the two harder to keep in sync, not easier.
// eslint-disable-next-line react-refresh/only-export-components
export function useTimeRange(): TimeRangeContextValue {
  const context = useContext(TimeRangeContext);
  if (!context) {
    throw new Error('useTimeRange must be used within a TimeRangeProvider');
  }
  return context;
}
