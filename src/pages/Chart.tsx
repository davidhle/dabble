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
        <h1 className="text-3xl font-bold text-gray-900">D3.js Chart Demo</h1>
        <button
          onClick={randomizeData}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Randomize Data
        </button>
      </div>
      <div className="rounded-lg bg-white p-6 shadow">
        <D3Chart data={data} width={600} height={350} />
      </div>
      <div className="rounded-lg bg-gray-100 p-4">
        <h3 className="font-medium text-gray-700">Current Data:</h3>
        <pre className="mt-2 text-sm text-gray-600">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
