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
 * axis), so legibility comes from the text itself: a themed color plus
 * `text-shadow` (a halo that reads against bright or dark canvas content
 * alike) rather than a backing box. See Constellation.tsx's top-of-file
 * comment for the full reasoning.
 *
 * text-[var(--text-color)]/text-[var(--text-muted-color)] plus
 * var(--viz-header-text-shadow) (not the fixed white/dark-shadow pair this
 * used to hardcode): a dark halo around WHITE text only helps in the dark
 * theme - swap to the light theme's cream --bg-color and white text with a
 * dark shadow would still render as a bright, hard-to-read patch over a
 * light canvas. Both the text color and the shadow itself are theme
 * tokens (see index.css's THEME TOKENS comment) so this flips to dark text
 * with a light/cream halo automatically in light mode.
 */

interface VizPageHeaderProps {
  title: string;
  subtitle: string;
}

export default function VizPageHeader({ title, subtitle }: VizPageHeaderProps) {
  return (
    <>
      <h1
        className="text-3xl font-bold text-[var(--text-color)]"
        style={{ textShadow: 'var(--viz-header-text-shadow)' }}
      >
        {title}
      </h1>
      <p
        className="text-[var(--text-secondary-color)]"
        style={{ textShadow: 'var(--viz-header-text-shadow)' }}
      >
        {subtitle}
      </p>
    </>
  );
}
