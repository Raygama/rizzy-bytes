import fs from "fs";
import path from "path";
import os from "os";
import { Writable } from "stream";
import pino from "pino";
import pinoPretty from "pino-pretty";

const SERVICE_NAME = process.env.SERVICE_NAME || "logger-service";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const LOG_DIR = process.env.LOG_DIR || "logs";
export const LOG_FILE_PREFIX = process.env.LOG_FILE_PREFIX || "logger";
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || "14", 10);
const LOG_SAMPLE_RATE = (() => {
  const parsed = Number(process.env.LOG_SAMPLE_RATE ?? 1);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(Math.max(parsed, 0), 1);
})();

const SENSITIVE_KEYS = [
  "password",
  "token",
  "otp",
  "authorization",
  "cookie",
  "secret",
  "apiKey",
  "refreshToken",
  "accessToken",
  "set-cookie"
];

const ensureLogDir = () => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
};

class RotatingFileStream extends Writable {
  constructor(dir, prefix) {
    super({ decodeStrings: false });
    this.dir = dir;
    this.prefix = prefix;
    this.currentDate = "";
    this.stream = null;
    ensureLogDir();
    this.rotateIfNeeded();
  }

  rotateIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (today === this.currentDate && this.stream) return;

    this.currentDate = today;
    if (this.stream) {
      this.stream.end();
    }
    const dest = path.join(this.dir, `${this.prefix}-${today}.log`);
    this.stream = fs.createWriteStream(dest, { flags: "a" });
  }

  _write(chunk, _enc, cb) {
    this.rotateIfNeeded();
    this.stream.write(chunk, cb);
  }
}

export const cleanupOldLogs = () => {
  if (!Number.isFinite(LOG_RETENTION_DAYS) || LOG_RETENTION_DAYS < 1) return;
  ensureLogDir();
  const files = fs.readdirSync(LOG_DIR);
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  files
    .filter((file) => file.startsWith(LOG_FILE_PREFIX) && file.endsWith(".log"))
    .forEach((file) => {
      const full = path.join(LOG_DIR, file);
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
      }
    });
};

export const sanitizePayload = (value) => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item));
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      if (SENSITIVE_KEYS.some((sKey) => key.toLowerCase().includes(sKey))) {
        return acc;
      }
      acc[key] = sanitizePayload(val);
      return acc;
    }, {});
  }

  if (typeof value === "string" && value.length > 2048) {
    return `${value.slice(0, 2048)}...[truncated]`;
  }

  return value;
};

const prettyStream =
  process.env.LOG_PRETTY === "false"
    ? null
    : pinoPretty({
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
        messageFormat: "[{level}] {msg}",
        singleLine: false
      });

const consoleStream = prettyStream || pino.destination({ dest: 1, sync: false });
const rotatingFileStream = new RotatingFileStream(LOG_DIR, LOG_FILE_PREFIX);
const streams = pino.multistream([{ stream: consoleStream }, { stream: rotatingFileStream }]);

export const logger = pino(
  {
    level: LOG_LEVEL,
    base: {
      service: SERVICE_NAME,
      host: os.hostname(),
      env: process.env.NODE_ENV || "development"
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "context.password",
        "context.token",
        "context.otp",
        "payload.password",
        "payload.token",
        "payload.otp",
        "payload.secret"
      ],
      remove: true
    },
    formatters: {
      level(label) {
        return { level: label };
      }
    }
  },
  streams
);

const normalizeLevel = (level = "info") => {
  const lvl = level.toLowerCase();
  if (["fatal", "error", "warn", "info", "debug", "trace"].includes(lvl)) return lvl;
  return "info";
};

export const shouldSample = (level) => {
  if (level === "error" || level === "fatal" || level === "warn") return true;
  return Math.random() < LOG_SAMPLE_RATE;
};

export const buildLogEntry = (payload = {}, meta = {}) => {
  const {
    event,
    message,
    context = {},
    service,
    requestId,
    correlationId,
    userId,
    source = "ingest",
    resource,
    statusCode,
    durationMs,
    tags = [],
    ip
  } = payload;

  const mergedContext = sanitizePayload({ ...(meta.context || {}), ...context });

  return {
    event: event || "log_event",
    message: message || event || "",
    service: service || payload.serviceName || SERVICE_NAME,
    requestId,
    correlationId,
    userId,
    source: source || meta.source || "ingest",
    resource,
    statusCode,
    durationMs,
    ip,
    tags,
    sampled: meta.sampled ?? true,
    context: mergedContext
  };
};

export const ingestLog = (payload, meta = {}) => {
  const level = normalizeLevel(payload.level);
  const sampled = meta.sampled ?? shouldSample(level);
  if (!sampled) return { skipped: true, sampled };

  const entry = buildLogEntry(payload, { sampled, ...meta });
  logger[level](entry, entry.message);
  return { skipped: false, sampled };
};

cleanupOldLogs();
