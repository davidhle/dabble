/**
 * auroraRibbon.ts - Geometry For StarMap's 'Aurora' Ribbons
 *
 * A hollow RANGE entry on the Constellation (see StarMap.tsx's AURORA
 * RIBBONS comment) is drawn as a soft, wavy filled band threading through
 * the cluster centers of the movement categories it overlapped in time.
 * This file is the pure geometry for that: sample a smooth curve through
 * the centers (or along an arc), then turn that centerline into a closed
 * ribbon outline that tapers to a point at both ends, weaves gently side
 * to side, and breathes in width. No DOM, no React - StarMap supplies
 * the points and draws the result.
 */

import * as d3 from 'd3';
import type { Entry } from '../types/Entry';
import { isEntryWithinRange } from './entryDateRange';

export interface Point {
  x: number;
  y: number;
}

/**
 * Samples a uniform Catmull-Rom spline through `points` - the curve passes
 * exactly through every point - with `samplesPerSegment` steps between
 * each consecutive pair. Endpoints are extrapolated (a phantom point
 * mirrored past each end), so the curve leaves the first and last point
 * heading straight along their segment rather than kinking.
 *
 * Point `k` of the input lands at sample index `k * samplesPerSegment`,
 * which is what lets StarMap split the ribbon into per-category gradient
 * segments exactly at each cluster center.
 */
export function sampleCatmullRom(
  points: Point[],
  samplesPerSegment: number
): Point[] {
  if (points.length < 2) return points.slice();
  const first = points[0];
  const second = points[1];
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const padded = [
    { x: 2 * first.x - second.x, y: 2 * first.y - second.y },
    ...points,
    { x: 2 * last.x - beforeLast.x, y: 2 * last.y - beforeLast.y },
  ];

  const samples: Point[] = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const [p0, p1, p2, p3] = padded.slice(segment, segment + 4);
    // The last segment includes its endpoint; the others leave it to the
    // next segment's first sample, so no point is duplicated.
    const steps =
      segment === points.length - 2 ? samplesPerSegment + 1 : samplesPerSegment;
    for (let step = 0; step < steps; step++) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      samples.push({
        x: blend(p0.x, p1.x, p2.x, p3.x),
        y: blend(p0.y, p1.y, p2.y, p3.y),
      });
    }
  }
  return samples;
}

/** `count + 1` evenly spaced points along a circular arc (angles in radians). */
export function sampleArc(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  count: number
): Point[] {
  const samples: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / count;
    samples.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return samples;
}

export interface RibbonOptions {
  /** Half the ribbon's width (px) at its widest, before tapering/breathing. */
  halfWidth: number;
  /** How far (px) the ribbon weaves side to side off its centerline. */
  undulationAmplitude: number;
  /** Length (px) of one side-to-side weave along the ribbon. */
  wavelength: number;
  /** Phase offset (radians) - seeded per entry so each ribbon weaves differently but stably. */
  phase: number;
}

export interface Ribbon {
  /** Left edge then right edge, one point per centerline sample (same index). */
  left: Point[];
  right: Point[];
  /** The ribbon's own (undulated) center at its halfway point - a click-to-center target. */
  midpoint: Point;
  /** Per sample (same index as left/right): the undulated center, and the unit normal there. */
  centers: Point[];
  normals: Point[];
}

/**
 * Turns a sampled centerline into a ribbon: at each sample, offset along
 * the local normal by a sine weave (the same idea as the hollow waves on
 * Spiral/Linear, as a band instead of a stroke), with a half-width that
 * tapers to zero at both ends (`sin(π·s)`, softened) and gently breathes
 * along the way. Both effects are scaled by the taper too, so the ends
 * meet the centerline cleanly.
 */
