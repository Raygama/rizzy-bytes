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

console.log("[CORS] Allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  })
);

app.use(express.json());
app.use(requestContext);
app.use(requestLogger);
app.use(metricsMiddleware);

app.use("/auth", authRoutes);
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/metrics", metricsHandler);


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
