/**
 * EditModeBanner.tsx - "Edit Mode Is On" Notice
 *
 * TOP-RIGHT, BELOW THE '+' BUTTON:
 * Fixed `top-right` (see `TOP_SLOT` in utils/topRightTooltipStack.ts),
 * directly below Layout.tsx's navbar and its '+' add-entry button, rather
 * than anchored near TimeRangeSelector at the bottom of the page (an
 * earlier version) or as a line of text under the page title (the
 * original version, in VizPageHeader.tsx's `subtitle`). Both earlier
 * spots put this notice near controls that have nothing to do with
 * editing; the '+' button is the one other place in the app that already
 * means "create/modify an entry," so a notice about entry EDITING reads
 * most naturally near it. Since this corner is the opposite side of the
 * screen from the sidebar panel stack (`fixed left-0`), this position
 * also needs no sidebar-width-aware centering the way the bottom-right
 * chrome (ResetButton/ThemeToggle/the old TimeRangeSelector-relative
 * position) does - `right-6` alone stays correct whether or not the
 * sidebar is open.
 *
 * ALWAYS THE TOP SLOT:
 * Edit Mode unconditionally renders in the stack's TOP slot whenever it's
 * on - see the STACKING comment in utils/topRightTooltipStack.ts for the
 * full reasoning. It never needs to know whether VizEmptyState's "no
 * entries match..." message is ALSO showing below it (the reverse isn't
 * true - see that file's own `editModeBannerVisible` prop), which is why
 * this component takes no props at all.
 *
 * WHY YELLOW:
 * Every other status message in the app (VizEmptyState's messages,
 * EntryPanel.tsx's Tags) uses indigo, the app's one neutral/informational
 * accent. Edit Mode is a standing warning that clicking now does something
 * DIFFERENT than usual (opens an editor instead of selecting) - it
 * deliberately reads as a distinct "heads up, you're in a special mode"
 * tone rather than blending in with routine informational text, the same
 * reason a caps-lock indicator or a "you have unsaved changes" banner
 * elsewhere typically isn't styled identically to normal body copy. See
 * index.css's `--yellow-accent-text` token comment.
 */

import { TOP_SLOT } from '../utils/topRightTooltipStack';

export default function EditModeBanner() {
  return (
    <div
      className="pointer-events-auto fixed right-6 z-40 max-w-sm rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-[var(--yellow-accent-text)]"
      style={{ top: TOP_SLOT }}
      role="status"
    >
      Edit Mode: click any entry to edit it.
    </div>
  );
}
