/**
 * Chart.tsx - Timeline Page
 *
 * Renders the entries array (lifted in App.tsx, same as Constellation.tsx
 * receives it) as a chronological timeline via LinearTimeline.tsx. This
 * used to render a D3.js bar-chart DEMO (D3Chart.tsx, driven by a
 * "Randomize Data" button over made-up placeholder numbers) that had
 * nothing to do with the app's actual entries - replaced entirely now
 * that there's a real per-entry visualization to show instead. See
 * LinearTimeline.tsx for the empty-state handling (no entries yet) and
 * the D3 scaleTime/axis/zoom implementation.
 */

import LinearTimeline from '../components/LinearTimeline';
import { Entry } from '../types/Entry';

interface ChartProps {
  entries: Entry[];
}

export default function Chart({ entries }: ChartProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-color)]">Timeline</h1>
      <p className="text-[var(--text-muted-color)]">
        Drag to pan, scroll to zoom, and click a point to see the entry behind
        it.
      </p>
      <LinearTimeline entries={entries} />
    </div>
  );
}
