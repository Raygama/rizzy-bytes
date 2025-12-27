// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { ChatHistoryStore } from "./history/chatHistoryStore.js";
import { connectToMongo } from "./history/mongoClient.js";
import { knowledgeBaseStore, nextKbId } from "./knowledgeBaseStore.js";
import { logEvent, requestContext, requestLogger } from "./logger.js";
import { requireAuth, requireRole } from "./auth.js";
import {
  metricsMiddleware,
  metricsHandler,
  observePredictionMetrics,
  estimateTokens,
  sampleGpuUtilization
} from "./metrics.js";

dotenv.config();

// config
const FLOWISE_URL = process.env.FLOWISE_URL || "http://flowise:3000";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/uploads";
const PORT = parseInt(process.env.PORT || "4000", 10);
const READ_TIMEOUT_MS = parseInt(process.env.READ_TIMEOUT_MS || "60000", 10);
const DOCUMENT_STORE_ID = process.env.DOCUMENT_STORE_ID || "d21759a2-d263-414e-b5a4-f2e5819d516e";
const KB_TYPES = {
  ta: {
    key: "ta",
    storeId: "09fadd22-0448-4e31-854d-6080ac8f9864",
    collectionName: "helpdesk_kb_ta",
    topK: 10
  },
  kp: {
    key: "kp",
    storeId: "c9b03bfa-f4ac-430d-a20d-81dade61a626",
    collectionName: "helpdesk_kb_kp",
    topK: 10
  },
  tak: {
    key: "tak",
    storeId: "0b77caad-ec5d-4be0-81b4-63ce72af9a5e",
    collectionName: "helpdesk_kb_tak",
    topK: 10
  },
  general: {
    key: "general",
    storeId: "9baa9873-0bbf-4ba4-a201-1452decf45a1",
    collectionName: "helpdesk_kb_general",
    topK: 10
  }
};
const BROKER_URL = process.env.BROKER_URL || "http://broker-service:3000";
const ASYNC_KB = (process.env.ASYNC_KB || "true").toLowerCase() === "true";
const WORKER_TOKEN = process.env.WORKER_TOKEN || process.env.INTERNAL_JOB_TOKEN || "change-me";
const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/helpdesk";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || null;
const COST_PER_1K_TOKENS = (() => {
  const parsed = Number(process.env.COST_PER_1K_TOKENS_USD || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
})();
const DEFAULT_TEXT_SPLITTER = {
  chunkSize: 1000,
  chunkOverlap: 200
};

const MAX_CONCURRENT_PREDICTIONS = (() => {
  const parsed = Number(process.env.MAX_CONCURRENT_PREDICTIONS || 4);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
})();
let activePredictions = 0;

const safeParseJSON = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to parse JSON value:", raw, err.message);
    return fallback;
  }
};

const cloneConfig = (config) => {
  if (!config) return {};
  return JSON.parse(JSON.stringify(config));
};

const LOADER_NODE_NAME = process.env.FLOWISE_LOADER_NAME || "fileLoader";
const LOADER_BASE_CONFIG = safeParseJSON(process.env.FLOWISE_LOADER_CONFIG, {});

const SPLITTER_NODE_NAME = process.env.FLOWISE_SPLITTER_NAME || "recursiveCharacterTextSplitter";
const SPLITTER_EXTRA_CONFIG = safeParseJSON(process.env.FLOWISE_SPLITTER_CONFIG, {});

const VECTOR_STORE_NAME = process.env.FLOWISE_VECTOR_STORE_NAME || null;
const VECTOR_STORE_CONFIG = safeParseJSON(process.env.FLOWISE_VECTOR_STORE_CONFIG, {});

const EMBEDDING_NAME = process.env.FLOWISE_EMBEDDING_NAME || null;
const EMBEDDING_CONFIG = safeParseJSON(process.env.FLOWISE_EMBEDDING_CONFIG, {});

const RECORD_MANAGER_NAME = process.env.FLOWISE_RECORD_MANAGER_NAME || null;
const RECORD_MANAGER_CONFIG = safeParseJSON(process.env.FLOWISE_RECORD_MANAGER_CONFIG, {});

const hrtimeSeconds = (startBigInt) => Number(process.hrtime.bigint() - startBigInt) / 1e9;

const cpuUsageSeconds = (cpuStart) => {
  const diff = process.cpuUsage(cpuStart);
  return (diff.user + diff.system) / 1e6;
};

const estimateCostUsdFromTokens = (tokens) => {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  if (!Number.isFinite(COST_PER_1K_TOKENS) || COST_PER_1K_TOKENS <= 0) return 0;
  return (tokens / 1000) * COST_PER_1K_TOKENS;
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const parseOrigins = (value) =>
  value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const resolveAllowedOrigins = () => {
  const parsed = parseOrigins(process.env.CORS_ORIGINS);
  if (!parsed.length) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  return parsed;
};

const createCorsOptions = () => {
  const origins = resolveAllowedOrigins();
  const allowAll = origins.includes("*");
  return {
    origin: allowAll
      ? true
      : (origin, callback) => {
          if (!origin || origins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposedHeaders: ["Content-Disposition"],
    optionsSuccessStatus: 204
  };
};

const COMMON_METADATA_OMIT_KEYS = ["loc", "loc.pageNumber", "loc.lines", "loc.lines.from", "loc.lines.to"];
const PDF_METADATA_OMIT_KEYS = [
  "pdf",
  "pdf.version",
  "pdf.info",
  "pdf.metadata",
  "pdf.metadata._metadata",
  "pdf.info.PDFFormatVersion",
  "pdf.info.IsAcroFormPresent",
  "pdf.info.IsXFAPresent",
  "pdf.info.Author",
  "pdf.info.Creator",
  "pdf.info.Producer",
  "pdf.info.CreationDate",
  "pdf.info.ModDate",
  "pdf.metadata._metadata.dc:format",
  "pdf.metadata._metadata.dc:creator",
  "pdf.metadata._metadata.xmp:createdate",
  "pdf.metadata._metadata.xmp:creatortool",
  "pdf.metadata._metadata.xmp:modifydate",
  "pdf.metadata._metadata.xmp:metadatadate",
  "pdf.metadata._metadata.pdf:producer",
  "pdf.metadata._metadata.xmpmm:documentid",
  "pdf.metadata._metadata.xmpmm:instanceid"
];

const DEFAULT_METADATA_OMIT_RULES = {
  "*": COMMON_METADATA_OMIT_KEYS,
  ".pdf": [...PDF_METADATA_OMIT_KEYS, ...COMMON_METADATA_OMIT_KEYS],
  ".doc": COMMON_METADATA_OMIT_KEYS,
  ".docx": COMMON_METADATA_OMIT_KEYS,
  ".xls": COMMON_METADATA_OMIT_KEYS,
  ".xlsx": COMMON_METADATA_OMIT_KEYS,
  ".csv": COMMON_METADATA_OMIT_KEYS,
  ".txt": COMMON_METADATA_OMIT_KEYS,
  ".json": COMMON_METADATA_OMIT_KEYS,
  ".jsonl": COMMON_METADATA_OMIT_KEYS,
  ".ppt": COMMON_METADATA_OMIT_KEYS,
  ".pptx": COMMON_METADATA_OMIT_KEYS
};

const normalizeMetadataRuleKey = (key) => {
  if (!key && key !== 0) return null;
  let trimmed = `${key}`.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "*" || trimmed === "default") {
    return "*";
  }
  if (!trimmed.startsWith(".")) {
    trimmed = `.${trimmed.replace(/^\./, "")}`;
  }
  return trimmed;
};

const normalizeMetadataRuleValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => `${entry}`.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return null;
};

const buildMetadataRuleMap = (defaults = {}, overrides = {}) => {
  const result = {};
  const assignRules = (ruleset) => {
    if (!ruleset || typeof ruleset !== "object") return;
    Object.entries(ruleset).forEach(([key, value]) => {
      const normalizedKey = normalizeMetadataRuleKey(key);
      const normalizedValue = normalizeMetadataRuleValue(value);
      if (!normalizedKey || !normalizedValue?.length) return;
      result[normalizedKey] = normalizedValue;
    });
  };
  assignRules(defaults);
  assignRules(overrides);
  return result;
};

const METADATA_OMIT_RULES = buildMetadataRuleMap(
  DEFAULT_METADATA_OMIT_RULES,
  safeParseJSON(process.env.FLOWISE_METADATA_OMIT_RULES, null)
);

const getMetadataOmitValueForFile = (filename) => {
  if (!filename) return null;
  const ext = path.extname(filename).toLowerCase();
  const candidates = METADATA_OMIT_RULES[ext] || METADATA_OMIT_RULES["*"];
  if (!candidates?.length) return null;
  const seen = new Set();
  const ordered = [];
  candidates.forEach((entry) => {
    const value = entry.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  });
  return ordered.length ? ordered.join(", ") : null;
};

const withOmitMetadataRules = (config = {}, filename) => {
  if (!filename) return config;
  const omitValue = getMetadataOmitValueForFile(filename);
  if (!omitValue) return config;
  return {
    ...config,
    omitMetadataKeys: omitValue
  };
};

const parsePositiveInt = (value, fallback = 1) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

const MANIFEST_FILE = (storeId) => path.join(UPLOAD_DIR, `${storeId || "default"}-manifest.json`);

const DEFAULT_ALLOWED_FILE_TYPES = [".pdf", ".doc", ".docx", ".csv", ".xls", ".xlsx"];
const ALLOWED_FILE_TYPES = new Set(
  safeParseJSON(process.env.FLOWISE_ALLOWED_FILE_TYPES, DEFAULT_ALLOWED_FILE_TYPES) || DEFAULT_ALLOWED_FILE_TYPES
);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

const isAllowedFileType = (file) => {
  if (!file) return false;
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ALLOWED_FILE_TYPES.has(ext)) return true;
  if (file.mimetype && ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) return true;
  return false;
};

