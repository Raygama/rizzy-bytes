import client from "prom-client";

const METRICS_ENABLED = (process.env.METRICS_ENABLED || "true").toLowerCase() === "true";
const METRICS_PREFIX = process.env.METRICS_PREFIX || "broker_";
const METRICS_BUCKETS = process.env.METRICS_BUCKETS
  ? process.env.METRICS_BUCKETS.split(",").map((n) => Number(n)).filter((n) => !Number.isNaN(n))
  : [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const register = new client.Registry();
register.setDefaultLabels({ service: "broker-service" });

if (METRICS_ENABLED) {
  client.collectDefaultMetrics({ register, prefix: METRICS_PREFIX });
}

const httpRequestDurationSeconds = new client.Histogram({
  name: `${METRICS_PREFIX}http_request_duration_seconds`,
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: METRICS_BUCKETS
});

const rabbitPublishCounter = new client.Counter({
  name: `${METRICS_PREFIX}rabbit_published_total`,
  help: "Total messages published to RabbitMQ",
  labelNames: ["routing_key"]
});

register.registerMetric(httpRequestDurationSeconds);
register.registerMetric(rabbitPublishCounter);

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

export const recordPublish = (routingKey) => {
  if (!METRICS_ENABLED) return;
  rabbitPublishCounter.labels(routingKey || "unknown").inc();
};

export const metricsHandler = async (_req, res) => {
  if (!METRICS_ENABLED) return res.status(503).send("metrics disabled");
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
};

export { register };
