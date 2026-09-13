/**
 * laneAssignment.ts - Greedy Interval-Scheduling Lane Assignment
 *
 * Extracted from LinearTimeline.tsx's original inline `ranges` useMemo (see
 * that file's own "LANE-BASED LAYOUT FOR CAPSULES" comment for the
 * greedy-interval-scheduling argument this still relies on: always placed
 * in the first non-conflicting lane). Both LinearTimeline.tsx (stacking
 * capsules into flat vertical rows) and SpiralTimeline.tsx (stacking arcs
 * into concentric radial rings) need the exact same ANSWER to "which lane
 * number does each overlapping range entry belong to" - only what a "lane"
 * means visually (a vertical pixel offset vs. a radial offset in polar
 * space) differs between the two views. Pulling the assignment itself out
 * here keeps that one answer shared, rather than two views maintaining two
 * copies of the same interval-scheduling logic that could quietly drift
 * apart.
 *
 * `getStart`/`getEnd` accessors (rather than requiring callers to shape
 * their items as `{ start, end }`) let each caller pass whatever 1D
 * "position along the timeline" measure fits its own coordinate space -
 * LinearTimeline uses `xScale` pixel positions, SpiralTimeline uses
 * arc-length distance along the spiral's own path (see SpiralTimeline's
 * `tToArcLength`) - without needing to rename or duplicate its own fields
 * just to satisfy this function's shape.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY DURATION-DESCENDING PROCESSING ORDER, NOT CHRONOLOGICAL (START-DATE)
 * ──────────────────────────────────────────────────────────────────────
 * Items are sorted by DURATION (getEnd - getStart), longest first, before
 * the greedy placement loop runs - not by start position, which is what
 * this function originally did (and what a textbook interval-scheduling
 * "minimum number of rooms" solution normally sorts by, since that's what
 * guarantees the fewest lanes overall - see LinearTimeline.tsx's own
 * "LANE-BASED LAYOUT FOR CAPSULES" comment for that argument).
 *
 * The greedy placement loop below always tries lane 0 first, so whichever
 * item is processed FIRST for a given cluster of overlapping items is the
 * one that claims lane 0 - the lane closest to the baseline in
 * LinearTimeline / closest to the spiral's own curve in SpiralTimeline,
 * i.e. visually the "anchor" position. Sorting by start date made that
 * anchor slot arbitrary: whichever entry merely happened to begin first
 * won lane 0, even if it was a brief entry quickly superseded by a much
 * longer-spanning one that then got pushed outward instead. A short entry
 * anchoring the base lane while a long one orbits around it reads
 * backwards - the short entry doesn't visually dominate enough of the
 * timeline to justify being the thing everything else stacks around.
 *
 * Processing longest-duration-first instead means a long-spanning entry
 * reliably wins lane 0 over anything shorter it overlaps with, so it acts
 * as a stable anchor that shorter overlapping entries stack around in
 * outer lanes - matching the visual intuition that the entry occupying
 * the most time on the timeline should be the one anchoring the base
 * lane, with everything else arranged relative to it, rather than lane
 * assignment being an accident of which entry started a day earlier.
 *
 * This is a DELIBERATE trade-off against the minimum-lane-count guarantee
 * start-order processing gives (see LinearTimeline's comment) - duration-
 * order can occasionally use one more lane than the true minimum for a
 * given cluster of GENUINELY overlapping items, in exchange for a
 * legible, deterministic anchor.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY EVERY LANE TRACKS ITS FULL ITEM LIST, NOT JUST ONE RUNNING "laneEnd"
 * ──────────────────────────────────────────────────────────────────────
 * An earlier version of this function tracked only a single running
 * `laneEnd[lane]` scalar (the most recently placed item's own end) and
 * checked a candidate item against just that one value: `start <
 * laneEnd[lane] + gap`. That's a valid non-overlap test ONLY when items
 * are considered in start-ascending order - under that order, whichever
 * item was placed in a lane most recently is also guaranteed to be the
 * TEMPORALLY LATEST item in that lane so far, so comparing only against
 * it is equivalent to comparing against everything in the lane.
 *
 * That invariant breaks under duration-descending order: a LONG item that
 * starts LATE in real time can still be processed FIRST (bigger
 * duration), claim lane 0, and stamp `laneEnd[0]` with its own late end
 * date. A SHORT item that starts EARLIER - and doesn't overlap that long
 * item at all - then gets compared against a `laneEnd` that sits in its
 * own future, and is wrongly rejected: `start < laneEnd + gap` is true
 * whenever the short item is either genuinely overlapping OR simply
 * happens anywhere before the long item, and the one-scalar check can't
 * tell those two cases apart. Concretely, in this app's own seed data:
 * the 90-day "Second WSC" (Sep-Nov 2022) has a longer duration than the
 * 60-day "First WSC" (Oct-Nov 2021), so it gets processed first and takes
 * lane 0, stamping `laneEnd[0]` to Nov 30, 2022; "First WSC" (2021) is
 * then checked against that 2022 date, sees `start < laneEnd`, and gets
 * bumped to lane 1 - even though the two don't overlap at all (a full
 * year apart) and both should be free to sit at lane 0.
 *
 * The fix: `laneItems[lane]` keeps every item already placed in that lane
 * (not just the latest one), and a candidate is checked for a genuine,
 * SYMMETRIC interval overlap (`overlaps` below - "does either one start
 * before the other ends") against ALL of them, not just whichever was
 * placed most recently. This is correct (no two overlapping items ever
 * share a lane) and, unlike the single-scalar version, doesn't
 * artificially reject a lane just because some unrelated, non-overlapping
 * item that happens to occupy it was processed first - the ONLY items
 * that will ever competes for a lane slot now are ones that ACTUALLY
 * overlap in time, exactly the scoping this function is supposed to
 * guarantee regardless of processing order.
 */
