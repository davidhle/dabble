/**
 * entryStatus.ts - Planned / Skipped Entries
 *
 * An entry's optional `status` (see Entry.status in types/Entry.ts) marks
 * it as not (yet) having happened: 'planned' is a future intention,
 * 'skipped' a planned thing that never happened. No status means it
 * happened - every entry created before statuses existed.
 *
 * VISUAL CHANNEL: across all three visualizations, "not (yet) happened" is
 * drawn as a DASHED outline on the entry's normal shape, in its category
 * color. It deliberately doesn't reuse either existing channel - opacity
 * (reserved for filtering) or solid/hollow (Movement/Orbit) - so a planned
 * Orbit entry still reads as hollow, and a dimmed one still reads as
 * filtered out. Skipped entries additionally sit just off the main line,
 * tied back to their date by a short dotted spur. The constants below are
 * shared so the three views draw that channel identically.
 */

import { Entry, EntryStatus, Reflection } from '../types/Entry';

export function isEntryStatus(value: unknown): value is EntryStatus {
  return value === 'planned' || value === 'skipped';
}

export function isPlanned(entry: Entry): boolean {
  return entry.status === 'planned';
}

export function isSkipped(entry: Entry): boolean {
  return entry.status === 'skipped';
}

/** Planned or skipped - anything that hasn't (or didn't) actually happen. */
export function isUnrealized(entry: Entry): boolean {
  return entry.status !== undefined;
}

/** stroke-dasharray for an unrealized entry's dashed outline. */
export const UNREALIZED_DASH_ARRAY = '3 2';

/** Stroke width (px) of that dashed outline. */
export const UNREALIZED_OUTLINE_WIDTH = 1.25;

/**
 * Gap (px) between a FILLED shape's own edge and its dashed outline. The
 * gap is what keeps a planned solid dot reading as solid - a dashed
 * stroke directly on its edge would blend into the same-colored fill.
 */
export const UNREALIZED_OUTLINE_GAP_PX = 3;

/** How far (px) a skipped mark sits off the main line. */
export const SKIPPED_SPUR_LENGTH_PX = 13;

/** stroke-dasharray for the dotted spur (drawn with round linecaps). */
export const SKIPPED_SPUR_DASH_ARRAY = '0.1 3';

/** Width (px) of the dotted spur. */
export const SKIPPED_SPUR_WIDTH = 1.5;

/** A Date's calendar date (YYYY-MM-DD) in the viewer's local timezone. */
export function toLocalDateString(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

/**
 * An entry's start date (YYYY-MM-DD), read back the way the form stores
 * it: local, unless hasTime === false (placeholder midnight UTC - see
 * Entry.hasTime).
 */
export function getEntryStartDateString(entry: Entry): string {
  const start = new Date(entry.timestamp);
  return entry.hasTime === false
    ? start.toISOString().slice(0, 10)
    : toLocalDateString(start);
}

/**
 * Whether a planned entry's date is behind us - when the sidebar starts
 * asking "Did this happen?". Never resolves anything by itself. A
 * date-only entry counts as passed once its (last) day is over; one with
 * a specific time, once that time has passed.
 */
export function hasPlannedDatePassed(entry: Entry, now = new Date()): boolean {
  if (!isPlanned(entry)) return false;
  const today = toLocalDateString(now);
  if (entry.endTimestamp) {
    return toLocalDateString(new Date(entry.endTimestamp)) < today;
  }
  if (entry.hasTime === false) {
    return getEntryStartDateString(entry) < today;
  }
  return new Date(entry.timestamp).getTime() < now.getTime();
}

/**
 * Whether a reflection was written before its entry's date - e.g. notes
 * on a plan, or the "what I wrote beforehand" reflection a planned entry
 * gets when resolved as happened. Shown with a "Before" label.
 * writtenDate is date-only at midnight UTC (see Reflection.writtenDate).
 */
export function isReflectionBefore(
  reflection: Reflection,
  entry: Entry
): boolean {
  return reflection.writtenDate.slice(0, 10) < getEntryStartDateString(entry);
}

/** An ISO timestamp as a Reflection.writtenDate: its local date, at midnight UTC. */
export function toReflectionWrittenDate(iso: string): string {
  return new Date(
    `${toLocalDateString(new Date(iso))}T00:00:00Z`
  ).toISOString();
}
