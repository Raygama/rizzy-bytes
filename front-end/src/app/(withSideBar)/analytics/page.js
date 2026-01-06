"use client";

import { useEffect, useState } from "react";
import { queryRange } from "@/lib/metrics";
import { transformRangeToChart } from "@/lib/transform";
import { getLatestValue } from "@/lib/transform";
import { MetricChart } from "@/components/chart";
import { MemoryBarChart } from "@/components/MemoryBarChart";
import { CostChart } from "@/components/CostChart";
import { transformCostTimeseries } from "@/lib/transform";

import { redirect } from "next/navigation";
import { jwtDecode } from "jwt-decode";

export default function MonitoringPage() {
  const [cpuData, setCpuData] = useState([]);
  const [ramData, setRamData] = useState([]);
  const [gpuData, setGpuData] = useState([]);
  const [ramCachedData, setRamCachedData] = useState([]);
  const [ramBufferData, setRamBufferData] = useState([]);
  const [costData, setCostData] = useState([]);
  const [costSummary, setCostSummary] = useState({
    total: 0,
    last30Days: 0,
  });

  const [loading, setLoading] = useState(false);

  const fetchAllMetrics = async () => {
    const COST_API = "https://localhost:4000/api/admin/openai/costs";

    try {
      setLoading(true);

      const end = Math.floor(Date.now() / 1000);
      const start = end - 15 * 60;

      const cpuQuery =
        '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)';

      const ramQuery =
        "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes";

      const gpuQuery =
        "(nvidia_smi_utilization_gpu_ratio * on (uuid) group_left(name) nvidia_smi_gpu_info)";

      const ramCachedQuery = "node_memory_Cached_bytes";

      const ramBuffersQuery = "node_memory_Buffers_bytes";

      const [cpuRaw, ramRaw, gpuRaw, ramCachedRaw, ramBufferRaw] =
        await Promise.all([
          queryRange({ query: cpuQuery, start, end, step: 30 }),
          queryRange({ query: ramQuery, start, end, step: 30 }),
          queryRange({ query: gpuQuery, start, end, step: 30 }),
          queryRange({ query: ramCachedQuery, start, end, step: 30 }),
          queryRange({ query: ramBuffersQuery, start, end, step: 30 }),
        ]);

      setCpuData(transformRangeToChart(cpuRaw));

      setRamData(
        transformRangeToChart(ramRaw).map((d) => ({
          ...d,
          value: d.value / 1024 / 1024 / 1024,
        }))
      );

      setGpuData(
        transformRangeToChart(gpuRaw).map((d) => ({
          ...d,
          value: d.value * 100,
        }))
      );

      setRamCachedData(
        transformRangeToChart(ramCachedRaw).map((d) => ({
          ...d,
          value: d.value / 1024 / 1024 / 1024,
        }))
      );

      setRamBufferData(
        transformRangeToChart(ramBufferRaw).map((d) => ({
          ...d,
          value: d.value / 1024 / 1024 / 1024,
        }))
      );

      const costRes = await fetch(COST_API);
      const costJson = await costRes.json();

      setCostSummary({
        total: costJson.total.costUsd,
        last30Days: costJson.last30Days.costUsd,
      });

      setCostData(transformCostTimeseries(costJson.timeseries));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMetrics();
  }, []);

  const cpuValue = getLatestValue(cpuData);
  const ramValue = getLatestValue(ramData);
  const gpuValue = getLatestValue(gpuData);
  const ramCachedValue = getLatestValue(ramCachedData);
  const ramBufferValue = getLatestValue(ramBufferData);
  const ramUsed = ramValue;
  const ramCached = ramCachedValue;
  const ramBuffer = ramBufferValue;

  const statusBadge = (value) => (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        value > 80
          ? "bg-orange-100 text-orange-600"
          : "bg-green-100 text-green-600"
      }`}
    >
      {value > 80 ? "Warning" : "Normal"}
    </span>
  );

  const token = localStorage.getItem("token");
  if (jwtDecode(token)?.role.toLowerCase() !== "admin") redirect("/chat");

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
          onClick={fetchAllMetrics}
          disabled={loading}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* CPU */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-gray-500">CPU LOAD</p>
            {statusBadge(cpuValue)}
          </div>
          <p className="text-2xl font-semibold">{Math.round(cpuValue)}%</p>
          <MetricChart data={cpuData} color="#22c55e" unit="percent" />
        </div>

        {/* GPU */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-gray-500">GPU LOAD</p>
            {statusBadge(gpuValue)}
          </div>
          <p className="text-2xl font-semibold">{Math.round(gpuValue)}%</p>
          <MetricChart data={gpuData} color="#f97316" unit="percent" />
        </div>

        {/* RAM */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-gray-500">RAM USAGE</p>
            {statusBadge((ramUsed / 16) * 100)}
          </div>
          <p className="text-2xl font-semibold">
            {ramUsed.toFixed(1)} <span className="text-sm">GiB</span>
          </p>
          <MetricChart data={ramData} color="#3b82f6" unit="gib" />
        </div>

        {/* RAM Breakdown */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">MEMORY BREAKDOWN</p>
          </div>

          <MemoryBarChart
            used={ramUsed}
            cached={ramCached}
            buffer={ramBuffer}
          />
        </div>

        {/* cost metric */}
        {/* COST METRIC */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-gray-500">COST</p>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600">
              USD
            </span>
          </div>

          <p className="text-2xl font-semibold">
            ${costSummary.last30Days.toFixed(2)}
          </p>

          <p className="mb-2 text-xs text-gray-500">
            Last 30 days • Total ${costSummary.total.toFixed(2)}
          </p>

          <CostChart data={costData} />
        </div>
      </div>
    </div>
  );
}
