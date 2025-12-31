const sanitizeBase = (value = "") => {
  if (typeof value !== "string") return "";
  return value.replace(/\/+$/, "");
};

const mode = (process.env.NEXT_PUBLIC_API_MODE || "direct").toLowerCase();

const configs = {
  // Direct calls to each service (local dev / docker compose)
  direct: {
    apiBase:
      sanitizeBase(process.env.NEXT_PUBLIC_DIRECT_API_BASE) ||
      "http://localhost:3001",
    flowiseBase:
      sanitizeBase(process.env.NEXT_PUBLIC_DIRECT_FLOWISE_BASE) ||
      "http://localhost:4000",
    prometheusBase:
      sanitizeBase(process.env.NEXT_PUBLIC_DIRECT_PROM_BASE) ||
      "http://localhost:9090",
    authPrefix: "/auth",
    brokerPrefix: "/broker",
    mailPrefix: "/mail",
    loggerPrefix: "/logger",
  },
  // Through the Nginx reverse proxy on the deployed VM (same-origin)
  nginx: {
    apiBase: sanitizeBase(process.env.NEXT_PUBLIC_NGINX_API_BASE) || "",
    flowiseBase:
      sanitizeBase(process.env.NEXT_PUBLIC_NGINX_FLOWISE_BASE) || "",
    prometheusBase:
      sanitizeBase(process.env.NEXT_PUBLIC_NGINX_PROM_BASE) || "/prometheus",
    authPrefix: "/api/auth",
    brokerPrefix: "/api/broker",
    mailPrefix: "/api/mail",
    loggerPrefix: "/api/logger",
  },
};

const activeConfig = configs[mode] || configs.direct;

const joinUrl = (base, path = "") => {
  const cleanBase = sanitizeBase(base);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
};

export const apiMode = mode;
export const apiConfig = activeConfig;

export const authUrl = (path = "") =>
  joinUrl(activeConfig.apiBase, `${activeConfig.authPrefix}${path}`);
export const brokerUrl = (path = "") =>
  joinUrl(activeConfig.apiBase, `${activeConfig.brokerPrefix}${path}`);
export const mailUrl = (path = "") =>
  joinUrl(activeConfig.apiBase, `${activeConfig.mailPrefix}${path}`);
export const loggerUrl = (path = "") =>
  joinUrl(activeConfig.apiBase, `${activeConfig.loggerPrefix}${path}`);
export const flowiseUrl = (path = "") =>
  joinUrl(activeConfig.flowiseBase || activeConfig.apiBase, path);
export const prometheusUrl = (path = "") =>
  joinUrl(activeConfig.prometheusBase, path);
