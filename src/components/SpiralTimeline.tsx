/**
 * SpiralTimeline.tsx - Chronological Spiral Visualization of Entries
 *
 * A third way to look at `entries`, alongside StarMap.tsx's clustered
 * "constellation" and LinearTimeline.tsx's straight time axis: entries are
 * laid out along an outward-growing spiral, ordered by time the same way
 * LinearTimeline orders them along a line, but coiled into a spiral so a
 * long history still fits inside a compact canvas instead of stretching
 * off-screen. Follows the same overall shape as LinearTimeline.tsx
 * (responsive sizing, a `[0,1]`-normalized time domain, hover tooltip) and
 * the same pan/zoom MECHANISM as StarMap.tsx (a single zoomed `<g>` whose
 * `transform` is written imperatively by d3-zoom, since - like StarMap,
 * and unlike LinearTimeline - there's no axis that needs to be
 * regenerated against a rescaled domain on every zoom tick).
 *
 * ──────────────────────────────────────────────────────────────────────
 * PARITY WITH StarMap.tsx / LinearTimeline.tsx (VIA Spiral.tsx)
 * ──────────────────────────────────────────────────────────────────────
 * This used to be a self-contained card (`rounded-lg border ... p-6`)
 * with its own local `selectedEntry` state and a read-only
 * <EntryDetailModal> popup on click - the odd one out among the three
 * visualization views, which otherwise all shared selection/filter/sort
 * state (useEntrySelection.ts) and a sidebar panel stack
 * (SidebarPanelStack.tsx). It's now been refactored to match
 * StarMap.tsx/LinearTimeline.tsx exactly, completing parity across all
 * three views - see Spiral.tsx's own top-of-file comment for the full
 * page-level wiring (FilterBar, SidebarPanelStack, TimeRangeSelector,
 * Reset button/toast) this component now plugs into:
 *
 *   - `onEntryClick`/`openedEntryIds`/`expandedEntryId` replace the local
 *     `selectedEntry` state + <EntryDetailModal> - a click here forwards
 *     straight to useEntrySelection's `handleEntryClick`, the exact same
 *     shared open-new/expand-minimized/deselect-expanded callback
 *     StarMap's `onStarClick` and LinearTimeline's `onEntryClick` already
 *     use - see useEntrySelection.ts's CLICK OUTCOMES comment.
 *   - `filterCategories` dims (never removes) points/arcs whose
 *     activityType isn't active, the same FILTERED_OUT_OPACITY treatment
 *     StarMap/LinearTimeline give their own entries.
 *   - The OPENED-ENTRY HIGHLIGHT (glow + ring) below mirrors StarMap's
 *     stars for points, and LinearTimeline's capsules (traced along the
 *     arc's own path instead of an inflated rect, since an arc isn't a
 *     straight capsule shape) for range entries.
 *   - `sidebarWidth`/`resetViewSignal` and the CLICK-TO-CENTER/RESET-VIEW
 *     effects below are adapted directly from StarMap.tsx (not
 *     LinearTimeline's `contentOriginX` shift) - see the "FULL-BLEED
 *     CANVAS" and "CLICK-TO-CENTER" comments further down for why
 *     StarMap's approach, not LinearTimeline's, is the right fit for this
 *     view's 2D coordinate system.
 *   - `domainRange` (TimeRangeContext's `selectedRange`, via Spiral.tsx)
 *     replaces the old "extent over whatever entries I was handed" domain
 *     calculation - see the "DOMAIN COMES FROM domainRange" comment below,
 *     the same fix LinearTimeline.tsx already made for the identical
 *     structural problem.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE SPIRAL FORMULA (ARCHIMEDEAN SPIRAL) + POLAR-TO-CARTESIAN CONVERSION
 * ──────────────────────────────────────────────────────────────────────
 * Every entry (and every sample point along the spiral's own path, and
 * every year label) is positioned by the same two-step recipe, in
 * `spiralPoint` below:
 *
 *   1. Normalize its date to `t` in [0, 1]: 0 = the earliest date across
 *      all entries, 1 = the latest (see `normalize`/`domain` below - this
 *      is the exact same "normalize to a [0,1] fraction of the full date
 *      range" idea as LinearTimeline's `baseXScale`, just not expressed as
 *      a d3 scale since what follows isn't a linear pixel mapping).
 *   2. Map `t` to a point in POLAR coordinates (an angle and a radius),
 *      then convert polar -> cartesian (x, y) to actually plot it:
 *
 *        theta  = t * totalRotations * 2*PI   (angle, in radians)
 *        radius = t * maxRadius
 *        x = centerX + radius * cos(theta)
 *        y = centerY + radius * sin(theta)
 *
 *      `theta` sweeps around `totalRotations` full turns as `t` goes from
 *      0 to 1 (turning entries strung out along a "line" of time into a
 *      coil), while `radius` grows linearly from `0` (dead center, t=0,
 *      the oldest entry) out to `maxRadius` (the outer edge, t=1, the
 *      most recent entry) - ZERO, not a fixed `minRadius` offset this
 *      used to add: an earlier version reserved a small center "hole"
 *      (`minRadius = maxRadius * 0.15`) on the reasoning that entries
 *      right at t=0 would otherwise pile up unreadably at a single point,
 *      but that baked a permanently empty ring into the middle of the
 *      canvas for every dataset, whether or not it actually had multiple
 *      entries competing for that exact spot. Starting at true radius 0
 *      instead means the earliest entry sits exactly at the spiral's own
 *      center, matching what "this point in time is the very beginning of
 *      the timeline" should look like, with no reserved dead space - see
 *      the YEAR GLYPHS comment below for how the innermost year marker
 *      still avoids sitting exactly on top of that same center point. A
 *      radius that's
 *      a LINEAR function of `theta` (as it is here, since both are linear
 *      functions of the same `t`) is the definition of an Archimedean
 *      spiral - the "coil of rope" spiral, with each successive loop the
 *      same distance further out than the last, as opposed to a
 *      logarithmic spiral (nautilus shell) whose loops grow
 *      multiplicatively.
 *
 * `totalRotations` is set to roughly the number of years the entries
 * span (see the `domain` useMemo), so each loop of the spiral reads
 * approximately as "one year" - which is also what makes the year-label
 * placement below land at one label per loop rather than piling up
 * unevenly.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FITTING THE WHOLE SPIRAL IN THE CANVAS WITHOUT ZOOMING OUT
 * ──────────────────────────────────────────────────────────────────────
 * `maxRadius` is derived from the container's OWN measured size (see the
 * `spiralParams` useMemo): half the smaller of width/height, minus a
 * fixed clearance for point radii and label text so nothing right at the
 * outer edge gets clipped. Since this is computed from the untransformed
 * canvas size and used at zoom identity (`k = 1`, no pan), the entire
 * spiral - oldest entry at the center to newest at the rim - is visible
 * the moment the view mounts, before the user pans or zooms at all.
 *
 * ──────────────────────────────────────────────────────────────────────
 * DRAWING THE SPIRAL LINE
 * ──────────────────────────────────────────────────────────────────────
 * The visible spiral curve is just a densely-sampled polyline: `t` is
 * walked from 0 to 1 in many small steps (`spiralSamples`), each mapped
 * through `spiralPoint`, and stitched into one SVG path `d` string of
 * `M x,y L x,y L x,y ...` segments - see `buildPolylinePath`. Because
 * every segment is a straight line, the path's total length is EXACTLY
 * the sum of each segment's Euclidean length (no curve-length
 * approximation needed) - that sum, `cumulativeLengths`, is what lets
 * `tToArcLength`/`arcLengthToT` convert between a `t` value and its
 * matching arc-length position along the path (both directions - see
 * YEAR GLYPHS below for what the inverse direction is used for).
 *
 * ──────────────────────────────────────────────────────────────────────
 * YEAR GLYPHS: A MINIMAL, HOVER-BASED MARKER, NOT ALWAYS-VISIBLE CURVED
 * TEXT
 * ──────────────────────────────────────────────────────────────────────
 * An earlier version drew each year's boundary as a `<textPath>` label
 * bending along the spiral's own curvature - legible along most of the
 * curve, but an Archimedean spiral's tangent direction rotates a full
 * 360° every loop, and on roughly the "lower half" of each loop (where
 * the tangent points more than 90° off horizontal) a `<textPath>` lays
 * glyphs out rotated to match that leftward-pointing tangent, which reads
 * as the whole label rendering upside-down and right-to-left. A follow-up
 * fix (building a small locally-reversed path per label to flip the
 * upside-down cases upright, the same technique amCharts and other
 * radial/circular chart libraries use) made the text legible everywhere,
 * but "four-digit text permanently bending around a spiral, at some
 * angle, forever" is still a lot of visual weight and reading effort for
 * what's ultimately just a boundary marker, not primary content the way
 * an entry's own title is.
 *
 * This replaces that entirely: each year boundary is now a single small
 * glyph (a Unicode "✦" four-pointed star, rendered as SVG `<text>` rather
 * than a hand-drawn `<path>` star shape - a system font renders a crisp,
 * properly-anti-aliased star at 9px far more reliably than a handful of
 * short line segments would at that size) sitting exactly on the gridline
 * at that year's position, styled at a low, muted opacity against the
 * SAME `currentColor` the gridline itself already uses (see
 * `YEAR_GLYPH_OPACITY`/`YEAR_GLYPH_HOVER_OPACITY`) - a quiet waypoint
 * marker along the gridline, not a fourth kind of "star" competing with
 * the colored, full-opacity entry stars. This also matches the app's
 * broader night-sky/constellation visual language (see StarMap.tsx) far
 * more naturally than rotated text ever did: a small dim star marking a
 * point in time, brightening slightly and showing a plain "2021"-style
 * tooltip on hover (via the SAME shared `EntryTooltip` entries already
 * use - see that component's own "ENTRY vs. LABEL VARIANT" comment for
 * how it renders a bare label instead of a title+date pair), rather than
 * always-on decoration the user has to read past.
 *
 * COLLISION AVOIDANCE: because `radius = t * maxRadius` now starts at
 * true 0 (see the SPIRAL FORMULA comment above), the earliest years'
 * glyphs sit in the densest, smallest-radius part of the spiral, right
 * alongside whatever entries happen to fall in that same tight inner
 * region - exactly where a glyph is most likely to land on top of (or
 * within a few px of) an actual entry marker. Before rendering each
 * glyph, its raw position is checked against the ALREADY-COMPUTED
 * `points`/`ranges` marker positions (their `x`/`y`, and each range's
 * `start`/`end`/`midpoint`) within `YEAR_GLYPH_COLLISION_RADIUS_PX`; if
 * one is too close, the glyph is nudged `YEAR_GLYPH_NUDGE_ARC_PX` further
 * ALONG THE CURVE (via `arcLengthToT`, first forward, then backward if
 * forward is still colliding) rather than off the gridline entirely - it
 * still marks essentially the same point in time, just shifted enough
 * along the ring to read as two distinct shapes instead of one fused
 * blob.
 *
 * ──────────────────────────────────────────────────────────────────────
 * RANGE ENTRIES: A BAND SAMPLED ALONG THE TRUE SPIRAL CURVE, NOT A
 * d3.arc() FIXED-RADIUS SECTOR
 * ──────────────────────────────────────────────────────────────────────
 * An entry with `endTimestamp` (see the field comment in types/Entry.ts)
 * spans two `t` values instead of one. This used to render as three
 * independent SVG primitives sharing one visual idea - a thin `stroke`
 * `<path>` sampled along the spiral's own curve between `tStart`/`tEnd`,
 * plus a `<circle>` at each end to mark the boundaries - and every
 * "opened entry" highlight treatment (glow, then later a ring) had to be
 * built, and re-tuned, three times over: once for the line, once for
 * EACH endpoint circle (see the git history of `OPENED_ARC_GLOW_*`/
 * `OPENED_ARC_ENDPOINT_GLOW_*` below for just how much back-and-forth
 * tuning three independently-drifting glow strengths took before they
 * finally read as "one consistent highlight"). Highlighting three
 * separate shapes as if they were one was the recurring source of bugs
 * here: a crisp outline ring that looked fine traced around a circle
 * turned into a distinct duplicate line when traced along the thin arc's
 * own centerline (removed in an earlier pass - see the git history), and
 * matching the line's glow strength to the point glow's took several
 * rounds of tuning three numbers instead of one.
 *
 * A LATER FIX replaced those three shapes with ONE `d3.arc()` path - an
 * annulus segment (`innerRadius`/`outerRadius` a small fixed thickness
 * apart) at a single FIXED radius: the entry's radius at its own midpoint
 * `t`. That fixed the three-shapes highlighting problem, but introduced a
 * geometry bug of its own: `d3.arc()` draws its ENTIRE angular sweep at
 * that one radius. This spiral's radius is `t * maxRadius` - it grows
 * continuously with `t` (see the top-of-file SPIRAL FORMULA comment) - so
 * for any entry spanning enough time, the TRUE spiral curve between its
 * start and end visibly curves outward, while a `d3.arc()` sector stays
 * perfectly flat across that same sweep. The band's two endpoints still
 * landed correctly (both computed at the true per-`t` angle), but
 * everything BETWEEN them drifted off the actual gridline - short entries
 * were fine (not enough `t` for the radius to grow visibly), but a
 * several-month-or-longer entry read as a flat chord cutting across the
 * spiral's own coil rather than tracing it.
 *
 * THE FIX: sample the real curve, the same way the main spiral path
 * itself is drawn (see "DRAWING THE SPIRAL LINE" above) and the same
 * per-`t` math a POINT entry already uses (`spiralPoint`) - not a
 * fixed-radius sector. `buildRangeBandPath` below walks ~40-60 evenly
 * spaced `t` steps between the entry's `t0`/`t1`, and at EACH step
 * computes the curve's own center point (`spiralPoint(t, params,
 * radiusOffset)` - the SAME lane-offset hook point entries use, so an
 * overlapping arc's outward nudge is baked into every sample, not just
 * applied once to a single fixed radius) plus a perpendicular offset
 * (`spiralOutwardNormal`, perpendicular to the curve's local tangent at
 * that exact `t`) half the band's thickness to either side. The band's
 * outer edge is the list of "outward" offset samples in order; its inner
 * edge is the same list of "inward" offset samples; the closed path walks
 * outer-forward-then-inner-backward (see `buildRangeBandPath`'s own
 * comment). Because every sample point sits exactly on the true curve
 * (nudged only perpendicular to it, by a small fixed thickness), the
 * resulting band hugs the actual spiral gridline along its ENTIRE length,
 * not just at its two endpoints - and because it's built from the exact
 * same `spiralPoint` function point entries use, a range entry's start/
 * end still always land exactly where a POINT entry at those same two
 * dates would, for the same reason the old d3.arc() version did.
 *
 * WHY THIS MAKES HIGHLIGHTING A SINGLE, CLEAN OPERATION:
 * Every "opened entry" treatment below - the blurred glow behind it, and
 * the crisp ring around it - is a STROKE on this exact same closed path
 * (`fill="none"`, a thicker or thinner `strokeWidth`), not a second,
 * differently-built shape. A closed path's stroke always traces its FULL
 * boundary as one continuous line - both long curved edges AND both cut
 * ends - for free, with no separate geometry to build or keep in sync
 * (see the "ARC BAND HIGHLIGHT" comment further below for why an earlier
 * two-shape attempt at this didn't work). There's exactly one shape's
 * boundary to trace a ring around, and exactly one shape's silhouette to
 * blur into a glow - no coordinating three separate elements' geometry,
 * tuning three opacity/width numbers to read as one strength, or
 * discovering that an outline drawn "outside" one piece looks completely
 * different from the same outline drawn "outside" a different piece of
 * what's supposed to be a single visual highlight.
 *
 * ──────────────────────────────────────────────────────────────────────
 * DOMAIN COMES FROM domainRange, NOT `entries`
 * ──────────────────────────────────────────────────────────────────────
 * This used to derive `minDate`/`maxDate` from `entries`' own extent (via
 * d3.extent, including endTimestamps). Now that Spiral.tsx pre-filters
 * `entries` down to whatever TimeRangeContext's `selectedRange` is (the
 * same HARD time filter Timeline.tsx/Constellation.tsx apply - see
 * Spiral.tsx's own comment), doing the same "extent over the entries I
 * was handed" would shrink the spiral down to a SMALLER window than what
 * the user actually selected whenever the surviving entries happen to
 * cluster away from one or both edges of `domainRange` - the exact same
 * bug LinearTimeline.tsx's own "DOMAIN COMES FROM domainRange" fix
 * addresses for its axis. Building `minDate`/`maxDate` from `domainRange`
 * directly instead keeps the spiral's full extent (and therefore
 * `totalRotations`, and every year label) representing the FULL selected
 * window regardless of how the entries inside it are distributed. The
 * single-instant padding fallback stays as a defensive guard (in case
 * `domainRange.start === domainRange.end`) even though
 * TimeRangeContext's own `computeFullRange` already pads a degenerate
 * range the same way.
 *
 * ──────────────────────────────────────────────────────────────────────
 * "NOW" MARKER: DOMAIN EXTENSION, THE DOTTED CONTINUATION, AND THE SUN/
 * MOON GLYPH
 * ──────────────────────────────────────────────────────────────────────
 * DOMAIN EXTENSION: `domainRange.end` is, at most, the most recent
 * entry's own date - there's no reason for the spiral's outer rim (t=1)
 * to represent anything LATER than that otherwise. But in practice
 * "now" is always later than your last logged entry (nobody logs an
 * entry for a moment that hasn't happened yet), so pinning t=1 to
 * whichever entry happens to be most recent would make the spiral's own
 * edge silently drift further "in the past" the longer someone goes
 * between visits - there's no visual cue that today isn't actually
 * where the timeline ends. Extending `maxDate` out to `now` whenever
 * `now` is later fixes t=1 to mean "the present moment," with the
 * actual latest entry sitting slightly inside it (at whatever `t` its
 * own date normalizes to) - exactly like a real archive: the most
 * recent thing you wrote down usually isn't "right now," it's some time
 * ago. This is a MAX-only extension - it never touches `domain[0]` - so
 * it can't reintroduce the "DOMAIN COMES FROM domainRange" bug just
 * above (entries clustering away from a SHRUNK edge): it only ever
 * pushes t=1 further OUTWARD than `domainRange` itself already
 * resolved to, never inward.
 *
 * THE DOTTED LINE + GLYPH: drawn as a second, much shorter sampled
 * polyline (same `spiralPoint`-per-sample technique the main curve
 * itself uses - see "DRAWING THE SPIRAL LINE" above - just scoped to
 * `[latestEntryDate's t, now's t]` instead of the full `[0, 1]`), with a
 * `strokeDasharray` added so it reads as a continuation of, not a
 * replacement for, the main gridline's solid stroke. `latestEntryDate`
 * (the line's inner endpoint) is computed directly from `entries`, NOT
 * reused from `domainRange.end`: someone can drag TimeRangeSelector's
 * own handle to an arbitrary date no entry actually falls on, and
 * anchoring this line there instead would leave it starting in empty
 * space rather than at a real entry. A small sun/moon text glyph sits
 * at the line's outer end (`now`'s own position) - a sun for local
 * hours [6, 18), a moon otherwise (see `NOW_DAY_START_HOUR`/
 * `NOW_DAY_END_HOUR` below), using nothing more than `new Date()` and
 * `getHours()` - no timezone lookup or geolocation, since "day or
 * night" here just means the VIEWER's own local clock, the same way a
 * device's own OS decides when to switch to a dark wallpaper.
 *
 * FROZEN AT MOUNT: `now` itself (the Date instance behind both the
 * domain extension above and the glyph's day/night check) is captured
 * ONCE, in a lazy `useState` initializer, not read fresh on every
 * render - see the "now" useState below. Without that, `now` would
 * advance by however many milliseconds elapsed between renders (small,
 * but nonzero, and non-deterministic), making the exact rendered
 * position of this line's outer endpoint - and therefore `totalRotations`,
 * which the domain extension can also nudge - technically different
 * every render, for no visible benefit; freezing it at mount makes the
 * marker's position (and the sun-vs-moon choice) a single, stable fact
 * about when this view was opened. The ONE exception is the tooltip
 * shown on hovering the glyph (see the "Hover tooltip" comment further
 * down) - that's expected to visibly tick while actively hovered, so it
 * reads fresh `new Date()` values on its own separate one-second
 * interval, entirely independent of this frozen `now`.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FULL-BLEED CANVAS + CLICK-TO-CENTER: SAME AS StarMap, NOT LinearTimeline
 * ──────────────────────────────────────────────────────────────────────
 * This used to render inside a bordered, padded card
 * (`rounded-lg border ... p-6 shadow-sm`) at a fixed `h-[420px]`, as a
 * normal-flow child of Spiral.tsx. Now that Spiral.tsx matches
 * Constellation.tsx/Timeline.tsx's page structure (floating header +
 * FilterBar above a full-bleed canvas, a sidebar overlay on top of that),
 * this component's root is `fixed inset-0`, the same "always fills the
 * entire viewport" approach StarMap.tsx uses - NOT LinearTimeline's
 * `contentOriginX` origin-shift, since that shift only makes sense for a
 * single linear axis where x position IS the data (see LinearTimeline's
 * own CANVAS ORIGIN SHIFT comment for why). A spiral is a free-form 2D
 * layout like StarMap's star field - there's no single meaningful
 * "origin" to shift - so, like StarMap, `sidebarWidth` is threaded in and
 * used only inside the CLICK-TO-CENTER target calculation below, not
 * anywhere else in this file.
 *
 * `useLayoutEffect` (not `useEffect`) for the responsive-sizing effect -
 * unlike the old bounded `h-[420px]` card, this now measures the full
 * viewport on mount, the same transient-zero-size-on-first-frame risk
 * LinearTimeline.tsx's own "MISSING DATA POINTS" comment (cause #2)
 * describes for its own full-bleed switch; `useLayoutEffect` avoids an
 * intermediate degenerate-scale paint the same way it does there.
 *
 * CLICK-TO-CENTER below is StarMap's own effect, adapted to this file's
 * coordinate system: entry world positions come from `spiralPoint`
 * instead of StarMap's jittered star (x, y), and a range entry centers on
 * the midpoint of its `tStart`/`tEnd` (the point on the spiral halfway
 * through its span) rather than a single point - the 2D equivalent of
 * LinearTimeline's own "midpoint of a range entry's start/end" choice for
 * its 1D axis.
 *
 * ──────────────────────────────────────────────────────────────────────
 * OVERLAPPING ARCS (AND POINTS): SAME LANE-ASSIGNMENT ALGORITHM AS
 * LinearTimeline, RADIAL OFFSET INSTEAD OF VERTICAL
 * ──────────────────────────────────────────────────────────────────────
 * Two range entries whose date spans overlap would draw as two arcs
 * tracing the exact same stretch of the spiral, indistinguishable from one
 * another - the identical problem LinearTimeline.tsx solves for its
 * capsules with greedy interval scheduling (see that file's own
 * "LANE-BASED LAYOUT FOR CAPSULES" comment for the full algorithm
 * explanation: place each in the first lane that doesn't conflict). The
 * ALGORITHM deciding arc lane NUMBERS is reused exactly, via
 * utils/laneAssignment.ts's `assignLanes` (duration-descending, same as
 * LinearTimeline - see that function's own header comment) - just fed
 * arc-length distance along `spiralPathD` (from `tToArcLength`) as its 1D
 * "position" measure instead of LinearTimeline's xScale pixel position.
 * Arc length is the right substitute because, like an xScale pixel
 * position, it's a single monotonically-increasing-with-time number -
 * exactly what the algorithm needs to reason about "does this one start
 * far enough past where that one ends" - even though the underlying
 * geometry is a 2D curve rather than a straight line.
 *
 * LANE 0 = ZERO OFFSET, UNLIKE LinearTimeline: LinearTimeline's lane 0
 * capsule still sits one `LANE_HEIGHT` below its baseline (`BASELINE_Y +
 * (lane+1)*LANE_HEIGHT`) because points and capsules already live on
 * physically separate rows there - a capsule directly on the baseline
 * would visually collide with the point row regardless of lane logic. The
 * spiral has no such separate row: `spiralPoint`'s own curve IS the
 * "home" position for both a point entry and a lane-0 arc, so lane 0 here
 * gets radiusOffset `0 * RADIAL_LANE_OFFSET_PX` - literally zero, sitting
 * exactly on the spiral's own drawn path - and only lane 1, 2, 3, ...
 * nudge outward by `lane * RADIAL_LANE_OFFSET_PX`. This is what makes the
 * longest-duration arc in a cluster of overlaps (see laneAssignment.ts's
 * duration-descending comment - it wins lane 0) visibly trace the same
 * gridline path a viewer would see if that arc were the only entry on the
 * timeline, rather than every arc always appearing detached from the
 * curve regardless of whether it actually overlaps anything.
 *
 * POINT ENTRIES NOW PARTICIPATE IN OVERLAP DETECTION TOO: a point sitting
 * at a date that falls inside an already-laned arc's span would render
 * right on top of that arc's lane-0 curve if left alone - previously
 * points always rendered at radiusOffset 0 unconditionally, regardless of
 * what arcs might cover their date. `points`/`ranges` below are computed
 * together (ranges/arcs first, then points checked against them) so each
 * point can look up whether ANY lane-0-or-above arc's span covers its own
 * arc-length position via `assignLaneAroundRanges` (laneAssignment.ts) -
 * if one does, the point is bumped to the next lane up (checked again
 * against arcs in THAT lane, and so on) exactly like an arc that can't
 * fit lane 0 moves to lane 1. A point is deliberately only ever checked
 * against ARCS, never against other points - two coincident points
 * sitting at the same spot is not the problem this solves, an arc's whole
 * lane-length span silently swallowing a point that happens to fall
 * inside it is. A point with no conflicting arc anywhere keeps its
 * original always-lane-0 behavior, sitting directly on the curve.
 *
 * `spiralPoint` takes a `radiusOffset` parameter (default 0) to make a
 * lane number a small additive term in the same `radius = t*maxRadius`
 * formula the top-of-file SPIRAL FORMULA comment already describes, at
 * the SAME theta it would otherwise use - nudging only the radius leaves
 * a point's angular position (and therefore which year-ring it reads
 * against) completely unchanged, just as LinearTimeline's vertical nudge
 * leaves an entry's x position (and therefore which axis tick it reads
 * against) unchanged. A range entry's sampled-curve band (see the RANGE
 * ENTRIES comment above) applies this exact same `lane *
 * RADIAL_LANE_OFFSET_PX` term the same way a point does - as `spiralPoint`'s
 * own `radiusOffset`, at every one of the ~40-60 samples the band walks
 * along its span, so the whole band shifts outward together rather than
 * just one representative point of it.
 *
 * Because `start`/`end`/`midpoint`/`pathD` (for ranges) and `x`/`y` (for
 * points) below are all computed WITH each entry's own lane offset
 * already baked in, hover/click/highlight code downstream (which reads
 * those same fields) automatically targets the lane-adjusted position -
 * there's no separate "un-offset" position left anywhere that could get
 * hovered/highlighted instead by mistake.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Entry } from '../types/Entry';
import { DateRange } from '../context/TimeRangeContext';
import { getActivityColor } from '../utils/colors';
// Same date/time formatting the "now" marker's tooltip uses for its live
// clock - see the top-of-file "NOW MARKER" comment and formatSingleDate's
// own comment in formatEntryDate.ts.
import { formatSingleDate } from '../utils/formatEntryDate';
// Shared with StarMap.tsx/LinearTimeline.tsx's own hover tooltip - see
// EntryTooltip.tsx's header comment for why this is a shared pattern
// across every visualization view rather than duplicated per-component.
import EntryTooltip from './EntryTooltip';
import VizEmptyState from './VizEmptyState';
import { assignLanes, assignLaneAroundRanges } from '../utils/laneAssignment';

interface SpiralTimelineProps {
  entries: Entry[];
  /**
   * Whether the RAW, unfiltered dataset (Spiral.tsx's own
   * `entries.length > 0`, not the time-filtered `entries` prop above) has
   * any entries at all - passed straight through to VizEmptyState.tsx so
   * it can distinguish "no data exists" from "filtered to nothing" - see
   * that component's own top-of-file comment for the full reasoning.
   */
  hasAnyEntries: boolean;
  /**
   * activityTypes currently "active" - see useEntrySelection.ts's
   * CATEGORY FILTER comment. Points/arcs whose activityType is NOT in
   * this list are dimmed to FILTERED_OUT_OPACITY, mirroring StarMap.tsx's
   * treatment of its stars and LinearTimeline.tsx's treatment of its
   * points/capsules.
   */
  filterCategories: string[];
  /**
   * Called with the clicked entry when a point or arc is clicked - wired
   * by Spiral.tsx to useEntrySelection's `handleEntryClick`, the same
   * shared open-new/expand-minimized/deselect-expanded callback
   * StarMap.tsx wires to `onStarClick` and LinearTimeline.tsx wires to its
   * own `onEntryClick` - see the CLICK PARITY comment at the top of this
   * file.
   */
  onEntryClick: (entry: Entry) => void;
  /**
   * IDs of entries currently "opened" (represented by a panel, expanded
   * or minimized, in Spiral.tsx's SidebarPanelStack) - same prop, same
   * source (useEntrySelection.ts), and same purpose as StarMap.tsx's
   * `openedEntryIds`: points/arcs whose id appears here render the
   * OPENED-ENTRY HIGHLIGHT below.
   */
  openedEntryIds: string[];
  /**
   * The id of the entry whose panel is currently expanded (not
   * minimized), or `null` - drives the CLICK-TO-CENTER effect below,
   * exactly like StarMap.tsx's `expandedEntryId`.
   */
  expandedEntryId: string | null;
  /**
   * The sidebar overlay's current rendered width in pixels (0 when it
   * isn't rendered) - same prop, same source (Spiral.tsx's measured
   * `sidebarWidth`), and same purpose as StarMap.tsx's `sidebarWidth`:
   * used only inside the CLICK-TO-CENTER target below to keep a centered
   * entry out from under the sidebar overlay.
   */
  sidebarWidth: number;
  /**
   * Bumped by Spiral.tsx every time its Escape-key/reset-button full
   * reset fires - see the RESET-VIEW effect below. Same counter-not-
   * boolean reasoning as StarMap.tsx's own `resetViewSignal`.
   */
  resetViewSignal: number;
  /**
   * The visible spiral window - Spiral.tsx's TimeRangeContext
   * `selectedRange`. `minDate`/`maxDate` are built from THIS now, instead
   * of `entries`' own extent - see the DOMAIN COMES FROM domainRange
   * comment above.
   */
  domainRange: DateRange;
  /**
   * The page's measured header bottom edge (Spiral.tsx's own
   * `headerLayout.top`) - used only to position VizEmptyState.tsx below
   * the header when there's nothing to show. Previously this component
   * positioned its own empty-state message at a hardcoded `top-28`,
   * which could overlap Spiral's (comparatively long, two-sentence)
   * subtitle - this measured value replaces that guess.
   */
  topOffset: number;
  /**
   * Whether the shared, cross-page Edit Mode flag (EditModeContext.tsx)
   * is currently on - passed straight through to VizEmptyState.tsx so its
   * "filtered" message knows whether EditModeBanner.tsx is ALSO occupying
   * the shared top-right tooltip stack's top slot (see that file's own
   * EDIT MODE STACKING comment). PURELY PRESENTATIONAL - see StarMap.tsx's
   * identical `isEditMode` prop comment for why this doesn't change
   * SpiralTimeline's own click behavior.
   */
  isEditMode: boolean;
}

