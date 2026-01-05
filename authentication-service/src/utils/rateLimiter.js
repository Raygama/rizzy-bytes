const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const clientKey = (req) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  "unknown";

const buckets = new Map();

export const rateLimiter = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const now = Date.now();
  const key = clientKey(req);
  const hits = buckets.get(key) || [];
  const recent = hits.filter((ts) => now - ts < WINDOW_MS);
  recent.push(now);
  buckets.set(key, recent);

  if (recent.length > MAX_REQUESTS) {
    return res.status(429).json({ error: `Rate limit exceeded. Max ${MAX_REQUESTS} requests per minute` });
  }

  next();
};