const describeAllowedFileTypes = () =>
  Array.from(ALLOWED_FILE_TYPES)
    .map((ext) => ext.replace(/^\./, "").toUpperCase())
    .join(", ");

// load API key either from env or from secret file path
let FLOWISE_API_KEY = process.env.FLOWISE_API_KEY || null;
if (!FLOWISE_API_KEY && process.env.FLOWISE_API_KEY_FILE) {
  try {
    FLOWISE_API_KEY = fs.readFileSync(process.env.FLOWISE_API_KEY_FILE, "utf8").trim();
  } catch (e) {
    console.warn("Could not read FLOWISE_API_KEY_FILE", e.message);
  }
}

const chatHistoryStore = new ChatHistoryStore();

const app = express();
const corsOptions = createCorsOptions();
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(requestContext);
app.use(requestLogger);
app.use(metricsMiddleware);

// multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const storeId = req.params.storeId || DOCUMENT_STORE_ID || "global";
      const dir = path.join(UPLOAD_DIR, storeId);
      await fsp.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${sanitized}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (isAllowedFileType(file)) {
      return cb(null, true);
    }
    req.fileValidationError = `Unsupported file type. Allowed types: ${describeAllowedFileTypes()}`;
    return cb(null, false);
  }
});

const pickFirstString = (value) => {
  if (!value && value !== 0) return null;
  if (Array.isArray(value)) {
    return value.length ? pickFirstString(value[0]) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
};

const pickNonEmptyString = (value) => {
  const candidate = pickFirstString(value);
  if (candidate === null) return null;
  const trimmed = `${candidate}`.trim();
  return trimmed || null;
};

const getHeaderValue = (req, name) => {
  if (!req || !name) return null;
  if (typeof req.get === "function") {
    return req.get(name);
  }
  const headerKey = name.toLowerCase();
  return req.headers?.[headerKey] || req.headers?.[name] || null;
};

const getSessionIdFromReq = (req) => {
  return (
    pickFirstString(getHeaderValue(req, "x-session-id")) ||
    pickFirstString(req.body?.sessionId) ||
    pickFirstString(req.query?.sessionId) ||
    null
  );
};

const getUserIdFromReq = (req) => {
  return pickFirstString(getHeaderValue(req, "x-user-id")) || pickFirstString(req.body?.userId) || null;
};

const resolveSessionId = (req) => {
  return getSessionIdFromReq(req) || randomUUID();
};

const buildPredictionPayload = (body) => {
  if (!body || typeof body !== "object") return {};
  const { sessionId, userId, ...rest } = body;
  return rest;
};

const resolveTypeConfig = (typeRaw) => {
  const key = (typeRaw || "").toString().trim().toLowerCase();
  if (!key) return null;
  return KB_TYPES[key] || null;
};

const resolveTypeConfigByStoreId = (storeId) => {
  if (!storeId) return null;
  return Object.values(KB_TYPES).find((cfg) => cfg.storeId === storeId) || null;
};

const getStoreIdFromReq = (req) => {
  const typeCfg =
    resolveTypeConfig(req.params?.type) ||
    resolveTypeConfig(req.query?.type) ||
    resolveTypeConfig(req.body?.type);
  if (typeCfg?.storeId) return typeCfg.storeId;
  return (
    pickFirstString(req.params?.storeId) ||
    pickFirstString(req.query?.storeId) ||
    pickFirstString(req.body?.storeId) ||
    DOCUMENT_STORE_ID
  );
};

const resolveStoreIdForLoader = async (req, loaderId) => {
  const explicit =
    pickFirstString(req.params?.storeId) ||
    pickFirstString(req.query?.storeId) ||
    pickFirstString(req.body?.storeId);
  if (explicit) return explicit;
  if (loaderId) {
    const kbEntry = await knowledgeBaseStore.findByLoader({ loaderId });
    if (kbEntry?.storeId) return kbEntry.storeId;
  }
  return DOCUMENT_STORE_ID;
};

const parseMetadataInput = (raw, fallback = null) => {
  if (!raw && raw !== 0) return fallback;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw { status: 400, body: { error: "Invalid metadata JSON" } };
  }
};

const ensureFlowiseComponentsConfigured = () => {
  if (!VECTOR_STORE_NAME || !EMBEDDING_NAME) {
    throw {
      status: 500,
      body: {
        error:
          "FLOWISE_VECTOR_STORE_NAME and FLOWISE_EMBEDDING_NAME must be configured to use the upsert API. Set the corresponding *_CONFIG values in .env."
      }
    };
  }
};

const pruneConfig = (config) => {
  if (!config || typeof config !== "object") return {};
  const result = {};
  Object.entries(config).forEach(([key, value]) => {
    const isString = typeof value === "string";
    const isEmptyString = isString && !value.trim();
    if (value === undefined || value === null || isEmptyString) return;
    result[key] = value;
  });
  return result;
};

const mergeComponentConfig = (primary = {}, secondary = {}) => {
  return pruneConfig({
    ...pruneConfig(secondary),
    ...pruneConfig(primary)
  });
};

const getComponentPayloads = () => {
  ensureFlowiseComponentsConfigured();
  return {
    loader: {
      name: LOADER_NODE_NAME,
      config: cloneConfig(LOADER_BASE_CONFIG)
    },
    splitter: {
      name: SPLITTER_NODE_NAME,
      config: {
        ...cloneConfig(DEFAULT_TEXT_SPLITTER),
        ...cloneConfig(SPLITTER_EXTRA_CONFIG)
      }
    },
    vectorStore: {
      name: VECTOR_STORE_NAME,
      config: cloneConfig(VECTOR_STORE_CONFIG)
    },
    embedding: {
      name: EMBEDDING_NAME,
      config: cloneConfig(EMBEDDING_CONFIG)
    },
    recordManager: RECORD_MANAGER_NAME
      ? {
          name: RECORD_MANAGER_NAME,
          config: cloneConfig(RECORD_MANAGER_CONFIG)
        }
      : null
  };
};

const cleanupUploadedFile = async (file) => {
  if (file?.path) {
    try {
      await fsp.unlink(file.path);
    } catch (_err) {
      // ignore
    }
  }
};

const ensureUploadFolder = async () => {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
};

