/**
 * zoomTo.ts - Programmatic d3-zoom Move, Animated Or Instant
 *
 * StarMap.tsx and SpiralTimeline.tsx both move their d3-zoom transform
 * programmatically (CLICK-TO-CENTER and RESET-VIEW). With motion enabled
 * that's a 650ms d3 transition; with it off (hooks/useMotionEnabled.ts)
 * the transform is applied directly - no transition is scheduled at all,
 * rather than a zero-duration one that still runs a d3 timer tick.
 * Either way d3-zoom fires its usual start/zoom/end events, so the
 * zoom layer's own listeners stay in sync identically.
 */

import * as d3 from 'd3';

/** Duration (ms) of an animated programmatic pan/zoom - 500-750ms: smooth, not sluggish. */
export const PROGRAMMATIC_ZOOM_MS = 650;

export function zoomTo(
  svgNode: SVGSVGElement,
  zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>,
  transform: d3.ZoomTransform,
  animate: boolean
): void {
  const selection = d3.select(svgNode);
  if (animate) {
    selection
      .transition()
      .duration(PROGRAMMATIC_ZOOM_MS)
      .call(zoomBehavior.transform, transform);
  } else {
    selection.call(zoomBehavior.transform, transform);
  }
}
