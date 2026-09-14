/**
 * topRightTooltipStack.ts - Shared Layout Constants For The Top-Right Tooltip Stack
 *
 * EditModeBanner.tsx and VizEmptyState.tsx's "no entries match the current
 * time range or filters" message both anchor to the same fixed top-right
 * corner - directly below Layout.tsx's navbar/'+' button - stacking
 * DOWNWARD when both are visible at once (Edit Mode is completely
 * independent of whether the current time range/filters happen to exclude
 * every entry, so either, both, or neither can be showing). Edit Mode
 * always takes the TOP slot when it's showing (see EditModeBanner.tsx's
 * own top-of-file comment for why); "no entries match" drops into that
 * same top slot itself whenever Edit Mode isn't currently on, or shifts
 * down into the second slot when it is (see VizEmptyState.tsx's own
 * comment on its `editModeBannerVisible` prop).
 *
 * These constants live in their own shared file - rather than one of the
 * two components exporting them for the other to import - so neither
 * "owns" the other and a third tooltip could join the same stack later
 * without an awkward cross-component import direction.
 */

/**
 * Distance (px) from the very top of the viewport to the stack's TOP
 * slot. Clears Layout.tsx's navbar's RIGHT pill (the one holding just the
 * '+' button) - `pt-4` (16px) from the viewport top, `p-1.5` (6px) around
 * the `h-10` (40px) button, so that pill's own bottom edge sits at
 * 16+6+40+6=68px - by a comfortable ~16-18px margin, so neither tooltip
 * can ever overlap that pill regardless of which one occupies this slot.
 * A fixed value (not measured off the pill directly): the pill's own
 * height and position are effectively constant across every page this
 * stack renders on, so there's no live layout fact here worth a ref/
 * effect the way TimeRangeSelector's own measured rect is elsewhere in
 * this app. Revisit this if Layout.tsx's right pill's own top offset/
 * padding/button size ever changes - see that pill's own comment in
 * Layout.tsx, which points back here for the same reason.
 */
export const TOP_SLOT = 86;

/**
 * Vertical gap (px) between the two tooltips when both are stacked -
 * matches the corner button stack's own 12px rhythm (ResetButton.tsx/
 * ThemeToggle.tsx).
 */
export const STACK_GAP = 12;

/**
 * Estimated rendered height (px) of EditModeBanner's own box - one line
 * of text plus its `p-3` padding/border - used by VizEmptyState.tsx to
 * compute the SECOND slot's top position when Edit Mode's banner is also
 * occupying the first one above it. A fixed estimate, not a live
 * measurement: EditModeBanner's message text never changes, so this
 * stays accurate rather than drifting the way a longer, wrapping
 * message's height would.
 */
export const EDIT_MODE_HEIGHT_ESTIMATE = 46;
