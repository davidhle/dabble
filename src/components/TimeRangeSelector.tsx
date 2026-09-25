/**
 * TimeRangeSelector.tsx - Draggable Time-Range Brush (d3-brush)
 *
 * A thin horizontal track spanning TimeRangeContext's `fullRange`, with
 * two draggable handles the user drags inward to narrow `selectedRange`.
 * Currently rendered by Timeline.tsx only (below LinearTimeline) - see
 * TimeRangeContext.tsx's top-of-file comment for why the range state
 * itself lives above the router regardless of which page renders this.
 *
 * Also centers itself in the free span between the sidebar overlay (via
 * the `sidebarWidth` prop) and the bottom-right button stack - see the
 * STACK-AWARE CENTERING comment on the returned JSX below.
 *
 * ──────────────────────────────────────────────────────────────────────
 * DOMAIN IS ALWAYS fullRange, NEVER selectedRange
 * ──────────────────────────────────────────────────────────────────────
 * The track's own scale is built from `fullRange` - the full min/max
 * across every entry - and stays that way regardless of how far the user
 * has already narrowed `selectedRange`. Only the BRUSH'S OWN SELECTION
 * (the highlighted band + its two handles) reflects `selectedRange`; the
 * track it slides within never shrinks to match it. This is what lets a
 * user narrowed all the way down to a single week always drag back out
 * to see (and re-select from) the full dataset again - if the domain
 * itself tracked `selectedRange` instead, narrowing the selection would
 * also narrow the only range left to select FROM, making it impossible
 * to widen back out without some separate "reset" affordance.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SYNCING A CONTROLLED d3-brush: THE `sourceEvent` GUARD
 * ──────────────────────────────────────────────────────────────────────
 * `selectedRange` is owned by TimeRangeContext, not by this component -
 * so this needs to work as a CONTROLLED input: dragging the brush should
 * call `setSelectedRange`, but `selectedRange` changing for any OTHER
 * reason (TimeRangeContext auto-tracking a widened `fullRange` - see its
 * own comment - or a future reset control) needs to move the brush's
 * handles to match, without that programmatic move re-triggering
 * `setSelectedRange` right back and creating a feedback loop.
 *
 * d3-brush's own event object answers this for free: `event.sourceEvent`
 * is the underlying DOM event (mousedown/touchstart/etc.) when a change
 * came from an actual user drag, and `null`/`undefined` when the change
 * came from a programmatic `.call(brush.move, ...)` instead (exactly
 * what the SYNC EFFECT below does). Guarding the 'brush'/'end' handler on
 * `event.sourceEvent` being present is what breaks the loop: a user drag
 * updates context state (sourceEvent present -> forwarded); the SYNC
 * EFFECT's resulting programmatic move fires the handler again, but with
 * no sourceEvent, so it's ignored instead of calling `setSelectedRange`
 * a second time for a change that already came from context.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WIDTH MEASUREMENT: A DEDICATED, UNPADDED INNER DIV
 * ──────────────────────────────────────────────────────────────────────
 * `containerRef` (below) is NOT on the outer padded card
 * (`px-4 py-3` - the rounded, bordered "floating chrome" box) - it's on a
 * plain inner div with no padding of its own, nested inside that card.
 * This used to be measured off the padded card directly, which was the
 * cause of the brush/track visibly overflowing the card's edges:
 * `getBoundingClientRect().width` on an element returns its full
 * BORDER-BOX width, padding included (Tailwind's preflight sets
 * `box-sizing: border-box` globally) - so measuring the padded card gave
 * back a width that already INCLUDED its own `px-4` padding (32px total).
 * Setting the `<svg>` (a CHILD of that same padded card) to that same
 * full measured width then sized it 32px wider than the card's actual
 * CONTENT area has room for, and since nothing constrains overflow here,
 * the svg's right edge - track, handles, all of it - rendered spilling
 * out past the card's padding and rounded border instead of stopping at
 * it. Measuring this separate, unpadded inner div instead gives back
 * exactly the content-box width already available inside the card's
 * padding, so an `<svg>` sized to match it can never exceed that box.
 */

