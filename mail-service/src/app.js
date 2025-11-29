import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from "nodemailer";
import { logEvent, maskEmail, requestContext, requestLogger } from "./logger.js";

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

const PORT = process.env.PORT || 3000;
const SMTP_HOST = process.env.SMTP_HOST || "mailhog";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "1025", 10);
const SMTP_FROM = process.env.SMTP_FROM || "no-reply@helpdesk.local";

// Mail transporter (MailHog in dev)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/send", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    res.json({ sent: true });
    logEvent({
      level: "info",
      event: "mail_sent",
      message: "Email dispatched",
      requestId: req.requestId,
      correlationId: req.correlationId,
      context: { to: maskEmail(to), subject }
    });
  } catch (e) {
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

app.listen(PORT, () => {
  console.log(`Mail service listening on ${PORT}`);
  logEvent({
    level: "info",
    event: "service_started",
    message: `Mail service listening on ${PORT}`,
    requestId: "startup"
  });
});
