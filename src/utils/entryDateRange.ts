/**
 * entryDateRange.ts - "Is This Entry Within A Date Range?"
 *
 * Used by Timeline.tsx to hard-filter which entries it passes to
 * LinearTimeline.tsx down to only those overlapping the current
 * TimeRangeContext `selectedRange` - see Timeline.tsx's own comment for
 * why this is a hard filter (entries outside the range aren't rendered at
 * all) rather than the dim-don't-remove treatment `filterCategories`
 * gets.
 */

import { DateRange } from '../context/TimeRangeContext';
import { Entry } from '../types/Entry';

/**
 * Whether `entry` falls within `range` at all.
 *
 * A plain point entry (no `endTimestamp`) is straightforward: its single
 * `timestamp` either lands inside `range` or it doesn't.
 *
 * A RANGE entry (has `endTimestamp`) is deliberately checked for
 * OVERLAP, not full containment: an entry that starts before
 * `range.start` but is still ongoing when `range.start` begins (or
 * starts inside `range` but continues past `range.end`) genuinely did
 * happen, at least in part, during the selected window - excluding it
 * just because one of its two endpoints falls outside the boundary would
 * hide a real event the user asked to see. The standard interval-overlap
 * test - each span's start is at or before the other's end - captures
 * this in both directions at once (fully contained, fully containing, or
 * only partially overlapping on either side).
 */
export function isEntryWithinRange(entry: Entry, range: DateRange): boolean {
  const entryStart = new Date(entry.timestamp);

  if (!entry.endTimestamp) {
    return (
      entryStart.getTime() >= range.start.getTime() &&
      entryStart.getTime() <= range.end.getTime()
    );
  }

  const entryEnd = new Date(entry.endTimestamp);
  return (
    entryStart.getTime() <= range.end.getTime() &&
    entryEnd.getTime() >= range.start.getTime()
  );
}