export function buildRibbon(
  centerline: Point[],
  options: RibbonOptions
): Ribbon {
  const { halfWidth, undulationAmplitude, wavelength, phase } = options;
  const count = centerline.length;
  if (count < 2) {
    const only = centerline[0] ?? { x: 0, y: 0 };
    return {
      left: [only],
      right: [only],
      midpoint: only,
      centers: [only],
      normals: [{ x: 0, y: -1 }],
    };
  }

  // Cumulative arc length, so the weave/taper are spaced by distance
  // along the ribbon, not by sample index.
  const lengths = [0];
  for (let i = 1; i < count; i++) {
    const dx = centerline[i].x - centerline[i - 1].x;
    const dy = centerline[i].y - centerline[i - 1].y;
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  const total = lengths[count - 1] || 1;
  const weaves = total / Math.max(1, wavelength);

  const left: Point[] = [];
  const right: Point[] = [];
  const centers: Point[] = [];
  const normals: Point[] = [];
  for (let i = 0; i < count; i++) {
    const s = lengths[i] / total;
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(count - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tangentLength = Math.hypot(tx, ty) || 1;
    const nx = -ty / tangentLength;
    const ny = tx / tangentLength;

    const taper = Math.pow(Math.sin(Math.PI * s), 0.6);
    const weave =
      undulationAmplitude * taper * Math.sin(2 * Math.PI * weaves * s + phase);
    const width =
      halfWidth *
      taper *
      (0.75 + 0.25 * Math.sin(Math.PI * weaves * s + phase * 1.7));

    const cx = centerline[i].x + nx * weave;
    const cy = centerline[i].y + ny * weave;
    centers.push({ x: cx, y: cy });
    normals.push({ x: nx, y: ny });
    left.push({ x: cx + nx * width, y: cy + ny * width });
    right.push({ x: cx - nx * width, y: cy - ny * width });
  }

  const midIndex = lengths.findIndex(length => length >= total / 2);
  return {
    left,
    right,
    midpoint: centers[midIndex === -1 ? Math.floor(count / 2) : midIndex],
    centers,
    normals,
  };
}

/**
 * A closed SVG path for the slice of `ribbon` between sample indices
 * `from` and `to` (inclusive) - the whole ribbon by default. Slices that
 * share a boundary index tile exactly, which is how StarMap gives each
 * stretch between two cluster centers its own gradient.
 */
export function ribbonPath(
  ribbon: Ribbon,
  from = 0,
  to = ribbon.left.length - 1
): string {
  const points = [
    ...ribbon.left.slice(from, to + 1),
    ...ribbon.right.slice(from, to + 1).reverse(),
  ];
  if (points.length === 0) return '';
  return (
    points
      .map(
        (p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`
      )
      .join(' ') + ' Z'
  );
}

/**
 * The movement categories an aurora threads through, in visit order - see
 * StarMap.tsx's AURORA RIBBONS comment. A category counts when any of its
 * entries in `allEntries` (other than `orbitEntry` itself) is dated within
 * or overlaps `orbitEntry`'s full span. The first stop is the category
 * whose matching entry is EARLIEST; each next stop is the nearest
 * unvisited center (by `centers`), which keeps the path from zig-zagging.
 * Categories without a center are skipped.
 */
export function orderAuroraCategories(
  orbitEntry: Entry,
  allEntries: Entry[],
  movementCategoryIds: Set<string>,
  centers: Record<string, Point>
): string[] {
  const startMs = new Date(orbitEntry.timestamp).getTime();
  const endMs = orbitEntry.endTimestamp
    ? new Date(orbitEntry.endTimestamp).getTime()
    : startMs;
  const span = {
    start: new Date(Math.min(startMs, endMs)),
    end: new Date(Math.max(startMs, endMs)),
  };

  const earliestByCategory = new Map<string, number>();
  for (const other of allEntries) {
    if (
      other.id === orbitEntry.id ||
      !movementCategoryIds.has(other.activityType) ||
      !centers[other.activityType] ||
      !isEntryWithinRange(other, span)
    ) {
      continue;
    }
    const at = new Date(other.timestamp).getTime();
    const previous = earliestByCategory.get(other.activityType);
    if (previous === undefined || at < previous) {
      earliestByCategory.set(other.activityType, at);
    }
  }

  const remaining = [...earliestByCategory.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([categoryId]) => categoryId);
  const visited = remaining.splice(0, 1);
  while (remaining.length > 0) {
    const from = centers[visited[visited.length - 1]];
    const distance = (categoryId: string) =>
      Math.hypot(
        centers[categoryId].x - from.x,
        centers[categoryId].y - from.y
      );
    let nearestIndex = 0;
    remaining.forEach((categoryId, index) => {
      if (distance(categoryId) < distance(remaining[nearestIndex])) {
        nearestIndex = index;
      }
    });
    visited.push(remaining.splice(nearestIndex, 1)[0]);
  }
  return visited;
}

/**
 * The color (and how much of it, 0-1) a ribbon's gradient paints at
 * `point`, for a stretch whose gradient runs `start` -> `end` through
 * evenly spaced `colors` - computed exactly the way the SVG renders it
 * (projecting `point` onto that line), so a streak matches the ribbon
 * under it. `fadeColor` stops (a CSS variable, so not mixable here)
 * act as "this color, fading out": next to one, the result keeps the
 * other stop's color and ramps its alpha toward 0.
 */
export function auroraColorAt(
  point: Point,
  start: Point,
  end: Point,
  colors: string[],
  fadeColor: string
): { color: string; alpha: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.min(
    1,
    Math.max(
      0,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  );
  if (colors.length === 1) return { color: colors[0], alpha: 1 };
  const scaled = t * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  if (a === fadeColor && b === fadeColor) {
    return { color: a, alpha: 0 };
  }
  if (a === fadeColor) return { color: b, alpha: local };
  if (b === fadeColor) return { color: a, alpha: 1 - local };
  return { color: d3.interpolateRgb(a, b)(local), alpha: 1 };
}
