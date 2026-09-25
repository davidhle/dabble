/**
 * SidebarResizeHandle - the draggable strip on the visualization sidebar's
 * canvas-facing edge: its RIGHT edge when the sidebar is on the left, its
 * LEFT edge when it's on the right (see useSidebarWidth.ts's SidebarSide).
 * The screen-facing edge stays pinned to --edge-gutter, so only the
 * canvas-facing edge moves.
 *
 * Rendered as a sibling of the sidebar container inside each page's
 * `relative w-fit` wrapper (the same wrapper BookmarkRail anchors to), so
 * `100%` from the anchored side is the container's live canvas-facing
 * edge and `top-0 bottom-0` spans its full height. Straddles the edge - half over the container,
 * half over the canvas - and sits above both (z-20) so it wins the hit
 * test over the container's own content and the rail's first few pixels.
 *
 * Pointer capture keeps the drag alive when the cursor outruns the strip
 * (or leaves the window); the body cursor/user-select overrides keep the
 * ew-resize cursor and stop text selection across the page mid-drag.
 * Also keyboard-operable as a focusable `separator` (arrow keys), and
 * double-click resets to the default width.
 */

import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';
import type { SidebarSide } from '../hooks/useSidebarWidth';

/** Strip width (px), centered on the edge. */
const HANDLE_WIDTH = 8;

/** Arrow-key step (px); Shift for a bigger step. */
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

interface SidebarResizeHandleProps {
  /** Which side the sidebar is on - the handle goes on the opposite edge. */
  side: SidebarSide;
  /** The sidebar container whose width this drags - its rendered width is the drag's starting point. */
  targetRef: RefObject<HTMLElement>;
  /** Called every pointermove with the requested width (clamping is the caller's job). */
  onResize: (width: number) => void;
  /** Called once the drag (or a key press) finishes - where the width gets saved. */
  onResizeEnd: () => void;
  /** Double-click: back to the default width. */
  onReset: () => void;
}

export default function SidebarResizeHandle({
  side,
  targetRef,
  onResize,
  onResizeEnd,
  onReset,
}: SidebarResizeHandleProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  // Moving the pointer right widens a left sidebar but narrows a right one.
  const direction = side === 'left' ? 1 : -1;

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onResizeEnd();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    if (!target) return;
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const delta =
      event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
    if (delta === 0) return;
    event.preventDefault();
    onResize(target.getBoundingClientRect().width + delta * direction);
    onResizeEnd();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      tabIndex={0}
      className="group absolute bottom-0 top-0 z-20 flex cursor-ew-resize touch-none justify-center focus:outline-none"
      style={{
        [side === 'left' ? 'left' : 'right']: `calc(100% - ${
          HANDLE_WIDTH / 2
        }px)`,
        width: HANDLE_WIDTH,
      }}
      onPointerDown={event => {
        const target = targetRef.current;
        if (!target || event.button !== 0) return;
        event.preventDefault();
        dragRef.current = {
          startX: event.clientX,
          startWidth: target.getBoundingClientRect().width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (!drag) return;
        onResize(drag.startWidth + (event.clientX - drag.startX) * direction);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
    >
      {/* Thin accent line on hover/focus/drag, so the edge reads as grabbable. */}
      <div className="my-4 w-0.5 rounded-full bg-[var(--accent-color)] opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-100 group-active:opacity-100" />
    </div>
  );
}
