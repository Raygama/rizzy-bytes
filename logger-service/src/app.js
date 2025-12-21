import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import readline from "readline";
import path from "path";
import {
  ingestLog,
  logger,
  sanitizePayload,
  shouldSample,
  LOG_DIR,
  LOG_FILE_PREFIX
} from "./logger.js";
import { startLogConsumer } from "./amqp.js";
import { requireAuth, requireRole } from "./auth.js";
import { fetchLogs as fetchLogsFromDb } from "./mongo.js";
import { metricsMiddleware, metricsHandler } from "./metrics.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const parseOrigins = (value) =>
  value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const allowedOrigins = (() => {
  const parsed = parseOrigins(process.env.CORS_ORIGINS);
  return parsed.length ? parsed : DEFAULT_ALLOWED_ORIGINS;
})();

const allowAllOrigins = allowedOrigins.includes("*");

const corsOptions = {
  origin: allowAllOrigins
    ? true
    : (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Request-Id"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "256kb" }));
app.use(metricsMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.originalUrl === "/logs" || req.originalUrl === "/health") return;
    if (!shouldSample("info")) return;
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      undefined;
    logger.info(
      {
        event: "http_request",
        message: `${req.method} ${req.originalUrl}`,
        resource: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        ip,
        context: {
          method: req.method,
          path: req.originalUrl
        }
      },
      `${req.method} ${req.originalUrl}`
    );
  });
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/metrics", metricsHandler);

app.post("/logs", (req, res) => {
  const {
    level = "info",
    event,
    message,
    context = {},
    service,
    correlationId,
    requestId,
    userId,
    resource,
    statusCode,
    durationMs,
    tags
  } = req.body || {};

  if (!event && !message) {
    return res.status(400).json({ error: "event or message is required" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress ||
    undefined;

  const sanitized = sanitizePayload(context);
  const result = ingestLog(
    {
      level,
      event,
      message,
      context: sanitized,
      service,
      correlationId,
      requestId: requestId || req.headers["x-request-id"],
      userId,
      resource,
      statusCode,
      durationMs,
      tags,
      ip,
      source: "http"
    },
    { source: "http" }
  );

  res.status(202).json({ received: true, sampled: !result.skipped });
});

const parseLimit = (val, fallback) => {
  const parsed = parseInt(val, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 1000);
};

const readLogs = async ({ date, limit, service, level, event, q }) => {
  const fileDate = date || new Date().toISOString().slice(0, 10);
  const filePath = path.join(LOG_DIR, `${LOG_FILE_PREFIX}-${fileDate}.log`);
  if (!fs.existsSync(filePath)) return [];

  const lines = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (service && parsed.service !== service) continue;
      if (level && parsed.level !== level) continue;
      if (event && parsed.event !== event) continue;
      if (q && !`${parsed.message ?? ""} ${JSON.stringify(parsed.context ?? {})}`.includes(q)) continue;
      lines.push(parsed);
      if (lines.length > limit) {
        lines.shift(); // keep last N
      }
    } catch (err) {
      continue;
    }
  }
  return lines;
};

app.get("/logs", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 200);
    const dbLogs = await fetchLogsFromDb({
      date: req.query.date,
      limit,
      service: req.query.service,
      level: req.query.level,
      event: req.query.event,
      q: req.query.q
    });

    const logs =
      Array.isArray(dbLogs) && dbLogs.length
        ? dbLogs
        : await readLogs({
            date: req.query.date,
            limit,
            service: req.query.service,
            level: req.query.level,
            event: req.query.event,
            q: req.query.q
          });
    res.json({ logs, count: logs.length });
  } catch (err) {
    logger.error({ event: "logs_fetch_failed", error: err.message }, "Failed to fetch logs");
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

const toCsvValue = (val) => {
  if (val === undefined || val === null) return "";
  const str = typeof val === "string" ? val : JSON.stringify(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

const formatLogsCsv = (logs = []) => {
  const header = [
    "time",
    "level",
    "service",
    "event",
    "message",
    "resource",
    "statusCode",
    "durationMs",
    "requestId",
    "correlationId",
    "userId",
    "tags",
    "ip",
    "context"
  ];

  const rows = logs.map((log) =>
    [
      log.createdAt || log.time || "",
      log.level,
      log.service,
      log.event,
      log.message,
      log.resource,
      log.statusCode,
      log.durationMs,
      log.requestId,
      log.correlationId,
      log.userId,
      Array.isArray(log.tags) ? log.tags.join("|") : log.tags,
      log.ip,
      log.context
    ]
      .map(toCsvValue)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
};

app.get("/logs/export", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 500);
    const dbLogs = await fetchLogsFromDb({
      date: req.query.date,
      limit,
      service: req.query.service,
      level: req.query.level,
      event: req.query.event,
      q: req.query.q
    });

    const logs =
      Array.isArray(dbLogs) && dbLogs.length
        ? dbLogs
        : await readLogs({
            date: req.query.date,
            limit,
            service: req.query.service,
            level: req.query.level,
            event: req.query.event,
            q: req.query.q
          });

    const csv = formatLogsCsv(logs);
    const filename = `logs-${req.query.date || new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    logger.error({ event: "logs_export_failed", error: err.message }, "Failed to export logs");
    res.status(500).json({ error: "Failed to export logs" });
  }
});

async function bootstrap() {
  const server = app.listen(PORT, () =>
    logger.info({ event: "server_started", port: PORT }, "Logger service up")
  );

  try {
    await startLogConsumer(RABBITMQ_URL);
  } catch (err) {
    logger.error({ event: "amqp_init_failed", error: err.message }, "Failed to start AMQP consumer");
    process.exit(1);
  }

  return server;
}

if (process.env.NODE_ENV !== "test") {
  bootstrap();
}

export { app, bootstrap, readLogs };
