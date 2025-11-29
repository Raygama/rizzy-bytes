import { randomUUID } from "crypto";

const SERVICE_NAME = process.env.SERVICE_NAME || "broker-service";
const LOG_ENDPOINT =
  process.env.LOG_ENDPOINT ||
  `${process.env.BROKER_URL || "http://broker-service:3000"}/publish/log`;

const ALLOWED_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"];
const SAMPLE_RATE = (() => {
  const parsed = Number(process.env.LOG_SAMPLE_RATE ?? 1);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(Math.max(parsed, 0), 1);
})();

const SENSITIVE_KEYS = ["password", "token", "authorization", "secret", "cookie"];

const cleanPayload = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => cleanPayload(item));
  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      if (SENSITIVE_KEYS.some((sKey) => key.toLowerCase().includes(sKey))) {
        return acc;
      }
      acc[key] = cleanPayload(val);
      return acc;
    }, {});
  }
  if (typeof value === "string" && value.length > 1024) {
    return `${value.slice(0, 1024)}...[truncated]`;
  }
  return value;
};

const shouldSample = (level) => {
  if (level === "fatal" || level === "error" || level === "warn") return true;
  return Math.random() < SAMPLE_RATE;
};

const normalizeLevel = (level = "info") => {
  const lowered = level.toLowerCase();
  if (ALLOWED_LEVELS.includes(lowered)) return lowered;
  return "info";
};

const emitLog = async (payload) => {
  if (!LOG_ENDPOINT) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": payload.requestId },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (err) {
    console.warn(`[${SERVICE_NAME}] log dispatch failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
};

export const logEvent = async ({
  level = "info",
  event,
  message,
  requestId,
  correlationId,
  resource,
  statusCode,
  durationMs,
  tags,
  context = {}
}) => {
  const normalizedLevel = normalizeLevel(level);
  if (!event && !message) return;
  if (!shouldSample(normalizedLevel)) return;

  const payload = {
    level: normalizedLevel,
    event: event || message,
    message: message || event,
    service: SERVICE_NAME,
    requestId,
    correlationId,
    resource,
    statusCode,
    durationMs,
    tags,
    context: cleanPayload(context)
  };

  await emitLog(payload);
};

export const requestContext = (req, _res, next) => {
  req.requestId = req.headers["x-request-id"] || randomUUID();
  req.correlationId = req.headers["x-correlation-id"] || req.requestId;
  next();
};

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.originalUrl?.startsWith("/publish/log")) return; // avoid logging the logging endpoint to prevent loops
    if (req.originalUrl === "/health") return;
    logEvent({
      level: "info",
      event: "http_request",
      message: `${req.method} ${req.originalUrl}`,
      requestId: req.requestId,
      correlationId: req.correlationId,
      resource: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      context: {
        method: req.method,
        path: req.originalUrl,
        ip:
          req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
          req.socket.remoteAddress ||
          undefined
      }
    });
  });
  next();
};
