// lib/prometheus.js
const PROMETHEUS_BASE_URL = (
  process.env.NEXT_PUBLIC_PROMETHEUS_URL || "/prometheus/api/v1"
).replace(/\/$/, "");

export async function queryRange({ query, start, end, step }) {
  const url = `${PROMETHEUS_BASE_URL}/query_range?query=${encodeURIComponent(
    query
  )}&start=${start}&end=${end}&step=${step}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch Prometheus data");

  return res.json();
}