const readManifest = async (storeId) => {
  try {
    const raw = await fsp.readFile(MANIFEST_FILE(storeId), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
};

const writeManifest = async (storeId, data) => {
  await ensureUploadFolder();
  await fsp.writeFile(MANIFEST_FILE(storeId), JSON.stringify(data, null, 2));
};

const JOB_STATUS_DIR = path.join(UPLOAD_DIR, "jobs");

const ensureJobDir = async () => {
  await fsp.mkdir(JOB_STATUS_DIR, { recursive: true });
};

const jobStatusPath = (jobId) => path.join(JOB_STATUS_DIR, `${jobId}.json`);

const setJobStatus = async (jobId, patch = {}) => {
  await ensureJobDir();
  const now = new Date().toISOString();
  let existing = {};
  try {
    existing = JSON.parse(await fsp.readFile(jobStatusPath(jobId), "utf8"));
  } catch (_) {
    existing = { jobId, createdAt: now };
  }
  const payload = {
    ...existing,
    ...patch,
    jobId,
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
  await fsp.writeFile(jobStatusPath(jobId), JSON.stringify(payload, null, 2));
  return payload;
};

const readJobStatus = async (jobId) => {
  try {
    const raw = await fsp.readFile(jobStatusPath(jobId), "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
};

const isWorkerRequest = (req) => {
  const tokenHeader = req.get("x-worker-token") || req.get("authorization");
  if (!tokenHeader) return false;
  const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
  return token === WORKER_TOKEN;
};

const ensureWorkerAuth = (req, res) => {
  if (!isWorkerRequest(req)) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
};

const upsertManifestEntry = async (storeId, patch) => {
  if (!patch?.docId) return;
  const manifest = await readManifest(storeId);
  const index = manifest.findIndex((entry) => entry.docId === patch.docId);
  if (index === -1) {
    manifest.push(patch);
  } else {
    Object.entries(patch).forEach(([key, value]) => {
      if (typeof value !== "undefined") {
        manifest[index][key] = value;
      }
    });
  }
  await writeManifest(storeId, manifest);
};

const removeManifestEntry = async (storeId, docId) => {
  if (!docId) return;
  const manifest = await readManifest(storeId);
  const filtered = manifest.filter((entry) => entry.docId !== docId);
  if (filtered.length === manifest.length) return;
  await writeManifest(storeId, filtered);
};

const fetchFlowiseStore = async (storeId) => {
  const pathUrl = `/api/v1/document-store/store/${storeId}`;
  return callFlowise("get", pathUrl);
};

const resolveComponentPayloads = async (storeId) => {
  const base = getComponentPayloads();
  let storeConfig = null;
  try {
    storeConfig = await fetchFlowiseStore(storeId);
  } catch (err) {
    console.warn("Unable to read Flowise store config, falling back to .env values:", err?.message || err);
  }

  const storeVectorConfig = storeConfig?.vectorStore?.config || {};
  const storeEmbeddingConfig = storeConfig?.embedding?.config || {};
  const storeRecordManagerConfig = storeConfig?.recordManager?.config || {};

  return {
    loader: base.loader,
    splitter: base.splitter,
    vectorStore: {
      ...base.vectorStore,
      config: mergeComponentConfig(base.vectorStore?.config, storeVectorConfig)
    },
    embedding: {
      ...base.embedding,
      config: mergeComponentConfig(base.embedding?.config, storeEmbeddingConfig)
    },
    recordManager: base.recordManager
      ? {
          ...base.recordManager,
          config: mergeComponentConfig(base.recordManager?.config, storeRecordManagerConfig)
        }
      : null
  };
};

const mergeLoaderWithKbEntry = ({ loader, kbEntry, storeId }) => {
  const loaderMeta =
    loader?.metadata && typeof loader.metadata === "object" && !Array.isArray(loader.metadata)
      ? loader.metadata
      : loader?.loaderConfig?.metadata && typeof loader.loaderConfig.metadata === "object"
        ? loader.loaderConfig.metadata
        : {};
  const metadata = kbEntry?.metadata && Object.keys(kbEntry.metadata || {}).length ? kbEntry.metadata : loaderMeta;
  const resolvedStoreId = kbEntry?.storeId || storeId || DOCUMENT_STORE_ID;
  const loaderId = kbEntry?.loaderId || loader?.id || metadata?.docId || null;
  const nameCandidate =
    kbEntry?.name ||
    resolveName({
      name: loader?.name,
      metadata: { ...metadata, name: metadata?.name || loader?.name },
      fallback: loaderId || loader?.fileName
    });
  const descriptionCandidate = resolveDescription({
    description: kbEntry?.description,
    metadata: { ...metadata, description: metadata?.description || loader?.description }
  });
  const filename =
    kbEntry?.filename ||
    loader?.fileName ||
    metadata?.originalFileName ||
    metadata?.filename ||
    metadata?.name ||
    (Array.isArray(loader?.files) && loader.files[0]?.name) ||
    null;
  const size =
    kbEntry?.size ||
    metadata?.size ||
    loader?.size ||
    (Array.isArray(loader?.files) && loader.files[0]?.size) ||
    null;
  const uploadedAt =
    kbEntry?.uploadedAt ||
    metadata?.uploadedAt ||
    (Array.isArray(loader?.files) && loader.files[0]?.uploaded) ||
    loader?.uploadedAt ||
    loader?.createdAt ||
    kbEntry?.createdAt ||
    null;
  const mergedMetadata = { ...(metadata || {}), ...(kbEntry?.metadata || {}), type: kbEntry?.type || metadata?.type };
  const typeValue = mergedMetadata?.type || kbEntry?.type || null;
  const statusValue = loader?.status || loader?.state || null;

  return {
    storeId: resolvedStoreId,
    loaderId,
    kbId: kbEntry?.kbId || null,
    name: nameCandidate || "KB Entry",
    description: descriptionCandidate || "",
    filename,
    size,
    metadata: mergedMetadata || {},
    uploadedAt,
    createdAt: kbEntry?.createdAt || loader?.createdAt || null,
    updatedAt: kbEntry?.updatedAt || loader?.updatedAt || null,
    flowiseLoader: loader || null,
    status: statusValue,
    type: typeValue
  };
};

const deriveEntryStatus = (entry) => {
  const loaderStatus = entry?.status ? `${entry.status}`.toUpperCase() : null;
  const hasCoreFields =
    entry?.kbId &&
    entry?.filename &&
    entry?.size !== null &&
    entry?.size !== undefined &&
    entry?.uploadedAt;

  // If Flowise reports SYNC, trust it even if some fields are not yet populated locally
  if (loaderStatus === "SYNC") return "SYNC";

  // If we have the core fields, consider it synchronized
  if (hasCoreFields) return "SYNC";

  // Otherwise still pending
  return "PENDING";
};

const buildEntryResponse = async ({ storeId, loaderId, kbEntry, flowiseLoader, typeCfg }) => {
  const resolvedTypeCfg =
    typeCfg ||
    resolveTypeConfigByStoreId(storeId) ||
    resolveTypeConfig(kbEntry?.type || kbEntry?.metadata?.type);

  let loader = flowiseLoader || null;
  const existingKb =
    kbEntry || (loaderId ? await knowledgeBaseStore.findByLoader({ loaderId, storeId }) : null);

  if (!loader && storeId && loaderId) {
    try {
      const storeData = await fetchFlowiseStore(storeId);
      loader = Array.isArray(storeData?.loaders)
        ? storeData.loaders.find((l) => l.id === loaderId) || null
        : null;
    } catch (err) {
      console.warn("Flowise fetch failed while building entry response:", err?.message || err);
    }
  }

  if (!existingKb && !loader) {
    return null;
  }

  const merged = mergeLoaderWithKbEntry({
    loader,
    kbEntry: existingKb,
    storeId: storeId || existingKb?.storeId || loader?.storeId
  });

  const entry = {
    storeId: merged.storeId || storeId || resolvedTypeCfg?.storeId || null,
    loaderId: merged.loaderId || loaderId || null,
    kbId: merged.kbId || null,
    name: merged.name || null,
    description: merged.description || "",
    filename: merged.filename || null,
    size: merged.size ?? null,
    uploadedAt: merged.uploadedAt || null,
    metadata: merged.metadata || {},
    createdAt: merged.createdAt || null,
    updatedAt: merged.updatedAt || null,
    status: merged.status || loader?.status || loader?.state || null,
    type: merged.type || resolvedTypeCfg?.key || existingKb?.metadata?.type || null
  };

  return { ...entry, status: deriveEntryStatus(entry) };
};

const loadDocuments = async (storeId) => {
  const kbEntries = await knowledgeBaseStore.list(storeId);
  const kbMap = new Map(kbEntries.map((entry) => [entry.loaderId, entry]));

  try {
    const storeData = await fetchFlowiseStore(storeId);
    const loaders = Array.isArray(storeData?.loaders) ? storeData.loaders : [];
    const documents = loaders.map((loader) =>
      mergeLoaderWithKbEntry({ loader, kbEntry: kbMap.get(loader.id), storeId })
    );

    kbEntries.forEach((entry) => {
      if (!documents.some((doc) => doc.loaderId === entry.loaderId)) {
        documents.push(
          mergeLoaderWithKbEntry({
            loader: null,
            kbEntry: entry,
            storeId: entry.storeId || storeId
          })
        );
      }
    });

    return { storeData, documents };
  } catch (err) {
    if (!kbEntries.length) {
      throw err;
    }
    console.warn("Flowise fetch failed, falling back to Mongo cache:", err?.message || err);
    const documents = kbEntries.map((entry) =>
      mergeLoaderWithKbEntry({ loader: null, kbEntry: entry, storeId: entry.storeId || storeId })
    );
    return { storeData: null, documents };
  }
};

const buildUpsertForm = ({ docId, metadata, replaceExisting = false, file, collectionName, topK }) => {
  const componentPayloads = getComponentPayloads();
  if (collectionName && componentPayloads?.vectorStore?.config) {
    componentPayloads.vectorStore.config.collectionName = collectionName;
    if (topK) {
      componentPayloads.vectorStore.config.topK = topK;
    }
  } else if (topK && componentPayloads?.vectorStore?.config) {
    componentPayloads.vectorStore.config.topK = topK;
  }
  const form = new FormData();
  
  if (replaceExisting) {
    form.append("replaceExisting", "true");
  }
  if (docId) {
    form.append("docId", docId);
  }
  if (metadata && Object.keys(metadata).length) {
    form.append("metadata", JSON.stringify(metadata));
  }
  // Send all required components for the upsert
  form.append("loader", JSON.stringify(componentPayloads.loader));
  form.append("splitter", JSON.stringify(componentPayloads.splitter));
  form.append("vectorStore", JSON.stringify(componentPayloads.vectorStore));
  form.append("embedding", JSON.stringify(componentPayloads.embedding));
  
  if (componentPayloads.recordManager) {
    form.append("recordManager", JSON.stringify(componentPayloads.recordManager));
  }
  
  if (file) {
    form.append("files", fs.createReadStream(file.path), file.originalname);
  }
  
  return form;
};

const sendUpsertForm = async (storeId, form) => {
  const headers = form.getHeaders();
  return callFlowise("post", `/api/v1/document-store/upsert/${storeId}`, form, {
    headers,
    maxBodyLength: Infinity
  });
};

const resolveName = ({ name, metadata, fallback }) => {
  return (
    pickNonEmptyString(name) ||
    pickNonEmptyString(metadata?.name) ||
    pickNonEmptyString(metadata?.title) ||
    pickNonEmptyString(metadata?.filename) ||
    pickNonEmptyString(metadata?.originalFileName) ||
    pickNonEmptyString(fallback) ||
    "KB Entry"
  );
};

const resolveDescription = ({ description, metadata }) => {
  if (typeof description === "string" && description.trim()) return description.trim();
  if (metadata?.description && `${metadata.description}`.trim()) return `${metadata.description}`.trim();
  if (metadata?.summary && `${metadata.summary}`.trim()) return `${metadata.summary}`.trim();
  return "";
};

const performUpsert = async ({
  storeId,
  filePath,
  originalName,
  metadata,
  replaceExisting,
  name,
  description,
  type,
  collectionName,
  topK
}) => {
  if (!filePath || !originalName) {
    throw { status: 400, body: { error: "filePath and originalName are required" } };
  }
  if (!type) {
    throw { status: 400, body: { error: "type is required" } };
  }
  const stat = await fsp.stat(filePath);
  const fauxFile = {
    path: filePath,
    originalname: originalName,
    size: stat.size
  };

  const reservedIds = await nextKbId();
  const kbMetadataBase = {
    ...(metadata || {}),
    source: reservedIds.kbId,
    name: resolveName({ name, metadata, fallback: originalName }),
    description: resolveDescription({ description, metadata }),
    tags: Array.isArray(metadata?.tags) ? metadata.tags : metadata?.tags ? [metadata.tags] : [],
    type
  };

  const result = await sendUpsertForm(
    storeId,
    buildUpsertForm({
      metadata: kbMetadataBase,
      replaceExisting: !!replaceExisting,
      file: fauxFile,
      collectionName,
      topK
    })
  );

  const kbMetadata = {
    ...kbMetadataBase,
    loaderId: result.docId
  };

  const kbEntry = await knowledgeBaseStore.upsert({
    storeId,
    loaderId: result.docId,
    kbId: reservedIds.kbId,
    kbNumericId: reservedIds.kbNumericId,
    name: kbMetadata.name,
    description: kbMetadata.description,
    metadata: kbMetadata,
    type,
    filename: originalName,
    size: stat.size,
    uploadedAt: new Date()
  });
  await upsertManifestEntry(storeId, {
    docId: result.docId,
    filename: originalName,
    size: stat.size,
    metadata,
    uploadedAt: new Date().toISOString()
  });
  await cleanupUploadedFile(fauxFile);
  return { ...result, storeId, kbEntry };
};

const performReprocess = async ({
  storeId,
  loaderId,
  metadata,
  replaceExisting = true,
  filePath,
  originalName,
  name,
  description,
  type,
  collectionName,
  topK
}) => {
  if (!loaderId) {
    throw { status: 400, body: { error: "loaderId is required" } };
  }
  if (!type) {
    throw { status: 400, body: { error: "type is required" } };
  }

  let fauxFile = null;
  if (filePath && originalName) {
    const stat = await fsp.stat(filePath);
    fauxFile = { path: filePath, originalname: originalName, size: stat.size };
  }

  const form = buildUpsertForm({
    docId: loaderId,
    metadata: metadata || undefined,
    replaceExisting: replaceExisting !== false,
    file: fauxFile || undefined,
    collectionName,
    topK
  });

  const result = await sendUpsertForm(storeId, form);
  const kbEntry = await knowledgeBaseStore.upsert({
    storeId,
    loaderId,
    name: resolveName({ name, metadata, fallback: loaderId }),
    description: resolveDescription({ description, metadata }),
    metadata,
    type,
    filename: originalName || undefined
  });
  await upsertManifestEntry(storeId, {
    docId: loaderId,
    metadata: metadata || undefined,
    processedAt: new Date().toISOString()
  });

  if (fauxFile) {
    await cleanupUploadedFile(fauxFile);
  }
  return { ...result, storeId, kbEntry };
};

const performJsonUpsert = async ({ storeId, body, type, collectionName, topK }) => {
  if (!body || typeof body !== "object" || !Object.keys(body).length) {
    throw { status: 400, body: { error: "Request body is required" } };
  }
  if (!type) {
    throw { status: 400, body: { error: "type is required" } };
  }
  const pathUrl = `/api/v1/document-store/upsert/${storeId}`;
  const payload = {
    ...body
  };
  if (collectionName) {
    payload.vectorStore = {
      ...(payload.vectorStore || {}),
      config: {
        ...(payload.vectorStore?.config || {}),
        collectionName,
        ...(topK ? { topK } : {})
      }
    };
  } else if (topK) {
    payload.vectorStore = {
      ...(payload.vectorStore || {}),
      config: {
        ...(payload.vectorStore?.config || {}),
        topK
      }
    };
  }
  const result = await callFlowise("post", pathUrl, payload);
  if (result?.docId) {
    await knowledgeBaseStore.upsert({
      storeId,
      loaderId: result.docId,
      name: resolveName({ name: body.name, metadata: body.metadata, fallback: result.docId }),
      description: resolveDescription({ description: body.description, metadata: body.metadata }),
      metadata: { ...(body.metadata || {}), type },
      type,
      filename: body.filename || body.metadata?.originalFileName || null,
      size: body.metadata?.size || null,
      uploadedAt: body.uploadedAt ? new Date(body.uploadedAt) : new Date()
    });
  }
  return result;
};

const performRefresh = async ({ storeId, body }) => {
  const pathUrl = `/api/v1/document-store/refresh/${storeId}`;
  return callFlowise("post", pathUrl, body || {});
};

// helper to forward to Flowise, forwarding error body
const callFlowise = async (method, url, data, config = {}) => {
  try {
    const headers = {
      ...(config.headers || {}),
      ...(FLOWISE_API_KEY ? { Authorization: `Bearer ${FLOWISE_API_KEY}`, "x-api-key": FLOWISE_API_KEY } : {})
    };

    const axiosConfig = {
      method,
      url: `${FLOWISE_URL}${url}`,
      data,
      timeout: READ_TIMEOUT_MS,
      ...config,
      headers
    };

    const resp = await axios(axiosConfig);
    return resp.data;
  } catch (err) {
    if (err.response && err.response.data) {
      throw { status: err.response.status || 500, body: err.response.data };
    }
    throw { status: 500, body: { error: err.message } };
  }
};

const enqueueJob = async (routingKey, payload, jobId) => {
  const target = `${BROKER_URL}/publish/job`;
  await axios.post(
    target,
    { routingKey, payload, jobId },
    { timeout: READ_TIMEOUT_MS }
  );
};

const extractTokensFromSseChunk = (chunk) => {
  if (!chunk) return "";
  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : `${chunk}`;
  const tokens = [];

  text.split(/\r?\n/).forEach((line) => {
    if (!line.startsWith("data:")) return;
    const payload = line.replace(/^data:\s*/, "").trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload);
      const token =
        parsed?.token ||
        parsed?.data?.token ||
        parsed?.data ||
        parsed?.text ||
        parsed?.message ||
        parsed?.content ||
        null;
      if (typeof token === "string") {
        tokens.push(token);
      }
    } catch (_err) {
      if (payload && payload !== "[DONE]") {
        tokens.push(payload);
      }
    }
  });

  return tokens.join("");
};

const getManifestHandler = async (req, res) => {
  try {
    const storeId = getStoreIdFromReq(req);
    const { storeData, documents } = await loadDocuments(storeId);
    return res.json({
      storeId: storeData?.id || storeId,
      documents,
      ...(storeData ? { store: storeData } : {})
    });
  } catch (err) {
    console.error("manifest read error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to read document list" });
  }
};

const listDocumentsHandler = async (req, res) => {
  try {
    const storeId = getStoreIdFromReq(req);
    const { documents } = await loadDocuments(storeId);
    return res.json(documents);
  } catch (err) {
    console.error("list documents error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to read document list" });
  }
};

const getLoaderHandler = async (req, res) => {
  try {
    const loaderId = pickFirstString(req.params?.loaderId);
    if (!loaderId) {
      return res.status(400).json({ error: "loaderId is required" });
    }
    const storeId = await resolveStoreIdForLoader(req, loaderId);
    const entry = await buildEntryResponse({ storeId, loaderId });
    if (!entry) {
      return res.status(404).json({ error: "Knowledge base entry not found" });
    }
    return res.json(entry);
  } catch (err) {
    console.error("get loader error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to read knowledge base entry" });
  }
};

