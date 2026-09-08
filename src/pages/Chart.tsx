import { useState } from 'react';
import D3Chart from '../components/D3Chart';

const initialData = [
  { label: 'Jan', value: 30 },
  { label: 'Feb', value: 45 },
  { label: 'Mar', value: 28 },
  { label: 'Apr', value: 60 },
  { label: 'May', value: 52 },
  { label: 'Jun', value: 75 },
];

export default function Chart() {
  const [data, setData] = useState(initialData);

  const randomizeData = () => {
    setData(
      data.map(d => ({
        ...d,
        value: Math.floor(Math.random() * 100) + 10,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[var(--text-color)]">
          D3.js Chart Demo
        </h1>
        <button
          onClick={randomizeData}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Randomize Data
        </button>
      </div>
      {/*
       * bg-[var(--panel-bg-color)] + border-[var(--panel-border-color)]:
       * same card surface token pair as Home.tsx's cards / EntryPanel.tsx
       * - see index.css :root. Both this chart card and the data-preview
       * card below reuse the one pair rather than each inventing its own
       * shade, same as they previously both leaned on plain bg-white/
       * bg-gray-100.
       */}
      <div className="rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] p-6 shadow-sm">
        <D3Chart data={data} width={600} height={350} />
      </div>
      <div className="rounded-lg border border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] p-4">
        <h3 className="font-medium text-[var(--text-color)]">Current Data:</h3>
        <pre className="mt-2 text-sm text-[var(--text-muted-color)]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