/** Small circle radius (px) for a single-point entry and for a range entry's end caps. */
const POINT_RADIUS = 5;

/**
 * Opacity of the "opened entry" glow - shared by the plain point glow
 * (rendered further below) AND the arc's own line/endpoint glow (see the
 * "ARC GLOW" comment further below for why the arc explicitly reuses this
 * exact value instead of an independently-tuned one).
 */
const GLOW_OPACITY = 0.6;

/**
 * Blur radius (px) for the plain point/star glow specifically - see
 * `ARC_GLOW_BLUR_STD_DEVIATION` below for why the arc's own line/endpoint
 * glow uses a separate, higher value instead of sharing this one.
 */
const GLOW_BLUR_STD_DEVIATION = 2;

/**
 * Half-thickness (px) of a range entry's sampled-curve band - each edge
 * (outer/inner) sits this far, PERPENDICULAR TO THE CURVE'S OWN LOCAL
 * TANGENT, to either side of the true spiral curve at that sample (see
 * the top-of-file "RANGE ENTRIES" comment and `buildRangeBandPath`
 * below), for a total rendered thickness of `ARC_BAND_HALF_THICKNESS * 2`
 * (8px) - a clearly visible filled band, not a thin line.
 */
const ARC_BAND_HALF_THICKNESS = 4;

