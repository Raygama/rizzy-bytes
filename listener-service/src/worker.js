import dotenv from "dotenv";
import amqp from "amqplib";
import axios from "axios";

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || "http://mail-service:3000";
const EXCHANGE = "jobs";

async function connectRabbitMQ() {
  let retries = 5;
  while (retries) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      console.log("Connected to RabbitMQ");
      return conn;
    } catch (err) {
      console.error("RabbitMQ not ready, retrying in 5s...", err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  throw new Error("Failed to connect to RabbitMQ");
}

(async () => {
  const conn = await connectRabbitMQ();
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });

  // Mail queue
  const mailQ = await ch.assertQueue("mail-service", { durable: true });
  await ch.bindQueue(mailQ.queue, EXCHANGE, "mail.*");

  // Log queue (optional)
  const logQ = await ch.assertQueue("logger-service", { durable: true });
  await ch.bindQueue(logQ.queue, EXCHANGE, "log.*");

  ch.consume(mailQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.type === "SEND_OTP") {
        await axios.post(`${MAIL_SERVICE_URL}/send`, {
          to: payload.to,
          subject: "Your OTP Code",
          text: `Your OTP is ${payload.otp}`,
          html: `<p>Your OTP is <b>${payload.otp}</b></p>`
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error("mail consumer failed:", e.message);
      ch.nack(msg, false, true);
    }
  }, { noAck: false });

  ch.consume(logQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      // Later: call logger-service API. For now, just log.
      console.log("LOG EVENT:", payload);
      ch.ack(msg);
    } catch (e) {
      ch.nack(msg, false, true);
    }
  }, { noAck: false });

  console.log("Listener running. Waiting for messages…");
})();
