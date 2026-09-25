/**
 * EntryPanel.tsx - Minimized Entry Row In The Sidebar Panel Stack
 *
 * Renders one selected entry in a page's sidebar panel stack (see
 * SidebarPanelStack.tsx) as a compact single-line row - category and title
 * only - that's clickable (via `onExpand`) to focus that entry, plus a
 * close button to remove it from the selection.
 *
 * FOCUSED MODE: this component used to have a second, EXPANDED layout that
 * grew inline within the stack to show the entry's full detail. Expanding
 * an entry is now a full-sidebar takeover instead - see
 * FocusedEntryView.tsx, which replaces the whole sidebar (header, filters,
 * and this stack) while an entry is expanded - so a row here only ever
 * renders minimized. The expanded layout's body sections moved to
 * EntryContent.tsx, and its edit/close buttons to FocusedEntryView's
 * header.
 *
 * THEMING: uses the opaque --panel-bg-color-solid surface (rather than the
 * more translucent --panel-bg-color) so the canvas underneath - StarMap's
 * stars especially - can't show through clearly enough to hurt legibility,
 * in either theme.
 *
 * The left accent bar's color comes from utils/colors.ts - the same
 * mapping StarMap.tsx uses to tint this entry's star - rather than a
 * second hardcoded color list here, so the two can't drift out of sync.
 */

import { Entry } from '../types/Entry';
import { getActivityColor } from '../utils/colors';
import { getCategoryName } from '../utils/categories';

interface EntryPanelProps {
  entry: Entry;
  /** Called when the row is clicked, to focus this entry - see FocusedEntryView.tsx. */
  onExpand: () => void;
  /** Called when the row's close button is clicked. */
  onClose: () => void;
}

export default function EntryPanel({
  entry,
  onExpand,
  onClose,
}: EntryPanelProps) {
  // Looked up from the dynamic category list rather than a fixed option
  // list, so a user-created category's name displays correctly here too -
  // see the DYNAMIC CATEGORIES comment in AddEntryForm.tsx for how those
  // get created.
  const displayActivityType = getCategoryName(entry.activityType);

  return (
    // The whole row is clickable to expand (onClick here, plus onKeyDown
    // for keyboard users since this is a <div> - it can't be a <button>
    // itself because it contains the nested close button below, and
    // <button> can't nest another interactive element). The close button
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
      style={{
        borderColor: 'var(--panel-border-color)',
        borderLeftColor: getActivityColor(entry.activityType),
        borderLeftWidth: 4,
      }}
    >
      <span className="flex-shrink-0 text-[var(--text-muted-color)]">
        {displayActivityType}
      </span>
      <span className="text-[var(--text-muted-color)]">&middot;</span>
      <span className="min-w-0 flex-1 truncate text-[var(--text-color)]">
        {entry.title}
      </span>
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onClose();
        }}
        className="ml-2 flex-shrink-0 text-[var(--text-muted-color)] hover:text-[var(--text-secondary-color)]"
        aria-label={`Close ${entry.title}`}
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
    </div>
  );
}
