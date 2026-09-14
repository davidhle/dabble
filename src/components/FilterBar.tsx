/**
 * FilterBar.tsx - Sort Mode + Category Filter Controls
 *
 * Renders, top to bottom: a "Filters" collapse/expand toggle row (plus the
 * always-visible "Show All" reset), the collapsible per-activityType filter
 * chip grid, then the sort-mode toggle ("By Date" / "By Category") -
 * category filters first since they always render, sort toggle last
 * since it only shows once there's a sidebar stack to sort (see
 * `hasSelection` below), sitting immediately above that stack.
 *
 * Shared by every visualization page that renders a canvas + sidebar
 * panel stack - Constellation.tsx, Timeline.tsx, and Spiral.tsx all render
 * this exact component with the exact same props shape, sourced from
 * useEntrySelection.ts's `sortMode`/`filterCategories` state.
 *
 * WHY THIS IS DECOUPLED FROM THE SIDEBAR'S VISIBILITY:
 * A page's sidebar panel stack (SidebarPanelStack.tsx) only has content
 * when `selectedEntries` is non-empty. These controls, though, are useful
 * *before* that ever happens too - e.g. filtering categories down, or
 * picking a sort mode, before opening a single entry. So FilterBar is
 * rendered unconditionally by each page, as a sibling of the page
 * title/instructions inside their shared unified container (see
 * Constellation.tsx's own layout comment) rather than inside the sidebar
 * panel stack's own conditional block - it has no dependency on
 * `selectedEntries` for *whether it renders*.
 *
 * It DOES take `hasSelection` as a prop, but only to decide whether the
 * sort-mode toggle specifically is worth showing: sorting is meaningless
 * with an empty (or single-panel) sidebar, so that one control is hidden
 * (not just disabled) until there's a stack to sort. The category filter
 * buttons have no such dependency and always render (collapsed or not),
 * since filtering affects the canvas regardless of whether any panel is
 * open.
 *
 * COLLAPSE/EXPAND, PERSISTED: whether the category chip grid itself is
 * expanded is local state here (`collapsed`), lazily initialized from
 * localStorage the same read-once-then-sync-on-change pattern
 * useTheme.ts's own `theme` state uses, so a visitor's choice survives a
 * refresh/revisit rather than always defaulting back open. It DOES default
 * to expanded (`collapsed = false`) the very first time, per the design
 * brief - only a visitor who deliberately collapses it once will see it
 * start collapsed on a later visit. "Show All" and the sort-mode toggle
 * are NOT part of the collapsible region - both stay visible regardless of
 * `collapsed`, since "reset every filter" and "change how the sidebar is
 * arranged" are both useful even with the chip grid tucked away, and
 * `collapsed` shows a compact "X of Y active" summary next to the toggle
 * instead so that state is still legible without expanding it.
 *
 * WIDTH: this component now always fills 100% of whatever parent hands
 * it - the callers' own unified container already constrains itself to
 * `calc(33vw - headerLayout.left)` (see Constellation.tsx's layout
 * comment), so this no longer needs its own `leftInset`-driven width calc
 * the way it did back when it rendered as an independent normal-flow
 * sibling directly over the canvas.
 *
 * PARTIALLY-OPAQUE CONTENT ON A SEMI-OPAQUE SURFACE:
 * This component used to have no background of its own at all - sitting
 * directly over a page's full-bleed canvas, with each individual control
 * carrying its own contrast (a solid fill when active, a colored border +
 * subtle background when inactive) since nothing behind it was opaque.
 * That per-control contrast is UNCHANGED here - it still reads correctly
 * now that the whole block sits on the callers' shared translucent
 * `.bullet-journal-surface` container instead of the bare canvas.
 *
 * State (`sortMode`, `filterCategories`) lives in useEntrySelection.ts,
 * not here - this component is purely a controlled view over props, the
 * same pattern the rest of a page uses (see EntryPanel.tsx, StarMap.tsx).
 */

import { useEffect, useState } from 'react';
import { Category } from '../types/Category';

export type SortMode = 'date' | 'category';

/** localStorage key the category-filter collapse state is persisted under - same naming convention as useTheme.ts's THEME_STORAGE_KEY. */
export const FILTER_COLLAPSE_STORAGE_KEY = 'dabble-filter-collapsed';

