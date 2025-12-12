import http from "http";
import client from "prom-client";

const METRICS_ENABLED = (process.env.METRICS_ENABLED || "true").toLowerCase() === "true";
const METRICS_PORT = parseInt(process.env.METRICS_PORT || "9464", 10);
const METRICS_PREFIX = process.env.METRICS_PREFIX || "listener_";
const METRICS_BUCKETS = process.env.METRICS_BUCKETS
  ? process.env.METRICS_BUCKETS.split(",").map((n) => Number(n)).filter((n) => !Number.isNaN(n))
  : [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const register = new client.Registry();
register.setDefaultLabels({ service: "listener-service" });

if (METRICS_ENABLED) {
  client.collectDefaultMetrics({ register, prefix: METRICS_PREFIX });
}

const jobDuration = new client.Histogram({
  name: `${METRICS_PREFIX}job_duration_seconds`,
  help: "Duration to process a message",
  labelNames: ["queue", "type", "status"],
  buckets: METRICS_BUCKETS
});

const jobsTotal = new client.Counter({
  name: `${METRICS_PREFIX}jobs_total`,
  help: "Total jobs processed",
  labelNames: ["queue", "type", "status"]
});

register.registerMetric(jobDuration);
register.registerMetric(jobsTotal);

export const trackJob = (queue, type, status, durationSeconds) => {
  if (!METRICS_ENABLED) return;
  jobsTotal.labels(queue || "unknown", type || "unknown", status).inc();
  if (typeof durationSeconds === "number") {
    jobDuration.labels(queue || "unknown", type || "unknown", status).observe(durationSeconds);
  }
};

export const startMetricsServer = () => {
  if (!METRICS_ENABLED) return null;
  const server = http.createServer(async (_req, res) => {
    if (_req.url !== "/metrics") {
      res.statusCode = 404;
      return res.end("not found");
    }
    res.setHeader("Content-Type", register.contentType);
    res.end(await register.metrics());
  });
  server.listen(METRICS_PORT, () => {
    console.log(`[metrics] listener-service metrics on ${METRICS_PORT}`);
  });
  return server;
};

export { register };
