// bg-[var(--panel-bg-color)] + border-[var(--panel-border-color)]: the
// same "card" surface token pair EntryPanel.tsx uses for its entry cards
// (see index.css :root) - a subtle lift off the page's --bg-color rather
// than a plain white card, reused here instead of introducing a
// second/different card token. text-indigo-400 (not the previous
// indigo-600) on each card heading: indigo-600 was tuned for contrast
// against a white card - against this dark card surface it reads muddy,
// so it's lightened a shade, same idea as Layout.tsx's nav links moving
// from gray-500/700 to gray-400/200.
const CARD_CLASSES =
  'rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] p-6 shadow-sm';

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-color)]">
        Welcome to Dabble
      </h1>
      <p className="text-lg text-[var(--text-muted-color)]">
        A React TypeScript project powered by Vite, styled with Tailwind CSS,
        with D3.js for data visualization and React Router for navigation.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        <div className={CARD_CLASSES}>
          <h2 className="text-xl font-semibold text-indigo-400">Vite</h2>
          <p className="mt-2 text-[var(--text-muted-color)]">
            Lightning-fast build tool with hot module replacement.
          </p>
        </div>
        <div className={CARD_CLASSES}>
          <h2 className="text-xl font-semibold text-indigo-400">
            Tailwind CSS
          </h2>
          <p className="mt-2 text-[var(--text-muted-color)]">
            Utility-first CSS framework for rapid UI development.
          </p>
        </div>
        <div className={CARD_CLASSES}>
          <h2 className="text-xl font-semibold text-indigo-400">D3.js</h2>
          <p className="mt-2 text-[var(--text-muted-color)]">
            Powerful library for creating data visualizations.
          </p>
        </div>
      </div>
    </div>
  );
}
