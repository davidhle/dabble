/**
 * useEntrySelection.ts - Page-Facing Hook Over EntrySelectionContext
 *
 * ──────────────────────────────────────────────────────────────────────
 * THIN HOOK, SHARED STATE - SEE EntrySelectionContext.tsx FOR THE ACTUAL
 * STATE/LOGIC
 * ──────────────────────────────────────────────────────────────────────
 * This used to be THE place selectedEntries/filterCategories/sortMode/
 * resetPending state and logic lived - a plain hook, called separately by
 * each of Constellation.tsx, Timeline.tsx, and Spiral.tsx, each call
 * creating its own local `useState`. Since a page is unmounted by React
 * Router whenever the route changes away from it, that per-page state was
 * silently lost on every navigation - opening an entry's panel on
 * Constellation and then clicking over to Spiral used to land there with
 * no memory that anything had ever been selected.
 *
 * The actual state now lives one layer up, in
 * `../context/EntrySelectionContext.tsx`'s `EntrySelectionProvider` -
 * mounted in App.tsx above the router, alongside `TimeRangeProvider`, so
 * it survives navigation the same way `selectedRange` already does (see
 * that context file's own top-of-file comment for the full reasoning, the
 * `onFullReset` registration mechanism, and why "recenter on mount" needs
 * no new code here at all - each canvas's existing recenter effect
 * already handles it).
 *
 * This hook is now just a thin adapter kept around so every EXISTING
 * consumer of its return value - StarMap, LinearTimeline, SpiralTimeline,
 * FilterBar, SidebarPanelStack, ResetButton, ResetToast, all of which
 * destructure named fields off whatever `useEntrySelection(...)` returns
 * - needed no changes at all: the shape of the returned object is
 * unchanged. Only the three pages that CALL this hook needed a small
 * adjustment: `categories` is no longer part of the options, since the
 * state that used to need it now lives in the Provider (fed `entries`
 * directly, from which it derives its own `categories` - see that file);
 * `onFullReset` stays, since a page's own canvas-specific pan/zoom reset
 * is still genuinely page-specific - see the CONTEXT file's "onFullReset
 * STAYS PAGE-SPECIFIC" comment for why. That registration is what this
 * file's own effect below does.
 */

import { useEffect } from 'react';
import {
  CategoryGroup,
  EntrySelectionContextValue,
  SelectedEntry,
  useEntrySelectionContext,
} from '../context/EntrySelectionContext';

export type { SelectedEntry, CategoryGroup };

export interface UseEntrySelectionOptions {
  /**
   * Called whenever a full reset actually fires (Escape's second press,
   * or a page's <ResetButton>), IN ADDITION to the shared context
   * clearing its own state - a page uses this to also reset its own
   * canvas-specific pan/zoom, without that logic living in the context.
   * Registered/unregistered with the context via this hook's own effect
   * below, keyed to this specific page's mount/unmount - see
   * EntrySelectionContext.tsx's "onFullReset STAYS PAGE-SPECIFIC" comment.
   */
  onFullReset?: () => void;
}

export type UseEntrySelectionResult = Omit<
  EntrySelectionContextValue,
  'setPageFullResetHandler'
>;

export function useEntrySelection({
  onFullReset,
}: UseEntrySelectionOptions = {}): UseEntrySelectionResult {
  const { setPageFullResetHandler, ...selection } = useEntrySelectionContext();

  // Registers THIS page's own `onFullReset` as the one the shared
  // context's `resetAll` will call, for as long as this page stays
  // mounted - and unregisters it on unmount (or before re-registering a
  // new closure whenever `onFullReset` itself changes identity), so a
  // reset triggered from whichever page happens to be mounted always
  // calls that page's own canvas reset, never a stale one left behind by
  // a page the user has since navigated away from.
  useEffect(() => {
    setPageFullResetHandler(onFullReset ?? null);
    return () => setPageFullResetHandler(null);
  }, [onFullReset, setPageFullResetHandler]);

  return selection;
}
