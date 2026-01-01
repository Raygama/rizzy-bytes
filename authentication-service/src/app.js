import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import { logEvent, requestContext, requestLogger } from "./utils/logger.js";
import { metricsMiddleware, metricsHandler } from "./metrics.js";

dotenv.config();
const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://helpdesk-if.space",
  "https://helpdesk-if.space",
];

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

const isSameHost = (origin, host) => {
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
};

const corsOptionsDelegate = (req, callback) => {
  const origin = req.header("Origin");
  const host = req.header("Host");

  const baseOptions = {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    optionsSuccessStatus: 204,
  };

  if (allowAllOrigins || !origin || allowedOrigins.includes(origin) || isSameHost(origin, host)) {
    return callback(null, { ...baseOptions, origin: true });
  }

  console.warn(`[CORS] Blocked request from origin: ${origin}`);
  return callback(null, { ...baseOptions, origin: false });
};

console.log("[CORS] Allowed origins:", allowedOrigins, "| allow same-host: true");

// Handle both requests and preflight. Without the OPTIONS handler the browser
// reports CORS failures for JSON POSTs to /auth/*.
app.use(cors(corsOptionsDelegate));
app.options(/.*/, cors(corsOptionsDelegate));

app.use(express.json());
app.use(requestContext);
app.use(requestLogger);
app.use(metricsMiddleware);

app.use("/auth", authRoutes);
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/metrics", metricsHandler);

// Unified JSON error handler (avoid default HTML responses)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Request error:", {
    path: req.originalUrl,
    method: req.method,
    status,
    message,
    stack: err.stack
  });
  const payload = { error: message };
  if (process.env.NODE_ENV === "development") payload.stack = err.stack;
  return res.status(status).json(payload);
});


mongoose
  .connect(process.env.MONGO_URI, { dbName: "helpdesk" })
  .then(() => {
    console.log("MongoDB connected");
    logEvent({
      level: "info",
      event: "db_connected",
      message: "MongoDB connected",
      requestId: "startup"
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    logEvent({
      level: "error",
      event: "db_connect_error",
      message: err.message,
      requestId: "startup",
      context: { stack: err.stack }
    });
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
  logEvent({
    level: "info",
    event: "service_started",
    message: `Auth service running on port ${PORT}`,
    requestId: "startup"
  });
});