export function assignLanes<T>(
  items: T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number,
  gap: number
): (T & { lane: number })[] {
  const sortedByDurationDesc = [...items].sort(
    (a, b) => getEnd(b) - getStart(b) - (getEnd(a) - getStart(a))
  );

  const overlaps = (a: T, b: T) =>
    getStart(a) < getEnd(b) + gap && getStart(b) < getEnd(a) + gap;

  // laneItems[lane] = every item already placed in that lane so far - see
  // the comment above for why a single running "last end" scalar isn't
  // enough once processing order isn't start-ascending.
  const laneItems: T[][] = [];

  return sortedByDurationDesc.map(item => {
    let lane = 0;
    while (laneItems[lane]?.some(existing => overlaps(item, existing))) {
      lane++;
    }
    (laneItems[lane] ??= []).push(item);
    return { ...item, lane };
  });
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * ASSIGNING A ZERO-DURATION POINT A LANE AROUND ALREADY-LANED RANGES
 * ──────────────────────────────────────────────────────────────────────
 * `assignLanes` above lanes a set of intervals against EACH OTHER,
 * incrementally, in one pass. This is a different, narrower question:
 * given a single instantaneous position (SpiralTimeline's point entries -
 * no endTimestamp, just one date) and a set of RANGE entries that have
 * already been laned by `assignLanes`, which lane can this one point sit
 * in without landing inside a range's span?
 *
 * It's deliberately NOT the same as running `assignLanes` over points and
 * ranges together: a point should only ever be pushed off lane 0 by an
 * ARC covering its date, never by another point sitting at a nearby (or
 * identical) position - two points at the same spot are not a legibility
 * problem the way a point silently swallowed inside an arc's lane-0 span
 * is. So this checks candidate lanes one at a time (0, 1, 2, ...) against
 * only the ranges already assigned to each lane, using `gap` as the same
 * "how close counts as touching" buffer `assignLanes` uses, and returns
 * the first lane number where no range's `[start-gap, end+gap]` window
 * contains `position` - the same "take the first (lowest-index)
 * non-conflicting lane" rule `assignLanes` itself follows, just checked
 * against a fixed, precomputed set of ranges instead of built up
 * incrementally against other points of its own kind. A position that
 * conflicts with nothing stays at lane 0, unchanged from having no lane
 * concept at all.
 */
export function assignLaneAroundRanges<R>(
  position: number,
  lanedRanges: (R & { lane: number })[],
  getRangeStart: (range: R) => number,
  getRangeEnd: (range: R) => number,
  gap: number
): number {
  let lane = 0;
  while (
    lanedRanges.some(
      range =>
        range.lane === lane &&
        position >= getRangeStart(range) - gap &&
        position <= getRangeEnd(range) + gap
    )
  ) {
    lane++;
  }
  return lane;
}