const listChunksHandler = async (req, res) => {
  try {
    const typeCfg =
      resolveTypeConfig(req.params?.type) ||
      resolveTypeConfig(req.query?.type) ||
      resolveTypeConfig(req.body?.type);
    const loaderId = pickFirstString(req.params?.loaderId);
    if (!loaderId) {
      return res.status(400).json({ error: "loaderId is required" });
    }
    const storeId = typeCfg?.storeId || (await resolveStoreIdForLoader(req, loaderId));
    const pageSource = req.query?.page ?? req.query?.pageNo ?? req.body?.page ?? req.body?.pageNo;
    const page = parsePositiveInt(pageSource, 1);
    const pathUrl = `/api/v1/document-store/chunks/${storeId}/${loaderId}/${page}`;
    const result = await callFlowise("get", pathUrl);
    if (typeof result === "string" && result.trim().startsWith("<!DOCTYPE")) {
      throw {
        status: 502,
        body: { error: "Flowise returned an unexpected HTML payload when requesting chunks" }
      };
    }
    return res.json(result);
  } catch (err) {
    console.error("list chunks error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to read chunks" });
  }
};

const listLoaderEntriesHandler = async (req, res) => {
  try {
    const filterType =
      resolveTypeConfig(req.query?.type) ||
      resolveTypeConfig(req.params?.type) ||
      resolveTypeConfig(req.body?.type) ||
      null;

    const targetTypes = filterType ? [filterType] : Object.values(KB_TYPES);
    const entries = [];

    for (const typeCfg of targetTypes) {
      const { storeData, documents } = await loadDocuments(typeCfg.storeId);

      const statusMap = new Map();
      if (Array.isArray(storeData?.loaders)) {
        storeData.loaders.forEach((loader) => {
          const id = loader?.id;
          if (!id) return;
          statusMap.set(id, loader.status || loader.state || null);
        });
      }

      (documents || []).forEach((doc) => {
        const loaderStatus = statusMap.get(doc.loaderId || doc.docId || doc.id) || doc.status || null;
        const enriched = {
          storeId: doc.storeId || typeCfg.storeId,
          loaderId: doc.loaderId || doc.docId || null,
          kbId: doc.kbId || null,
          name: doc.name || null,
          description: doc.description || "",
          filename: doc.filename || null,
          size: doc.size ?? null,
          uploadedAt: doc.uploadedAt || null,
          metadata: doc.metadata || {},
          createdAt: doc.createdAt || null,
          updatedAt: doc.updatedAt || null,
          status: loaderStatus,
          type: doc.type || typeCfg.key
        };
        entries.push({ ...enriched, status: deriveEntryStatus(enriched) });
      });
    }
    return res.json(entries);
  } catch (err) {
    console.error("list loader entries error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to read loader entries" });
  }
};

