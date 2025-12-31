// Build Flowise proxy URLs from a single base. The base can be empty for
// same-origin calls (e.g. /api/v1/...) or a full URL like
// http://70.153.24.245/api.
const FLOWISE_PROXY_BASE = (
  process.env.NEXT_PUBLIC_FLOWISE_PROXY_URL || ""
).replace(/\/$/, "");

export const flowiseEndpoint = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${FLOWISE_PROXY_BASE}${normalizedPath}`;
};
