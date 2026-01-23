export default function About() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">About This Project</h1>
      <div className="prose max-w-none">
        <p className="text-lg text-gray-600">
          This project demonstrates a modern React application setup with
          TypeScript, featuring data visualization capabilities and a clean,
          maintainable architecture.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-gray-800">
          Tech Stack
        </h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li className="flex items-center">
            <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></span>
            React 18 with TypeScript
          </li>
          <li className="flex items-center">
            <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></span>
            Vite for fast development and building
          </li>
          <li className="flex items-center">
            <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></span>
            Tailwind CSS for styling
          </li>
          <li className="flex items-center">
            <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></span>
            D3.js for data visualizations
          </li>
          <li className="flex items-center">
            <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></span>
            React Router for navigation
          </li>
          <li className="flex items-center">
            <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></span>
            ESLint + Prettier for code quality
          </li>
        </ul>
      </div>
    </div>
  );
}
