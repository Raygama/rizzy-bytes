import dotenv from "dotenv";
import amqp from "amqplib";
import axios from "axios";
import fs from "fs"; // [ADDED] untuk baca file template HTML
import path from "path"; // [ADDED] untuk handle path file
import { fileURLToPath } from "url"; // [ADDED] untuk dapat __dirname di ES Module
import { logEvent, newRequestIds } from "./logger.js";
import { startMetricsServer, trackJob } from "./metrics.js";

dotenv.config();
startMetricsServer();

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const MAIL_SERVICE_URL =
  process.env.MAIL_SERVICE_URL || "http://mail-service:3000";
const FLOWISE_PROXY_URL =
  process.env.FLOWISE_PROXY_URL || "http://flowise-proxy:4000";
const WORKER_TOKEN =
  process.env.WORKER_TOKEN || process.env.INTERNAL_JOB_TOKEN || "change-me";
const EXCHANGE = "jobs";

// [ADDED] Setup __dirname dan path ke template OTP
const __filename = fileURLToPath(import.meta.url); // [ADDED]
const __dirname = path.dirname(__filename); // [ADDED]
const OTP_TEMPLATE_PATH = path.join(
  // [ADDED]
  __dirname,
  "templates",
  "otp-email.html"
);
const OTP_LOGO_URL = process.env.OTP_LOGO_URL || "https://koeliah.com/wp-content/uploads/2018/11/telkom-university.png";

// [ADDED] Cache untuk menghindari baca file berulang-ulang
let otpTemplateCache = null; // [ADDED]

// [ADDED] Fungsi untuk ambil isi template OTP dari file
function getOtpTemplate() {
  // [ADDED]
  if (!otpTemplateCache) {
    otpTemplateCache = fs.readFileSync(OTP_TEMPLATE_PATH, "utf8");
  }
  return otpTemplateCache;
}

// [ADDED] Fungsi untuk render HTML OTP dengan mengganti placeholder
function renderOtpHtml({ otp, username }) {
  // [ADDED]
  const tpl = getOtpTemplate();
  const hasLogo = OTP_LOGO_URL && OTP_LOGO_URL.trim();

  return tpl
    .replace(/{{OTP_CODE}}/g, otp) // ganti semua {{OTP_CODE}}
    .replace(/{{USERNAME}}/g, username || "") // ganti {{USERNAME}} kalau ada
    .replace(/{{LOGO_URL}}/g, hasLogo ? OTP_LOGO_URL.trim() : "")
    .replace(/{{LOGO_DISPLAY}}/g, hasLogo ? "block" : "none")
    .replace(/{{LOGO_PLACEHOLDER_DISPLAY}}/g, hasLogo ? "none" : "flex");
}

const callProxy = async (path, payload) => {
  const url = `${FLOWISE_PROXY_URL}${path}`;
  return axios.post(url, payload, {
    headers: { "x-worker-token": WORKER_TOKEN },
    timeout: 120000
  });
};

async function connectRabbitMQ() {
  let retries = 5;
  while (retries) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      console.log("Connected to RabbitMQ");
      return conn;
    } catch (err) {
      console.error("RabbitMQ not ready, retrying in 5s...", err.message);
      logEvent({
        level: "warn",
        event: "amqp_connect_retry",
        message: err.message,
        context: { retriesLeft: retries - 1 }
      });
      retries -= 1;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  throw new Error("Failed to connect to RabbitMQ");
}

