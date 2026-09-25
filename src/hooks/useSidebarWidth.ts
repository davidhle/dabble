/**
 * useSidebarWidth - the user-chosen width AND side (left/right) of the
 * visualization pages' unified sidebar container (Constellation.tsx/
 * Timeline.tsx/Spiral.tsx), set by dragging SidebarResizeHandle.tsx and
 * clicking SidebarSideToggle.tsx, both persisted to localStorage so they
 * carry across pages and visits.
 *
 * This only decides the container's CSS `width`. It is deliberately NOT a
 * second copy of each page's `sidebarWidth` state: those pages still
 * measure the rendered container with a ResizeObserver, so every
 * width-aware consumer (canvas centering, LinearTimeline's content origin,
 * TimeRangeSelector, VizEmptyState, BookmarkRail's `100%` anchor) follows a
 * drag through the exact same path it already follows a window resize.
 *
 * Until the user drags, the width is the original `33vw - offset` default
 * (offset = the container's measured distance from the screen edge it's
 * anchored to - left or right - i.e. --edge-gutter). Once they do, their width is clamped at render time -
 * not just while dragging - so a saved width stays sane after the window
 * shrinks: never under SIDEBAR_MIN_WIDTH, never past SIDEBAR_MAX_VW
 * of the viewport, and the max wins when a narrow viewport can't fit both.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** localStorage keys - same naming convention as useTheme.ts's THEME_STORAGE_KEY. */
export const SIDEBAR_WIDTH_STORAGE_KEY = 'dabble-sidebar-width';
export const SIDEBAR_SIDE_STORAGE_KEY = 'dabble-sidebar-side';

/**
 * Which screen edge the sidebar hugs. Every sidebar-aware consumer
 * (canvas centering, LinearTimeline's content band, TimeRangeSelector,
 * VizEmptyState, BookmarkRail, the resize handle) takes this alongside the
 * page's measured `sidebarWidth` - which is always the width of the screen
 * band the sidebar occupies measured FROM ITS OWN EDGE, so each consumer
 * only has to decide which side that band is on.
 */
export type SidebarSide = 'left' | 'right';

/** Narrowest the user can drag the sidebar - keeps the header, FilterBar chips, and entry panels readable. */
export const SIDEBAR_MIN_WIDTH = 280;

/**
 * Furthest (vw) the sidebar's canvas-facing edge may reach from its own
 * screen edge - a viewport-relative cap, so the canvas always keeps at
 * least half the screen no matter how wide the monitor is.
 */
const SIDEBAR_MAX_VW = 50;

function loadStoredWidth(): number | null {
  const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

function loadStoredSide(): SidebarSide {
  return localStorage.getItem(SIDEBAR_SIDE_STORAGE_KEY) === 'right'
    ? 'right'
    : 'left';
}

/**
 * `gaps`: the container's measured distance from the left and right screen
 * edges (the page's `containerLayout`). Only the one for the side the
 * sidebar is anchored to matters - that's the `offset` in `33vw - offset`.
 */
export function useSidebarWidth(gaps: { left: number; right: number }) {
  const [userWidth, setUserWidth] = useState<number | null>(loadStoredWidth);
  const [side, setSide] = useState<SidebarSide>(loadStoredSide);
  const edgeOffset = side === 'left' ? gaps.left : gaps.right;
  // Mirrors `userWidth` so `persist` (called on drag end) can save the
  // latest value without being re-created on every drag frame.
  const userWidthRef = useRef(userWidth);

  const maxWidth = useCallback(
    () => (window.innerWidth * SIDEBAR_MAX_VW) / 100 - edgeOffset,
    [edgeOffset]
  );

  /** Live update while dragging - clamped here too so the stored value is always one that actually renders. */
  const resizeTo = useCallback(
    (width: number) => {
      const clamped = Math.round(
        Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), maxWidth())
      );
      userWidthRef.current = clamped;
      setUserWidth(clamped);
    },
    [maxWidth]
  );

  /** Saves the current width - on drag end rather than every frame. */
  const persist = useCallback(() => {
    if (userWidthRef.current !== null) {
      localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(userWidthRef.current)
      );
    }
  }, []);

  /** Back to the `33vw - offset` default and forget the saved width. */
  const resetWidth = useCallback(() => {
    userWidthRef.current = null;
    setUserWidth(null);
    localStorage.removeItem(SIDEBAR_WIDTH_STORAGE_KEY);
  }, []);

  const toggleSide = useCallback(() => {
    setSide(current => {
      const next = current === 'left' ? 'right' : 'left';
      localStorage.setItem(SIDEBAR_SIDE_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Mirrors `side` onto <html data-sidebar-side> for as long as a
  // visualization page is mounted, so the bottom corner button stack
  // (`[data-corner-stack]` - see index.css) can hop to the opposite corner
  // via CSS alone, including ThemeToggle, which Layout.tsx renders outside
  // any page. Removed on unmount so Home/About keep the default corner.
  // Layout (not plain) effect so the buttons never paint a frame on the
  // same side as the sidebar.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.sidebarSide = side;
    return () => {
      delete root.dataset.sidebarSide;
    };
  }, [side]);

  const width =
    userWidth === null
      ? `calc(33vw - ${edgeOffset}px)`
      : `min(max(${SIDEBAR_MIN_WIDTH}px, ${userWidth}px), calc(${SIDEBAR_MAX_VW}vw - ${edgeOffset}px))`;

  return { width, resizeTo, persist, resetWidth, side, toggleSide };
}
