/**
 * hollowGlyphs.ts - Shared Styling For 'Hollow' Entries
 *
 * Entries whose visual style is 'hollow' (getVisualStyle in
 * types/Category.ts) are drawn as a hollow ring (single date) or a thin
 * stroked sine wave (range) instead of a solid dot/capsule, outside the
 * lane system - see SpiralTimeline.tsx's "ORBIT ENTRIES" comment for the
 * full design. SpiralTimeline.tsx and LinearTimeline.tsx both draw them;
 * this file holds everything about them that ISN'T tied to either view's
 * geometry (stroke widths, glow, opacity, how many oscillations a wave
 * gets), so the two views can't drift apart. Each view keeps its own
 * wave AMPLITUDE rule, since what it's proportional to differs (Spiral's
 * year-to-year loop gap vs. Linear's lane height), but clamps it to the
 * same px range below.
 */

/** Border width (px) of a single-date hollow entry's ring - same radius as a solid point in each view. */
export const HOLLOW_POINT_STROKE_WIDTH = 2;

/** Stroke width (px) of a hollow range's sine wave. */
export const HOLLOW_WAVE_STROKE_WIDTH = 1.75;
/** Opacity of the wave - fully present, just lighter than a solid band; NOT a view's FILTERED_OUT_OPACITY. */
export const HOLLOW_WAVE_OPACITY = 0.8;
/** The wave's soft same-color glow: a wider, blurred copy of the stroke underneath it. */
export const HOLLOW_WAVE_GLOW_STROKE_WIDTH = 5;
export const HOLLOW_WAVE_GLOW_OPACITY = 0.45;
export const HOLLOW_WAVE_GLOW_BLUR_STD_DEVIATION = 2.5;
/** Width (px) of the wave's invisible hover/click stroke - a 1.75px line is too thin to hover comfortably. */
export const HOLLOW_WAVE_HIT_STROKE_WIDTH = 14;

/** Px range every view clamps its wave amplitude to. */
export const HOLLOW_WAVE_MIN_AMPLITUDE_PX = 2.5;
export const HOLLOW_WAVE_MAX_AMPLITUDE_PX = 10;

/**
 * Oscillation count scales with the SQUARE ROOT of the entry's duration
 * in months - a 1-month entry gets 5 cycles, 4 months 10, a year ~17 -
 * so short entries aren't a flat squiggle and long ones don't turn into a
 * dense zigzag. Tied to the entry's own dates (not its on-screen length),
 * so the wave doesn't reshape itself while the view zooms or the domain
 * tweens. Rounded to a half cycle so the wave ends back on its centerline.
 */
const CYCLES_PER_SQRT_MONTH = 5;
const MIN_CYCLES = 3;
const MAX_CYCLES = 24;
/** Samples per oscillation, bounded to [MIN_SAMPLES, MAX_SAMPLES] - ~10 per cycle keeps each crest smooth. */
const SAMPLES_PER_CYCLE = 10;
const MIN_SAMPLES = 48;
const MAX_SAMPLES = 240;
const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000;

export function hollowWaveCycles(durationMs: number): number {
  const months = Math.max(0, durationMs) / MS_PER_MONTH;
  const cycles = CYCLES_PER_SQRT_MONTH * Math.sqrt(months);
  const clamped = Math.min(MAX_CYCLES, Math.max(MIN_CYCLES, cycles));
  return Math.round(clamped * 2) / 2;
}

/** How many samples a wave with `cycles` oscillations is drawn with. */
export function hollowWaveSampleCount(cycles: number): number {
  return Math.min(
    MAX_SAMPLES,
    Math.max(MIN_SAMPLES, Math.round(cycles * SAMPLES_PER_CYCLE))
  );
}

/** Clamps a view's raw amplitude (px) to the shared range above. */
export function clampHollowWaveAmplitude(amplitude: number): number {
  return Math.min(
    HOLLOW_WAVE_MAX_AMPLITUDE_PX,
    Math.max(HOLLOW_WAVE_MIN_AMPLITUDE_PX, amplitude)
  );
}

/** An open `M x,y L x,y ...` path through `points`, in order. */
export function buildPolylinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}