(async () => {
  const conn = await connectRabbitMQ();
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  logEvent({
    level: "info",
    event: "amqp_connected",
    message: "Listener connected to RabbitMQ",
    context: { exchange: EXCHANGE }
  });

  // Mail queue
  const mailQ = await ch.assertQueue("mail-service", { durable: true });
  await ch.bindQueue(mailQ.queue, EXCHANGE, "mail.*");

  ch.consume(
    mailQ.queue,
    async (msg) => {
      if (!msg) return;
      const { requestId } = newRequestIds();
      const started = Date.now();
      try {
        const payload = JSON.parse(msg.content.toString());
        if (payload.type === "SEND_OTP") {
          // [CHANGED] sebelumnya html hardcoded, sekarang pakai template HTML
          const html = renderOtpHtml(payload);

          await axios.post(
            `${MAIL_SERVICE_URL}/send`,
            {
              to: payload.to,
              subject: "Kode Verifikasi 2-Langkah", // [OPTIONAL] bisa kamu ganti
              text: `Your OTP is ${payload.otp}`, // fallback text-only
              html,
            },
            {
              headers: {
                "x-worker-token": WORKER_TOKEN,
              },
            }
          );
        }

        ch.ack(msg);
        trackJob(mailQ.queue, payload.type, "success", (Date.now() - started) / 1000);
        logEvent({
          level: "info",
          event: "mail_job_processed",
          message: "Mail job processed",
          requestId,
          context: { queue: mailQ.queue, type: payload.type, to: payload.to, purpose: payload.purpose }
        });
      } catch (e) {
        console.error("mail consumer failed:", e.message);
        trackJob(mailQ.queue, "unknown", "failure", (Date.now() - started) / 1000);
        logEvent({
          level: "error",
          event: "mail_job_failed",
          message: e.message,
          requestId,
          context: { queue: mailQ.queue }
        });
        ch.nack(msg, false, true);
      }
    },
    { noAck: false }
  );

  const kbQ = await ch.assertQueue("kb-jobs", { durable: true });
  await ch.bindQueue(kbQ.queue, EXCHANGE, "kb.*");
  await ch.bindQueue(kbQ.queue, EXCHANGE, "llm.batch");
  await ch.bindQueue(kbQ.queue, EXCHANGE, "analytics.rollup");

  ch.consume(
    kbQ.queue,
    async (msg) => {
      if (!msg) return;
      const { requestId } = newRequestIds();
      const started = Date.now();
      let routingKey = msg.fields?.routingKey || "kb.unknown";
      try {
        const payload = JSON.parse(msg.content.toString());
        const jobId = payload.jobId;

        if (routingKey === "kb.ingest") {
          await callProxy("/internal/jobs/kb/ingest", payload);
        } else if (routingKey === "kb.reprocess") {
          await callProxy("/internal/jobs/kb/reprocess", payload);
        } else if (routingKey === "kb.upsert") {
          await callProxy("/internal/jobs/kb/upsert", payload);
        } else if (routingKey === "kb.refresh") {
          await callProxy("/internal/jobs/kb/refresh", payload);
        } else if (routingKey === "llm.batch" || routingKey === "analytics.rollup") {
          if (jobId) {
            await callProxy("/internal/jobs/status", {
              jobId,
              status: "failed",
              type: routingKey,
              error: "Handler not implemented"
            });
          }
          throw new Error(`No handler for ${routingKey}`);
        } else {
          if (jobId) {
            await callProxy("/internal/jobs/status", {
              jobId,
              status: "failed",
              type: routingKey,
              error: "Unknown routing key"
            });
          }
          throw new Error(`Unknown routing key ${routingKey}`);
        }

        ch.ack(msg);
        trackJob(kbQ.queue, routingKey, "success", (Date.now() - started) / 1000);
        logEvent({
          level: "info",
          event: "kb_job_processed",
          message: "KB/LLM job processed",
          requestId,
          context: { queue: kbQ.queue, routingKey, jobId }
        });
      } catch (e) {
        console.error("kb job failed:", e.message);
        routingKey = routingKey || "kb.unknown";
        trackJob(kbQ.queue, routingKey, "failure", (Date.now() - started) / 1000);
        logEvent({
          level: "error",
          event: "kb_job_failed",
          message: e.message,
          requestId,
          context: { queue: kbQ.queue, routingKey }
        });
        // Do NOT requeue to avoid duplicate upserts in Flowise when partial failures occur
        ch.ack(msg);
      }
    },
    { noAck: false }
  );

  console.log("Listener running. Waiting for messages...");
})();