/**
 * Number of evenly-spaced `t` samples `buildRangeBandPath` walks between a
 * range entry's `t0`/`t1` to build its band - see the top-of-file "RANGE
 * ENTRIES" comment. Within the ~40-60 range that's dense enough to hug the
 * true spiral curve invisibly (no visible faceting even on a
 * several-month-long entry whose radius grows noticeably across its
 * span), mirroring `SAMPLES_PER_ROTATION`, the main spiral curve's own
 * per-rotation sample density.
 */
const RANGE_BAND_SAMPLE_COUNT = 48;

/**
 * ──────────────────────────────────────────────────────────────────────
 * ARC BAND HIGHLIGHT: STROKE THE ONE CLOSED PATH, DON'T BUILD A SECOND
 * SHAPE
 * ──────────────────────────────────────────────────────────────────────
 * Now that a range entry is a single sampled-curve band (see the
 * top-of-file "RANGE ENTRIES" comment), its "opened entry" glow and ring
 * are a STROKE on that EXACT SAME path (`fill="none"`, `stroke=...`) -
 * see the render below - not a second, differently-built shape. An
 * earlier version (back when the band was a `d3.arc()` sector) tried
 * building a second, wider/narrower `d3.arc()` shape for the glow/ring
 * instead, and it looked broken: resizing an annulus segment's
 * `innerRadius`/`outerRadius` does NOT uniformly "grow" it the way
 * offsetting a rounded rectangle's own edges does (LinearTimeline.tsx's
 * `capsuleOutlineRect`) - a differently-sized arc's rounded corners land
 * at a different position than the original's, so the highlight only
 * showed up as extra arcs parallel to the two long curved edges, never
 * wrapping around the rounded end caps. `pathD` is already a single
 * CLOSED path (outer edge samples, then inner edge samples in reverse,
 * back to start); stroking it directly makes SVG trace that entire
 * boundary as one continuous line, cut ends included, with no separate
 * geometry to keep in sync.
 *
 * `OPENED_ARC_GLOW_EXTRA_RADIUS`/`ARC_RING_WIDTH` are each still the same
 * numeric values earlier versions of this glow/ring already used (4 and
 * 1.5 - see this file's own git history for how those were tuned to read
 * as comparably strong to the plain point glow/ring), just applied
 * differently now: `strokeWidth` at render time is DOUBLE each of these,
 * since a stroke straddles its path (half spills inward, half outward) -
 * only the outward half ends up visible once the opaque colored band is
 * drawn on top of both, covering the inward half. Blur uses its OWN
 * dedicated `opened-arc-glow` filter (see the `<defs>` below) at
 * `ARC_GLOW_BLUR_STD_DEVIATION`, decoupled from the plain point/star
 * glow's own `opened-spiral-glow` filter so this doesn't also blur every
 * plain point.
 */
