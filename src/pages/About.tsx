/**
 * About.tsx - Project History & Roadmap
 *
 * Home.tsx serves as the primary landing/introduction page for the MVP
 * (welcome copy plus the Export/Import/"Start Your Own Constellation"
 * data-management actions). This page is reserved for the project's own
 * story - the thesis research it grew out of, its broader goals, and
 * what's built vs. still planned - rather than data management.
 *
 * STYLING: mirrors Home.tsx's own conventions (see that file) - a
 * `space-y-6` root and `h1`/`h2` using the same
 * --text-color/--text-muted-color tokens. Body copy fills the full width
 * of `main`'s own content box (no `max-w-*` cap), same as Home.tsx.
 */

import { LINK_CLASSNAME } from '../utils/linkify';

/** Shared bullet-list styling for the plain Future Features list below - lifted out so bare bullet items can't drift in appearance. */
function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-[var(--text-muted-color)]">
      {items.map(item => (
        <li key={item} className="flex items-start">
          <span className="mr-2 mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500"></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Term-and-caption variant for Current Features: each item pairs a bold,
 * accent-colored feature name with a plain-body-text descriptive sentence,
 * rather than FeatureList's bare name - since these are shipped features
 * worth explaining, not brief planned-work bullets.
 */
function DescriptiveFeatureList({
  items,
}: {
  items: { name: string; description: string }[];
}) {
  return (
    <ul className="mt-4 space-y-4">
      {items.map(({ name, description }) => (
        <li key={name} className="flex items-start">
          <span className="mr-2 mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500"></span>
          <span>
            <span className="font-bold text-indigo-500">{name}</span>
            <span className="text-[var(--text-muted-color)]">
              {' '}
              — {description}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function About() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-color)]">
        About This Project
      </h1>

      <div className="space-y-4">
        <p className="text-lg text-[var(--text-muted-color)]">
          For my master's thesis project, under the supervision of Eva Hornecker
          and Sarah Fdili Alaoui, I conducted participatory research with female
          choreographers and dance practitioners to co-design ChoreoMapper, an
          interactive digital tool to enable dancers to trace their dance
          careers. The tool would use moments in the dancers' life, both dance
          and non-dance related, as data points and visualize them into a spiral
          shape.
        </p>
        <p className="text-lg text-[var(--text-muted-color)]">
          The broader goal of the project was to later develop the tool into a
          system that encapsulates multiple dancers' experiences into an
          interactive visualization that resembles a cartography: a map of
          various practitioners' career stories and reflections. In doing so,
          the visualization could further have the potential to foster
          connections between these people by highlighting shared experiences
          and/or feelings. This goal was originally inspired by dance researcher
          Bertha Bermúdez, who noticed an opportunity for exchange between
          practitioners in traditional dance communities in the French and
          Spanish regions in the Basque Country.
        </p>
        <p className="text-lg text-[var(--text-muted-color)]">
          The final artifact of my thesis was a hi-fidelity prototype, and as a
          continuation of that work, I developed Dabble. I was motivated to
          implement this project into a web app as I myself am a dancer and am
          curious in exploring the value that comes out of visualizing moments
          in my dance practice, which spans across different styles and
          activities which aren't directly related to dance, but still impact my
          trajectory.
        </p>
        <p className="text-lg text-[var(--text-muted-color)]">
          More information regarding the thesis can be found{' '}
          <a
            href="https://ledavid.framer.website/work/choreomapper"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASSNAME}
          >
            here
          </a>
          .
        </p>
      </div>

      {/*
       * Current/Future Features side by side as two columns on wider
       * screens - `grid-cols-1` first so they stack (rather than
       * squeezing two narrow columns) on a phone-width viewport, matching
       * `sm:` breakpoint elsewhere in the app.
       */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-color)]">
            Current Features
          </h2>
          <DescriptiveFeatureList
            items={[
              {
                name: 'Constellation',
                description:
                  'Entries appear as stars clustered by activity, echoing a night sky. Click a star to open its entry, filter by category, or scrub through time with the range selector below.',
              },
              {
                name: 'Timeline',
                description:
                  'A linear, chronological view of every entry, with multi-day events rendered as capsules and overlapping periods automatically laid out across separate tracks for legibility.',
              },
              {
                name: 'Spiral',
                description:
                  "Time coils outward from a center point — the earliest entry at the core, the most recent at the outer edge — inspired directly by my original master's thesis prototype, ChoreoMapper.",
              },
              {
                name: 'Time range brush selector',
                description:
                  'Narrow any visualization down to a specific window of time, shared consistently across all three views.',
              },
              {
                name: 'Light & dark themes',
                description:
                  'Toggle between a dark night-sky palette and a warm, sketchbook-paper light mode — applied consistently across every view, panel, and form.',
              },
              {
                name: 'Bring your own data',
                description:
                  'Export your entries as a portable JSON file, or import one to pick up where you left off. Anyone visiting can also reset to a blank slate and start their own constellation from scratch.',
              },
              {
                name: 'Flexible date precision',
                description:
                  'Entries don\'t need an exact date. Log something as vague as "October - November 2021," attach a real date range for multi-day events, or skip the time of day entirely if you only remember the day.',
              },
              {
                name: 'Dynamic categories',
                description:
                  "Categories aren't fixed in advance. Add a new one the moment you pick up a new hobby, and it's woven into the visualizations right away with its own color.",
              },
              {
                name: 'Edit entries',
                description:
                  'Update any entry after the fact — correct a date, add a location, reclassify its category — or switch on Edit Mode to jump straight from any star, point, or arc into its editor.',
              },
            ]}
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-color)]">
            Future Features
          </h2>
          <FeatureList
            items={[
              'Visualizing connections between events (e.g., locations, feelings, life events)',
              'Custom positioning of the points in the constellation view',
              'Media attachments (photos, voice notes, ...)',
              "Retroactive reflections/annotations on past events — add a dated note or reflection to an existing entry after the fact (with its own timestamp and emotional state at the time of writing), while staying linked to the original event. The reflection's own date can be backdated to any point between the original event and today (e.g. transcribing an old journal entry that reflected on a past event sometime after it happened).",
              'Robust location input — attach a real, mappable location to an entry (via a geocoding-based location search) rather than just plain text, while still supporting simple free-text location entries. This lays the groundwork for future connections between entries based on shared geographic location.',
              'List/table view — browse all entries as a sortable, filterable table or database-style list, with a toggle to switch between a compact table view and a card/block-based view (similar to Notion), as an alternative way to explore entries outside of the visualizations.',
              'Video thumbnails and previews from linked media (YouTube, Instagram, etc.)',
              '3D renderings of the visualizations using Three.js',
              'Backend development for real cross-device sync (likely via Cloudflare Workers)',
              'User authentication, potentially replacing the current JSON import/export as the primary way to save and restore your data',
              "Multi-category entries — associate an entry with more than one category (e.g. a trip that involved both shuffle dancing and pole dance & calisthenics training), represented visually maybe with a gradient blending each category's color.",
            ]}
          />
        </div>
      </div>

      <p className="text-sm text-[var(--text-muted-color)]">
        You can see this project's codebase{' '}
        <a
          href="https://github.com/davidhle/dabble"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASSNAME}
        >
          here
        </a>
        .
      </p>
    </div>
  );
}
