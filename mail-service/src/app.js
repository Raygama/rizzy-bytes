import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from "nodemailer";
import { logEvent, maskEmail, requestContext, requestLogger } from "./logger.js";
import { metricsMiddleware, metricsHandler, recordSend } from "./metrics.js";

dotenv.config();
const app = express();

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const lowered = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y"].includes(lowered);
};

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
const SMTP_HOST = process.env.SMTP_HOST || "mailhog";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "1025", 10);
const SMTP_FROM = process.env.SMTP_FROM || "no-reply@helpdesk.local";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_SECURE = parseBoolean(process.env.SMTP_SECURE, false);
const SMTP_REQUIRE_TLS = parseBoolean(process.env.SMTP_REQUIRE_TLS, false);
const SMTP_TLS_REJECT_UNAUTHORIZED = parseBoolean(
  process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
  true
);

const transporterOptions = {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: SMTP_REQUIRE_TLS,
  tls: { rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED }
};

if (SMTP_USER && SMTP_PASS) {
  transporterOptions.auth = { user: SMTP_USER, pass: SMTP_PASS };
}

// Mail transporter (MailHog in dev, Gmail/other SMTP in prod)
const transporter = nodemailer.createTransport(transporterOptions);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

transporter
  .verify()
  .then(() => {
    logEvent({
      level: "info",
      event: "smtp_verified",
      message: "SMTP transporter ready",
      requestId: "startup",
      context: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        requireTLS: SMTP_REQUIRE_TLS,
        authEnabled: Boolean(transporterOptions.auth),
        tlsRejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED
      }
    });
  })
  .catch((err) => {
    logEvent({
      level: "error",
      event: "smtp_verify_failed",
      message: err.message,
      requestId: "startup",
      context: { host: SMTP_HOST, port: SMTP_PORT }
    });
  });

app.post("/send", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    res.json({ sent: true });
    recordSend("success");
    logEvent({
      level: "info",
      event: "mail_sent",
      message: "Email dispatched",
      requestId: req.requestId,
      correlationId: req.correlationId,
      context: { to: maskEmail(to), subject }
    });
  } catch (e) {
    recordSend("failure");
    logEvent({
      level: "error",
      event: "mail_send_failed",
      message: e.message,
      requestId: req.requestId,
      correlationId: req.correlationId,
      context: { to: maskEmail(req.body?.to), subject: req.body?.subject }
    });
    res.status(500).json({ error: e.message });
  }
});

app.get("/metrics", metricsHandler);

app.listen(PORT, () => {
  console.log(`Mail service listening on ${PORT}`);
  logEvent({
    level: "info",
    event: "service_started",
    message: `Mail service listening on ${PORT}`,
    requestId: "startup"
  });
});