const OPENED_ARC_GLOW_EXTRA_RADIUS = 4;
const OPENED_ARC_GLOW_OPACITY = GLOW_OPACITY;
/** Blur radius (px) for JUST the arc band's own glow - see the "ARC BAND HIGHLIGHT" comment above for why this is bumped above (and kept decoupled from) the shared point/star `GLOW_BLUR_STD_DEVIATION`. */
const ARC_GLOW_BLUR_STD_DEVIATION = 3;
/** Visible thickness (px) of a range entry's ring once drawn - see the "ARC BAND HIGHLIGHT" comment above for why the render's actual `strokeWidth` is double this. */
const ARC_RING_WIDTH = 1.5;

/**
 * Radial spacing (px) between stacked arc lanes - the spiral's equivalent
 * of LinearTimeline.tsx's `LANE_HEIGHT`. Lane 0's arc renders at
 * `radius + RADIAL_LANE_OFFSET_PX`, lane 1 at `radius + 2 *
 * RADIAL_LANE_OFFSET_PX`, and so on - see the top-of-file "OVERLAPPING
 * ARCS" comment for why this is a radius nudge rather than a vertical one.
 *
 * Originally 10px (an 8-12px range, matched down from LANE_HEIGHT's 26px
 * on the assumption that the spiral's loops were already spaced far
 * enough apart radially that a small per-lane nudge would read clearly).
 * In practice that was too tight once several overlapping arcs stacked up:
 * outer lanes sat close enough to each other - and to the next loop of the
 * main spiral curve/year gridlines - that telling two nearby lanes apart,
 * or a lane apart from the underlying spiral, took real effort. Bumped to
 * roughly 1.8x that (18px) for comfortable, unambiguous separation between
 * stacked lanes and between the outermost lane and the next year's loop.
 */
const RADIAL_LANE_OFFSET_PX = 18;

/**
 * Extra arc-length clearance (px, along the spiral's own path) required
 * between one arc's end and the next arc's start before they're allowed to
 * share a lane - the spiral's equivalent of LinearTimeline.tsx's
 * `LANE_GAP_PX`, using the same value: both measure "how much straight-line
 * clearance in px reads as clearly separated," just along a straight axis
 * there and along the spiral's curve here.
 */
const LANE_GAP_PX = 6;

/**
 * Clearance (px) reserved between the spiral's outermost loop
 * (`maxRadius`) and the container's edge - room for point radii, arc end
 * caps, and year-label text so nothing at the rim gets visually clipped.
 */
const RADIUS_PADDING = 40;

/** Roughly how many straight segments make up one full loop of the main spiral path - tuned for a visibly smooth curve without an excessive path string. */
const SAMPLES_PER_ROTATION = 48;

/** Hard cap on total main-spiral samples, so a very long-spanning (many-year) timeline doesn't build an unreasonably large path string. */
const MAX_SPIRAL_SAMPLES = 2000;

/**
 * Font size (px) of a year glyph - see the top-of-file "YEAR GLYPHS"
 * comment. Small and quiet by design: this marks a waypoint on the
 * gridline, not an entry, so it should never compete with the larger,
 * colored `POINT_RADIUS`-sized entry stars.
 */
const YEAR_GLYPH_FONT_SIZE_PX = 9;

/**
 * Resting / hovered opacity of a year glyph, against the SAME
 * `currentColor` (`--text-muted-color`) the gridline itself already uses
 * - see the top-of-file "YEAR GLYPHS" comment for why a glyph should read
 * as part of the gridline's own quiet visual language rather than as a
 * distinct, attention-grabbing marker.
 */
const YEAR_GLYPH_OPACITY = 0.45;
const YEAR_GLYPH_HOVER_OPACITY = 0.85;

/**
 * Local hour range (inclusive start, exclusive end) during which the
 * "now" marker's glyph renders as a sun rather than a moon - see the
 * top-of-file "NOW MARKER" comment. A plain `Date.getHours()` comparison
 * against the VIEWER's own device clock - no timezone lookup or
 * geolocation, matching the task's own "just simple local hour
 * comparison" ask.
 */
const NOW_DAY_START_HOUR = 6;
const NOW_DAY_END_HOUR = 18;

/**
 * Dash pattern (SVG `stroke-dasharray`, px-on/px-off) for the "now"
 * continuation line - same `currentColor`/opacity/width as the main
 * spiral gridline it extends (see the render below), just dashed so it
 * reads as a continuation past real data rather than more of the solid
 * curve.
 */
const NOW_LINE_DASH = '2,3';

/**
 * Font size (px) of the sun/moon "now" glyph - a bit larger than
 * `YEAR_GLYPH_FONT_SIZE_PX`, since this marks the live present moment
 * (arguably the single most important waypoint on the whole spiral),
 * not just a quiet year boundary.
 */
const NOW_GLYPH_FONT_SIZE_PX = 14;

/** Resting / hovered opacity of the "now" glyph - same idea as `YEAR_GLYPH_OPACITY`/`YEAR_GLYPH_HOVER_OPACITY`, just a bit stronger at rest so it doesn't read as quietly as a plain year waypoint. */
const NOW_GLYPH_OPACITY = 0.7;
const NOW_GLYPH_HOVER_OPACITY = 1;

/** How often (ms) the "now" glyph's hover tooltip re-renders its displayed clock while actively hovered - see the "Hover tooltip" comment further down. */
const NOW_TOOLTIP_TICK_MS = 1000;

/**
 * How close (px, on screen) a year glyph's raw position needs to be to an
 * actual entry marker before it's considered "colliding" and gets nudged
 * - see the top-of-file "YEAR GLYPHS" comment's "COLLISION AVOIDANCE"
 * section. Sized a bit larger than `POINT_RADIUS` so the nudge kicks in
 * before the two shapes visually touch, not only once they'd fully
 * overlap.
 */
const YEAR_GLYPH_COLLISION_RADIUS_PX = 10;

/**
 * How far (px, along the curve's own arc length) a colliding year glyph
 * is nudged - see the top-of-file "YEAR GLYPHS" comment's "COLLISION
 * AVOIDANCE" section. Large enough to clear a typical entry marker's own
 * radius/glow at `YEAR_GLYPH_COLLISION_RADIUS_PX`, small enough that the
 * glyph still reads as marking essentially the same point on the
 * gridline, not a different year boundary.
 */
const YEAR_GLYPH_NUDGE_ARC_PX = 14;

/** How far the user can zoom in/out - same range StarMap.tsx uses for its own 2D pannable canvas. */
const ZOOM_SCALE_EXTENT: [number, number] = [0.5, 8];

/** Average milliseconds in a year (accounts for leap years) - used only to estimate `totalRotations`. */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Angle (radians) the spiral starts at for t=0 - purely cosmetic (starts pointing straight up rather than right). */
const SPIRAL_START_ANGLE = -Math.PI / 2;

/** Opacity applied to a point/arc whose category is filtered out - same value as StarMap.tsx's/LinearTimeline.tsx's FILTERED_OUT_OPACITY. */
const FILTERED_OUT_OPACITY = 0.15;

/**
 * Neutral, bright highlight color for the "opened entry" ring/glow - same
 * color, same reasoning as StarMap.tsx's/LinearTimeline.tsx's own
 * OPENED_HIGHLIGHT_COLOR: deliberately not tied to any activityType
 * color, so it reads clearly against every entry color. A theme token
 * (--star-highlight-color), not a fixed hex value - see StarMap.tsx's own
 * comment on its identical constant for why.
 */
const OPENED_HIGHLIGHT_COLOR = 'var(--star-highlight-color)';

interface SpiralParams {
  centerX: number;
  centerY: number;
  maxRadius: number;
  totalRotations: number;
}

/**
 * Polar -> cartesian mapping for a normalized time fraction `t` - see the
 * top-of-file "SPIRAL FORMULA" comment. `radius = t * maxRadius` - ZERO
 * at t=0, no `minRadius` floor (see that comment for why the earlier
 * fixed-center-hole version was replaced) - so the earliest entry sits
 * exactly at the spiral's own center.
 *
 * `radiusOffset` (default 0) adds a constant to the computed radius before
 * converting to cartesian, at the SAME theta `t` would otherwise use - this
 * is the one hook lane-assigned arcs use to push themselves outward; see
 * the top-of-file "OVERLAPPING ARCS" comment for why a radius nudge (not a
 * theta nudge) is the spiral's equivalent of LinearTimeline's vertical lane
 * offset. Every other caller (the main spiral path, year labels, and point
 * entries - none of which are ever lane-assigned) leaves this at its
 * default and is completely unaffected.
 */
