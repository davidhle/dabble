/**
 * ResetToast.tsx - Escape-to-Reset Confirmation Toast
 *
 * A small floating notification shown while Constellation.tsx's
 * `resetPending` is true - see the ESCAPE KEY comment there for the
 * two-press confirmation pattern this is the visible half of. Purely
 * presentational: it mounts/unmounts based on `visible` alone, so it
 * disappears automatically the instant `resetPending` flips false,
 * whatever the cause (the pending timer expiring, an unrelated
 * interaction cancelling it, or the reset itself firing) - there's no
 * separate show/hide state to keep in sync here.
 */

interface ResetToastProps {
  visible: boolean;
}

export default function ResetToast({ visible }: ResetToastProps) {
  if (!visible) return null;

  return (
    // fixed bottom-center, pointer-events-none so it never blocks clicks
    // on the stars/panels beneath it. z-40: above StarMap (z-0), the
    // header (z-10), and the sidebar overlay (z-30) - see Constellation.tsx
    // - but below the AddEntryForm modal (z-50).
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-gray-900/90 px-4 py-2 text-sm text-gray-100 shadow-lg backdrop-blur">
        <span>Press</span>
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
          Esc
        </kbd>
        <span>again to reset the view</span>
      </div>
    </div>
  );
}
