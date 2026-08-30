/**
 * Constellation.tsx - Star Map Page
 *
 * Renders the entries array (lifted in App.tsx) as a pannable/zoomable
 * "star map" via StarMap.tsx. See StarMap.tsx for the pan/zoom,
 * clustering, and click handling implementation details.
 *
 * App.tsx currently keeps entries only in memory, so a fresh session has
 * an empty array. Rather than let the page render an empty void, we fall
 * back to a small set of mock entries (src/utils/mockEntries.ts) purely
 * so there's something to look at and click on while testing - real
 * entries added via the '+' button take over immediately once they exist.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FULL-BLEED CANVAS + FLOATING OVERLAY SIDEBAR
 * ──────────────────────────────────────────────────────────────────────
 * This used to be a two-region flex layout: a sidebar and a StarMap
 * container as flex siblings, where opening the sidebar physically
 * shrank StarMap's box (and StarMap resized its <svg> to match via
 * ResizeObserver). That's been replaced with a layered approach:
 *
 *   - StarMap renders itself `fixed inset-0` (see its own top-of-file
 *     comment) - it always fills the entire viewport, full width and
 *     height, regardless of `selectedEntries`. It is no longer a sized
 *     flex child of anything here; nothing in this file constrains its
 *     box.
 *   - The sidebar panel stack is a *separate*, absolutely-positioned
 *     overlay (`fixed left-0 bottom-0`, with a measured `top` and
 *     `paddingLeft` - see `headerLayout` below - plus a fixed `w-[33vw]`
 *     width), drawn on top of StarMap's canvas with a higher z-index. It
 *     only renders at all when `selectedEntries` is non-empty - there's
 *     still no separate "is the sidebar open" flag, "open" is still just
 *     derived from `selectedEntries.length > 0` - but unlike before,
 *     mounting/unmounting it can't affect StarMap's size, because
 *     StarMap's size no longer depends on anything in this file's layout.
 *
 * The sidebar's width and header-relative position both still matter to
 * *other* things, even though they don't affect StarMap's own size:
 *   - Width, for *visually* centering a clicked star - see `sidebarWidth`
 *     below (the overlay's own *actual rendered* width, currently a
 *     product of the fixed `w-[33vw]` class) and the CLICK-TO-CENTER
 *     comment in StarMap.tsx.
 *   - Header layout, so the overlay's content starts below the header
 *     stack (navbar + title/subtitle + FilterBar) and shares its left
 *     edge, instead of overlapping or misaligning with it - see
 *     `headerLayout` below.
 * FilterBar's own two rows (category filters, sort toggle) and this
 * sidebar overlay all share the SAME fixed `33vw` width (one third of
 * the viewport) - previously this was measured off the instructional
 * subtitle `<p>`'s own rendered width instead, so all three matched it
 * exactly; that matching has been intentionally replaced with a flat
 * viewport-relative proportion (see FilterBar.tsx and the sidebar's
 * className below), independent of the subtitle's width. `headerLayout`
 * still only measures `top`/`left` (position, not size) - see below - to
 * keep the sidebar's *left edge* aligned with the header, which is
 * unrelated to this width change.
 *
 * ──────────────────────────────────────────────────────────────────────
 * PANEL STACK: SORT ORDER, EXPAND/MINIMIZE, AND THE "OPENED" HIGHLIGHT
 * ──────────────────────────────────────────────────────────────────────
 * `selectedEntries` holds `{ entry, expanded }` pairs, always kept sorted
 * newest-first by `entry.timestamp` (see `insertSortedByTimestampDesc`).
 * That sort only runs when an entry is *added* - toggling which panel is
 * expanded, or removing one, never reorders the rest of the list, so a
 * panel doesn't jump around in the stack just because the user is
 * clicking through it.
 *
 * At most one panel is expanded at a time: opening a new star, or
 * re-clicking/re-selecting an already-open one, expands that entry and
 * collapses every other one. This mirrors a lot of "accordion" UIs and
 * keeps the sidebar from growing unboundedly tall as more stars are
 * opened - only the panel currently being looked at takes up full space,
 * the rest collapse to compact rows (see EntryPanel.tsx).
 *
 * `openedEntryIds` (passed to StarMap for the highlight ring/glow around
 * "opened" stars) is *every* id in `selectedEntries`, expanded or not -
 * "opened" means "has a panel in the sidebar at all", not "is currently
 * expanded". It's derived with `useMemo` rather than tracked as separate
 * state, so it can never drift out of sync with `selectedEntries` itself.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SORT MODE: REORGANIZING, NOT FILTERING
 * ──────────────────────────────────────────────────────────────────────
 * `sortMode` ('date' | 'category') controls how `selectedEntries` is
 * *presented* - grouped under colored category headers, or as one flat
 * newest-first list - via `categoryGroups` below. It never touches
 * `selectedEntries` itself: every entry that's open stays open, and its
 * expanded/minimized state is unaffected, when the mode is switched.
 *
 * This is deliberately unlike a *filter* would be (e.g. "only show
 * Dance entries," a hypothetical future feature): a filter changes which
 * panels are visible at all - it can make a panel disappear. This sort
 * toggle only changes how the still-fully-visible set of panels is
 * arranged on screen. If filtering is added later, it should compose
 * with this (filter first, then apply whichever sort mode to what's left)
 * rather than being implemented as another case of this toggle.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CATEGORY FILTER: DIMS STARS, NEVER TOUCHES THE SIDEBAR
 * ──────────────────────────────────────────────────────────────────────
 * `filterCategories` is the set of activityTypes currently "active" -
 * defaults to *all* of them, i.e. nothing filtered out. It's passed to
 * StarMap, which dims (not removes) any star whose activityType isn't in
 * the set - see the comment above `stars.map()` in StarMap.tsx for why
 * "dim, don't remove" matters (an opened star's highlight ring should
 * stay visible, just dimmed, even while filtered out).
 *
 * Crucially, `filterCategories` is completely independent of
 * `selectedEntries`: filtering a category out never closes, removes, or
 * even collapses that category's sidebar panels. The sidebar and the
 * star map's filter are two separate views over the same data - a panel
 * you opened stays open (and its star keeps its highlight ring) even if
 * you then filter its category out of the star map entirely.
 *
 * `sortMode` and `filterCategories` state lives here, but the controls
 * for them render via <FilterBar>, rendered as a normal-flow sibling of
 * the page title rather than inside the sidebar overlay - see
 * FilterBar.tsx's header comment for why: unlike the panel stack, those
 * controls need to stay usable even when `selectedEntries` is empty.
 *
 * ──────────────────────────────────────────────────────────────────────
 * HEADER STACKING: FLOW LAYOUT, NOT MANUAL OFFSETS
 * ──────────────────────────────────────────────────────────────────────
 * The title/subtitle text and <FilterBar> both need to render on top of
 * StarMap's `fixed inset-0` canvas (see StarMap.tsx) without overlapping
 * each other. An earlier version made FilterBar its own `fixed`,
 * hand-placed box (`top-20`) floating independently of the title/
 * subtitle block below it - which meant its position was a guess that
 * didn't account for the title block's actual (variable - the
 * "Showing example data" badge changes its height) rendered height, and
 * the two would visually overlap.
 *
 * The fix is to stop positioning them independently: both now live in
 * one normal-flow wrapper (`relative z-10`, below), stacked with
 * ordinary `space-y-4` margins the same way any other flow content
 * would be. `relative z-10` on the wrapper is what lifts the *whole*
 * subtree above the canvas in one place - see the comment on that div
 * for why - rather than each element separately fighting over z-index.
 * Ordinary block flow then guarantees no overlap, automatically
 * adjusting if the title block's height ever changes, instead of a
 * hand-tuned pixel offset needing to be re-guessed by hand.
 *
 * TRANSPARENT CONTAINER, CONTRASTED CONTENT:
 * Neither the title/subtitle block nor <FilterBar> has an opaque
 * background of its own - both sit directly over the starfield so it
 * stays visible through them, per the design brief. Legibility instead
 * comes from styling each piece of *content* for contrast individually:
 * the title/subtitle text uses a light color plus `text-shadow` (a dark
 * halo that reads against bright stars or dark sky alike - see
 * `READABLE_TEXT_SHADOW` below), while FilterBar's buttons each carry
 * their own border/background (see FilterBar.tsx). Multiple small
 * contrasted elements instead of one big backing box.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import EntryPanel from '../components/EntryPanel';
import FilterBar, { SortMode } from '../components/FilterBar';
import StarMap from '../components/StarMap';
import { ACTIVITY_TYPE_OPTIONS, ActivityType, Entry } from '../types/Entry';
import { getActivityColor } from '../utils/colors';
import { generateMockEntries } from '../utils/mockEntries';

interface ConstellationProps {
  entries: Entry[];
}

interface SelectedEntry {
  entry: Entry;
  expanded: boolean;
}

/**
 * Dark halo behind light text, so it stays legible whether it's sitting
 * over a bright star or open dark sky - see the "TRANSPARENT CONTAINER,
 * CONTRASTED CONTENT" comment above. A tight shadow for edge definition
 * plus a softer, larger one for a subtle glow.
 */