/**
 * The raw polar angle (radians) at `t` - `theta` in the SPIRAL FORMULA
 * comment, before it's converted to cartesian. Pulled out of `spiralPoint`
 * so the YEAR LABEL TICKS mark (which needs the "from center outward to
 * this point" direction, not `spiralPoint`'s own (x, y) output) can reuse
 * the exact same formula rather than a second, possibly-drifting copy of
 * it.
 */
function spiralPolarAngle(t: number, params: SpiralParams): number {
  return SPIRAL_START_ANGLE + t * params.totalRotations * Math.PI * 2;
}

function spiralPoint(
  t: number,
  params: SpiralParams,
  radiusOffset = 0
): { x: number; y: number } {
  const { centerX, centerY, maxRadius } = params;
  const radius = t * maxRadius + radiusOffset;
  const theta = spiralPolarAngle(t, params);
  return {
    x: centerX + radius * Math.cos(theta),
    y: centerY + radius * Math.sin(theta),
  };
}

/** Stitches a list of points into one straight-segmented SVG path `d` string. */
function buildPolylinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

/**
 * How far apart (in normalized `t`) the two samples used to ESTIMATE a
 * range band's local tangent direction are - see `spiralOutwardNormal`
 * below. Small enough that the finite-difference tangent is accurate to a
 * small fraction of a pixel (the spiral's radius/angle are both smooth,
 * well-behaved functions of `t` at this scale), but not so small that
 * floating-point cancellation in the subtraction starts to matter.
 */
const TANGENT_ESTIMATION_EPSILON_T = 0.0005;

/**
 * The unit vector PERPENDICULAR to the spiral curve's own local tangent
 * at `t`, pointing OUTWARD (away from the spiral's center) - the offset
 * direction `buildRangeBandPath` below nudges each sampled curve point
 * along to build a range entry's band edges. See the top-of-file "RANGE
 * ENTRIES" comment for why this replaces `d3.arc()`'s fixed-radius
 * sector: offsetting PERPENDICULAR TO THE CURVE at every sample (instead
 * of radially at one fixed radius for the whole span) is what makes the
 * band's edges parallel the true curve exactly, all the way along it.
 *
 * The tangent itself is estimated with a symmetric finite difference -
 * `spiralPoint` just before and just after `t` (at the SAME
 * `radiusOffset`, so a lane-offset arc's tangent reflects its own
 * offset curve, not the un-offset one) - rather than hand-deriving the
 * closed-form derivative of `radius(t)*cos(theta(t))`: this way any
 * future change to `spiralPoint`'s own formula automatically flows
 * through here too, with no second derivative to keep in sync.
 *
 * A tangent has two perpendiculars (rotate it +90° or -90°); which one is
 * actually "outward" is resolved by comparing each against the sampled
 * point's own radial direction (spiral center -> point) and keeping
 * whichever has a positive dot product with it - i.e. whichever
 * perpendicular actually points away from center, rather than assuming a
 * fixed rotation direction that could flip depending on which half of a
 * loop a sample falls on.
 */
function spiralOutwardNormal(
  t: number,
  params: SpiralParams,
  radiusOffset: number,
  center: { x: number; y: number }
): { x: number; y: number } {
  const before = spiralPoint(
    Math.max(0, t - TANGENT_ESTIMATION_EPSILON_T),
    params,
    radiusOffset
  );
  const after = spiralPoint(
    Math.min(1, t + TANGENT_ESTIMATION_EPSILON_T),
    params,
    radiusOffset
  );

  const tangentX = after.x - before.x;
  const tangentY = after.y - before.y;
  const tangentLength = Math.hypot(tangentX, tangentY) || 1;

  let normalX = -tangentY / tangentLength;
  let normalY = tangentX / tangentLength;

  const radialX = center.x - params.centerX;
  const radialY = center.y - params.centerY;
  if (normalX * radialX + normalY * radialY < 0) {
    normalX = -normalX;
    normalY = -normalY;
  }

  return { x: normalX, y: normalY };
}

/**
 * Builds a closed SVG path `d` string for a range entry's band by
 * SAMPLING the true spiral curve between `t0`/`t1`, rather than drawing a
 * `d3.arc()` fixed-radius sector - see the top-of-file "RANGE ENTRIES"
 * comment for the full root-cause/fix explanation. At each of
 * `sampleCount` evenly-spaced `t` steps: `spiralPoint(t, params,
 * radiusOffset)` gives the curve's own center point at that instant
 * (`radiusOffset` is the entry's lane offset - see the "OVERLAPPING ARCS"
 * comment - so an overlapping arc's outward nudge is baked into every
 * sample, not applied once to a single representative radius), and
 * `spiralOutwardNormal` gives the perpendicular-to-tangent direction to
 * offset it in; the outer edge point is that center nudged `halfThickness`
 * outward, the inner edge point the same center nudged `halfThickness`
 * inward.
 *
 * The closed path is built by walking the outer edge points in order
 * (start -> end), then the inner edge points in REVERSE order (end ->
 * start), back to the first outer point - the standard way to turn two
 * parallel "rails" into one filled band. Because both rails are offset
 * PERPENDICULAR to the curve's tangent at each sample (not offset
 * radially, and not held to one fixed radius), the resulting band hugs
 * the true curve along its entire length; the two short segments at each
 * end (connecting the first/last outer point to the first/last inner
 * point) are automatically perpendicular to the curve's own tangent
 * there too, giving a clean straight cut rather than a rounded cap -
 * rounding those into an actual arc cap would need extra geometry this
 * component doesn't currently build, so a perpendicular cut is used as
 * the acceptable baseline instead.
 */
function buildRangeBandPath(
  t0: number,
  t1: number,
  radiusOffset: number,
  halfThickness: number,
  params: SpiralParams,
  sampleCount: number
): string {
  const outerEdge: { x: number; y: number }[] = [];
  const innerEdge: { x: number; y: number }[] = [];

  for (let i = 0; i <= sampleCount; i++) {
    const t = t0 + ((t1 - t0) * i) / sampleCount;
    const center = spiralPoint(t, params, radiusOffset);
    const normal = spiralOutwardNormal(t, params, radiusOffset, center);

    outerEdge.push({
      x: center.x + normal.x * halfThickness,
      y: center.y + normal.y * halfThickness,
    });
    innerEdge.push({
      x: center.x - normal.x * halfThickness,
      y: center.y - normal.y * halfThickness,
    });
  }

  const boundary = [...outerEdge, ...innerEdge.reverse()];
  return `${buildPolylinePath(boundary)} Z`;
}

