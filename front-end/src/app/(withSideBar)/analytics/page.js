"use client";

import { useEffect, useState } from "react";
import { queryRange } from "@/lib/metrics";
import { transformRangeToChart } from "@/lib/transform";
import { CpuChart } from "@/components/chart";

export default function MonitoringPage() {
  const [cpuData, setCpuData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCpu = async () => {
    try {
      setLoading(true);
      setError(null);

      const end = Math.floor(Date.now() / 1000);
      const start = end - 15 * 60; // last 15 minutes

      const query =
        '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)';

      const raw = await queryRange({
        query,
        start,
        end,
        step: 30,
      });

      setCpuData(transformRangeToChart(raw));
    } catch (err) {
      setError("Failed to fetch CPU data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sekali saat page dibuka
  useEffect(() => {
    fetchCpu();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">System Monitoring</h1>
          <p className="text-sm text-gray-600">
            Data updates only when refreshed
          </p>
        </div>

        <button
          onClick={fetchCpu}
          disabled={loading}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white p-4">
          <h2 className="mb-2 text-sm font-medium">CPU Average (%)</h2>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {!error && cpuData.length === 0 && (
            <p className="text-sm text-gray-500">No data</p>
          )}

          {cpuData.length > 0 && <CpuChart data={cpuData} />}
        </div>
      </div>
    </div>
  );
}
