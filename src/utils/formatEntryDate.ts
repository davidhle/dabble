/**
 * formatEntryDate.ts - Shared entry date/date-range display logic
 *
 * Extracted here because EntryDetailModal.tsx and EntryPanel.tsx both
 * need the same "how do we show this entry's date" logic, which now has
 * to handle three cases instead of two: an imprecise dateDisplay label,
 * a single-point-in-time entry, or a multi-day entry with endTimestamp
 * (see the endTimestamp field comment in types/Entry.ts).
 */

import { Entry } from '../types/Entry';

function formatSingleDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a start/end pair as a range like "Jun 30 – Jul 2, 2023".
 * Drops the weekday (unlike the single-date format) since two weekdays
 * for a range reads as clutter; includes the year on both ends only
 * when the range crosses a year boundary.
 */
function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString(undefined, { month: 'short' });
  const endMonth = end.toLocaleDateString(undefined, { month: 'short' });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${start.getDate()}, ${startYear} – ${endMonth} ${end.getDate()}, ${endYear}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${endYear}`;
}

/**
 * Prefers the imprecise, human-written dateDisplay (e.g. "October -
 * November 2021") when present - see the dateDisplay field comment in
 * types/Entry.ts - then a formatted date range when endTimestamp is
 * present, falling back to the exact formatted timestamp for ordinary
 * single-point-in-time entries.
 */
export function formatEntryDate(entry: Entry): string {
  if (entry.dateDisplay) return entry.dateDisplay;

  const start = new Date(entry.timestamp);
  if (entry.endTimestamp) {
    return formatDateRange(start, new Date(entry.endTimestamp));
  }
  return formatSingleDate(start);
}
