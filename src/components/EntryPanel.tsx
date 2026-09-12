/**
 * EntryPanel.tsx - Inline (Non-Overlay) Entry Detail Panel
 *
 * Renders one entry in the Constellation sidebar's panel stack, in one of
 * two modes controlled by the `expanded` prop (state owned by
 * Constellation.tsx - see the "expand/minimize" comment there):
 *
 *   - expanded: full detail - title, activityType, date, tags, description,
 *     notes, close button. Mirrors EntryDetailModal.tsx's content, just
 *     laid out as a stacked block instead of a centered overlay.
 *   - minimized: a compact single-line row - activityType/category and
 *     title only - that's clickable (via `onExpand`) to become the
 *     expanded panel. Also has a close button, wired to the same `onClose`
 *     prop as the expanded view (see `CloseButton` below) - closing an
 *     entry should behave identically regardless of which state its panel
 *     was in, so there's one close handler, not one per mode.
 *
 * THEMING: the sidebar itself sits on --bg-color (same token as StarMap's
 * canvas - see index.css :root), so both modes use an overlay of that same
 * base color to stay visually separable from the page and from other
 * stacked panels without breaking the cohesive theme. Both modes now use
 * the SAME --panel-bg-color-solid surface - the minimized row used to keep
 * the more translucent --panel-bg-color instead (its one line of text
 * "needs little help standing out over the starfield"), but that let
 * StarMap's stars show through a minimized row clearly enough to hurt
 * legibility, especially once a light theme's brighter canvas made the
 * translucency more noticeable. Matching the expanded panel's fully opaque
 * surface keeps every row - minimized or expanded - equally legible over
 * whatever's rendering underneath it, in either theme.
 *
 * The left accent bar's color (present in both modes) comes from
 * utils/colors.ts - the same mapping StarMap.tsx uses to tint this
 * entry's star - rather than a second hardcoded color list here. See the
 * comment in colors.ts for why: in short, one shared mapping can't drift
 * out of sync with itself, while two copies of "activityType -> color"
 * inevitably would once either one is edited without remembering the other.
 *
 * MOOD / MEDIA LINKS: this is the ONE shared panel component
 * Constellation.tsx and Timeline.tsx both render an entry's full detail
 * through (see SidebarPanelStack.tsx) - so a display gap here is a display
 * gap on every page that uses it, not just one. It used to render Tags,
 * Description, and Notes only; entry.mood and entry.mediaLinks were both
 * being collected by AddEntryForm.tsx and saved onto the entry correctly,
 * but had no section here to actually show up in, so they silently never
 * appeared no matter how many moods were picked or media links added.
 * Both gaps are covered now - see the Mood and Media Links sections below,
 * which follow the exact same "label + content, render nothing at all
 * when empty" pattern Tags already used, rather than introducing a new
 * one. (Spiral.tsx doesn't render through this component yet - it still
 * uses EntryDetailModal.tsx, which got the same two sections added for
 * the same reason; see that file's own comments.)
 */

import { Entry } from '../types/Entry';
import { getActivityColor } from '../utils/colors';
import { getCategoryName } from '../utils/categories';
import { linkify, LINK_CLASSNAME } from '../utils/linkify';
import { getMediaLinkLabel } from '../utils/mediaLinks';
import { formatEntryDate } from '../utils/formatEntryDate';

interface EntryPanelProps {
  entry: Entry;
  /** Whether this panel renders full detail (true) or a compact row (false). */
  expanded: boolean;
  /** Called when a minimized row is clicked, to expand it. */
  onExpand: () => void;
  /** Called when either mode's close button is clicked. */
  onClose: () => void;
}

/**
 * The (x) close icon/button, shared verbatim between the expanded and
 * minimized panel layouts below so the two modes can't drift apart in
 * appearance or behavior - both call the same `onClose` from
 * Constellation.tsx, which removes the entry from `selectedEntries` and
 * (since StarMap's highlight is derived from that same state) clears its
 * star's "opened" highlight.
 */
