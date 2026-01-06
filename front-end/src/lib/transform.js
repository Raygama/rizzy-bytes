// lib/transform.js

export function transformRangeToChart(result) {
  if (!result?.data?.result?.[0]?.values) return [];

  return result.data.result[0].values.map(([ts, value]) => ({
    time: new Date(ts * 1000).toLocaleTimeString(),
    value: Number(value),
  }));
}

export function getLatestValue(data) {
  if (!data || data.length === 0) return 0;
  return data[data.length - 1].value;
}

export function transformCostTimeseries(timeseries = []) {
  return timeseries.map((item) => ({
    time: new Date(item.timestamp).toLocaleDateString(),
    value: Number(item.costUsd),
  }));
}