const updateChunkHandler = async (req, res) => {
  try {
    const loaderId = pickFirstString(req.params?.loaderId);
    const chunkId = pickFirstString(req.params?.chunkId);
    if (!loaderId || !chunkId) {
      return res.status(400).json({ error: "loaderId and chunkId are required" });
    }
    const storeId = await resolveStoreIdForLoader(req, loaderId);
    const body = req.body && Object.keys(req.body).length ? req.body : {};
    const pathUrl = `/api/v1/document-store/chunks/${storeId}/${loaderId}/${chunkId}`;
    const result = await callFlowise("put", pathUrl, body);
    return res.json(result);
  } catch (err) {
    console.error("update chunk error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to update chunk" });
  }
};

const updateKbMetaHandler = async (req, res) => {
  try {
    const loaderId = pickFirstString(req.params?.loaderId);
    if (!loaderId) {
      return res.status(400).json({ error: "loaderId is required" });
    }
    const typeCfgFromReq = resolveTypeConfig(req.body?.type || req.query?.type || req.params?.type);
    const storeId = typeCfgFromReq?.storeId || (await resolveStoreIdForLoader(req, loaderId));

    const name = pickNonEmptyString(req.body?.name);
    const descriptionInput = pickFirstString(req.body?.description);
    const description =
      typeof descriptionInput === "string" && descriptionInput.trim()
        ? descriptionInput.trim()
        : descriptionInput === "" || descriptionInput === null
          ? ""
          : null;

    if (!name && description === null) {
      return res.status(400).json({ error: "name and/or description is required" });
    }

    const existingEntry = await knowledgeBaseStore.findByLoader({ loaderId, storeId });
    if (!existingEntry) {
      return res.status(404).json({ error: "KB entry not found for loaderId" });
    }
    const typeCfg =
      typeCfgFromReq ||
      resolveTypeConfig(existingEntry?.type || existingEntry?.metadata?.type) ||
      resolveTypeConfigByStoreId(storeId);

    const mergedMetadata = {
      ...(existingEntry.metadata || {}),
      ...(name ? { name } : {}),
      ...(description !== null ? { description } : {})
    };

    const updated = await knowledgeBaseStore.updateByLoader({
      loaderId,
      storeId,
      patch: {
        ...(name ? { name } : {}),
        ...(description !== null ? { description } : {}),
        metadata: mergedMetadata
      }
    });

    await upsertManifestEntry(storeId, {
      docId: loaderId,
      name: updated?.name,
      description: updated?.description,
      metadata: updated?.metadata
    });

    const entry = await buildEntryResponse({
      storeId,
      loaderId,
      kbEntry: updated,
      typeCfg
    });

    return res.json(entry || updated);
  } catch (err) {
    console.error("update kb meta error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to update KB metadata" });
  }
};

const uploadAndUpsertHandler = async (req, res) => {
  const typeCfg = resolveTypeConfig(req.body?.type || req.query?.type || req.params?.type);
  if (!typeCfg) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "type is required" });
  }
  const storeId = typeCfg.storeId;
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  if (!req.file) {
    return res.status(400).json({ error: "file field is required" });
  }

  const name = pickNonEmptyString(req.body?.name);
  const description = pickNonEmptyString(req.body?.description);
  if (!name) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "name is required" });
  }
  if (!description) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "description is required" });
  }

  let metadata = {
    originalFileName: req.file.originalname,
    name,
    description
  };
  try {
    const parsedMetadata = parseMetadataInput(req.body?.metadata, {});
    const sourceUrl = pickNonEmptyString(req.body?.sourceUrl);
    metadata = {
      ...metadata,
      ...(parsedMetadata || {}),
      name,
      description,
      ...(sourceUrl ? { sourceUrl } : {})
    };
  } catch (err) {
    await cleanupUploadedFile(req.file);
    return res.status(err.status || 400).json(err.body || { error: "Invalid metadata" });
  }

  // enqueue heavy KB ingestion if async mode is enabled
  if (ASYNC_KB) {
    try {
      const jobId = randomUUID();
      await setJobStatus(jobId, {
        status: "queued",
        type: "kb.ingest",
        storeId,
        payload: { name, description, filename: req.file.originalname }
      });
    await enqueueJob("kb.ingest", {
      jobId,
      storeId,
      filePath: req.file.path,
      originalName: req.file.originalname,
      metadata,
      replaceExisting: req.body?.replaceExisting === "true",
      name,
      description,
      type: typeCfg.key,
      collectionName: typeCfg.collectionName,
      topK: typeCfg.topK
    });
      return res.status(202).json({ jobId, status: "queued" });
    } catch (err) {
      console.error("enqueue kb.ingest failed:", err);
      await cleanupUploadedFile(req.file);
      return res.status(500).json({ error: "Unable to enqueue KB ingestion" });
    }
  }

  try {
    const form = buildUpsertForm({
      metadata,
      replaceExisting: req.body?.replaceExisting === "true",
      file: req.file,
      collectionName: typeCfg.collectionName,
      topK: typeCfg.topK
    });
    const result = await sendUpsertForm(storeId, form);

    let kbEntry = null;
    try {
      kbEntry = await knowledgeBaseStore.create({
        storeId,
        loaderId: result.docId,
        name,
        description,
        type: typeCfg.key,
        filename: req.file.originalname,
        size: req.file.size,
        metadata,
        uploadedAt: new Date()
      });
    } catch (kbErr) {
      // attempt cleanup in Flowise to avoid orphan loader if KB create fails
      try {
        await callFlowise("delete", `/api/v1/document-store/loader/${storeId}/${result.docId}`);
      } catch (_cleanupErr) {
        // ignore cleanup failures
      }
      throw kbErr;
    }

    await upsertManifestEntry(storeId, {
      docId: result.docId,
      filename: req.file.originalname,
      size: req.file.size,
      metadata,
      uploadedAt: kbEntry?.uploadedAt?.toISOString?.() || new Date().toISOString(),
      kbId: kbEntry?.kbId,
      name: kbEntry?.name,
      description: kbEntry?.description
    });
    const entry = await buildEntryResponse({
      storeId,
      loaderId: result.docId,
      kbEntry,
      typeCfg
    });
    return res.json({ ...result, storeId, kb: kbEntry, kbId: kbEntry?.kbId, entry });
  } catch (err) {
    console.error("upsert upload error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to upsert document" });
  } finally {
    if (!ASYNC_KB) {
      await cleanupUploadedFile(req.file);
    }
  }
};