function CloseButton({
  onClick,
  label,
}: {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-2 flex-shrink-0 text-[var(--text-muted-color)] hover:text-[var(--text-secondary-color)]"
      aria-label={label}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
}

export default function EntryPanel({
  entry,
  expanded,
  onExpand,
  onClose,
}: EntryPanelProps) {
  // Looked up from the dynamic category list rather than a fixed option
  // list, so a user-created category's name displays correctly here too -
  // see the DYNAMIC CATEGORIES comment in AddEntryForm.tsx for how those
  // get created.
  const displayActivityType = getCategoryName(entry.activityType);

  // Same color this entry's star is tinted with in StarMap - see the
  // theming comment above for why this is looked up rather than hardcoded.
  const accentColor = getActivityColor(entry.activityType);

  // Shared by both modes: the colored left accent bar over the panel
  // surface tokens.
  const panelStyle = {
    borderColor: 'var(--panel-border-color)',
    borderLeftColor: accentColor,
    borderLeftWidth: 4,
  };

  if (!expanded) {
    return (
      // The whole row is clickable to expand (onClick here, plus onKeyDown
      // for keyboard users since this is a <div> - it can't be a <button>
      // itself because it contains the nested CloseButton below, and
      // <button> can't nest another interactive element). CloseButton
      // stops propagation so clicking it doesn't also bubble up and fire
      // this row's onExpand.
      <div
        role="button"
        tabIndex={0}
        onClick={onExpand}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') onExpand();
        }}
        className="flex w-full flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border bg-[var(--panel-bg-color-solid)] px-4 py-2.5 text-sm shadow-sm"
        style={panelStyle}
      >
        <span className="flex-shrink-0 text-[var(--text-muted-color)]">
          {displayActivityType}
        </span>
        <span className="text-[var(--text-muted-color)]">&middot;</span>
        <span className="min-w-0 flex-1 truncate text-[var(--text-color)]">
          {entry.title}
        </span>
        <CloseButton
          onClick={event => {
            event.stopPropagation();
            onClose();
          }}
          label={`Close ${entry.title}`}
        />
      </div>
    );
  }

  // See formatEntryDate for the dateDisplay / date-range / single-date
  // precedence - shows a range like "Jun 30 – Jul 2, 2023" when the entry
  // has an endTimestamp (see types/Entry.ts).
  const formattedDate = formatEntryDate(entry);

  return (
    <div
      // bg-[var(--panel-bg-color-solid)]: same opaque surface the
      // minimized row above now also uses (see the THEMING comment at the
      // top of this file) - this expanded panel is a full block of text
      // sitting directly over StarMap's starfield, so legibility matters
      // even more here. See --panel-bg-color-solid's own comment in
      // index.css for the ~92% opacity value and why it's deliberately
      // short of fully opaque.
      className="w-full flex-shrink-0 rounded-lg border bg-[var(--panel-bg-color-solid)] shadow-sm"
      style={panelStyle}
    >
      {/* ─── Header ─── */}
      <div
        className="flex items-start justify-between border-b px-4 pt-4 pb-3"
        style={{ borderColor: 'var(--panel-border-color)' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-[var(--text-color)]">
            {entry.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted-color)]">
            {displayActivityType} &middot; {formattedDate}
          </p>
        </div>
        <CloseButton onClick={onClose} label={`Close ${entry.title}`} />
      </div>

      {/* ─── Body ─── */}
      <div className="space-y-3 px-4 py-3">
        {entry.tags.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
              Tags
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {entry.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-indigo-400/20 px-3 py-1 text-sm font-medium text-[var(--indigo-accent-text)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/*
         * Mood - see the MOOD / MEDIA LINKS comment at the top of this
         * file. `entry.mood` is optional (`string[] | undefined`) and, per
         * AddEntryForm.tsx, is never set to an empty array either (moods
         * only gets passed through when at least one was picked) - the
         * length check is still here defensively rather than trusting
         * that invariant, so this renders NOTHING (not an empty "Mood"
         * label with no chips under it) for any falsy/empty value. Teal
         * rather than Tags' indigo or any color from
         * NEW_CATEGORY_COLOR_PALETTE (utils/categories.ts) - a color no
         * category can ever be assigned, so a mood chip can never be
         * mistaken for a category-colored one.
         */}
        {entry.mood && entry.mood.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
              Mood
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {entry.mood.map(mood => (
                <span
                  key={mood}
                  className="inline-flex items-center rounded-full bg-teal-400/20 px-3 py-1 text-sm font-medium text-[var(--teal-accent-text)]"
                >
                  {mood}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
            Description
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--text-secondary-color)]">
            {entry.description
              ? linkify(entry.description)
              : 'No description for this entry.'}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
            Notes
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--text-secondary-color)]">
            {entry.notes ? linkify(entry.notes) : 'No notes for this entry.'}
          </p>
        </div>

        {/*
         * Media Links - see the MOOD / MEDIA LINKS comment at the top of
         * this file. Each link renders as a labeled clickable link-out
         * ("View on Instagram") rather than the raw URL - getMediaLinkLabel
         * (utils/mediaLinks.ts) derives the platform from the URL's own
         * hostname, since AddEntryForm.tsx has no per-platform input and
         * always saves `media.type` as "Video" regardless of the actual
         * platform (see its addMediaLink comment) - `media.type` isn't
         * trustworthy enough to label off of. Same target="_blank" +
         * rel="noopener noreferrer" + LINK_CLASSNAME styling linkify.ts
         * uses for a URL found inside free-text notes/description, so a
         * link reads the same way wherever it appears in this panel.
         */}
        {entry.mediaLinks.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted-color)]">
              Media Links
            </p>
            <div className="mt-1.5 flex flex-col gap-1">
              {entry.mediaLinks.map((media, index) => (
                <a
                  key={index}
                  href={media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm ${LINK_CLASSNAME}`}
                >
                  {getMediaLinkLabel(media.url)}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
