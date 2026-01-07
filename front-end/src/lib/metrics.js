// lib/prometheus.js
import { prometheusUrl } from "./apiConfig";

export async function queryRange({ query, start, end, step }) {
  const url = `/api/prometheus/query-range?query=${encodeURIComponent(
    query
  )}&start=${start}&end=${end}&step=${step}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch Prometheus data");

  return res.json();
}