const READABLE_TEXT_SHADOW =
  '0 1px 3px rgba(0, 0, 0, 0.9), 0 2px 10px rgba(0, 0, 0, 0.7)';

/**
 * Inserts `selectedEntry` into `list` and returns a new array sorted
 * newest-first by timestamp. Used only when a *new* star is opened - see
 * the panel-stack comment above for why toggling/closing never re-sorts.
 */
function insertSortedByTimestampDesc(
  list: SelectedEntry[],
  selectedEntry: SelectedEntry
): SelectedEntry[] {
  return [...list, selectedEntry].sort(
    (a, b) =>
      new Date(b.entry.timestamp).getTime() -
      new Date(a.entry.timestamp).getTime()
  );
}

export default function Constellation({ entries }: ConstellationProps) {
  const usingMockData = entries.length === 0;

  // Only generate mock entries once, not on every render, and only when
  // they're actually needed.
  const mockEntries = useMemo(() => generateMockEntries(), []);

  const displayedEntries = usingMockData ? mockEntries : entries;

  // The sidebar's panel stack - see the panel-stack comment above for the
  // sort-order and expand/collapse rules this state follows.
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);

  // How the (unchanged) panel stack is currently arranged - see the
  // "SORT MODE" comment above for why this never removes/hides a panel.
  const [sortMode, setSortMode] = useState<SortMode>('date');

  // Which activityTypes are currently active (visible at normal opacity)
  // in StarMap - see the "CATEGORY FILTER" comment above. Starts with
  // every category active, i.e. nothing filtered out.
  const [filterCategories, setFilterCategories] = useState<ActivityType[]>(() =>
    ACTIVITY_TYPE_OPTIONS.map(option => option.value)
  );

  const handleStarClick = (entry: Entry) => {
    setSelectedEntries(prev => {
      const alreadyOpen = prev.some(selected => selected.entry.id === entry.id);

      if (alreadyOpen) {
        // Already in the stack: just switch which panel is expanded.
        // No duplicate, no reorder.
        return prev.map(selected => ({
          ...selected,
          expanded: selected.entry.id === entry.id,
        }));
      }

      // A newly opened star: collapse every existing panel, then insert
      // this one (expanded) back into chronological order.
      const collapsedRest = prev.map(selected => ({
        ...selected,
        expanded: false,
      }));
      return insertSortedByTimestampDesc(collapsedRest, {
        entry,
        expanded: true,
      });
    });
  };

  // Also used when a minimized panel row in the sidebar is clicked - same
  // "expand this one, collapse the rest, don't reorder" rule as re-clicking
  // an already-open star.
  const handleExpandPanel = (entryId: string) => {
    setSelectedEntries(prev =>
      prev.map(selected => ({
        ...selected,
        expanded: selected.entry.id === entryId,
      }))
    );
  };

  const handleClosePanel = (entryId: string) => {
    setSelectedEntries(prev =>
      prev.filter(selected => selected.entry.id !== entryId)
    );
  };

  const handleToggleFilterCategory = (category: ActivityType) => {
    setFilterCategories(prev =>
      prev.includes(category)
        ? prev.filter(active => active !== category)
        : [...prev, category]
    );
  };

  const handleResetFilters = () => {
    setFilterCategories(ACTIVITY_TYPE_OPTIONS.map(option => option.value));
  };

  // Every entry currently represented by a sidebar panel (expanded or
  // minimized) - see the panel-stack comment above for why this covers
  // both, and why it's derived rather than separately tracked.
  const openedEntryIds = useMemo(
    () => selectedEntries.map(selected => selected.entry.id),
    [selectedEntries]
  );

  // `selectedEntries` -> one bucket per activityType, for 'category' sort
  // mode. Buckets are populated by scanning `selectedEntries` in its
  // existing newest-first order, so each bucket comes out newest-first
  // too, with no separate per-group sort needed. Only non-empty buckets
  // are kept, then ordered alphabetically by label (per spec, "for now" -
  // a fixed/custom category order could replace this later).
  const categoryGroups = useMemo(() => {
    const buckets = new Map<string, SelectedEntry[]>();
    for (const selected of selectedEntries) {
      const key = selected.entry.activityType;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(selected);
      } else {
        buckets.set(key, [selected]);
      }
    }

    return ACTIVITY_TYPE_OPTIONS.map(option => ({
      option,
      entries: buckets.get(option.value) ?? [],
    }))
      .filter(group => group.entries.length > 0)
      .sort((a, b) => a.option.label.localeCompare(b.option.label));
  }, [selectedEntries]);

  const hasSelection = selectedEntries.length > 0;

  // The sidebar overlay's live rendered width, passed to StarMap so it
  // can keep its click-to-center math accurate - see the layout comment
  // above and StarMap.tsx's CLICK-TO-CENTER comment. Measured off the DOM
  // node directly (rather than assumed from the fixed `w-[33vw]` class
  // below) because the overlay's actual rendered pixel width still needs
  // an actual measurement to convert that viewport-relative unit into
  // the pixel coordinates StarMap's zoom math works in. Resets to 0
  // whenever the overlay unmounts (`hasSelection` false), since there's
  // no node to measure - matching StarMap's `sidebarWidth: 0` "canvas is
  // fully visible" case.
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

  // Where the header stack (title/subtitle + FilterBar) actually sits in
  // the viewport, so the sidebar overlay below can start just past its
  // bottom edge and share its left edge, instead of overlapping or
  // misaligning with it. This is position only, NOT size/width - see the
  // "FULL-BLEED CANVAS + FLOATING OVERLAY SIDEBAR" comment at the top of
  // this file for why width is now a flat 33vw instead of being derived
  // from anything measured here.
  //
  // Neither top nor left can be a hardcoded guess:
  //   - top: the navbar's height lives in Layout.tsx (not this file), and
  //     the header block's own height changes with its content - e.g.
  //     the sort toggle inside FilterBar showing/hiding with
  //     `hasSelection` (see FilterBar.tsx).
  //   - left: `main` in Layout.tsx is `mx-auto max-w-7xl px-4 sm:px-6
  //     lg:px-8` - on any viewport *wider* than max-w-7xl (1280px), the
  //     `mx-auto` centering margin adds on top of that padding, shifting
  //     `left` right as the window keeps growing. A static Tailwind class
  //     (even one that replicates the px-4/sm:px-6/lg:px-8 breakpoints
  //     exactly) can't reproduce that - only measuring the header's
  //     actual rendered position gives the exact number in every case.
  //
  // `headerRef.current.getBoundingClientRect()` gives both directly -
  // `.bottom`/`.left` already include the navbar's height and any
  // mx-auto centering margin for free (this wrapper sits below the
  // navbar, inside main, in normal document flow). Nothing to add or
  // guess for either.
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

    // ResizeObserver catches the header's own size changing (content
    // wrapping differently, FilterBar's sort toggle showing/hiding).
    // It does NOT fire when the header's *position* shifts without a
    // size change though - which is exactly what happens to `left` once
    // the viewport is wider than main's max-w-7xl cap (see above): the
    // header's width stops growing, but its mx-auto margin keeps
    // shifting as the window resizes. A window resize listener catches
    // that case too; both call the same `updateLayout`.
    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);
    window.addEventListener('resize', updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  return (
    // A Fragment, not a single `space-y-4` div, wraps the whole return:
    // `space-y-*` applies margin-top to every sibling, including the
    // out-of-flow `fixed` ones below (StarMap, the sidebar overlay) -
    // which would misalign StarMap's `inset-0` edges by that margin.
    // `space-y-4` is scoped to just the flow-content header wrapper
    // (title/subtitle + FilterBar) below instead.
    <>
      {/*
       * relative z-10: StarMap's canvas below is `fixed inset-0` at z-0
       * (see StarMap.tsx) and would otherwise paint over this
       * non-positioned content, since positioned elements always paint
       * above non-positioned ones regardless of DOM order. Putting z-10
       * here once lifts this whole subtree - title, subtitle, AND
       * FilterBar - above the canvas together, rather than each needing
       * its own position/z-index. See the "HEADER STACKING" and
       * "TRANSPARENT CONTAINER, CONTRASTED CONTENT" comments at the top
       * of this file for why FilterBar lives in here (ordinary flow, no
       * background) instead of as an independently `fixed` element.
       */}
      <div ref={headerRef} className="relative z-10 space-y-4">
        {/*
         * The "showing example data" badge used to render here, next to
         * the title - it now lives in Layout.tsx's navbar instead, next
         * to the '+' button, so it's part of the top nav row rather than
         * floating over the starfield near wherever a highlighted star
         * happens to be. `usingMockData` above is still needed here
         * regardless, to decide whether StarMap falls back to mock
         * entries - see this file's top comment.
         */}
        <h1
          className="text-3xl font-bold text-white"
          style={{ textShadow: READABLE_TEXT_SHADOW }}
        >
          Constellation
        </h1>
        <p
          className="text-gray-200"
          style={{ textShadow: READABLE_TEXT_SHADOW }}
        >
          Drag to pan, scroll to zoom, and click a star to see the entry behind
          it.
        </p>

        <FilterBar
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          filterCategories={filterCategories}
          onToggleFilterCategory={handleToggleFilterCategory}
          onResetFilters={handleResetFilters}
          hasSelection={hasSelection}
        />
      </div>

      {/*
       * Full-bleed canvas - see the layout comment at the top of this
       * file. Not a layout child of anything here; StarMap sizes and
       * positions itself via `fixed inset-0`.
       */}
      <StarMap
        entries={displayedEntries}
        onStarClick={handleStarClick}
        openedEntryIds={openedEntryIds}
        filterCategories={filterCategories}
        sidebarWidth={sidebarWidth}
      />

      {/*
       * Sidebar overlay - only rendered (and therefore only taking up
       * screen space) when `hasSelection`. Being `fixed` rather than a
       * flex sibling, mounting/unmounting it can't resize StarMap's
       * canvas underneath - see the layout comment at the top of this
       * file for why that's the whole point of this restructure.
       */}
      {hasSelection && (
        <div
          ref={sidebarRef}
          // z-30: above StarMap's canvas (z-0) and the header stack
          // (z-10), below the AddEntryForm modal (z-50).
          //
          // top: headerLayout.top (not `inset-y-0`/top-0) so this starts
          // just below the header stack instead of overlapping it.
          // `bottom-0` still anchors the other edge, so this extends to
          // the bottom of the viewport same as before - width (see
          // w-[33vw] below) doesn't affect that vertical math at all, so
          // the scrollable height (`bottom-0` minus `top`) and
          // `overflow-y-auto` scroll behavior both keep working exactly
          // as before at this new width.
          //
          // paddingLeft: headerLayout.left (this container is still
          // `left-0`, an absolute x of 0) shifts content's left edge to
          // headerLayout.left, matching the header's left edge - see the
          // `headerLayout` comment above for why this is measured rather
          // than a replicated padding class.
          //
          // w-[33vw]: a FIXED width - one third of the viewport - rather
          // than derived from the header/subtitle's rendered width (the
          // previous behavior; see the top-of-file layout comment). This
          // is the same width FilterBar's own root uses (see
          // FilterBar.tsx), so the category filter row, sort toggle, and
          // this panel stack all still share one consistent width with
          // each other - just no longer tied to the subtitle text.
          //
          // bg-transparent, no shadow/border: this outer stack container
          // has NO surface styling of its own anymore - only the
          // container, not the individual panel cards inside it (see
          // EntryPanel.tsx, which still uses --panel-bg-color for its own
          // surface so panel text stays readable against the stars). A
          // shadow here (with nothing opaque to cast it from) would just
          // read as an unexplained dark smudge over the starfield, so
          // it's dropped along with the background - same "transparent
          // container, contrasted content" approach as FilterBar.tsx. The
          // starfield now shows through the gaps between/around panels
          // instead of behind a solid sidebar-shaped box.
          // constellation-sidebar-scroll (see index.css): overrides just
          // this container's scrollbar TRACK to transparent - the
          // browser default white track clashes with the dark theme -
          // while keeping a visible THUMB. Scoped to this one class, so
          // no other scrollable element in the app is affected.
          className="constellation-sidebar-scroll fixed bottom-0 left-0 z-30 flex w-[33vw] flex-col gap-3 overflow-y-auto bg-transparent pb-3 pt-3"
          style={{
            top: headerLayout.top,
            paddingLeft: headerLayout.left,
          }}
        >
          {sortMode === 'date' ? (
            <>
              {/* Makes the (already-default) ordering explicit rather than silent. */}
              <div className="flex flex-shrink-0 items-center gap-1.5 px-1 text-xs text-gray-500">
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Sorted by date (newest first)</span>
              </div>

              {selectedEntries.map(({ entry, expanded }) => (
                <EntryPanel
                  key={entry.id}
                  entry={entry}
                  expanded={expanded}
                  onExpand={() => handleExpandPanel(entry.id)}
                  onClose={() => handleClosePanel(entry.id)}
                />
              ))}
            </>
          ) : (
            categoryGroups.map(({ option, entries: groupEntries }) => (
              <div key={option.value} className="flex flex-col gap-3">
                <div
                  className="flex-shrink-0 rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-900"
                  style={{ backgroundColor: getActivityColor(option.value) }}
                >
                  {option.label}
                </div>
                {groupEntries.map(({ entry, expanded }) => (
                  <EntryPanel
                    key={entry.id}
                    entry={entry}
                    expanded={expanded}
                    onExpand={() => handleExpandPanel(entry.id)}
                    onClose={() => handleClosePanel(entry.id)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
