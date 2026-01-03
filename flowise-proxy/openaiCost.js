import axios from "axios";

const OPENAI_BILLING_URL = "https://api.openai.com/v1/usage";

const isoDate = (d) => d.toISOString().split("T")[0];

const defaultWindow = () => {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), 10, 1, 0, 0, 0)); // Nov 1 of current year
  if (start > end) {
    start.setUTCFullYear(start.getUTCFullYear() - 1);
  }
  return { start, end };
};

export const fetchOpenAiUsage = async ({ apiKey, start, end }) => {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  const startDate = isoDate(start);
  const endDate = isoDate(end);
  const url = `${OPENAI_BILLING_URL}?start_date=${startDate}&end_date=${endDate}`;
  const resp = await axios.get(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  return resp.data;
};

export const summarizeCosts = (usageData) => {
  // OpenAI usage response includes daily array with "line_items" -> "cost"
  const timeseries = [];
  let totalUsd = 0;

  if (Array.isArray(usageData?.data)) {
    usageData.data.forEach((item) => {
      const date = item?.aggregation_timestamp
        ? new Date(item.aggregation_timestamp * 1000).toISOString().split("T")[0]
        : item?.snapshot_time || null;
      const cost = item?.cost || item?.line_items?.reduce((sum, li) => sum + (li.cost || 0), 0) || 0;
      totalUsd += cost;
      if (date) {
        timeseries.push({ date, costUsd: cost });
      }
    });
  }

  timeseries.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { totalUsd, timeseries };
};

export const computeOpenAiCosts = async ({ apiKey, totalWindow, last30Window }) => {
  const { start: totalStart, end: totalEnd } = totalWindow || defaultWindow();
  const last30End = last30Window?.end || new Date();
  const last30Start =
    last30Window?.start ||
    new Date(last30End.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsage, last30Usage] = await Promise.all([
    fetchOpenAiUsage({ apiKey, start: totalStart, end: totalEnd }),
    fetchOpenAiUsage({ apiKey, start: last30Start, end: last30End })
  ]);

  const totalSummary = summarizeCosts(totalUsage);
  const last30Summary = summarizeCosts(last30Usage);

  return {
    total: {
      start: isoDate(totalStart),
      end: isoDate(totalEnd),
      costUsd: totalSummary.totalUsd
    },
    last30Days: {
      start: isoDate(last30Start),
      end: isoDate(last30End),
      costUsd: last30Summary.totalUsd
    },
    timeseries: last30Summary.timeseries
  };
};

