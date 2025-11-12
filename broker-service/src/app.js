import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { initAMQP, publish } from "./amqp.js";

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
app.options("*", cors(corsOptions));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

// health
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// publish endpoints
app.post("/publish/otp", async (req, res) => {
  try {
    await publish("mail.otp", req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/publish/log", async (req, res) => {
  try {
    await publish("log.event", req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
  } catch (e) {
    console.error("Failed to initialize AMQP:", e);
    process.exit(1);
  } 
});
