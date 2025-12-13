import client from "prom-client";
import { execSync } from "node:child_process";

const METRICS_ENABLED = (process.env.METRICS_ENABLED || "true").toLowerCase() === "true";
const METRICS_PREFIX = process.env.METRICS_PREFIX || "flowise_proxy_";
const METRICS_BUCKETS = process.env.METRICS_BUCKETS
  ? process.env.METRICS_BUCKETS.split(",").map((n) => Number(n)).filter((n) => !Number.isNaN(n))
  : [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const COST_PER_1K_TOKENS = (() => {
  const parsed = Number(process.env.COST_PER_1K_TOKENS_USD || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
})();
const CAPTURE_GPU_UTIL = (process.env.METRICS_CAPTURE_GPU || "false").toLowerCase() === "true";

const register = new client.Registry();
register.setDefaultLabels({ service: "flowise-proxy" });

if (METRICS_ENABLED) {
  client.collectDefaultMetrics({ register, prefix: METRICS_PREFIX });
}

const httpRequestDurationSeconds = new client.Histogram({
  name: `${METRICS_PREFIX}http_request_duration_seconds`,
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: METRICS_BUCKETS
});

const predictionDurationSeconds = new client.Histogram({
  name: `${METRICS_PREFIX}prediction_duration_seconds`,
  help: "End-to-end prediction latency in seconds",
  labelNames: ["flow_id", "status", "stream"],
  buckets: METRICS_BUCKETS
});

const predictionCpuSeconds = new client.Histogram({
  name: `${METRICS_PREFIX}prediction_cpu_seconds`,
  help: "CPU time consumed per prediction (user+system seconds)",
  labelNames: ["flow_id", "status", "stream"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

const predictionRequestsTotal = new client.Counter({
  name: `${METRICS_PREFIX}prediction_requests_total`,
  help: "Total prediction calls",
  labelNames: ["flow_id", "status", "stream"]
});

const predictionTokensTotal = new client.Counter({
  name: `${METRICS_PREFIX}prediction_tokens_total`,
  help: "Estimated tokens per prediction",
  labelNames: ["flow_id", "stream"]
});

const predictionCostUsdTotal = new client.Counter({
  name: `${METRICS_PREFIX}prediction_cost_usd_total`,
  help: "Estimated cost in USD per prediction",
  labelNames: ["flow_id", "stream"]
});

const predictionGpuUtilPercent = new client.Histogram({
  name: `${METRICS_PREFIX}prediction_gpu_util_percent`,
  help: "Sampled GPU utilization percent per prediction (if enabled)",
  labelNames: ["flow_id", "stream"],
  buckets: [0, 10, 25, 50, 75, 90, 100]
});

register.registerMetric(httpRequestDurationSeconds);
register.registerMetric(predictionDurationSeconds);
register.registerMetric(predictionCpuSeconds);
register.registerMetric(predictionRequestsTotal);
register.registerMetric(predictionTokensTotal);
register.registerMetric(predictionCostUsdTotal);
register.registerMetric(predictionGpuUtilPercent);

const approximateTokens = (text) => {
  if (!text) return 0;
  if (typeof text !== "string") return 0;
  // Rough heuristic: ~4 chars per token
  return Math.max(0, Math.ceil(text.length / 4));
};

export const sampleGpuUtilization = () => {
  if (!CAPTURE_GPU_UTIL) return undefined;
  try {
    const out = execSync(
      "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits",
      { encoding: "utf8", timeout: 500 }
    );
    const first = out.split("\n").map((l) => l.trim()).filter(Boolean)[0];
    const parsed = Number(first);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch (_err) {
    return undefined;
  }
};

export const metricsMiddleware = (req, res, next) => {
  if (!METRICS_ENABLED) return next();
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const diff = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDurationSeconds
      .labels(req.method, req.route?.path || req.originalUrl || "unknown", res.statusCode)
      .observe(diff);
  });
  next();
};

export const metricsHandler = async (_req, res) => {
  if (!METRICS_ENABLED) return res.status(503).send("metrics disabled");
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
};

export const observePredictionMetrics = ({
  flowId,
  status = "success",
  stream = false,
  durationSeconds,
  cpuSeconds,
  tokens,
  costUsd,
  gpuUtilPercent
}) => {
  if (!METRICS_ENABLED) return;
  const streamLabel = stream ? "true" : "false";
  predictionRequestsTotal.labels(flowId || "unknown", status, streamLabel).inc();
  if (typeof durationSeconds === "number" && durationSeconds >= 0) {
    predictionDurationSeconds.labels(flowId || "unknown", status, streamLabel).observe(durationSeconds);
  }
  if (typeof cpuSeconds === "number" && cpuSeconds >= 0) {
    predictionCpuSeconds.labels(flowId || "unknown", status, streamLabel).observe(cpuSeconds);
  }
  if (typeof tokens === "number" && tokens >= 0) {
    predictionTokensTotal.labels(flowId || "unknown", streamLabel).inc(tokens);
    if (COST_PER_1K_TOKENS > 0) {
      const estimatedCost = (tokens / 1000) * COST_PER_1K_TOKENS;
      predictionCostUsdTotal.labels(flowId || "unknown", streamLabel).inc(estimatedCost);
    }
  }
  if (typeof costUsd === "number" && costUsd >= 0) {
    predictionCostUsdTotal.labels(flowId || "unknown", streamLabel).inc(costUsd);
  }
  if (typeof gpuUtilPercent === "number" && gpuUtilPercent >= 0) {
    predictionGpuUtilPercent.labels(flowId || "unknown", streamLabel).observe(gpuUtilPercent);
  }
};

export const estimateTokens = (text) => approximateTokens(text);

export { register };
