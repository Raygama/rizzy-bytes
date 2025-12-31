// Build auth service URLs from a single base. The base can be absolute
// (e.g. http://70.153.24.245/api/auth) or relative (/api/auth).
const AUTH_API_BASE = (
  process.env.NEXT_PUBLIC_AUTH_API_URL || "/api/auth"
).replace(/\/$/, "");

export const authEndpoint = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${AUTH_API_BASE}${normalizedPath}`;
};