function loadStoredCollapsed(): boolean {
  // Defaults to expanded (false) on first visit - see the header comment's
  // COLLAPSE/EXPAND section for why only an explicit prior "true" flips it.
  return localStorage.getItem(FILTER_COLLAPSE_STORAGE_KEY) === 'true';
}

interface FilterBarProps {
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  /** The dynamic category list to render filter toggles for - see Constellation.tsx. */
  categories: Category[];
  filterCategories: string[];
  onToggleFilterCategory: (category: string) => void;
  onResetFilters: () => void;
  /** Whether the sidebar has at least one panel open - see the header comment above. */
  hasSelection: boolean;
}

export default function FilterBar({
  sortMode,
  onSortModeChange,
  categories,
  filterCategories,
  onToggleFilterCategory,
  onResetFilters,
  hasSelection,
}: FilterBarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    loadStoredCollapsed()
  );

  useEffect(() => {
    localStorage.setItem(FILTER_COLLAPSE_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const activeCount = filterCategories.length;
  const totalCount = categories.length;

  return (
    <div className="flex w-full flex-col gap-3">
      {/*
       * "Filters" collapse/expand toggle + "Show All" - the one row that's
       * ALWAYS visible regardless of `collapsed`, per the header comment's
       * COLLAPSE/EXPAND section above.
       */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(current => !current)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted-color)] transition-colors hover:text-[var(--text-color)]"
        >
          <svg
            className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${
              collapsed ? '-rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span>
            Filters
            {collapsed && ` (${activeCount} of ${totalCount} active)`}
          </span>
        </button>

        <button
          type="button"
          onClick={onResetFilters}
          className="rounded-full border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-2.5 py-1 text-xs font-medium text-[var(--text-color)] hover:underline"
        >
          Show All
        </button>
      </div>

      {/*
       * Category filter toggles - see the "CATEGORY FILTER" comment in
       * Constellation.tsx. Purely visual (dims stars in StarMap) and
       * independent of `selectedEntries`: toggling a category here never
       * closes a panel already open for it. Only rendered while expanded -
       * see the COLLAPSE/EXPAND section of the header comment above.
       */}
      {!collapsed && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
          {categories.map(category => {
            const isActive = filterCategories.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onToggleFilterCategory(category.id)}
                aria-pressed={isActive}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  // text-gray-900 (active) is deliberately unchanged across
                  // themes - it's dark text against category.color itself
                  // (a data-identity color, not a theme color), so it needs
                  // to stay dark regardless of light/dark mode. The inactive
                  // case now uses the themed primary text color instead of a
                  // fixed text-gray-200, which would go near-invisible
                  // against the light theme's own light background tint.
                  isActive ? 'text-gray-900' : 'text-[var(--text-color)]'
                }`}
                style={{
                  // Inactive buttons still get a subtle background of their
                  // own (rather than fully transparent) - see the
                  // "PARTIALLY-OPAQUE CONTENT ON A SEMI-OPAQUE SURFACE"
                  // comment above: this button needs to read clearly
                  // regardless of what's behind it. Themed (was a fixed
                  // white tint) so it stays a subtle LIFT in either theme,
                  // not a bright wash in light mode.
                  backgroundColor: isActive
                    ? category.color
                    : 'var(--field-tint-1)',
                  borderColor: category.color,
                }}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      )}

      {hasSelection && (
        // Sort mode toggle - see the "SORT MODE" comment in Constellation.tsx:
        // switching this never adds/removes/hides a panel, it only changes
        // how the existing set is arranged in the sidebar. Hidden entirely
        // (not just disabled) while the sidebar is empty, since there's
        // nothing to sort yet. Rendered below the category filters (and
        // above the sidebar panel stack, per Constellation.tsx's layout)
        // rather than above them. bg-[var(--panel-bg-color-solid)]: the
        // unselected/track background matches EntryPanel.tsx's expanded
        // (and now minimized - see its own comment) panel background
        // exactly, rather than a separate --field-tint-1 lift, so this
        // toggle reads as the same opaque surface as the sidebar panels
        // sitting directly below it instead of a visibly different shade.
        <div className="flex flex-shrink-0 gap-1 rounded-lg bg-[var(--panel-bg-color-solid)] p-1">
          {(['date', 'category'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onSortModeChange(mode)}
              aria-pressed={sortMode === mode}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                sortMode === mode
                  ? 'bg-[var(--accent-color)] text-[var(--accent-foreground-color)]'
                  : 'text-[var(--text-muted-color)] hover:text-[var(--text-color)]'
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
