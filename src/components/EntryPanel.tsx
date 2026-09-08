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
 * canvas - see index.css :root), so this panel uses --panel-bg-color, a
 * subtle lightened overlay of that same base color, to stay visually
 * separable from the page and from other stacked panels without breaking
 * the cohesive dark theme. Both tokens move together if a light mode is
 * added later.
 *
 * The left accent bar's color (present in both modes) comes from
 * utils/colors.ts - the same mapping StarMap.tsx uses to tint this
 * entry's star - rather than a second hardcoded color list here. See the
 * comment in colors.ts for why: in short, one shared mapping can't drift
 * out of sync with itself, while two copies of "activityType -> color"
 * inevitably would once either one is edited without remembering the other.
 */

import { ACTIVITY_TYPE_OPTIONS, Entry } from '../types/Entry';
import { getActivityColor } from '../utils/colors';

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
      className="ml-2 flex-shrink-0 text-gray-500 hover:text-gray-300"
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
  const activityLabel =
    ACTIVITY_TYPE_OPTIONS.find(option => option.value === entry.activityType)
      ?.label ?? entry.activityType;

  // "Other" entries store their real category name separately, so prefer
  // that over the generic "Other" label when it's available.
  const displayActivityType =
    entry.customActivityType && entry.customActivityType.trim().length > 0
      ? entry.customActivityType
      : activityLabel;

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
        className="flex w-full flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border bg-[var(--panel-bg-color)] px-4 py-2.5 text-sm shadow-sm"
        style={panelStyle}
      >
        <span className="flex-shrink-0 text-gray-400">
          {displayActivityType}
        </span>
        <span className="text-gray-600">&middot;</span>
        <span className="min-w-0 flex-1 truncate text-gray-100">
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

  const formattedDate = new Date(entry.timestamp).toLocaleDateString(
    undefined,
    {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );

  return (
    <div
      className="w-full flex-shrink-0 rounded-lg border bg-[var(--panel-bg-color)] shadow-sm"
      style={panelStyle}
    >
      {/* ─── Header ─── */}
      <div
        className="flex items-start justify-between border-b px-4 pt-4 pb-3"
        style={{ borderColor: 'var(--panel-border-color)' }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-gray-100">
            {entry.title}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {displayActivityType} &middot; {formattedDate}
          </p>
        </div>
        <CloseButton onClick={onClose} label={`Close ${entry.title}`} />
      </div>

      {/* ─── Body ─── */}
      <div className="space-y-3 px-4 py-3">
        {entry.tags.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Tags
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {entry.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-indigo-400/20 px-3 py-1 text-sm font-medium text-indigo-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Description
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-300">
            {entry.description || 'No description for this entry.'}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Notes
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-300">
            {entry.notes || 'No notes for this entry.'}
          </p>
        </div>
      </div>
    </div>
  );
}
