import amqp from "amqplib";
import { ingestLog, logger } from "./logger.js";

const EXCHANGE = process.env.AMQP_EXCHANGE || "jobs";
const LOG_QUEUE = process.env.LOG_QUEUE || "logger-service";
const LOG_ROUTING_KEY = process.env.LOG_ROUTING_KEY || "log.*";
const RETRY_DELAY_MS = parseInt(process.env.AMQP_RETRY_DELAY_MS || "5000", 10);
const MAX_RETRIES = process.env.AMQP_MAX_RETRIES
  ? parseInt(process.env.AMQP_MAX_RETRIES, 10)
  : -1;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectWithRetry = async (url) => {
  let attempt = 0;
  while (MAX_RETRIES < 0 || attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      logger.info({ event: "amqp_connect_attempt", attempt }, "AMQP: connecting");
      const conn = await amqp.connect(url);
      logger.info({ event: "amqp_connected" }, "AMQP: connected");
      return conn;
    } catch (err) {
      logger.warn(
        { event: "amqp_connect_failed", attempt, error: err.message },
        "AMQP: connection failed"
      );
      await wait(RETRY_DELAY_MS);
    }
  }
  throw new Error("AMQP: exceeded max retries");
};

export const startLogConsumer = async (url) => {
  const conn = await connectWithRetry(url);
  const ch = await conn.createChannel();

  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  const q = await ch.assertQueue(LOG_QUEUE, { durable: true });
  await ch.bindQueue(q.queue, EXCHANGE, LOG_ROUTING_KEY);

  logger.info(
    {
      event: "log_consumer_ready",
      queue: LOG_QUEUE,
      exchange: EXCHANGE,
      routingKey: LOG_ROUTING_KEY
    },
    "Logger consumer started"
  );

  ch.consume(
    q.queue,
    (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        ingestLog(payload, { source: "rabbitmq", context: { queue: q.queue } });
        ch.ack(msg);
      } catch (err) {
        logger.error({ event: "log_consume_failed", error: err.message }, "Invalid log payload");
        ch.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  return { conn, ch };
};
