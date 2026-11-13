/**
 * About.tsx - Project History & Roadmap
 *
 * Home.tsx serves as the primary landing/introduction page for the MVP
 * (welcome copy plus "Start Your Own Constellation"; Export/Import live in
 * the Settings modal - see SettingsModal.tsx). This page is reserved for the project's own
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
                name: 'Linked views',
                description:
                  'One time range brush narrows all three views to the same window, and whatever entries are open stay open as you switch between them.',
              },
              {
                name: 'Movement & Orbit',
                description:
                  'Every category belongs to one of two domains: Movement, the things you practice, drawn as solid marks; and Orbit, the life and culture around them, drawn hollow. In the constellation, Orbit periods run as aurora ribbons through the practices they overlapped with.',
              },
              {
                name: 'Flexible date precision',
                description:
                  'Entries don\'t need an exact date. Log something as vague as "October - November 2021," attach a real date range for multi-day events, or skip the time of day entirely if you only remember the day. Locations can be just as partial: a country, a city, a specific place, or any mix.',
              },
              {
                name: 'Dynamic categories',
                description:
                  "Categories aren't fixed in advance. Add a new one the moment you pick up a new hobby, and it's woven into the visualizations right away. Rename or recolor any of them later from a curated palette, colors already in use, or a full custom picker.",
              },
              {
                name: 'Edit entries',
                description:
                  'Update any entry after the fact — correct a date, add a location, reclassify its category — or switch on Edit Mode to jump straight from any star, point, or arc into its editor.',
              },
              {
                name: 'Reflections',
                description:
                  'Add dated, backdatable follow-up notes to any entry — capture how you feel about it in hindsight, with its own mood, text, and media, while staying linked to the original. A reflection written ahead of the event is marked "Before."',
              },
              {
                name: 'Photos & video',
                description:
                  'Attach photos with captions and open them full-size in a lightbox. YouTube links play right in the sidebar, loading only once you press play.',
              },
              {
                name: 'Planned & skipped',
                description:
                  'Log something before it happens. Plans are drawn dashed, and the spiral carries on as a dotted line past today. Once the date passes, the entry asks "Did this happen?" — and the ones that didn\'t stay as skipped, a record of what I meant to do.',
              },
              {
                name: 'Connections',
                description:
                  'Entries that share a tag, place, or mood show up as related, and you can link two entries yourself with a note on why. Focusing an entry draws faint lines to its connections in the constellation and dims everything unrelated in the timeline and spiral.',
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
                name: 'Customizable sidebar',
                description:
                  'Resize the sidebar by dragging its edge, or flip it to either side of the screen. Several open entries sit in small bookmark tabs, with a full undo history.',
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
              'Connection lines in the timeline and spiral too, not just the constellation',
              'Suggested connections, and gentle prompts to revisit older entries',
              "Multi-category entries — a trip that involved both shuffle and pole, for example, maybe shown as a blend of each category's color",
              'Material artifacts — objects, songs, or videos tied to a practice or era rather than a single date',
              'Richer media: voice notes, photos in reflections, previews for more providers than YouTube, and real, mappable locations',
              'A list/table view for browsing entries outside the visualizations',
              'Accounts and cross-device sync, replacing export/import and getting past browser storage limits (which photos make matter more)',
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
