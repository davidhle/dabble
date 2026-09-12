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

/** Shared bullet-list styling for both the Current/Future Features lists below - lifted out so the two can't drift apart in appearance. */
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
          <FeatureList
            items={[
              'Linear visualization',
              'Spiral visualization',
              'Constellation visualization',
              'Time range brush selector',
            ]}
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-color)]">
            Future Features
          </h2>
          <FeatureList
            items={[
              'Edit event data',
              'Visualizing connections between events (e.g., locations, feelings, life events)',
              'Custom positioning of the points in the constellation view',
              'Media attachments (photos, voice notes, ...)',
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
