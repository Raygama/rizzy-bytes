import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";

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

app.use("/auth", authRoutes);
app.get("/health", (req, res) => res.json({ status: "ok" }));


mongoose
  .connect(process.env.MONGO_URI, { dbName: "helpdesk" })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Auth service running on port ${PORT}`));
