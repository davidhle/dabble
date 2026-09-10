/**
 * VizPageHeader.tsx - Title + Subtitle Text Block For Viz Pages
 *
 * The title/subtitle text shown at the top of every visualization page
 * (Constellation, Timeline, and eventually Spiral) - factored out of
 * Constellation.tsx so the three pages render this identically instead of
 * copy-pasting the same two elements and styling. This is purely
 * presentational: which page renders it, and what wraps it (the
 * measured, ref'd header container - see the "HEADER STACKING" comment in
 * Constellation.tsx), stays owned by each page.
 *
 * TRANSPARENT CONTAINER, CONTRASTED CONTENT:
 * Neither element has an opaque background of its own - both sit directly
 * over a page's full-bleed canvas (StarMap's starfield, LinearTimeline's
 * axis), so legibility comes from the text itself: a light color plus
 * `text-shadow` (a dark halo that reads against bright or dark canvas
 * content alike) rather than a backing box. See Constellation.tsx's
 * top-of-file comment for the full reasoning.
 */

const READABLE_TEXT_SHADOW =
  '0 1px 3px rgba(0, 0, 0, 0.9), 0 2px 10px rgba(0, 0, 0, 0.7)';

interface VizPageHeaderProps {
  title: string;
  subtitle: string;
}

export default function VizPageHeader({ title, subtitle }: VizPageHeaderProps) {
  return (
    <>
      <h1
        className="text-3xl font-bold text-white"
        style={{ textShadow: READABLE_TEXT_SHADOW }}
      >
        {title}
      </h1>
      <p className="text-gray-200" style={{ textShadow: READABLE_TEXT_SHADOW }}>
        {subtitle}
      </p>
    </>
  );
}
