/**
 * focusHighlight.ts - Stroke Values For The FOCUSED Entry's Canvas Highlight
 *
 * StarMap, LinearTimeline, and SpiralTimeline all draw the same two-layer
 * "opened entry" highlight (a soft blurred glow behind the mark, then a
 * crisp thin ring) around every entry that has a sidebar panel. Once the
 * sidebar switched to a single focused-entry view (FocusedEntryView.tsx),
 * the canvas needed to agree with it about WHICH of those opened entries
 * is the one currently in focus - so the focused entry (`expandedEntryId`)
 * gets a brighter, heavier version of that same highlight, and every other
 * opened entry keeps the original values.
 *
 * Only the focused values live here, shared by all three canvases so they
 * can't drift apart; each canvas keeps its own existing constants/literals
 * for the regular opened treatment. Same highlight color either way (the
 * --star-highlight-color token) - the emphasis comes from stroke weight
 * and opacity, not a different hue.
 */

/** Glow stroke width for the focused entry (regular opened glow: 4). */
export const FOCUSED_GLOW_STROKE_WIDTH = 6;

/** Glow opacity for the focused entry (regular opened glow: 0.6). */
export const FOCUSED_GLOW_OPACITY = 0.95;

/** Crisp ring stroke width for the focused entry (regular opened ring: 1.5). */
export const FOCUSED_RING_STROKE_WIDTH = 2.5;
