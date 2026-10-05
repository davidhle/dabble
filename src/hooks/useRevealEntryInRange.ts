/**
 * useRevealEntryInRange - slides the shared time window to an entry the
 * user opens from OUTSIDE it.
 *
 * An entry can stay open in the sidebar after the selected time range
 * moves away from it, and the sidebar (a panel row, a BookmarkRail tab,
 * FocusedEntryView's Back/Undo) can still expand it - but every viz page
 * only draws entries inside `selectedRange`, so the canvas would show
 * nothing for it. When the expanded entry changes to one outside the
 * window, this SLIDES the window (same duration, start and end shifted
 * together - like LinearTimeline's drag-to-slide) just far enough that
 * the entry sits REVEAL_MARGIN_FRACTION of the window in from the nearer
 * edge, clamped to `fullRange`. The brush moves with it, so the user
 * sees what happened.
 *
 * Keyed ONLY on the expanded entry changing, never on the range: if the
 * user drags the window away from an already-open entry, that's
 * deliberate, and snapping back would fight them.
 *
 * An entry longer than the window can't fit, so the window lines up with
 * the entry's START instead (its start date, plus as much of it as fits),
 * rather than widening the window and changing the user's zoom.
 *
 * ANIMATED: the slide eases over REVEAL_ANIMATION_MS, writing the shared
 * range every frame, so the brush and all three canvases glide with it
 * (SpiralTimeline treats back-to-back range changes as a live drag and
 * follows them frame by frame). It yields the moment anything else sets
 * the range mid-glide (the user grabbing the brush), and is instant -
 * no animation frames at all - with the Animations setting off (see
 * hooks/useMotionEnabled.ts).
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DateRange, useTimeRange } from '../context/TimeRangeContext';
import type { Entry } from '../types/Entry';
import { isEntryWithinRange } from '../utils/entryDateRange';
import { useMotionEnabled } from './useMotionEnabled';

/** How far in from the nearer edge (as a fraction of the window's duration) a revealed entry lands. */
const REVEAL_MARGIN_FRACTION = 0.1;

/** Duration (ms) of the reveal slide - see ANIMATED above. */
const REVEAL_ANIMATION_MS = 600;

/**
 * `entries` must be the FULL, unfiltered list - the entry being revealed
 * is by definition not in the time-filtered one.
 */
export function useRevealEntryInRange(
  expandedEntryId: string | null,
  entries: Entry[]
) {
  const { fullRange, selectedRange, setSelectedRange } = useTimeRange();

  // The animation frame loop reads the live range through this ref, to
  // notice when something else has moved it mid-glide.
  const selectedRangeRef = useRef(selectedRange);
  selectedRangeRef.current = selectedRange;
  const frameRef = useRef<number | null>(null);
  // Read per reveal through a ref - the effect below is keyed on the
  // expanded entry alone (see its own comment).
  const motionEnabled = useMotionEnabled();
  const motionEnabledRef = useRef(motionEnabled);
  motionEnabledRef.current = motionEnabled;

  // Stop any glide in flight on unmount.
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  useEffect(() => {
    if (!expandedEntryId) return;
    const entry = entries.find(candidate => candidate.id === expandedEntryId);
    if (!entry || isEntryWithinRange(entry, selectedRange)) return;

    const target = revealWindow(entry, selectedRange, fullRange);

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (!motionEnabledRef.current) {
      setSelectedRange(target);
      return;
    }

    const span = target.end.getTime() - target.start.getTime();
    const interpolateStart = d3.interpolateNumber(
      selectedRange.start.getTime(),
      target.start.getTime()
    );
    let lastSet: DateRange = selectedRange;
    const startedAt = performance.now();

    const step = (now: number) => {
      // Something else (e.g. the brush) set the range - let it win.
      if (selectedRangeRef.current !== lastSet) {
        frameRef.current = null;
        return;
      }
      const progress = Math.min(1, (now - startedAt) / REVEAL_ANIMATION_MS);
      const start = interpolateStart(d3.easeCubicInOut(progress));
      lastSet =
        progress >= 1
          ? target
          : { start: new Date(start), end: new Date(start + span) };
      // Updated eagerly too, since the re-render that would refresh it
      // may land after the next frame.
      selectedRangeRef.current = lastSet;
      setSelectedRange(lastSet);
      frameRef.current = progress >= 1 ? null : requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    // Deliberately keyed on `expandedEntryId` alone - see the top-of-file
    // comment: a range change must never trigger this, and `entries`
    // changing (an edit) shouldn't either.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEntryId]);
}

/**
 * The window `selected` slid (same duration) so `entry` is in view - see
 * the top-of-file comment for the placement rules. Pure, for testing.
 */
export function revealWindow(
  entry: Entry,
  selected: DateRange,
  full: DateRange
): DateRange {
  const span = selected.end.getTime() - selected.start.getTime();
  const margin = span * REVEAL_MARGIN_FRACTION;
  const entryStart = new Date(entry.timestamp).getTime();
  const entryEnd = entry.endTimestamp
    ? new Date(entry.endTimestamp).getTime()
    : entryStart;

  // Left of the window, or too long to fit: its start lands `margin` in
  // from the left edge. Otherwise (right of the window): its end lands
  // `margin` in from the right edge.
  const alignToStart =
    entryEnd < selected.start.getTime() ||
    entryEnd - entryStart > span - 2 * margin;
  const unclampedStart = alignToStart
    ? entryStart - margin
    : entryEnd + margin - span;
  const start = Math.max(
    full.start.getTime(),
    Math.min(unclampedStart, full.end.getTime() - span)
  );

  return { start: new Date(start), end: new Date(start + span) };
}