import {
  forwardRef,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { Entry } from '../types/Entry';
import { useTimeRange } from '../context/TimeRangeContext';
import type { SidebarSide } from '../hooks/useSidebarWidth';

interface TimeRangeSelectorProps {
  /**
   * The FULL, unfiltered entries array (Timeline.tsx's own `entries` prop,
   * not its time-filtered subset) - used only for the DENSITY TICKS below.
   * Using the unfiltered list is deliberate: showing density ticks only
   * for entries already inside the current selection would be circular
   * for a control whose whole job is helping the user pick a DIFFERENT
   * selection - the ticks need to show where data exists across the
   * entire `fullRange`, including outside whatever's currently selected.
   */
  entries: Entry[];
  /**
   * The sidebar overlay's current rendered width in pixels (0 when it
   * isn't rendered) - same prop, same source (Timeline.tsx's measured
   * `sidebarWidth`), and same purpose as LinearTimeline.tsx's own
   * `sidebarWidth`: this control's outer wrapper (see the return JSX
   * below) uses it to center itself between the sidebar and the
   * bottom-right button stack - instead of the full viewport,
   * whenever a panel is open, the same "exclude the sidebar's band"
   * pattern used everywhere else a sidebar-aware layout is needed.
   */
  sidebarWidth: number;
  /** Which screen edge `sidebarWidth`'s band is on - the wrapper insets from that side instead. */
  sidebarSide: SidebarSide;
  /**
   * Optional one-line caption rendered just above the card, centered on
   * it (Spiral.tsx's year-glyph footnote). Lives inside the card so it
   * follows STACK-AWARE CENTERING for free, rather than the page
   * re-deriving the card's position.
   */
  caption?: ReactNode;
}

/** Plot margins - room so the brush's handles (which extend slightly past the selection edges) aren't clipped at the container's own edges. */
const MARGIN = { top: 4, right: 12, bottom: 4, left: 12 };

/** Height (px) of both the always-visible background track and the brush's own interactive/visual extent - deliberately the same value so the two visually read as one thin band, not two mismatched layers. */
const TRACK_HEIGHT = 20;

/** Width (px) of each drag handle - passed to the brush's own `.handleSize()` so the generated `.handle--w`/`.handle--e` rects match the width this file also styles them to. */
const HANDLE_WIDTH = 8;

/** `%b %d, %Y` - e.g. "Mar 17, 2023" - used for the start/end labels flanking the track. */
const formatDate = d3.timeFormat('%b %d, %Y');

/**
 * `forwardRef`, forwarded to the CARD div below (the `w-full max-w-xl
 * rounded-2xl ...` one) - not the outer `fixed` wrapper, which merely
 * spans the full sidebar-to-button-stack region it centers
 * itself within. A calling page (see VizEmptyState.tsx's "filtered"
 * message) needs the CARD's own actual rendered position/size to
 * position something relative to it (e.g. immediately to its right) -
 * the outer wrapper's own box wouldn't give that, since it's always
 * exactly that region regardless of how wide the
 * card centered inside it actually renders.
 */
const TimeRangeSelector = forwardRef<HTMLDivElement, TimeRangeSelectorProps>(
  function TimeRangeSelector(
    { entries, sidebarWidth, sidebarSide, caption },
    cardRef
  ) {
    const { fullRange, selectedRange, setSelectedRange } = useTimeRange();

    const containerRef = useRef<HTMLDivElement>(null);
    const brushGroupRef = useRef<SVGGElement>(null);
    const brushBehaviorRef = useRef<d3.BrushBehavior<unknown> | null>(null);

    // Same measure-before-paint approach as LinearTimeline.tsx's own
    // "Responsive sizing" - see its comment for why `useLayoutEffect`
    // (not `useEffect`) matters for getting a correct size on the very
    // first rendered frame.
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const updateWidth = () => setWidth(el.getBoundingClientRect().width);
      updateWidth();
      const observer = new ResizeObserver(updateWidth);
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // How far the corner button stack (ThemeToggle/ResetButton/
    // EditModeToggle, tagged `data-corner-stack`) reaches in from its own
    // screen edge. Measured off the real buttons rather than hardcoded, so
    // it tracks --chrome-edge-gutter (which grows with the viewport) and
    // any future change to the buttons' own size - see STACK-AWARE
    // CENTERING below. Measured from whichever edge each button is nearer,
    // so the value is the same in either corner and never goes stale
    // while index.css flips the stack to the other side.
    const [stackInset, setStackInset] = useState(0);

    useLayoutEffect(() => {
      const buttons = document.querySelectorAll('[data-corner-stack]');

      const updateInset = () => {
        const vw = document.documentElement.clientWidth;
        let inset = 0;
        buttons.forEach(b => {
          const rect = b.getBoundingClientRect();
          inset = Math.max(
            inset,
            rect.left > vw / 2 ? vw - rect.left : rect.right
          );
        });
        setStackInset(inset);
      };
      updateInset();
      // Window resize: the gutter is viewport-relative, so the stack moves
      // without resizing. ResizeObserver: the buttons themselves resizing.
      const observer = new ResizeObserver(updateInset);
      buttons.forEach(b => observer.observe(b));
      window.addEventListener('resize', updateInset);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateInset);
      };
    }, []);

    // The obstacle on each side the card centers between: whichever of the
    // sidebar or the button stack reaches further in from that edge. The
    // stack sits opposite the sidebar (see index.css's `data-corner-stack`
    // rule). An edge with neither reserves the stack's band anyway, so
    // with no sidebar open the card stays centered on the viewport.
    const stackSide: SidebarSide = sidebarSide === 'left' ? 'right' : 'left';
    const insetFor = (edge: SidebarSide) =>
      Math.max(
        sidebarSide === edge ? sidebarWidth : 0,
        stackSide === edge ? stackInset : 0
      ) || stackInset;
    const leftInset = insetFor('left');
    const rightInset = insetFor('right');

    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);

    // See the DOMAIN IS ALWAYS fullRange comment above - this never reads
    // `selectedRange`.
    const scale = useMemo(
      () =>
        d3
          .scaleTime()
          .domain([fullRange.start, fullRange.end])
          .range([0, innerWidth]),
      [fullRange, innerWidth]
    );

    /**
     * ─── DENSITY TICKS: where entries fall across `fullRange` ───
     * A lightweight, purely visual reference for where events cluster
     * along the FULL track - drawn before the user ever touches the brush,
     * so they can see roughly where the data actually is before deciding
     * how to narrow the selection. Each entry gets exactly one thin
     * vertical tick at `scale(entry.timestamp)` - using the start
     * timestamp uniformly for BOTH point and range entries (not e.g. a
     * tick per day of a range entry's span), and no lane/stacking logic to
     * keep entries that land close together from overlapping - this is
     * deliberately simpler than LinearTimeline.tsx's own lane-assignment
     * for capsules: ticks here are only ~20px tall and semi-transparent, so
     * several overlapping ticks at nearby dates naturally read as a
     * slightly denser/brighter band via alpha blending alone (a "poor
     * man's histogram") rather than needing real layout to stay legible.
     * Plain React-rendered SVG `<line>`s, not anything d3 draws - no
     * imperative DOM manipulation needed for a static list of marks with no
     * interaction of their own.
     */
    const densityTickX = useMemo(
      () => entries.map(entry => scale(new Date(entry.timestamp))),
      [entries, scale]
    );

    // ─── Create/attach the brush whenever the geometry or domain changes ───
    // Recreated (not just repositioned) on `scale`/`innerWidth` changes since
    // both the pixel `.extent()` and the handler's closure over `scale`
    // (for `scale.invert()`) need to stay current - a stale closure here
    // would silently convert brush pixel positions back to the WRONG dates
    // after a resize or a `fullRange` change.
    useEffect(() => {
      const group = brushGroupRef.current;
      if (!group || innerWidth === 0) return;

      const brush = d3
        .brushX()
        .handleSize(HANDLE_WIDTH)
        .extent([
          [0, 0],
          [innerWidth, TRACK_HEIGHT],
        ])
        .on('brush end', (event: d3.D3BrushEvent<unknown>) => {
          // See the SYNCING A CONTROLLED d3-brush comment above.
          if (!event.sourceEvent) return;

          if (!event.selection) {
            // An empty selection (the user clicked without dragging,
            // collapsing the brush to nothing) reads as "clear the
            // filter" - snap back to the full range rather than leaving
            // the timeline showing zero entries.
            setSelectedRange(fullRange);
            return;
          }

          const [x0, x1] = event.selection as [number, number];
          setSelectedRange({ start: scale.invert(x0), end: scale.invert(x1) });
        });

      const selection = d3.select(group);
      selection.call(brush);

      // Restyle the brush's auto-generated elements - d3-brush gives
      // `.selection`/`.handle` some default (light-mode-only) inline
      // presentation attributes of its own; overriding them here, right
      // after `.call(brush)`, is the same "restyle d3's own output"
      // pattern LinearTimeline.tsx's AXIS EFFECT uses for its tick text.
      // Driven entirely by --accent-color (the app's one shared accent
      // token - see index.css) via CSS `color-mix()`, rather than fixed
      // indigo values, so this brush inverts along with every other
      // accent-colored control between themes instead of staying a fixed
      // color that only happened to read well against one theme.
      selection
        .select('.selection')
        .attr(
          'fill',
          'color-mix(in srgb, var(--accent-color) 35%, transparent)'
        )
        .attr('stroke', 'color-mix(in srgb, var(--accent-color) 55%, white)')
        .attr('stroke-width', 1)
        .attr('rx', TRACK_HEIGHT / 2);
      selection
        .selectAll('.handle')
        .attr('fill', 'var(--accent-color)')
        .attr('stroke', 'none')
        .attr('rx', HANDLE_WIDTH / 2)
        .attr('cursor', 'ew-resize');

      brushBehaviorRef.current = brush;

      return () => {
        selection.on('.brush', null);
        brushBehaviorRef.current = null;
      };
    }, [scale, innerWidth, fullRange, setSelectedRange]);

    // ─── Keep the brush's handle positions synced to `selectedRange` ───
    // Covers both the INITIAL position right after the effect above
    // (re)creates the brush (a freshly attached brush has no selection at
    // all until moved), and any later change to `selectedRange` that didn't
    // originate from dragging this brush itself - see the SYNCING A
    // CONTROLLED d3-brush comment above for why that's safe (the
    // `sourceEvent` guard) rather than fighting this effect in a loop.
    useEffect(() => {
      const group = brushGroupRef.current;
      const brush = brushBehaviorRef.current;
      if (!group || !brush || innerWidth === 0) return;

      d3.select(group).call(brush.move, [
        scale(selectedRange.start),
        scale(selectedRange.end),
      ]);
    }, [selectedRange, scale, innerWidth]);

    const height = TRACK_HEIGHT + MARGIN.top + MARGIN.bottom;

    return (
      // Self-contained `fixed bottom-*` floating chrome, same positioning
      // pattern as ResetButton.tsx/ResetToast.tsx (both also self-position
      // rather than taking layout coordinates as props - unlike
      // SidebarPanelStack.tsx, nothing here depends on the page's own
      // measured header layout). Centered rather than pinned to a corner
      // (there's no natural corner for a horizontal track the way a round
      // button has one), and given the SAME opaque "floating chrome" surface
      // (--panel-bg-color-solid + --panel-border-color + backdrop-blur +
      // shadow-lg) ResetButton/ResetToast use - this is a floating
      // CONTROL, not header content, so it follows their visual language
      // rather than the header's own fully-transparent "text over the
      // starfield" treatment.
      // z-40: same tier as ResetButton/ResetToast, above the canvas (z-0)
      // and header (z-10), below the AddEntryForm modal (z-50).
      //
      // STACK-AWARE CENTERING: `left`/`right` (inline styles, since both
      // are runtime numbers) narrow this flex container's own box down to
      // exactly the free span between the two obstacles - `leftInset`/
      // `rightInset` above: the sidebar's edge on one side, the button
      // stack's inner edge on the other. `justify-center` then centers the
      // card WITHIN that span, so the gap from the sidebar to the card
      // always equals the gap from the card to the stack, at any sidebar
      // width or side - the same "center within what's actually visible"
      // result LinearTimeline.tsx reaches with its CANVAS ORIGIN SHIFT.
      //
      // `px-3` keeps a minimum 12px gap on both sides, so the card shrinks
      // (still centered) rather than touching either obstacle when the
      // span gets narrow - e.g. a sidebar dragged wide (see
      // SidebarResizeHandle.tsx) on a laptop-sized screen.
      <div
        className="fixed bottom-6 z-40 flex justify-center px-3"
        style={{ left: leftInset, right: rightInset }}
      >
        <div
          ref={cardRef}
          className="relative w-full max-w-xl rounded-2xl border border-[var(--panel-border-color)] bg-[var(--panel-bg-color-solid)] px-4 py-3 shadow-lg backdrop-blur"
        >
          {caption && (
            // `pointer-events-none`: read-only text that shouldn't
            // intercept clicks meant for the canvas behind it.
            <p className="pointer-events-none absolute inset-x-0 bottom-full mb-2 text-center text-xs text-[var(--text-muted-color)]">
              {caption}
            </p>
          )}
          {/*
           * WIDTH MEASUREMENT div - see the top-of-file comment for why this
           * has to be a separate, unpadded element from the card above
           * rather than measuring the padded card directly.
           */}
          <div ref={containerRef} className="w-full">
            <svg width={width} height={height}>
              <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                {/*
                 * The always-visible background track - see the DOMAIN IS
                 * ALWAYS fullRange comment above. This is a plain rect, not
                 * anything d3-brush draws; the brush's own `.selection`
                 * element (restyled above) sits on top of it once attached.
                 */}
                <rect
                  width={innerWidth}
                  height={TRACK_HEIGHT}
                  rx={TRACK_HEIGHT / 2}
                  fill="var(--field-tint-1)"
                />

                {/*
                 * DENSITY TICKS - see the useMemo comment above. Rendered
                 * AFTER the plain background rect (so they show up against
                 * it) but BEFORE the brush's own group (so the brush's
                 * `.selection`/`.handle` elements still paint visibly on
                 * top of the ticks, not hidden underneath them).
                 * `pointer-events-none` so these never steal a drag gesture
                 * meant for the brush underneath/around them - they're a
                 * read-only visual reference only.
                 */}
                <g className="pointer-events-none">
                  {densityTickX.map((x, index) => (
                    <line
                      key={index}
                      x1={x}
                      x2={x}
                      y1={0}
                      y2={TRACK_HEIGHT}
                      stroke="var(--text-muted-color)"
                      strokeOpacity={0.6}
                      strokeWidth={1.5}
                    />
                  ))}
                </g>

                <g ref={brushGroupRef} />
              </g>
            </svg>
          </div>

          <div className="mt-1 flex justify-between text-xs text-[var(--text-muted-color)]">
            <span>{formatDate(selectedRange.start)}</span>
            <span>{formatDate(selectedRange.end)}</span>
          </div>
        </div>
      </div>
    );
  }
);

export default TimeRangeSelector;
