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

/**
 * Exported (not just used internally by `formatEntryDate` below) so
 * SpiralTimeline.tsx's "now" marker tooltip can format a live
 * current-moment `Date` - which isn't an `Entry` at all - the exact same
 * "weekday, month day, year, h:mm am/pm" way an entry's own timestamp is
 * shown, rather than a second, separately-maintained date format just
 * for that one tooltip.
 */
export function formatSingleDate(date: Date, includeTime: boolean): string {
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (!includeTime) {
    // No meaningful time-of-day (see the hasTime field comment in
    // types/Entry.ts) - AddEntryForm.tsx stores a placeholder midnight
    // UTC timestamp for these, so the calendar date must be read back in
    // UTC too. Formatting in the viewer's local timezone instead would
    // shift the displayed date to the previous day for anyone west of
    // UTC (e.g. US timezones), since local midnight UTC has already
    // rolled into "yesterday evening" there.
    return date.toLocaleDateString(undefined, {
      ...dateOptions,
      timeZone: 'UTC',
    });
  }

  const datePart = date.toLocaleDateString(undefined, dateOptions);
  const timePart = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart}, ${timePart}`;
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
 *
 * For a single-point-in-time entry, the time-of-day is only appended
 * when `hasTime` isn't explicitly `false` - see the hasTime field
 * comment in types/Entry.ts for why entries without the field default
 * to showing time, and range entries never show a time-of-day (ranges
 * predate hasTime and are about which days are covered, not a time on
 * either end).
 */
export function formatEntryDate(entry: Entry): string {
  if (entry.dateDisplay) return entry.dateDisplay;

  const start = new Date(entry.timestamp);
  if (entry.endTimestamp) {
    return formatDateRange(start, new Date(entry.endTimestamp));
  }
  return formatSingleDate(start, entry.hasTime !== false);
}
