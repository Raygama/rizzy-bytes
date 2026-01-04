import axios from "axios";

const OPENAI_USAGE_URL = "https://api.openai.com/v1/organization/usage/completions";

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const defaultWindows = () => {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), 10, 1, 0, 0, 0)); // Nov 1 current year
  if (start > end) {
    start.setUTCFullYear(start.getUTCFullYear() - 1);
  }
  const last30End = end;
  const last30Start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { total: { start, end }, last30: { start: last30Start, end: last30End } };
};

const fetchBuckets = async ({ apiKey, start, end }) => {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const params = {
    start_time: toUnixSeconds(start),
    end_time: toUnixSeconds(end)
  };
  let allBuckets = [];
  let nextPage = null;

  do {
    const resp = await axios.get(OPENAI_USAGE_URL, {
      headers,
      params: nextPage ? { ...params, page: nextPage } : params
    });
    const body = resp.data || {};
    const data = Array.isArray(body.data) ? body.data : [];
    allBuckets = allBuckets.concat(data);
    nextPage = body.has_more ? body.next_page : null;
  } while (nextPage);

  return allBuckets;
};

const summarizeBuckets = (buckets = []) => {
  const timeseries = [];
  let total = 0;

  buckets.forEach((bucket) => {
    const cost = Array.isArray(bucket.results)
      ? bucket.results.reduce((sum, r) => sum + (r?.cost || 0), 0)
      : 0;
    total += cost;
    const ts = bucket.end_time ? new Date(bucket.end_time * 1000).toISOString() : bucket.end_time_iso || null;
    timeseries.push({
      start: bucket.start_time_iso || bucket.start_time || null,
      end: bucket.end_time_iso || bucket.end_time || null,
      costUsd: cost,
      timestamp: ts
    });
  });

  timeseries.sort((a, b) => {
    if (a.timestamp && b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
    return 0;
  });

  return { totalUsd: total, timeseries };
};

export const computeOpenAiCosts = async ({ apiKey, totalWindow, last30Window } = {}) => {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  const defaults = defaultWindows();
  const tw = totalWindow || defaults.total;
  const l30 = last30Window || defaults.last30;

  const [totalBuckets, last30Buckets] = await Promise.all([
    fetchBuckets({ apiKey, start: tw.start, end: tw.end }),
    fetchBuckets({ apiKey, start: l30.start, end: l30.end })
  ]);

  const totalSummary = summarizeBuckets(totalBuckets);
  const last30Summary = summarizeBuckets(last30Buckets);

  return {
    total: {
      start: tw.start.toISOString(),
      end: tw.end.toISOString(),
      costUsd: totalSummary.totalUsd
    },
    last30Days: {
      start: l30.start.toISOString(),
      end: l30.end.toISOString(),
      costUsd: last30Summary.totalUsd
    },
    timeseries: last30Summary.timeseries
  };
};