export default function SpiralTimeline({
  entries,
  hasAnyEntries,
  filterCategories,
  onEntryClick,
  openedEntryIds,
  expandedEntryId,
  sidebarWidth,
  resetViewSignal,
  domainRange,
  topOffset,
  isEditMode,
}: SpiralTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  // Holds the same zoom *behavior* instance attached to the <svg> below, so
  // CLICK-TO-CENTER/RESET-VIEW (see below) can programmatically drive it
  // later, outside of the 'zoom' event handler that normally drives it -
  // same role as StarMap.tsx's own `zoomBehaviorRef`.
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);

  // ─── Responsive sizing ───
  // Same ResizeObserver-on-a-container-ref pattern as StarMap.tsx/
  // LinearTimeline.tsx - now measuring the full viewport (see the
  // FULL-BLEED CANVAS comment above), so this uses `useLayoutEffect`, not
  // `useEffect`, for the same first-frame reason LinearTimeline.tsx does.
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── "Now", frozen at mount ───
  // See the top-of-file "NOW MARKER" comment's own "FROZEN AT MOUNT"
  // section for why this is captured once, in a lazy useState
  // initializer (which React guarantees only ever runs on the very
  // first render), rather than read fresh on every render.
  const [now] = useState(() => new Date());

  // ─── Date domain ───
  // See the DOMAIN COMES FROM domainRange comment above - this no longer
  // derives from `entries`' own extent. The one addition is the "NOW
  // MARKER" extension - see that top-of-file comment for the full
  // reasoning - which pushes `domain[1]` out to `now` whenever `now` is
  // later, and ONLY then; it never touches `domain[0]`.
  const [minDate, maxDate] = useMemo(() => {
    const domain: [Date, Date] = [domainRange.start, domainRange.end];

    if (now.getTime() > domain[1].getTime()) {
      domain[1] = now;
    }

    if (domain[0].getTime() === domain[1].getTime()) {
      domain[0] = d3.timeDay.offset(domain[0], -1);
      domain[1] = d3.timeDay.offset(domain[1], 1);
    }

    return domain;
  }, [domainRange, now]);

  const normalize = (date: Date): number => {
    const span = maxDate.getTime() - minDate.getTime();
    return span === 0 ? 0 : (date.getTime() - minDate.getTime()) / span;
  };

  // ─── Spiral parameters ───
  // `totalRotations` is roughly the number of years the domain spans
  // (see the top-of-file SPIRAL FORMULA comment), floored at 1 full loop
  // so even a short-lived history still reads as a spiral rather than a
  // single tight arc. `maxRadius` is scaled off the container's own
  // measured size - see the "FITTING THE WHOLE SPIRAL" comment above. No
  // `minRadius` - see the "SPIRAL FORMULA" comment's own explanation of
  // why the spiral now starts at true radius 0 instead of a reserved
  // center hole.
  const spiralParams = useMemo<SpiralParams>(() => {
    const yearsSpanned = (maxDate.getTime() - minDate.getTime()) / MS_PER_YEAR;
    const totalRotations = Math.max(1, yearsSpanned);
    const maxRadius = Math.max(
      0,
      Math.min(size.width, size.height) / 2 - RADIUS_PADDING
    );

    return {
      centerX: size.width / 2,
      centerY: size.height / 2,
      maxRadius,
      totalRotations,
    };
  }, [size, minDate, maxDate]);

  // ─── Main spiral path ───
  // Densely sampled polyline approximation of the spiral curve itself -
  // see "DRAWING THE SPIRAL LINE" above for why a polyline's length is
  // exact (not approximate) and how that feeds year-label positioning.
  const spiralSampleCount = Math.min(
    MAX_SPIRAL_SAMPLES,
    Math.max(64, Math.round(spiralParams.totalRotations * SAMPLES_PER_ROTATION))
  );

  const spiralSamples = useMemo(() => {
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= spiralSampleCount; i++) {
      samples.push(spiralPoint(i / spiralSampleCount, spiralParams));
    }
    return samples;
  }, [spiralSampleCount, spiralParams]);

  const spiralPathD = useMemo(
    () => buildPolylinePath(spiralSamples),
    [spiralSamples]
  );

  // Cumulative Euclidean distance up to each sample - since every
  // segment is straight, this sum IS the path's exact length at that
  // sample, the same units `tToArcLength`/`arcLengthToT` both work in.
  const cumulativeLengths = useMemo(() => {
    const lengths = [0];
    for (let i = 1; i < spiralSamples.length; i++) {
      const prev = spiralSamples[i - 1];
      const curr = spiralSamples[i];
      lengths.push(
        lengths[i - 1] + Math.hypot(curr.x - prev.x, curr.y - prev.y)
      );
    }
    return lengths;
  }, [spiralSamples]);

  const totalPathLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0;

  /** Interpolates a `t` (0-1) fraction to its arc-length position along `spiralPathD`. */
  const tToArcLength = (t: number): number => {
    const index = t * spiralSampleCount;
    const i0 = Math.floor(index);
    const i1 = Math.min(spiralSampleCount, i0 + 1);
    const frac = index - i0;
    const len0 = cumulativeLengths[i0] ?? 0;
    const len1 = cumulativeLengths[i1] ?? len0;
    return len0 + (len1 - len0) * frac;
  };

  /**
   * The inverse of `tToArcLength` - given an arc-length distance along
   * `spiralPathD`, finds the `t` (0-1) it corresponds to. Used to nudge a
   * year glyph along the gridline when it would otherwise land on top of
   * an entry marker - see the top-of-file "YEAR GLYPHS" comment's
   * "COLLISION AVOIDANCE" section: `arcLengthToT(tToArcLength(t) +
   * YEAR_GLYPH_NUDGE_ARC_PX)` finds the `t` a fixed PIXEL distance past a
   * glyph's own position, which is what lets the nudge stay visually
   * consistent regardless of how much arc length a given `t` step covers
   * at that point in the spiral (outer loops cover far more arc length
   * per unit `t` than inner ones).
   *
   * `cumulativeLengths` is monotonically non-decreasing (each segment
   * adds a non-negative length), so a binary search for the bracketing
   * sample index is valid, then linear interpolation WITHIN that bracket
   * mirrors `tToArcLength`'s own interpolation exactly (same source
   * array, same units), just solved in the opposite direction.
   */
  const arcLengthToT = (targetLength: number): number => {
    const clamped = Math.max(0, Math.min(targetLength, totalPathLength));
    let lo = 0;
    let hi = cumulativeLengths.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulativeLengths[mid] < clamped) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const i1 = lo;
    const i0 = Math.max(0, i1 - 1);
    const len0 = cumulativeLengths[i0] ?? 0;
    const len1 = cumulativeLengths[i1] ?? len0;
    const frac = len1 > len0 ? (clamped - len0) / (len1 - len0) : 0;
    return (i0 + frac) / spiralSampleCount;
  };

  // ─── Year boundaries ───
  // One glyph per calendar year the domain touches, positioned at that
  // year's Jan 1 (clamped into [minDate, maxDate] for the first/last
  // partial years) - see the top-of-file "YEAR GLYPHS" comment for how
  // each one is actually rendered.
  const yearBoundaries = useMemo(() => {
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();
    const span = maxDate.getTime() - minDate.getTime();
    const labels: { year: number; t: number }[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const boundaryTime = Math.min(
        Math.max(new Date(year, 0, 1).getTime(), minDate.getTime()),
        maxDate.getTime()
      );
      labels.push({
        year,
        t: span === 0 ? 0 : (boundaryTime - minDate.getTime()) / span,
      });
    }
    return labels;
  }, [minDate, maxDate]);

  // ─── Sorted entries ───
  // Chronological draw order, same as LinearTimeline's implicit ordering
  // (entries already sorted by position along its axis) - so later
  // entries draw on top of earlier ones where circles/arcs overlap.
  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [entries]
  );

  // Set for O(1) membership checks per point/arc - same pattern as
  // StarMap.tsx's activeCategorySet/LinearTimeline.tsx's own.
  const activeCategorySet = useMemo(
    () => new Set<string>(filterCategories),
    [filterCategories]
  );

  // Whether there's anything actually visible to plot right now - see
  // StarMap.tsx's identical `isEmpty` comment and VizEmptyState.tsx's own
  // top-of-file comment for the full reasoning (this single check covers
  // both the time filter and the category filter as a possible cause).
  const isEmpty = useMemo(
    () => !entries.some(entry => activeCategorySet.has(entry.activityType)),
    [entries, activeCategorySet]
  );

  // Set for O(1) membership checks per point/arc - same pattern, same
  // source, and same purpose as StarMap.tsx's own `openedEntryIdSet`.
  const openedEntryIdSet = useMemo(
    () => new Set(openedEntryIds),
    [openedEntryIds]
  );

  /**
   * ──────────────────────────────────────────────────────────────────────
   * RANGE ENTRIES (with endTimestamp): LANE-ASSIGNED, TRUE-CURVE-SAMPLED
   * BANDS, LANE 0 = 0 RADIAL OFFSET
   * ──────────────────────────────────────────────────────────────────────
   * See the top-of-file "OVERLAPPING ARCS (AND POINTS)" comment for the
   * lane-NUMBER-assignment reasoning (unchanged) and the "RANGE ENTRIES"
   * comment for why each band is now built by SAMPLING the true spiral
   * curve (`buildRangeBandPath`) instead of a `d3.arc()` fixed-radius
   * sector. In short: `assignLanes` (utils/laneAssignment.ts, shared
   * verbatim with LinearTimeline.tsx) decides lane NUMBERS from each
   * entry's arc-length span along the spiral path (`tToArcLength`, the
   * spiral's stand-in for LinearTimeline's xScale pixel position, and
   * processed duration-descending, so a solitary or longest-overlapping
   * arc lands in lane 0); `radiusOffset` then turns a lane number into
   * `spiralPoint`'s own `radiusOffset` argument - `lane *
   * RADIAL_LANE_OFFSET_PX`, so lane 0 is exactly 0 - fed into EVERY sample
   * `buildRangeBandPath` takes along the band's span, not just applied
   * once to a single representative radius the way the old `d3.arc()`
   * version did.
   *
   * `start`/`end`/`midpoint` below are each `spiralPoint(t, spiralParams,
   * radiusOffset)` - the exact same true-curve, lane-offset position a
   * POINT entry at that same `t` would render at - so they sit exactly on
   * the band that's actually drawn; the hover/click/highlight JSX further
   * down, and the YEAR GLYPHS collision check, both read these same
   * fields, so they automatically target where the band visually IS.
   *
   * `lanedRangeItems` (the pre-radiusOffset `assignLanes` output, still
   * carrying `arcStart`/`arcEnd`) is kept alongside the final `ranges` list
   * so the POINT ENTRIES computation just below can look up which lane
   * each arc landed in and what span it covers, without recomputing any of
   * this from scratch.
   */
  const { ranges, lanedRangeItems } = useMemo(() => {
    const items = sortedEntries
      .filter(entry => entry.endTimestamp)
      .map(entry => {
        const tStart = normalize(new Date(entry.timestamp));
        const tEnd = normalize(new Date(entry.endTimestamp as string));
        return {
          entry,
          tStart,
          tEnd,
          arcStart: tToArcLength(Math.min(tStart, tEnd)),
          arcEnd: tToArcLength(Math.max(tStart, tEnd)),
          color: getActivityColor(entry.activityType),
        };
      });

    const laned = assignLanes(
      items,
      item => item.arcStart,
      item => item.arcEnd,
      LANE_GAP_PX
    );

    const ranges = laned.map(({ entry, tStart, tEnd, color, lane }) => {
      const radiusOffset = lane * RADIAL_LANE_OFFSET_PX;
      const t0 = Math.min(tStart, tEnd);
      const t1 = Math.max(tStart, tEnd);
      const tMid = (t0 + t1) / 2;

      // This is the ONLY path generated per range entry - the "opened"
      // glow/ring below (in the render) both STROKE this exact same `d`
      // string rather than generating their own differently-built
      // shapes; see that render's own comment for why stroking the one
      // closed path directly, instead of building separate offset
      // shapes, is what makes the highlight wrap continuously around the
      // ENTIRE shape (both long curved edges AND both cut ends).
      const pathD = buildRangeBandPath(
        t0,
        t1,
        radiusOffset,
        ARC_BAND_HALF_THICKNESS,
        spiralParams,
        RANGE_BAND_SAMPLE_COUNT
      );

      return {
        entry,
        pathD,
        start: spiralPoint(t0, spiralParams, radiusOffset),
        end: spiralPoint(t1, spiralParams, radiusOffset),
        midpoint: spiralPoint(tMid, spiralParams, radiusOffset),
        color,
        lane,
      };
    });

    return { ranges, lanedRangeItems: laned };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedEntries, spiralParams, minDate, maxDate, cumulativeLengths]);

  /**
   * ──────────────────────────────────────────────────────────────────────
   * SINGLE-POINT ENTRIES (no endTimestamp): LANE-BUMPED AROUND ARCS THAT
   * COVER THEIR DATE
   * ──────────────────────────────────────────────────────────────────────
   * See the top-of-file "POINT ENTRIES NOW PARTICIPATE IN OVERLAP
   * DETECTION TOO" comment for the full reasoning. In short: a point whose
   * date falls within an already-laned arc's span (`lanedRangeItems`,
   * computed just above) would render right on top of that arc's curve if
   * left at lane 0 - `assignLaneAroundRanges` (utils/laneAssignment.ts)
   * finds the first lane (0, 1, 2, ...) where no arc assigned to that lane
   * covers this point's own arc-length position, checking only against
   * ARCS (never other points - see that function's own comment for why).
   * A point with no conflicting arc anywhere stays at lane 0, i.e.
   * `radiusOffset` 0, unchanged from its original always-on-the-curve
   * behavior.
   */
  const points = useMemo(
    () =>
      sortedEntries
        .filter(entry => !entry.endTimestamp)
        .map(entry => {
          const t = normalize(new Date(entry.timestamp));
          const position = tToArcLength(t);
          const lane = assignLaneAroundRanges(
            position,
            lanedRangeItems,
            item => item.arcStart,
            item => item.arcEnd,
            LANE_GAP_PX
          );
          const radiusOffset = lane * RADIAL_LANE_OFFSET_PX;
          return {
            entry,
            ...spiralPoint(t, spiralParams, radiusOffset),
            color: getActivityColor(entry.activityType),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedEntries, spiralParams, minDate, maxDate, lanedRangeItems]
  );

  // ─── Entry marker positions (for year-glyph collision avoidance) ───
  // See the top-of-file "YEAR GLYPHS" comment's "COLLISION AVOIDANCE"
  // section - a flat list of every rendered entry marker's on-screen
  // position (a point's own (x, y), or a range arc's start/end/midpoint),
  // checked against each year glyph's raw position before it's drawn.
  const entryMarkerPositions = useMemo(
    () => [
      ...points.map(point => ({ x: point.x, y: point.y })),
      ...ranges.flatMap(range => [range.start, range.end, range.midpoint]),
    ],
    [points, ranges]
  );

  /**
   * Finds a `t` for a year glyph that doesn't land on top of an entry
   * marker - see the top-of-file "YEAR GLYPHS" comment's "COLLISION
   * AVOIDANCE" section. Tries the glyph's own raw position first, then
   * nudges forward along the curve, then backward; if even that's still
   * colliding (an extreme edge case - entries densely packed on both
   * sides), just accepts the forward-nudged position rather than
   * searching indefinitely for a perfectly clear spot.
   */
  const findNonCollidingYearGlyphT = (t: number, arcLength: number): number => {
    const collidesAt = (candidateT: number): boolean => {
      const candidate = spiralPoint(candidateT, spiralParams);
      return entryMarkerPositions.some(
        marker =>
          Math.hypot(marker.x - candidate.x, marker.y - candidate.y) <
          YEAR_GLYPH_COLLISION_RADIUS_PX
      );
    };

    if (!collidesAt(t)) return t;

    const forwardT = arcLengthToT(
      Math.min(totalPathLength, arcLength + YEAR_GLYPH_NUDGE_ARC_PX)
    );
    if (!collidesAt(forwardT)) return forwardT;

    const backwardT = arcLengthToT(
      Math.max(0, arcLength - YEAR_GLYPH_NUDGE_ARC_PX)
    );
    return collidesAt(backwardT) ? forwardT : backwardT;
  };

  // ─── "Now" marker ───
  // See the top-of-file "NOW MARKER" comment for the full reasoning.
  // `isDaytime` is derived from the SAME frozen `now` the domain
  // extension above uses - not `new Date()` read fresh here - so the
  // sun/moon choice is fixed for this view's lifetime rather than
  // flipping mid-session if it happens to be open across 6am/6pm.
  const isDaytime =
    now.getHours() >= NOW_DAY_START_HOUR && now.getHours() < NOW_DAY_END_HOUR;

  // The line's INNER endpoint - deliberately the latest entry's own
  // date, computed directly from `entries` (each entry's `endTimestamp`
  // when present, else its plain `timestamp`), NOT reused from
  // `domainRange.end` - see the top-of-file comment's "THE DOTTED LINE +
  // GLYPH" section for why.
  const latestEntryDate = useMemo(() => {
    if (entries.length === 0) return null;

    return entries.reduce(
      (latest, entry) => {
        const entryEnd = new Date(entry.endTimestamp ?? entry.timestamp);
        return entryEnd.getTime() > latest.getTime() ? entryEnd : latest;
      },
      new Date(entries[0].endTimestamp ?? entries[0].timestamp)
    );
  }, [entries]);

  const nowMarker = useMemo(() => {
    // No entries at all, or (an unusual edge case - a future-dated
    // entry) the latest entry is somehow already later than "now" -
    // either way there's no sensible forward-in-time line to draw.
    if (!latestEntryDate || now.getTime() < latestEntryDate.getTime()) {
      return null;
    }

    const tStart = normalize(latestEntryDate);
    const tEnd = normalize(now);
    if (tEnd <= tStart) return null;

    // Same sampled-polyline technique (and the SAME per-rotation sample
    // density) as the main spiral curve itself - see the top-of-file
    // "DRAWING THE SPIRAL LINE" comment - just scoped to this much
    // shorter `[tStart, tEnd]` sub-span instead of the full `[0, 1]`.
    const sampleCount = Math.max(
      2,
      Math.round(
        (tEnd - tStart) * spiralParams.totalRotations * SAMPLES_PER_ROTATION
      )
    );
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= sampleCount; i++) {
      samples.push(
        spiralPoint(tStart + ((tEnd - tStart) * i) / sampleCount, spiralParams)
      );
    }

    return {
      pathD: buildPolylinePath(samples),
      glyphPosition: samples[samples.length - 1],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `normalize` closes over minDate/maxDate, already listed directly below (same pattern `points`/`ranges` use above)
  }, [latestEntryDate, now, spiralParams, minDate, maxDate]);

  // ─── Pan/zoom behavior ───
  // Same mechanism as StarMap.tsx: attached once, and the 'zoom' handler
  // writes the transform directly onto `zoomLayerRef`'s <g> rather than
  // going through React state - there's no axis here that needs to be
  // regenerated against a rescaled domain the way LinearTimeline's is, so
  // there's nothing else that needs to react to the transform.
  // `zoomBehaviorRef` is stashed (unlike the pre-parity version) so
  // CLICK-TO-CENTER/RESET-VIEW below can drive it programmatically.
  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomLayer = d3.select(zoomLayerRef.current);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_SCALE_EXTENT)
      .on('zoom', event => {
        zoomLayer.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svg.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  /**
   * ──────────────────────────────────────────────────────────────────────
   * CLICK-TO-CENTER: PROGRAMMATIC PAN VIA d3-zoom's `.transform()`, TIED TO
   * THE EXPANDED-ENTRY STATE CHANGE
   * ──────────────────────────────────────────────────────────────────────
   * Adapted from StarMap.tsx's own CLICK-TO-CENTER effect - see its
   * comment for the full reasoning (why this lives in an effect keyed on
   * `expandedEntryId` rather than the click handler, and why the target
   * isn't simply the canvas center). The only difference in the target
   * MATH is *where* a target entry's world (x, y) comes from: a point uses
   * its own `spiralPoint` output directly; a range entry uses `midpoint`
   * (see the `ranges` useMemo above) instead of a single endpoint, so
   * centering a long-duration entry doesn't push most of its arc off to
   * one side of the target.
   *
   * `sidebarWidth` IS A DEPENDENCY HERE - UNLIKE StarMap.tsx's OWN EFFECT:
   * StarMap deliberately excludes it (see that file's comment: "the pan
   * should only ever be triggered by the expanded entry actually changing,
   * not by e.g. a window resize"), but that omission has a race condition
   * on the very FIRST entry ever opened: `expandedEntryId` flips to a
   * real id and `hasSelection` flips true in the SAME render (both come
   * from the same useEntrySelection.ts state update), but the sidebar's
   * ACTUAL rendered pixel width isn't known yet - Spiral.tsx's own
   * `sidebarWidth` state still measures 0 until its ResizeObserver
   * callback fires against the now-mounted SidebarPanelStack DOM node,
   * which lands in a LATER, separate commit. Since `targetX` reads
   * `sidebarWidth` directly, this effect firing on that first render would
   * center against the stale pre-open value (0) - i.e. the full canvas
   * center - instead of the correct sidebar-excluded center, exactly the
   * bug this fixes. Including `sidebarWidth` here means the effect fires
   * AGAIN once the real measured width lands a moment later, recentering
   * onto the correct target - the identical fix (and identical staleness
   * cause) LinearTimeline.tsx's own AUTO-RECENTER effect already documents
   * for its `contentOriginX`/`innerWidth`. d3's `.transition()` simply
   * redirects the still-in-flight first animation toward the corrected
   * target rather than restarting it, so this reads as one smooth pan
   * converging on the right spot, not a visible double jump. On every
   * SUBSEQUENT click (sidebar already open, `sidebarWidth` unchanged by
   * this expand), this dependency is a no-op - the effect only actually
   * re-fires when `sidebarWidth`'s value itself changes, which also means
   * resizing the window while a panel is open correctly re-centers as the
   * sidebar's rendered width changes with it. `points`/`ranges`/`size`
   * stay excluded, same as StarMap's own `stars`/`size` - see StarMap's
   * comment for why this should only re-run for a real "recenter" signal
   * (the expanded entry changing, or the sidebar's width changing),
   * not every render that happens to touch one of the values it reads.
   */
  useEffect(() => {
    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior || !expandedEntryId) return;

    const point = points.find(
      candidate => candidate.entry.id === expandedEntryId
    );
    const range = point
      ? undefined
      : ranges.find(candidate => candidate.entry.id === expandedEntryId);
    const world = point ?? range?.midpoint;
    if (!world) return;

    const { width, height } = size;
    if (width === 0 || height === 0) return;

    const targetX = sidebarWidth + (width - sidebarWidth) / 2;
    const targetY = height / 2;

    const currentTransform = d3.zoomTransform(svgNode);

    const centeredTransform = d3.zoomIdentity
      .translate(targetX, targetY)
      .scale(currentTransform.k) // preserve the user's current zoom level
      .translate(-world.x, -world.y);

    d3.select(svgNode)
      .transition()
      .duration(650) // 500-750ms: smooth, not sluggish, same as StarMap's
      .call(zoomBehavior.transform, centeredTransform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEntryId, sidebarWidth]);

  /**
   * ─── RESET-VIEW: PROGRAMMATIC PAN/ZOOM RESET, TIED TO `resetViewSignal` ───
   * Identical to StarMap.tsx's own RESET-VIEW effect - see its comment for
   * why `isFirstResetSignal` skips the very first run.
   */
  const isFirstResetSignal = useRef(true);
  useEffect(() => {
    if (isFirstResetSignal.current) {
      isFirstResetSignal.current = false;
      return;
    }

    const svgNode = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgNode || !zoomBehavior) return;

    d3.select(svgNode)
      .transition()
      .duration(650)
      .call(zoomBehavior.transform, d3.zoomIdentity);
  }, [resetViewSignal]);

  // ─── Hover tooltip ───
  // Same shape/tracking as LinearTimeline.tsx/StarMap.tsx - see the
  // "Hover tooltip" comment in LinearTimeline.tsx - EXTENDED with a
  // `kind` discriminant so the SAME piece of state can also track a
  // hovered YEAR GLYPH (see the "YEAR GLYPHS" comment below) or the
  // hovered "NOW" GLYPH (see the top-of-file "NOW MARKER" comment), not
  // just a hovered entry point/arc. `EntryTooltip` below is rendered
  // with either its `entry` prop (unchanged behavior) or its `label`
  // prop (the bare year, or the live current date/time), depending on
  // which branch is set - see EntryTooltip.tsx's own "ENTRY vs. LABEL
  // VARIANT" comment.
  const [hovered, setHovered] = useState<
    | { kind: 'entry'; entry: Entry; x: number; y: number }
    | { kind: 'year'; year: number; x: number; y: number }
    | { kind: 'now'; x: number; y: number }
    | null
  >(null);

  // While the "now" glyph is actively hovered, its tooltip should
  // visibly tick once a second rather than staying frozen at whatever
  // instant the hover started - see the top-of-file "NOW MARKER"
  // comment's "FROZEN AT MOUNT" section for why this is deliberately
  // its OWN separate live clock, not the frozen `now` state used
  // everywhere else in this component. This effect only manages a
  // re-render counter, not a `Date` itself - the tooltip's own render
  // below reads a fresh `new Date()` each time this fires, so the
  // interval is what makes that happen, not what stores the time. The
  // interval is created (and torn down) only while
  // `hovered?.kind === 'now'`, which is what makes it stop the instant
  // the mouse leaves rather than continuing to tick in the background.
  const [, setNowTooltipTick] = useState(0);

  useEffect(() => {
    if (hovered?.kind !== 'now') return;

    const interval = window.setInterval(() => {
      setNowTooltipTick(tick => tick + 1);
    }, NOW_TOOLTIP_TICK_MS);

    return () => window.clearInterval(interval);
  }, [hovered?.kind]);

  const isReady =
    size.width > 0 && size.height > 0 && spiralParams.maxRadius > 0;

  return (
    // `fixed inset-0` (not a layout child) - see the FULL-BLEED CANVAS
    // comment above. z-0, same base layer as StarMap.tsx/LinearTimeline.tsx:
    // Spiral.tsx's floating header and sidebar overlay both render above
    // this with their own higher z-index. canvas-vignette-bg (see
    // index.css), not a flat bg-[var(--bg-color)] - the same radial
    // vignette StarMap.tsx's own canvas paints, so this reads as the same
    // background rather than a visibly flatter one just because this is a
    // different view.
    <div ref={containerRef} className="canvas-vignette-bg fixed inset-0 z-0">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="cursor-grab text-[var(--text-muted-color)] active:cursor-grabbing"
      >
        <defs>
          {/*
           * Soft blur used behind a plain OPENED POINT's highlight ring,
           * so it reads as a glow rather than a hard-edged shape - same
           * pattern as StarMap.tsx's `opened-star-glow`/
           * LinearTimeline.tsx's `opened-point-glow` (kept as a separate
           * id here since defs ids are scoped per-<svg>, not shared
           * across components). NOT used by the arc's own glow below -
           * see `opened-arc-glow` for why that one needs a different,
           * decoupled blur value instead of sharing this one.
           */}
          <filter
            id="opened-spiral-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation={GLOW_BLUR_STD_DEVIATION} />
          </filter>
          {/*
           * Soft blur for an OPENED range entry's band glow - a separate
           * filter, not a shared one with the plain point glow above,
           * specifically so this can use a HIGHER blur radius
           * (ARC_GLOW_BLUR_STD_DEVIATION) without also blurring every
           * plain point's glow more than intended. See the "ARC BAND
           * HIGHLIGHT" comment above `OPENED_ARC_GLOW_EXTRA_RADIUS` for
           * why this needed a stronger blur than the plain point glow's
           * own value in the first place.
           */}
          <filter
            id="opened-arc-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation={ARC_GLOW_BLUR_STD_DEVIATION} />
          </filter>
        </defs>
        <g ref={zoomLayerRef}>
          {isReady && (
            <>
              <path
                d={spiralPathD}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.5}
              />

              {/*
               * "NOW" MARKER - see the top-of-file "NOW MARKER" comment.
               * Same stroke color/opacity/width as the main gridline
               * path just above (this IS that same gridline, just
               * continuing past the last real entry), with
               * `strokeDasharray` added so it visibly reads as a
               * continuation rather than more of the solid curve.
               */}
              {nowMarker && (
                <>
                  <path
                    d={nowMarker.pathD}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.35}
                    strokeWidth={1.5}
                    strokeDasharray={NOW_LINE_DASH}
                  />
                  <text
                    x={nowMarker.glyphPosition.x}
                    y={nowMarker.glyphPosition.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="currentColor"
                    fontSize={NOW_GLYPH_FONT_SIZE_PX}
                    opacity={
                      hovered?.kind === 'now'
                        ? NOW_GLYPH_HOVER_OPACITY
                        : NOW_GLYPH_OPACITY
                    }
                    className="cursor-default select-none transition-opacity duration-150"
                    onMouseEnter={event =>
                      setHovered({
                        kind: 'now',
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }
                    onMouseMove={event =>
                      setHovered(current =>
                        current && current.kind === 'now'
                          ? { ...current, x: event.clientX, y: event.clientY }
                          : current
                      )
                    }
                    onMouseLeave={() => setHovered(null)}
                  >
                    {isDaytime ? '☀' : '☾'}
                  </text>
                </>
              )}

              {ranges.map(({ entry, pathD, color }) => {
                const isOpened = openedEntryIdSet.has(entry.id);
                const isFilteredOut = !activeCategorySet.has(
                  entry.activityType
                );
                return (
                  // OPENED-ENTRY HIGHLIGHT: one group per range, opacity
                  // applied once to the whole group (glow + band + ring)
                  // so a filtered-out arc's highlight dims along with it -
                  // same structure as StarMap.tsx's per-star <g>/
                  // LinearTimeline.tsx's per-range <g>. No `transform`
                  // here (unlike the earlier `d3.arc()`-based version):
                  // `pathD` is now built from `spiralPoint`, which already
                  // returns absolute canvas coordinates (`centerX`/
                  // `centerY` baked in), the same coordinate space
                  // `points` below render directly into - see the
                  // top-of-file "RANGE ENTRIES" comment.
                  <g
                    key={entry.id}
                    style={{
                      opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                    }}
                    className="cursor-pointer transition-opacity duration-200"
                    onMouseEnter={event =>
                      setHovered({
                        kind: 'entry',
                        entry,
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }
                    onMouseMove={event =>
                      setHovered(current =>
                        current &&
                        current.kind === 'entry' &&
                        current.entry.id === entry.id
                          ? { ...current, x: event.clientX, y: event.clientY }
                          : current
                      )
                    }
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onEntryClick(entry)}
                  >
                    {isOpened && (
                      // OPENED-ENTRY HIGHLIGHT (band glow + ring) -
                      // STROKING THE SAME CLOSED PATH, NOT TWO SEPARATE
                      // OFFSET SHAPES:
                      //
                      // An earlier version (back when `pathD` was a
                      // `d3.arc()` sector) generated a second, WIDER
                      // `d3.arc()` shape for the glow (different
                      // innerRadius/outerRadius/cornerRadius from
                      // `pathD`) and a THIRD, entirely-outside-outerRadius
                      // shape for the ring. Resizing an annulus segment's
                      // radii like that does NOT uniformly "grow" it the
                      // way offsetting a rounded rectangle's own edges
                      // does (LinearTimeline.tsx's `capsuleOutlineRect`) -
                      // a wider/narrower arc's rounded corners land at a
                      // DIFFERENT position than the original's, so the
                      // result reads as extra arcs parallel to the two
                      // long curved edges that never wrap around the
                      // rounded end caps at all.
                      //
                      // `pathD` is now already a single CLOSED path built
                      // by `buildRangeBandPath` (outer edge samples, then
                      // inner edge samples in reverse, back to the first
                      // outer point) - stroking it directly, with
                      // `fill="none"`, makes SVG trace that entire closed
                      // boundary as one continuous line, both cut ends
                      // included, for free - no separate geometry needed.
                      // The stroke straddles
                      // the boundary (half in, half out); both are drawn
                      // BEHIND the opaque colored band below, which
                      // covers the inward half, leaving only a clean
                      // outward halo/ring - the same "glow circle, then
                      // solid shape" layering StarMap.tsx's per-star <g>
                      // uses, just both glow AND ring behind the fill
                      // here (unlike a plain point's ring, which sits at
                      // an already-larger radius with no overlap to hide,
                      // this ring traces the SAME boundary the fill does,
                      // so it also needs the fill drawn after it).
                      // `strokeWidth` is doubled from the visually-tuned
                      // "how much should show" value, since only half of
                      // a straddling stroke ends up visible.
                      <>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={OPENED_HIGHLIGHT_COLOR}
                          strokeWidth={OPENED_ARC_GLOW_EXTRA_RADIUS * 2}
                          strokeOpacity={OPENED_ARC_GLOW_OPACITY}
                          filter="url(#opened-arc-glow)"
                          className="pointer-events-none"
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke={OPENED_HIGHLIGHT_COLOR}
                          strokeWidth={ARC_RING_WIDTH * 2}
                          className="pointer-events-none"
                        />
                      </>
                    )}
                    <path d={pathD} fill={color} />
                  </g>
                );
              })}

              {points.map(({ entry, x, y, color }) => {
                const isOpened = openedEntryIdSet.has(entry.id);
                const isFilteredOut = !activeCategorySet.has(
                  entry.activityType
                );
                return (
                  // OPENED-ENTRY HIGHLIGHT: same per-entry <g> + opacity
                  // + glow/ring structure as StarMap.tsx's stars.map().
                  <g
                    key={entry.id}
                    style={{
                      opacity: isFilteredOut ? FILTERED_OUT_OPACITY : 1,
                    }}
                    className="transition-opacity duration-200"
                  >
                    {isOpened && (
                      <circle
                        cx={x}
                        cy={y}
                        r={POINT_RADIUS + 5}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={4}
                        strokeOpacity={GLOW_OPACITY}
                        filter="url(#opened-spiral-glow)"
                        className="pointer-events-none"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={POINT_RADIUS}
                      fill={color}
                      stroke={color}
                      strokeOpacity={0.35}
                      strokeWidth={4}
                      className="cursor-pointer"
                      onMouseEnter={event =>
                        setHovered({
                          kind: 'entry',
                          entry,
                          x: event.clientX,
                          y: event.clientY,
                        })
                      }
                      onMouseMove={event =>
                        setHovered(current =>
                          current &&
                          current.kind === 'entry' &&
                          current.entry.id === entry.id
                            ? {
                                ...current,
                                x: event.clientX,
                                y: event.clientY,
                              }
                            : current
                        )
                      }
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => onEntryClick(entry)}
                    />
                    {isOpened && (
                      <circle
                        cx={x}
                        cy={y}
                        r={POINT_RADIUS + 3}
                        fill="none"
                        stroke={OPENED_HIGHLIGHT_COLOR}
                        strokeWidth={1.5}
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}

              {yearBoundaries.map(({ year, t }) => {
                // Nudged away from any colliding entry marker (see the
                // top-of-file "YEAR GLYPHS" comment's "COLLISION
                // AVOIDANCE" section) before computing its final position.
                const glyphT = findNonCollidingYearGlyphT(t, tToArcLength(t));
                const { x, y } = spiralPoint(glyphT, spiralParams);
                const isHovered =
                  hovered?.kind === 'year' && hovered.year === year;

                return (
                  <text
                    key={year}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="currentColor"
                    fontSize={YEAR_GLYPH_FONT_SIZE_PX}
                    opacity={
                      isHovered ? YEAR_GLYPH_HOVER_OPACITY : YEAR_GLYPH_OPACITY
                    }
                    className="cursor-default select-none transition-opacity duration-150"
                    onMouseEnter={event =>
                      setHovered({
                        kind: 'year',
                        year,
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }
                    onMouseMove={event =>
                      setHovered(current =>
                        current &&
                        current.kind === 'year' &&
                        current.year === year
                          ? { ...current, x: event.clientX, y: event.clientY }
                          : current
                      )
                    }
                    onMouseLeave={() => setHovered(null)}
                  >
                    ✦
                  </text>
                );
              })}
            </>
          )}
        </g>
      </svg>

      {hovered &&
        (hovered.kind === 'entry' ? (
          <EntryTooltip entry={hovered.entry} x={hovered.x} y={hovered.y} />
        ) : hovered.kind === 'year' ? (
          <EntryTooltip
            label={String(hovered.year)}
            x={hovered.x}
            y={hovered.y}
          />
        ) : (
          // "NOW" GLYPH TOOLTIP - see the top-of-file "NOW MARKER"
          // comment and the `setNowTooltipTick` effect above: `new
          // Date()` is read fresh right here (not the frozen `now` used
          // everywhere else in this component) so this label re-renders
          // with the actual current time on each one-second tick while
          // this glyph is being hovered, same date/time format
          // (`formatSingleDate`) an entry's own tooltip uses.
          <EntryTooltip
            label={formatSingleDate(new Date(), true)}
            x={hovered.x}
            y={hovered.y}
          />
        ))}

      {isEmpty && (
        <VizEmptyState
          hasAnyEntries={hasAnyEntries}
          topOffset={topOffset}
          sidebarWidth={sidebarWidth}
          editModeBannerVisible={isEditMode}
        />
      )}
    </div>
  );
}
