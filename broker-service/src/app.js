import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { initAMQP, publish } from "./amqp.js";
import { logEvent, requestContext, requestLogger } from "./logger.js";
import { metricsMiddleware, metricsHandler, recordPublish } from "./metrics.js";
import crypto from "crypto";

dotenv.config();
const app = express();

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const parseOrigins = (value) =>
  value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const allowedOrigins = (() => {
  const parsed = parseOrigins(process.env.CORS_ORIGINS);
  if (!parsed.length) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  return parsed;
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
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Disposition"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(requestContext);
app.use(requestLogger);
app.use(metricsMiddleware);

const PORT = process.env.PORT || 3000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

// health
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// publish endpoints
app.post("/publish/otp", async (req, res) => {
  try {
    await publish("mail.otp", req.body);
    recordPublish("mail.otp");
    logEvent({
      level: "info",
      event: "otp_job_published",
      message: "OTP job published",
      requestId: req.requestId,
      correlationId: req.correlationId,
      context: { routingKey: "mail.otp" }
    });
    res.json({ ok: true });
  } catch (e) {
    logEvent({
      level: "error",
      event: "otp_publish_failed",
      message: e.message,
      requestId: req.requestId,
      correlationId: req.correlationId,
      context: { routingKey: "mail.otp" }
    });
    res.status(500).json({ error: e.message });
  }
});

app.post("/publish/log", async (req, res) => {
  try {
    await publish("log.event", req.body);
    recordPublish("log.event");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const ALLOWED_ROUTING_KEYS = new Set([
  "kb.ingest",
  "kb.reprocess",
  "kb.upsert",
  "kb.refresh",
  "llm.batch",
  "analytics.rollup"
]);

const createJobId = () => crypto.randomUUID();

app.post("/publish/job", async (req, res) => {
  try {
    const { routingKey, payload = {}, jobId } = req.body || {};
    if (!routingKey || !ALLOWED_ROUTING_KEYS.has(routingKey)) {
      return res.status(400).json({ error: "Invalid routingKey" });
    }

    const id = jobId || createJobId();
    const message = { ...payload, jobId: id, routingKey };

    await publish(routingKey, message);
    recordPublish(routingKey);

    logEvent({
      level: "info",
      event: "job_published",
      message: `Job published to ${routingKey}`,
      requestId: req.requestId,
      correlationId: req.correlationId,
      context: { routingKey, jobId: id }
    });

    res.status(202).json({ ok: true, jobId: id });
  } catch (e) {
    logEvent({
      level: "error",
      event: "job_publish_failed",
      message: e.message,
      requestId: req.requestId,
      correlationId: req.correlationId
    });
    res.status(500).json({ error: e.message });
  }
});

app.get("/metrics", metricsHandler);

const RETRY_DELAY_MS = parseInt(process.env.AMQP_RETRY_DELAY_MS, 10) || 5000;
const MAX_RETRIES = process.env.AMQP_MAX_RETRIES ? parseInt(process.env.AMQP_MAX_RETRIES, 10) : -1;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(url) {
  let attempt = 0;
  while (MAX_RETRIES < 0 || attempt < MAX_RETRIES) {
    attempt++;
    try {
      console.log(`AMQP: attempting connection (attempt ${attempt})`);
      await initAMQP(url);
      console.log("AMQP: connected");
      return;
    } catch (err) {
      console.error(`AMQP: connection failed (attempt ${attempt}): ${err.message}`);
      console.log(`AMQP: retrying in ${RETRY_DELAY_MS}ms`);
      await wait(RETRY_DELAY_MS);
    }
  }
  throw new Error("AMQP: exceeded max retries");
}

// startup
app.listen(PORT, async () => {
  try {
    await connectWithRetry(RABBITMQ_URL);
    console.log(`Broker service listening on ${PORT}`);
    logEvent({
      level: "info",
      event: "service_started",
      message: `Broker service listening on ${PORT}`,
      requestId: "startup"
    });
  } catch (e) {
    console.error("Failed to initialize AMQP:", e);
    process.exit(1);
  } 
});
