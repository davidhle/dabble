export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Welcome to Dabble</h1>
      <p className="text-lg text-gray-600">
        A React TypeScript project powered by Vite, styled with Tailwind CSS,
        with D3.js for data visualization and React Router for navigation.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-indigo-600">Vite</h2>
          <p className="mt-2 text-gray-500">
            Lightning-fast build tool with hot module replacement.
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-indigo-600">
            Tailwind CSS
          </h2>
          <p className="mt-2 text-gray-500">
            Utility-first CSS framework for rapid UI development.
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-indigo-600">D3.js</h2>
          <p className="mt-2 text-gray-500">
            Powerful library for creating data visualizations.
          </p>
        </div>
      </div>
    </div>
  );
}
