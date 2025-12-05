import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017";
const MONGO_DB = process.env.MONGO_DB || "logger";
const MONGO_COLLECTION = process.env.MONGO_COLLECTION || "logs";

let client;
let collection;
let connectingPromise;
let lastErrorLoggedAt = 0;

const logOnce = (msg, err) => {
  const now = Date.now();
  if (now - lastErrorLoggedAt < 30_000) return;
  lastErrorLoggedAt = now;
  // eslint-disable-next-line no-console
  console.warn("[mongo] " + msg + (err?.message ? ` (${err.message})` : ""));
};

const ensureCollection = async () => {
  if (collection) return collection;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    try {
      client = new MongoClient(MONGO_URI, { maxPoolSize: 5 });
      await client.connect();
      const db = client.db(MONGO_DB);
      const col = db.collection(MONGO_COLLECTION);
      await col.createIndex({ createdAt: -1 });
      await col.createIndex({ service: 1, level: 1, createdAt: -1 });
      collection = col;
      return collection;
    } catch (err) {
      logOnce("Failed to connect to MongoDB for logger-service", err);
      collection = null;
      return null;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
};

export const insertLog = async (doc) => {
  const col = await ensureCollection();
  if (!col) return false;
  try {
    await col.insertOne(doc);
    return true;
  } catch (err) {
    logOnce("Failed to persist log to MongoDB", err);
    return false;
  }
};

export const fetchLogs = async ({ date, limit, service, level, event, q }) => {
  const col = await ensureCollection();
  if (!col) return [];

  const query = {};
  if (service) query.service = service;
  if (level) query.level = level;
  if (event) query.event = event;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    query.createdAt = { $gte: start, $lt: end };
  }
  if (q) {
    const regex = new RegExp(q, "i");
    query.$or = [{ message: regex }, { event: regex }, { "context.message": regex }];
  }

  const safeLimit = Math.min(Math.max(limit ?? 200, 1), 1000);

  const docs = await col
    .find(query, { sort: { createdAt: -1 }, limit: safeLimit })
    .toArray();

  return docs.map(({ _id, ...rest }) => ({
    id: _id?.toString(),
    ...rest
  }));
};

export const closeMongo = async () => {
  if (client) {
    await client.close();
  }
};
