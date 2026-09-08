/**
 * ResetButton.tsx - Explicit, No-Confirmation Full Reset
 *
 * A persistent circular icon button, fixed bottom-right, that fires
 * Constellation.tsx's full reset (its `resetAll` function) immediately
 * on click - no confirmation step, unlike the Escape key shortcut's
 * two-press pattern (see the ESCAPE KEY comment in Constellation.tsx).
 * That asymmetry is deliberate, not an inconsistency: Escape can be hit
 * reflexively with no visual target, which is exactly why it needs a
 * safeguard against an accidental press - but clicking a clearly
 * labeled, deliberately positioned button on screen already IS the
 * deliberate action. A second confirmation on top of that would just be
 * friction, not safety.
 *
 * Purely presentational/controlled, like ResetToast.tsx alongside it -
 * `resetPending` state, the Escape listener, and `resetAll` itself all
 * still live in Constellation.tsx.
 */

interface ResetButtonProps {
  onClick: () => void;
}

export default function ResetButton({ onClick }: ResetButtonProps) {
  return (
    <button
      onClick={onClick}
      // fixed bottom-right, deliberately far from <ResetToast>'s
      // bottom-center position (see Constellation.tsx) so the two never
      // overlap. z-40: same layer as ResetToast - above StarMap (z-0),
      // the header (z-10), and the sidebar overlay (z-30), below the
      // AddEntryForm modal (z-50).
      className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-gray-900/90 text-gray-100 shadow-lg backdrop-blur transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      aria-label="Reset view"
      title="Reset view"
    >
      {/* Refresh/reset icon - two curved arrows forming a circle. */}
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
    </button>
  );
}
