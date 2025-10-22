import amqp from "amqplib";

let conn, ch;
const EXCHANGE = "jobs";

export const initAMQP = async (url) => {
  conn = await amqp.connect(url);
  ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  return ch;
};

export const publish = async (routingKey, message) => {
  if (!ch) throw new Error("AMQP channel not initialized");
  ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
};
