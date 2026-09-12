/**
 * FilterBar.tsx - Sort Mode + Category Filter Controls
 *
 * Renders, top to bottom: the per-activityType filter toggles + "Show
 * All" reset, then the sort-mode toggle ("By Date" / "By Category") -
 * category filters first since they always render, sort toggle last
 * since it only shows once there's a sidebar stack to sort (see
 * `hasSelection` below), sitting immediately above that stack.
 *
 * Shared by every visualization page that renders a canvas + sidebar
 * panel stack - Constellation.tsx (StarMap) and Timeline.tsx
 * (LinearTimeline) both render this exact component with the exact same
 * props shape, sourced from useEntrySelection.ts's `sortMode`/
 * `filterCategories` state.
 *
 * WHY THIS IS DECOUPLED FROM THE SIDEBAR'S VISIBILITY:
 * A page's sidebar overlay (SidebarPanelStack.tsx) only renders when
 * `selectedEntries` is non-empty. These controls, though, are useful
 * *before* that ever happens too - e.g. filtering categories down, or
 * picking a sort mode, before opening a single entry. So FilterBar is
 * rendered unconditionally by each page, as a sibling of the page
 * title/instructions rather than inside the sidebar overlay's
 * conditional block - it has no dependency on `selectedEntries` for
 * *whether it renders*.
 *
 * It DOES take `hasSelection` as a prop, but only to decide whether the
 * sort-mode toggle specifically is worth showing: sorting is meaningless
 * with an empty (or single-panel) sidebar, so that one control is hidden
 * (not just disabled) until there's a stack to sort. The category filter
 * buttons have no such dependency and always render, since filtering
 * affects the canvas regardless of whether any panel is open.
 *
 * TRANSPARENT CONTAINER, CONTRASTED CONTENT:
 * This component has no background/border/shadow of its own - it sits
 * directly over a page's full-bleed canvas (see Constellation.tsx's
 * layout comment for why it's a normal-flow sibling of the page header
 * rather than its own floating box). Instead of legibility coming from
 * one opaque backing box behind everything, each individual control
 * carries its own contrast: the sort-toggle track has a subtle
 * background, and every button has either a solid fill (when active) or
 * a colored border + its own subtle background (when inactive) - so
 * nothing here depends on an opaque container to stay readable against a
 * busy canvas.
 *
 * State (`sortMode`, `filterCategories`) lives in useEntrySelection.ts,
 * not here - this component is purely a controlled view over props, the
 * same pattern the rest of a page uses (see EntryPanel.tsx, StarMap.tsx).
 */

import { Category } from '../types/Category';

export type SortMode = 'date' | 'category';

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
  /**
   * The calling page's own measured `headerLayout.left` - this component's
   * own horizontal offset from the viewport's left edge, since it renders
   * in normal document flow (inside `main`'s own padding/centering)
   * instead of being pinned to the viewport like SidebarPanelStack.tsx.
   *
   * WHY THIS IS NEEDED: SidebarPanelStack.tsx is `fixed left-0` with a
   * `w-[33vw]` box, so its right edge always lands at exactly 33vw from
   * the VIEWPORT's left edge, regardless of `left` (its `paddingLeft: left`
   * only pushes its CONTENT in from that box's left side, without moving
   * the box's own right edge). This component, by contrast, sits at
   * `x = leftInset` in normal flow - so a flat `w-[33vw]` here would end at
   * `leftInset + 33vw`, overshooting the sidebar's own right edge by
   * exactly `leftInset` pixels (visibly, category pills/the sort toggle
   * rendering wider than the sidebar and spilling out over the canvas).
   * Subtracting `leftInset` from the width here instead lands this
   * component's own right edge at the same `33vw` viewport-relative
   * position the sidebar's content already uses, so the two match exactly
   * regardless of viewport width or how much horizontal page padding
   * `leftInset` happens to be.
   */
  leftInset: number;
}

export default function FilterBar({
  sortMode,
  onSortModeChange,
  categories,
  filterCategories,
  onToggleFilterCategory,
  onResetFilters,
  hasSelection,
  leftInset,
}: FilterBarProps) {
  return (
    // width: an inline style (not a `w-[33vw]` class) so it can subtract
    // `leftInset` - see the prop's own comment above for why a flat 33vw
    // doesn't actually line up with SidebarPanelStack.tsx's own right
    // edge. Applied to this component's own root, which is enough to make
    // both rows below (the category buttons and the sort toggle) match it
    // too, since neither constrains its own width.
    <div
      className="flex flex-col gap-3"
      style={{ width: `calc(33vw - ${leftInset}px)` }}
    >
      {/*
       * Category filter toggles - see the "CATEGORY FILTER" comment in
       * Constellation.tsx. Purely visual (dims stars in StarMap) and
       * independent of `selectedEntries`: toggling a category here never
       * closes a panel already open for it. Always rendered, regardless
       * of `hasSelection` - unlike the sort toggle below.
       */}
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
                // "TRANSPARENT CONTAINER, CONTRASTED CONTENT" comment
                // above: this button needs to read clearly with nothing
                // opaque behind it but the starfield. Themed (was a fixed
                // white tint) so it stays a subtle LIFT off the canvas in
                // either theme, not a bright wash in light mode.
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
        <button
          type="button"
          onClick={onResetFilters}
          className="rounded-full border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-2.5 py-1 text-xs font-medium text-[var(--text-color)] hover:underline"
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
                  ? 'bg-indigo-500 text-white'
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
