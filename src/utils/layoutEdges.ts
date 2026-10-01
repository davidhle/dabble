/**
 * layoutEdges.ts - An element's distance from the viewport's left/right
 * edges, IGNORING CSS transforms.
 *
 * The viz pages' sidebar wrapper slides off-screen via `transform` when
 * collapsed (see index.css's COLLAPSED SIDEBAR rules), and
 * getBoundingClientRect() reports that slid position - which would feed
 * the sidebar's own width math (useSidebarWidth.ts's edge offset) a bogus
 * negative gutter mid-slide. offsetLeft/offsetWidth describe the
 * untransformed layout box instead, so the numbers stay put no matter
 * where the sidebar is animating to. Assumes no horizontal page scroll,
 * which the viz pages never have.
 */
export function layoutEdges(el: HTMLElement): { left: number; right: number } {
  let left = 0;
  let node: HTMLElement | null = el;
  while (node) {
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return {
    left,
    right: document.documentElement.clientWidth - (left + el.offsetWidth),
  };
}
