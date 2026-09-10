/**
 * Timeline.tsx - Chronological Timeline Page
 *
 * Renders the entries array (lifted in App.tsx, same as Constellation.tsx
 * receives it) as a chronological timeline via LinearTimeline.tsx. This
 * used to render a D3.js bar-chart DEMO (D3Chart.tsx, driven by a
 * "Randomize Data" button over made-up placeholder numbers) that had
 * nothing to do with the app's actual entries - replaced entirely now
 * that there's a real per-entry visualization to show instead. See
 * LinearTimeline.tsx for the empty-state handling (no entries yet) and
 * the D3 scaleTime/axis/zoom implementation.
 *
 * PILOT: FIRST PAGE (AFTER CONSTELLATION) BUILT ON THE SHARED HOOK
 * ──────────────────────────────────────────────────────────────────────
 * This page used to be its own simple thing - a light-mode card
 * (`space-y-6`, LinearTimeline in a bordered box) with no filter/sort
 * controls at all, and clicking a point opened a single read-only
 * <EntryDetailModal> popup. It's now been refactored to match
 * Constellation.tsx's page structure exactly, as a pilot for eventually
 * doing the same to Spiral.tsx:
 *
 *   - Selection/filter/sort state comes from useEntrySelection.ts, the
 *     SAME hook Constellation.tsx uses - see that file's top-of-file
 *     comment for why it's now the single source of truth for this state
 *     across all three visualization pages, rather than being
 *     reimplemented (or, as here, simply absent) per page.
 *   - The title/subtitle block is VizPageHeader.tsx, the same component
 *     Constellation.tsx renders.
 *   - <FilterBar> is the same component and props shape Constellation.tsx
 *     uses - its category toggles actually dim LinearTimeline's
 *     points/ranges now (see LinearTimeline.tsx's `filterCategories`
 *     prop), the same FILTERED_OUT_OPACITY treatment StarMap.tsx gives
 *     its stars.
 *   - Clicking an entry no longer opens EntryDetailModal - it now adds a
 *     panel to SidebarPanelStack.tsx, the SAME sidebar panel stack
 *     component Constellation.tsx uses, via `handleEntryClick` wired to
 *     LinearTimeline's `onEntryClick` prop, mirroring exactly how
 *     Constellation.tsx wires the same handler to StarMap's
 *     `onStarClick`.
 *   - The page layout (full-bleed canvas behind a floating z-10 header
 *     and a z-30 sidebar overlay, measured `headerLayout` for the
 *     sidebar's position, the same `w-fit`/`space-y-4` header wrapper)
 *     matches Constellation.tsx's CSS approach exactly - see
 *     Constellation.tsx's own top-of-file layout comment for the full
 *     reasoning behind each piece, which isn't re-explained here to
 *     avoid the two files' comments drifting out of sync with each
 *     other.
 *
 * STAGE 2: sidebarWidth, openedEntryIds/expandedEntryId, and topOffset
 * ──────────────────────────────────────────────────────────────────────
 * This page now also replicates two more pieces of Constellation.tsx's
 * wiring that a first pass skipped:
 *
 *   - `sidebarWidth` is measured off SidebarPanelStack's own rendered DOM
 *     node the exact same way Constellation.tsx measures it for StarMap -
 *     LinearTimeline's own AUTO-RECENTER effect (see its header comment)
 *     needs it for the same "exclude the sidebar's band when centering"
 *     math StarMap's CLICK-TO-CENTER effect uses.
 *   - `openedEntryIds`/`expandedEntryId` (both already returned by
 *     useEntrySelection.ts, just not consumed here yet) are passed to
 *     LinearTimeline so it can render the SAME opened-entry highlight
 *     ring/glow StarMap renders for its stars, and drive that same
 *     AUTO-RECENTER effect.
 *   - `topOffset` (this page's own `headerLayout.top`) is new -
 *     LinearTimeline needs it to vertically center its content BELOW the
 *     header, unlike StarMap's starfield which has no equivalent
 *     vertical exclusion. See LinearTimeline.tsx's VERTICAL CENTERING
 *     comment for why this page-specific need doesn't apply to StarMap.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import FilterBar from '../components/FilterBar';
import LinearTimeline from '../components/LinearTimeline';
import ResetButton from '../components/ResetButton';
import ResetToast from '../components/ResetToast';
import SidebarPanelStack from '../components/SidebarPanelStack';
import VizPageHeader from '../components/VizPageHeader';
import { Entry } from '../types/Entry';
import { loadCategories } from '../utils/categories';
import { useEntrySelection } from '../hooks/useEntrySelection';

interface TimelineProps {
  entries: Entry[];
}

export default function Timeline({ entries }: TimelineProps) {
  // The dynamic category list - see Constellation.tsx's identical
  // `categories` useMemo for why this is recomputed off `entries`.
  const categories = useMemo(() => loadCategories(), [entries]);

  const {
    selectedEntries,
    openedEntryIds,
    expandedEntryId,
    handleEntryClick,
    handleExpandPanel,
    handleClosePanel,
    sortMode,
    handleSortModeChange,
    categoryGroups,
    filterCategories,
    handleToggleFilterCategory,
    handleResetFilters,
    hasSelection,
    resetPending,
    resetAll,
  } = useEntrySelection({ categories });

  // Where the header stack (title/subtitle + FilterBar) actually sits in
  // the viewport, so SidebarPanelStack below can start just past its
  // bottom edge and share its left edge - identical to Constellation.tsx's
  // `headerLayout` measurement; see its comment for why neither `top` nor
  // `left` can be a hardcoded guess. `top` is also handed to
  // LinearTimeline as `topOffset` now - see the STAGE 2 comment above.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerLayout, setHeaderLayout] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateLayout = () => {
      const rect = el.getBoundingClientRect();
      setHeaderLayout({ top: rect.bottom, left: rect.left });
    };
    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);
    window.addEventListener('resize', updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  // The sidebar overlay's live rendered width, passed to LinearTimeline so
  // its AUTO-RECENTER effect can keep its horizontal-centering math
  // accurate - identical to Constellation.tsx's own `sidebarWidth`
  // measurement for StarMap; see its comment for why this has to be
  // measured off the DOM node rather than assumed from SidebarPanelStack's
  // fixed `w-[33vw]` class.
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(0);

  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) {
      setSidebarWidth(0);
      return;
    }

    const updateWidth = () => setSidebarWidth(el.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasSelection]);

  return (
    // Fragment, not a `space-y-4` div - see Constellation.tsx's identical
    // comment: `space-y-*` would misalign LinearTimeline's `fixed inset-0`
    // edges by adding margin-top to it as a sibling.
    <>
      <div ref={headerRef} className="relative z-10 w-fit space-y-4">
        <VizPageHeader
          title="Timeline"
          subtitle="Drag to pan, scroll to zoom, and click a point to see the entry behind it."
        />

        <FilterBar
          sortMode={sortMode}
          onSortModeChange={handleSortModeChange}
          categories={categories}
          filterCategories={filterCategories}
          onToggleFilterCategory={handleToggleFilterCategory}
          onResetFilters={handleResetFilters}
          hasSelection={hasSelection}
        />
      </div>

      <LinearTimeline
        entries={entries}
        filterCategories={filterCategories}
        onEntryClick={handleEntryClick}
        openedEntryIds={openedEntryIds}
        expandedEntryId={expandedEntryId}
        sidebarWidth={sidebarWidth}
        topOffset={headerLayout.top}
      />

      <ResetToast visible={resetPending} />
      <ResetButton onClick={resetAll} />

      {hasSelection && (
        <SidebarPanelStack
          ref={sidebarRef}
          selectedEntries={selectedEntries}
          sortMode={sortMode}
          categoryGroups={categoryGroups}
          onExpand={handleExpandPanel}
          onClose={handleClosePanel}
          top={headerLayout.top}
          left={headerLayout.left}
        />
      )}
    </>
  );
}
