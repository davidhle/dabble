/**
 * linkify.ts - Shared URL-to-Link Text Rendering
 *
 * Entry text (description, notes) is free-form and visitors sometimes
 * paste plain http(s) URLs into it. Several components render that same
 * text back out (EntryPanel.tsx's expanded panel, EntryDetailModal.tsx) -
 * rather than each one carrying its own copy of a URL regex and the
 * logic to turn a match into an <a> element (which would inevitably
 * drift - one spot tweaking the regex or link styling without the
 * other), this is the single place that owns "how do we find a URL in
 * this text and turn it into a clickable link." Callers just pass the
 * raw string where they used to render it directly.
 *
 * Plain .ts (not .tsx) despite building React elements: it uses
 * `createElement` directly instead of JSX syntax, so it doesn't need a
 * JSX-aware file extension.
 */

import { createElement, Fragment, ReactNode } from 'react';

/** Matches one http(s) URL run (up to the next whitespace). */
const URL_PATTERN = /https?:\/\/[^\s]+/g;

/**
 * The clickable-link styling every <a> this file renders uses. Exported so
 * other components that render their own <a> elements for a URL - e.g.
 * EntryPanel.tsx's Media Links section, which renders a labeled link
 * ("View on Instagram") rather than the raw URL text linkify() itself
 * produces - can reuse the exact same visual language instead of a second,
 * possibly-drifting copy of this class string.
 */
export const LINK_CLASSNAME =
  'text-[var(--indigo-accent-text)] underline hover:opacity-80';

/**
 * Splits `text` on http(s) URLs and returns an array of React nodes:
 * plain text segments interleaved with <a> elements for each URL found.
 * Drop-in replacement anywhere a component currently renders the raw
 * string - `{linkify(entry.notes)}` instead of `{entry.notes}`.
 *
 * target="_blank" + rel="noopener noreferrer" on every link: opens the
 * URL in a new tab without handing the destination page a `window.opener`
 * reference back to this app (the tabnabbing risk of target="_blank"
 * alone).
 */
export function linkify(text: string): ReactNode[] {
  if (!text) return [text];

  // A fresh RegExp instance per call (rather than reusing the
  // module-level URL_PATTERN directly) so this function is safe to call
  // concurrently/re-entrantly - a shared global-flag regex's `lastIndex`
  // would otherwise be mutated by exec() and corrupt any other in-flight
  // call using the same instance.
  const regex = new RegExp(URL_PATTERN);
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    const start = match.index;

    if (start > lastIndex) {
      nodes.push(
        createElement(Fragment, { key: key++ }, text.slice(lastIndex, start))
      );
    }

    nodes.push(
      createElement(
        'a',
        {
          key: key++,
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: LINK_CLASSNAME,
        },
        url
      )
    );

    lastIndex = start + url.length;
  }

  if (lastIndex < text.length) {
    nodes.push(createElement(Fragment, { key: key++ }, text.slice(lastIndex)));
  }

  return nodes;
}
