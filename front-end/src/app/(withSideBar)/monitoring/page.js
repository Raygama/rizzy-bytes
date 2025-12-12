"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function AnalyticsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("http://localhost:8080/monitoring");
      const json = await res.json();
      setData(json);
    }

    fetchData();

    // polling setiap 5 detik
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <p>Loading...</p>;

  // Convert array for charts
  const cpuData = data.cpu_over_time.map((v, i) => ({ time: i, value: v }));
  const gpuData = data.gpu_over_time.map((v, i) => ({ time: i, value: v }));

  const vramData = Object.entries(data.vram_breakdown).map(([key, value]) => ({
    name: key,
    value,
  }));

  const ramData = [
    { name: "Used", value: data.ram_breakdown.used },
    { name: "Cached", value: data.ram_breakdown.cached },
    { name: "Free", value: data.ram_breakdown.free },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* TOP METRICS CARD */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="CPU Utilization" value={data.cpu + "%"} />
        <MetricCard title="GPU Utilization" value={data.gpu + "%"} />
        <MetricCard title="RAM Usage" value={data.ram + "%"} />
        <MetricCard title="VRAM Usage" value={data.vram + "%"} />
      </div>

      {/* CPU Load Chart */}
      <div className="p-4 bg-white rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">CPU Load Over Time</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cpuData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="#e63946"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* VRAM Usage History */}
      <div className="p-4 bg-white rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">VRAM Usage History</h2>
        <BarChart width={600} height={250} data={vramData}>
          <XAxis dataKey="name" />
          <Bar dataKey="value" fill="#ff6b6b" />
        </BarChart>
      </div>

      {/* GPU Load Chart */}
      <div className="p-4 bg-white rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">GPU Core Usage</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={gpuData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="#e63946"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* RAM Breakdown */}
      <div className="p-4 bg-white rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">Memory RAM Breakdown</h2>
        <BarChart width={500} height={250} data={ramData}>
          <XAxis dataKey="name" />
          <Bar dataKey="value" fill="#f28482" />
        </BarChart>
      </div>
    </div>
  );
}

// Card Component
function MetricCard({ title, value }) {
  return (
    <div className="bg-white shadow p-4 rounded-xl">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
