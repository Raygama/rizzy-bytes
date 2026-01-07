import { NextResponse } from "next/server";

const PROM_BASE =
  process.env.PROMETHEUS_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_DIRECT_PROM_BASE ||
  "http://prometheus:9090";

const sanitizeNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const start = sanitizeNumber(searchParams.get("start"));
  const end = sanitizeNumber(searchParams.get("end"));
  const step = sanitizeNumber(searchParams.get("step"));

  if (!query || start === null || end === null || step === null) {
    return NextResponse.json(
      { error: "query, start, end, and step are required" },
      { status: 400 }
    );
  }

  const url = new URL("/api/v1/query_range", PROM_BASE);
  url.searchParams.set("query", query);
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));
  url.searchParams.set("step", String(step));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Failed to fetch Prometheus data", detail: text },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch Prometheus data" },
      { status: 502 }
    );
  }
}