const reprocessHandler = async (req, res) => {
  const loaderId = pickFirstString(req.params?.loaderId);
  if (!loaderId) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "loaderId is required" });
  }
  const typeCfg = resolveTypeConfig(req.body?.type || req.query?.type || req.params?.type);
  const storeId = typeCfg?.storeId || (await resolveStoreIdForLoader(req, loaderId));
  if (!typeCfg) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "type is required" });
  }

  if (req.fileValidationError) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: req.fileValidationError });
  }

  let existingEntry = null;
  try {
    existingEntry = await knowledgeBaseStore.findByLoader({ loaderId, storeId });
  } catch (_err) {
    // non-fatal for processing
  }

  const name = pickNonEmptyString(req.body?.name) || existingEntry?.name;
  const descriptionInput = pickFirstString(req.body?.description);
  const description =
    descriptionInput === null || typeof descriptionInput === "undefined"
      ? existingEntry?.description || ""
      : `${descriptionInput}`.trim();

  if (!name) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "name is required" });
  }
  if (!description) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "description is required" });
  }

  let metadataPatch = null;
  try {
    metadataPatch = parseMetadataInput(req.body?.metadata, {});
  } catch (err) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(err.status || 400).json(err.body || { error: "Invalid metadata" });
  }

  const metadata = {
    ...(existingEntry?.metadata || {}),
    ...(metadataPatch || {}),
    name,
    description
  };
  if (existingEntry?.kbId) {
    metadata.kbId = existingEntry.kbId;
  }
  if (req.file) {
    metadata.originalFileName = req.file.originalname;
    metadata.size = req.file.size;
  }
  const sourceUrl = pickNonEmptyString(req.body?.sourceUrl);
  if (sourceUrl) {
    metadata.sourceUrl = sourceUrl;
  }

  if (ASYNC_KB) {
    try {
      const jobId = randomUUID();
      await setJobStatus(jobId, {
        status: "queued",
        type: "kb.reprocess",
        storeId,
        payload: { loaderId, name, description }
      });
      await enqueueJob("kb.reprocess", {
        jobId,
        storeId,
        loaderId,
        metadata,
        replaceExisting: req.body?.replaceExisting !== "false",
      filePath: req.file?.path,
      originalName: req.file?.originalname,
      name,
      description,
      type: typeCfg.key,
      collectionName: typeCfg.collectionName,
      topK: typeCfg.topK
    });
      return res.status(202).json({ jobId, status: "queued" });
    } catch (err) {
      console.error("enqueue kb.reprocess failed:", err);
      if (req.file) {
        await cleanupUploadedFile(req.file);
      }
      return res.status(500).json({ error: "Unable to enqueue KB reprocess" });
    }
  }

  try {
    const form = buildUpsertForm({
      docId: loaderId,
      metadata,
      replaceExisting: req.body?.replaceExisting !== "false",
      file: req.file || undefined,
      collectionName: typeCfg.collectionName,
      topK: typeCfg.topK
    });
    const result = await sendUpsertForm(storeId, form);
    const kbEntry = await knowledgeBaseStore.upsert({
      storeId,
      loaderId,
      name,
      description,
      type: typeCfg.key,
      filename: req.file?.originalname || existingEntry?.filename || null,
      size: req.file?.size ?? existingEntry?.size ?? null,
      metadata,
      uploadedAt: req.file ? new Date() : existingEntry?.uploadedAt || new Date()
    });
    await upsertManifestEntry(storeId, {
      docId: loaderId,
      metadata,
      processedAt: new Date().toISOString(),
      kbId: kbEntry?.kbId,
      name: kbEntry?.name,
      description: kbEntry?.description,
      filename: kbEntry?.filename,
      size: kbEntry?.size
    });
    const entry = await buildEntryResponse({
      storeId,
      loaderId,
      kbEntry,
      typeCfg
    });
    return res.json({ ...result, storeId, kb: kbEntry, kbId: kbEntry?.kbId, entry });
  } catch (err) {
    console.error("reprocess error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to process document" });
  } finally {
    if (!ASYNC_KB && req.file) {
      await cleanupUploadedFile(req.file);
    }
  }
};

const deleteLoaderHandler = async (req, res) => {
  try {
    const loaderId = pickFirstString(req.params?.loaderId);
    if (!loaderId) {
      return res.status(400).json({ error: "loaderId is required" });
    }
    const typeCfgFromReq = resolveTypeConfig(req.body?.type || req.query?.type || req.params?.type);
    const storeId = typeCfgFromReq?.storeId || (await resolveStoreIdForLoader(req, loaderId));
    const typeCfg = typeCfgFromReq || resolveTypeConfigByStoreId(storeId);
    if (!typeCfg) {
      return res.status(400).json({ error: "type is required" });
    }

    const preKb = await knowledgeBaseStore.findByLoader({ loaderId, storeId });
    let preLoader = null;
    try {
      const storeData = await fetchFlowiseStore(storeId);
      preLoader = Array.isArray(storeData?.loaders)
        ? storeData.loaders.find((l) => l.id === loaderId) || null
        : null;
    } catch (fetchErr) {
      console.warn("Flowise fetch failed before delete:", fetchErr?.message || fetchErr);
    }

    const pathUrl = `/api/v1/document-store/loader/${storeId}/${loaderId}`;
    const result = await callFlowise("delete", pathUrl);
    if (typeof result === "string" && result.trim().startsWith("<!DOCTYPE")) {
      throw {
        status: 502,
        body: { error: "Flowise returned an unexpected HTML page. Check Flowise logs for delete errors." }
      };
    }
    await removeManifestEntry(storeId, loaderId);
    await knowledgeBaseStore.remove({ loaderId, storeId });
    // trigger refresh to reprocess remaining chunks/loaders (queued if async)
    let refreshJobId = null;
    if (ASYNC_KB) {
      refreshJobId = randomUUID();
      await setJobStatus(refreshJobId, { status: "queued", type: "kb.refresh", storeId });
      await enqueueJob("kb.refresh", { jobId: refreshJobId, storeId, body: {} });
    } else {
      try {
        await callFlowise("post", `/api/v1/document-store/refresh/${storeId}`, {});
      } catch (refreshErr) {
        console.warn("refresh after delete failed:", refreshErr?.message || refreshErr);
      }
    }
    const entry = await buildEntryResponse({
      storeId,
      loaderId,
      kbEntry: preKb,
      flowiseLoader: preLoader,
      typeCfg
    });
    const responseBody = entry
      ? { ...entry, refreshJobId: refreshJobId || null }
      : { storeId, loaderId, refreshJobId: refreshJobId || null };
    return res.json(responseBody);
  } catch (err) {
    const flowiseMessage = err?.body?.message || err?.message || "";
    const isNotFound =
      err?.status === 404 ||
      /unable to locate loader/i.test(flowiseMessage) ||
      /not found/i.test(flowiseMessage);

    if (isNotFound) {
      return res.status(404).json({ error: "Loader not found in document store" });
    }

    console.error("delete loader error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to delete document" });
  }
};

const jsonUpsertHandler = async (req, res) => {
  try {
    const typeCfg = resolveTypeConfig(req.body?.type || req.query?.type || req.params?.type);
    if (!typeCfg) {
      return res.status(400).json({ error: "type is required" });
    }
    const storeId = typeCfg.storeId;
    if (!req.body || !Object.keys(req.body).length) {
      return res.status(400).json({ error: "Request body is required" });
    }
    if (ASYNC_KB) {
      const jobId = randomUUID();
      await setJobStatus(jobId, {
        status: "queued",
        type: "kb.upsert",
        storeId,
        payload: { docId: req.body?.docId }
      });
      await enqueueJob("kb.upsert", {
        jobId,
        storeId,
        body: req.body,
        type: typeCfg.key,
        collectionName: typeCfg.collectionName,
        topK: typeCfg.topK
      });
      return res.status(202).json({ jobId, status: "queued" });
    }
    const bodyWithSource = { ...req.body };
    const sourceUrl = pickNonEmptyString(req.body?.sourceUrl);
    if (sourceUrl) {
      bodyWithSource.metadata = {
        ...(req.body?.metadata || {}),
        sourceUrl
      };
    }
    const result = await performJsonUpsert({
      storeId,
      body: bodyWithSource,
      type: typeCfg.key,
      collectionName: typeCfg.collectionName,
      topK: typeCfg.topK
    });
    return res.json(result);
  } catch (err) {
    console.error("json upsert error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to upsert document" });
  }
};

const refreshHandler = async (req, res) => {
  try {
    const typeCfg = resolveTypeConfig(req.body?.type || req.query?.type || req.params?.type);
    if (!typeCfg) {
      return res.status(400).json({ error: "type is required" });
    }
    const storeId = typeCfg.storeId;
    const body = req.body && Object.keys(req.body).length ? req.body : {};
    if (ASYNC_KB) {
      const jobId = randomUUID();
      await setJobStatus(jobId, { status: "queued", type: "kb.refresh", storeId });
      await enqueueJob("kb.refresh", { jobId, storeId, body, type: typeCfg.key });
      return res.status(202).json({ jobId, status: "queued" });
    }
    const result = await performRefresh({ storeId, body });
    return res.json(result);
  } catch (err) {
    console.error("refresh error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to refresh document store" });
  }
};

