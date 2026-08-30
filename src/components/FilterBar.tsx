/**
 * FilterBar.tsx - Sort Mode + Category Filter Controls (Constellation view)
 *
 * Renders, top to bottom: the per-activityType filter toggles + "Show
 * All" reset, then the sort-mode toggle ("By Date" / "By Category") -
 * category filters first since they always render, sort toggle last
 * since it only shows once there's a sidebar stack to sort (see
 * `hasSelection` below), sitting immediately above that stack.
 *
 * WHY THIS IS DECOUPLED FROM THE SIDEBAR'S VISIBILITY:
 * The sidebar overlay only renders (see Constellation.tsx) when
 * `selectedEntries` is non-empty. These controls, though, are useful
 * *before* that ever happens too - e.g. filtering categories down, or
 * picking a sort mode, before opening a single star. So FilterBar is
 * rendered unconditionally by Constellation.tsx, as a sibling of the
 * page title/instructions rather than inside the sidebar overlay's
 * conditional block - it has no dependency on `selectedEntries` for
 * *whether it renders*.
 *
 * It DOES take `hasSelection` as a prop, but only to decide whether the
 * sort-mode toggle specifically is worth showing: sorting is meaningless
 * with an empty (or single-panel) sidebar, so that one control is hidden
 * (not just disabled) until there's a stack to sort. The category filter
 * buttons have no such dependency and always render, since filtering
 * affects the star map regardless of whether any panel is open.
 *
 * TRANSPARENT CONTAINER, CONTRASTED CONTENT:
 * This component has no background/border/shadow of its own anymore -
 * it sits directly over StarMap's starfield (see Constellation.tsx's
 * layout comment for why it's a normal-flow sibling of the page header
 * rather than its own floating box). Instead of legibility coming from
 * one opaque backing box behind everything, each individual control
 * carries its own contrast: the sort-toggle track has a subtle
 * background, and every button has either a solid fill (when active) or
 * a colored border + its own subtle background (when inactive) - so
 * nothing here depends on an opaque container to stay readable against a
 * busy field of stars.
 *
 * State (`sortMode`, `filterCategories`) still lives in Constellation.tsx
 * - this component is purely a controlled view over props, the same
 * pattern the rest of the page uses (see EntryPanel.tsx, StarMap.tsx).
 */

import { ACTIVITY_TYPE_OPTIONS, ActivityType } from '../types/Entry';
import { getActivityColor } from '../utils/colors';

export type SortMode = 'date' | 'category';

interface FilterBarProps {
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  filterCategories: ActivityType[];
  onToggleFilterCategory: (category: ActivityType) => void;
  onResetFilters: () => void;
  /** Whether the sidebar has at least one panel open - see the header comment above. */
  hasSelection: boolean;
}

export default function FilterBar({
  sortMode,
  onSortModeChange,
  filterCategories,
  onToggleFilterCategory,
  onResetFilters,
  hasSelection,
}: FilterBarProps) {
  return (
    // w-[33vw]: a FIXED width - one third of the viewport - rather than
    // matching the instructional subtitle text's rendered width (the
    // previous behavior). Applied to this component's own root, which is
    // enough to make both rows below (the category buttons and the sort
    // toggle) match it too, since neither constrains its own width. The
    // sidebar panel stack in Constellation.tsx uses this same `w-[33vw]`
    // class, so all three stay a consistent width with each other.
    <div className="flex w-[33vw] flex-col gap-3">
      {/*
       * Category filter toggles - see the "CATEGORY FILTER" comment in
       * Constellation.tsx. Purely visual (dims stars in StarMap) and
       * independent of `selectedEntries`: toggling a category here never
       * closes a panel already open for it. Always rendered, regardless
       * of `hasSelection` - unlike the sort toggle below.
       */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
        {ACTIVITY_TYPE_OPTIONS.map(option => {
          const isActive = filterCategories.includes(option.value);
          const color = getActivityColor(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggleFilterCategory(option.value)}
              aria-pressed={isActive}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-gray-900' : 'text-gray-200'
              }`}
              style={{
                // Inactive buttons still get a subtle background of their
                // own (rather than fully transparent) - see the
                // "TRANSPARENT CONTAINER, CONTRASTED CONTENT" comment
                // above: this button needs to read clearly with nothing
                // opaque behind it but the starfield.
                backgroundColor: isActive ? color : 'rgba(255, 255, 255, 0.08)',
                borderColor: color,
              }}
            >
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onResetFilters}
          className="rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-gray-200 hover:text-white hover:underline"
        >
          Show All
        </button>
      </div>

      {hasSelection && (
        // Sort mode toggle - see the "SORT MODE" comment in Constellation.tsx:
        // switching this never adds/removes/hides a panel, it only changes
        // how the existing set is arranged in the sidebar. Hidden entirely
        // (not just disabled) while the sidebar is empty, since there's
        // nothing to sort yet. Rendered below the category filters (and
        // above the sidebar panel stack, per Constellation.tsx's layout)
        // rather than above them.
        <div className="flex flex-shrink-0 gap-1 rounded-lg bg-white/5 p-1">
          {(['date', 'category'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onSortModeChange(mode)}
              aria-pressed={sortMode === mode}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                sortMode === mode
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-300 hover:text-gray-100'
              }`}
            >
              {mode === 'date' ? 'By Date' : 'By Category'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
