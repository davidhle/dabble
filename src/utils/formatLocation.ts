/**
 * formatLocation.ts - Shared entry location display logic
 *
 * Entry.location is a union (see the STRUCTURED LOCATION comment in
 * types/Entry.ts): either the new structured { country?, city?, place? }
 * shape, or - for entries created before this feature existed - a plain
 * legacy string. This is the one place that decides how to turn either
 * shape into a single display string, so EntryPanel.tsx and any future
 * caller can't drift apart on the formatting.
 */

import { Entry, EntryLocation } from '../types/Entry';

function isStructuredLocation(
  location: NonNullable<Entry['location']>
): location is EntryLocation {
  return typeof location !== 'string';
}

/**
 * Formats an entry's location for display.
 *
 * - Legacy plain-string locations are shown as-is, unstructured (no
 *   attempt to split/parse them into country/city/place - see the
 *   BACKWARD COMPATIBILITY comment in types/Entry.ts).
 * - Structured locations join whichever of place/city/country are
 *   present, most-specific first (e.g. "Djoon Club, Paris, France"),
 *   gracefully omitting any missing piece rather than showing blanks or
 *   stray commas.
 *
 * Returns `undefined` when there's nothing to show (no location, or a
 * structured location with all three fields empty) so callers can use
 * the same "render nothing when empty" pattern as the rest of
 * EntryPanel.tsx's optional sections.
 */
export function formatLocationDisplay(
  location: Entry['location']
): string | undefined {
  if (!location) return undefined;

  if (!isStructuredLocation(location)) {
    return location.trim() || undefined;
  }

  const parts = [location.place, location.city, location.country].filter(
    (part): part is string => Boolean(part && part.trim())
  );

  return parts.length > 0 ? parts.join(', ') : undefined;
}