const internalKbIngestHandler = async (req, res) => {
  if (!ensureWorkerAuth(req, res)) return;
  const {
    jobId,
    storeId: rawStoreId,
    filePath,
    originalName,
    metadata,
    replaceExisting,
    name,
    description,
    type,
    collectionName
  } = req.body || {};
  if (!jobId || !filePath || !originalName) {
    return res.status(400).json({ error: "jobId, filePath, and originalName are required" });
  }
  if (!type) {
    return res.status(400).json({ error: "type is required" });
  }
  const existingStatus = await readJobStatus(jobId);
  if (existingStatus?.status === "succeeded") {
    return res.json(existingStatus);
  }
  const storeId = rawStoreId || DOCUMENT_STORE_ID;
  await setJobStatus(jobId, { status: "processing", type: "kb.ingest", storeId });
  try {
    const result = await performUpsert({
      storeId,
      filePath,
      originalName,
      metadata,
      replaceExisting,
      name,
      description,
      type,
      collectionName
    });
    await setJobStatus(jobId, { status: "succeeded", type: "kb.ingest", storeId, result: { docId: result.docId } });
    return res.json({ ok: true, jobId, result });
  } catch (err) {
    await setJobStatus(jobId, {
      status: "failed",
      type: "kb.ingest",
      storeId,
      error: err?.body?.error || err?.message || "Job failed"
    });
    return res.status(err.status || 500).json(err.body || { error: "Job failed" });
  }
};

const internalKbReprocessHandler = async (req, res) => {
  if (!ensureWorkerAuth(req, res)) return;
  const {
    jobId,
    storeId: rawStoreId,
    loaderId,
    metadata,
    replaceExisting,
    filePath,
    originalName,
    name,
    description,
    type,
    collectionName
  } = req.body || {};
  if (!jobId || !loaderId) {
    return res.status(400).json({ error: "jobId and loaderId are required" });
  }
  if (!type) {
    return res.status(400).json({ error: "type is required" });
  }
  const existingStatus = await readJobStatus(jobId);
  if (existingStatus?.status === "succeeded") {
    return res.json(existingStatus);
  }
  const storeId = rawStoreId || DOCUMENT_STORE_ID;
  await setJobStatus(jobId, { status: "processing", type: "kb.reprocess", storeId });
  try {
    const result = await performReprocess({
      storeId,
      loaderId,
      metadata,
      replaceExisting,
      filePath,
      originalName,
      name,
      description,
      type,
      collectionName
    });
    await setJobStatus(jobId, {
      status: "succeeded",
      type: "kb.reprocess",
      storeId,
      result: { docId: result.docId || loaderId }
    });
    return res.json({ ok: true, jobId, result });
  } catch (err) {
    await setJobStatus(jobId, {
      status: "failed",
      type: "kb.reprocess",
      storeId,
      error: err?.body?.error || err?.message || "Job failed"
    });
    return res.status(err.status || 500).json(err.body || { error: "Job failed" });
  }
};

const internalKbUpsertHandler = async (req, res) => {
  if (!ensureWorkerAuth(req, res)) return;
  const { jobId, storeId: rawStoreId, body, type, collectionName } = req.body || {};
  if (!jobId) {
    return res.status(400).json({ error: "jobId is required" });
  }
  if (!type) {
    return res.status(400).json({ error: "type is required" });
  }
  const existingStatus = await readJobStatus(jobId);
  if (existingStatus?.status === "succeeded") {
    return res.json(existingStatus);
  }
  const storeId = rawStoreId || DOCUMENT_STORE_ID;
  await setJobStatus(jobId, { status: "processing", type: "kb.upsert", storeId });
  try {
    const result = await performJsonUpsert({ storeId, body: body || {}, type, collectionName });
    await setJobStatus(jobId, {
      status: "succeeded",
      type: "kb.upsert",
      storeId,
      result: { docId: result?.docId }
    });
    return res.json({ ok: true, jobId, result });
  } catch (err) {
    await setJobStatus(jobId, {
      status: "failed",
      type: "kb.upsert",
      storeId,
      error: err?.body?.error || err?.message || "Job failed"
    });
    return res.status(err.status || 500).json(err.body || { error: "Job failed" });
  }
};

const internalKbRefreshHandler = async (req, res) => {
  if (!ensureWorkerAuth(req, res)) return;
  const { jobId, storeId: rawStoreId, body } = req.body || {};
  if (!jobId) {
    return res.status(400).json({ error: "jobId is required" });
  }
  const existingStatus = await readJobStatus(jobId);
  if (existingStatus?.status === "succeeded") {
    return res.json(existingStatus);
  }
  const storeId = rawStoreId || DOCUMENT_STORE_ID;
  await setJobStatus(jobId, { status: "processing", type: "kb.refresh", storeId });
  try {
    const result = await performRefresh({ storeId, body: body || {} });
    await setJobStatus(jobId, { status: "succeeded", type: "kb.refresh", storeId });
    return res.json({ ok: true, jobId, result });
  } catch (err) {
    await setJobStatus(jobId, {
      status: "failed",
      type: "kb.refresh",
      storeId,
      error: err?.body?.error || err?.message || "Job failed"
    });
    return res.status(err.status || 500).json(err.body || { error: "Job failed" });
  }
};

const persistChatInteraction = async ({ flowId, sessionId, question, answer, requestMeta, userId }) => {
  const assistantMeta =
    Array.isArray(answer?.sourceDocuments) && answer.sourceDocuments.length
      ? { sourceDocumentsCount: answer.sourceDocuments.length }
      : undefined;

  await chatHistoryStore.appendInteraction({
    flowId,
    sessionId,
    question,
    answer,
    meta: {
      user: requestMeta && Object.keys(requestMeta).length ? { payload: requestMeta } : undefined,
      assistant: assistantMeta,
      conversation: userId ? { userId } : undefined
    }
  });
};

