// lib/transform.js

export function transformRangeToChart(result) {
  if (!result?.data?.result?.[0]?.values) return [];

  return result.data.result[0].values.map(([ts, value]) => ({
    time: new Date(ts * 1000).toLocaleTimeString(),
    value: Number(value),
  }));
}
