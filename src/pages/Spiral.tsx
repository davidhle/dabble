/**
 * Spiral.tsx - Spiral Timeline Page
 *
 * Renders the entries array (lifted in App.tsx, same as Chart.tsx and
 * Constellation.tsx receive it) as a spiral-shaped timeline via
 * SpiralTimeline.tsx - a third visualization alongside the clustered
 * Constellation view and the straight-line Timeline view, for a history
 * that's easier to take in as one coiled shape than a long horizontal
 * line once it spans several years. See SpiralTimeline.tsx for the
 * spiral formula, textPath year labels, and range-entry arc rendering.
 */

import SpiralTimeline from '../components/SpiralTimeline';
import { Entry } from '../types/Entry';

interface SpiralProps {
  entries: Entry[];
}

export default function Spiral({ entries }: SpiralProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-color)]">Spiral</h1>
      <p className="text-[var(--text-muted-color)]">
        Drag to pan, scroll to zoom, and click a point (or arc) to see the entry
        behind it. Time coils outward from the center - oldest at the middle,
        most recent at the rim.
      </p>
      <SpiralTimeline entries={entries} />
    </div>
  );
}