const streamPredictionToClient = async ({
  req,
  res,
  flowId,
  payload,
  sessionId,
  userId,
  question,
  requestMeta,
  metricContext
}) => {
  payload.streaming = true;

  const headers = {
    Accept: "text/event-stream",
    ...(FLOWISE_API_KEY ? { Authorization: `Bearer ${FLOWISE_API_KEY}`, "x-api-key": FLOWISE_API_KEY } : {})
  };

  const upstream = await axios({
    method: "post",
    url: `${FLOWISE_URL}/api/v1/prediction/${flowId}`,
    data: payload,
    responseType: "stream",
    headers,
    timeout: 0
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  res.write(`event: session\ndata: ${JSON.stringify({ sessionId, flowId })}\n\n`);

  let aggregated = "";
  const streamTokens = [];

  const handleChunk = (chunk) => {
    const token = extractTokensFromSseChunk(chunk);
    if (token) {
      aggregated += token;
      streamTokens.push(token);
    }
    res.write(chunk);
  };

  const handleError = (err) => {
    console.error("streaming proxy error:", err?.message || err);
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
      res.end();
    }
    if (upstream?.data?.destroy) {
      upstream.data.destroy();
    }
    if (metricContext?.startedAt) {
      const durationSeconds = hrtimeSeconds(metricContext.startedAt);
      const cpuSeconds = cpuUsageSeconds(metricContext.cpuStart || process.cpuUsage());
      observePredictionMetrics({
        flowId,
        status: "error",
        stream: true,
        durationSeconds,
        cpuSeconds
      });
    }
  };

  upstream.data.on("data", handleChunk);
  upstream.data.on("error", handleError);
  upstream.data.on("end", async () => {
    try {
      const answerPayload = { text: aggregated, streamTokens };
      await persistChatInteraction({ flowId, sessionId, question, answer: answerPayload, requestMeta, userId });
      if (metricContext?.startedAt) {
        const durationSeconds = hrtimeSeconds(metricContext.startedAt);
        const cpuSeconds = cpuUsageSeconds(metricContext.cpuStart || process.cpuUsage());
        const tokens = estimateTokens(aggregated);
        const costUsd = estimateCostUsdFromTokens(tokens);
        const gpuUtilPercent = sampleGpuUtilization();
        observePredictionMetrics({
          flowId,
          status: "success",
          stream: true,
          durationSeconds,
          cpuSeconds,
          tokens,
          costUsd,
          gpuUtilPercent
        });
      }
    } catch (err) {
      console.error("stream persistence error:", err);
      if (metricContext?.startedAt) {
        const durationSeconds = hrtimeSeconds(metricContext.startedAt);
        const cpuSeconds = cpuUsageSeconds(metricContext.cpuStart || process.cpuUsage());
        observePredictionMetrics({
          flowId,
          status: "error",
          stream: true,
          durationSeconds,
          cpuSeconds
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.write("event: done\ndata: \"done\"\n\n");
        res.end();
      }
    }
  });

  req.on("close", () => {
    if (upstream?.data?.destroy) {
      upstream.data.destroy();
    }
  });
};

const predictionProxyHandler = async (req, res) => {
  const metricContext = {
    startedAt: process.hrtime.bigint(),
    cpuStart: process.cpuUsage()
  };
  try {
    if (activePredictions >= MAX_CONCURRENT_PREDICTIONS) {
      return res.status(429).json({ error: "Too many concurrent predictions, please retry shortly" });
    }
    activePredictions += 1;

    const { flowId } = req.params;
    if (!flowId) {
      return res.status(400).json({ error: "flowId is required" });
    }
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Request body is required" });
    }

    const payload = buildPredictionPayload(req.body);
    const question = pickFirstString(req.body?.question) || pickFirstString(payload.question);
    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }
    payload.question = question;

    const sessionId = resolveSessionId(req);
    const userId = getUserIdFromReq(req);

    const requestMeta = { ...payload };
    if (typeof requestMeta.question !== "undefined") {
      delete requestMeta.question;
    }

    const wantsStream =
      req.body?.stream === true ||
      `${req.query?.stream}` === "true" ||
      /\bevent-stream\b/i.test(getHeaderValue(req, "accept") || "");

    if (wantsStream) {
      await streamPredictionToClient({
        req,
        res,
        flowId,
        payload,
        sessionId,
        userId,
        question,
        requestMeta,
        metricContext
      });
      return;
    }

    const response = await callFlowise("post", `/api/v1/prediction/${flowId}`, payload);
    await persistChatInteraction({ flowId, sessionId, question, answer: response, requestMeta, userId });

    const durationSeconds = hrtimeSeconds(metricContext.startedAt);
    const cpuSeconds = cpuUsageSeconds(metricContext.cpuStart);
    const textCandidate =
      typeof response?.text === "string"
        ? response.text
        : typeof response === "string"
          ? response
          : JSON.stringify(response || {});
    const tokens = estimateTokens(textCandidate);
    const costUsd = Number.isFinite(response?.costUsd)
      ? Number(response.costUsd)
      : estimateCostUsdFromTokens(tokens);
    const gpuUtilPercent = sampleGpuUtilization();

    observePredictionMetrics({
      flowId,
      status: "success",
      stream: false,
      durationSeconds,
      cpuSeconds,
      tokens,
      costUsd,
      gpuUtilPercent
    });

    return res.json({ ...response, sessionId });
  } catch (err) {
    console.error("prediction proxy error:", err);
    const durationSeconds = metricContext?.startedAt ? hrtimeSeconds(metricContext.startedAt) : undefined;
    const cpuSeconds = metricContext?.cpuStart ? cpuUsageSeconds(metricContext.cpuStart) : cpuUsageSeconds(process.cpuUsage());
    observePredictionMetrics({
      flowId: req?.params?.flowId,
      status: "error",
      stream: false,
      durationSeconds,
      cpuSeconds
    });
    return res.status(err.status || 500).json(err.body || { error: "Unable to complete prediction" });
  } finally {
    activePredictions = Math.max(0, activePredictions - 1);
  }
};

const listChatSessionsHandler = async (req, res) => {
  try {
    const { flowId } = req.params;
    if (!flowId) {
      return res.status(400).json({ error: "flowId is required" });
    }
    const sessions = await chatHistoryStore.listSessions(flowId);
    return res.json({ flowId, sessions });
  } catch (err) {
    console.error("list chat history error:", err);
    return res.status(500).json({ error: "Unable to load chat history" });
  }
};

const getChatSessionHandler = async (req, res) => {
  try {
    const { flowId, sessionId } = req.params;
    if (!flowId || !sessionId) {
      return res.status(400).json({ error: "flowId and sessionId are required" });
    }
    const history = await chatHistoryStore.getHistory(flowId, sessionId);
    if (!history) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    return res.json(history);
  } catch (err) {
    console.error("get chat history error:", err);
    return res.status(500).json({ error: "Unable to load chat session" });
  }
};

app.post("/api/v1/prediction/:flowId", requireAuth, predictionProxyHandler);
app.post("/api/v1/prediction/:flowId/stream", requireAuth, predictionProxyHandler);
app.get("/api/chat/history/:flowId", requireAuth, listChatSessionsHandler);
app.get("/api/chat/history/:flowId/:sessionId", requireAuth, getChatSessionHandler);

// KB routes: require staff/admin
const requireKbRole = [requireAuth, requireRole("staff", "admin")];

app.get("/api/kb", requireKbRole, getManifestHandler);
app.get("/api/kb/store/:storeId", requireKbRole, getManifestHandler);

app.get("/api/kb/loaders", requireKbRole, listDocumentsHandler);
app.get("/api/kb/:storeId/loaders", requireKbRole, listDocumentsHandler);
app.get("/api/kb/entries", requireKbRole, listLoaderEntriesHandler);
app.get("/api/kb/:storeId/entries", requireKbRole, listLoaderEntriesHandler);
app.get("/api/kb/loaders/:loaderId", requireKbRole, getLoaderHandler);
app.get("/api/kb/:storeId/loaders/:loaderId", requireKbRole, getLoaderHandler);
app.get("/api/kb/loaders/:loaderId/chunks", requireKbRole, listChunksHandler);
app.get("/api/kb/:storeId/loaders/:loaderId/chunks", requireKbRole, listChunksHandler);
app.put("/api/kb/loaders/:loaderId/chunks/:chunkId", requireKbRole, updateChunkHandler);
app.put("/api/kb/:storeId/loaders/:loaderId/chunks/:chunkId", requireKbRole, updateChunkHandler);
app.patch("/api/kb/loaders/:loaderId/meta", requireKbRole, updateKbMetaHandler);
app.patch("/api/kb/:storeId/loaders/:loaderId/meta", requireKbRole, updateKbMetaHandler);

app.post("/api/kb/loaders", requireKbRole, upload.single("file"), uploadAndUpsertHandler);
app.post("/api/kb/:storeId/loaders", requireKbRole, upload.single("file"), uploadAndUpsertHandler);

app.delete("/api/kb/loaders/:loaderId", requireKbRole, deleteLoaderHandler);
app.delete("/api/kb/:storeId/loaders/:loaderId", requireKbRole, deleteLoaderHandler);

app.put("/api/kb/loaders/:loaderId", requireKbRole, upload.single("file"), reprocessHandler);
app.put("/api/kb/:storeId/loaders/:loaderId", requireKbRole, upload.single("file"), reprocessHandler);
app.post("/api/kb/loaders/:loaderId/process", requireKbRole, upload.single("file"), reprocessHandler);
app.post("/api/kb/:storeId/loaders/:loaderId/process", requireKbRole, upload.single("file"), reprocessHandler);

app.post("/api/kb/upsert", requireKbRole, jsonUpsertHandler);
app.post("/api/kb/:storeId/upsert", requireKbRole, jsonUpsertHandler);

app.post("/api/kb/refresh", requireKbRole, refreshHandler);
app.post("/api/kb/:storeId/refresh", requireKbRole, refreshHandler);

app.get("/api/jobs/:jobId", async (req, res) => {
  const status = await readJobStatus(req.params.jobId);
  if (!status) return res.status(404).json({ error: "Job not found" });
  return res.json(status);
});

app.post("/internal/jobs/kb/ingest", internalKbIngestHandler);
app.post("/internal/jobs/kb/reprocess", internalKbReprocessHandler);
app.post("/internal/jobs/kb/upsert", internalKbUpsertHandler);
app.post("/internal/jobs/kb/refresh", internalKbRefreshHandler);
app.post("/internal/jobs/status", async (req, res) => {
  if (!ensureWorkerAuth(req, res)) return;
  const { jobId, status, error, result, type, storeId } = req.body || {};
  if (!jobId || !status) {
    return res.status(400).json({ error: "jobId and status are required" });
  }
  const record = await setJobStatus(jobId, { status, error, result, type, storeId });
  return res.json(record);
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/metrics", metricsHandler);

let serverInstance = null;

export const startServer = async (port = PORT) => {
  if (serverInstance) return serverInstance;
  await connectToMongo(MONGO_URI, MONGO_DB_NAME || undefined);
  await ensureUploadFolder();

  serverInstance = await new Promise((resolve, reject) => {
    const listener = app
      .listen(port, () => {
        console.log(
          `Flowise-proxy running on ${port}. FLOWISE_URL=${FLOWISE_URL}, UPLOAD_DIR=${UPLOAD_DIR}, DOCUMENT_STORE_ID=${DOCUMENT_STORE_ID}`
        );
        resolve(listener);
      })
      .on("error", reject);
  });

  return serverInstance;
};

export const stopServer = async () => {
  if (!serverInstance) return;
  await new Promise((resolve, reject) => {
    serverInstance.close((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
  serverInstance = null;
  
  // Close MongoDB connection
  try {
    const mongoose = await import("mongoose");
    if (mongoose.default.connection.readyState !== 0) {
      await mongoose.default.disconnect();
    }
  } catch (_err) {
    // Ignore if mongoose isn't loaded
  }
};

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("Failed to start flowise-proxy server", err);
    process.exit(1);
  });
}
