// server.js
import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { ChatHistoryStore } from "./history/chatHistoryStore.js";

dotenv.config();

// config
const FLOWISE_URL = process.env.FLOWISE_URL || "http://flowise:3000";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/uploads";
const CHAT_HISTORY_DIR = process.env.CHAT_HISTORY_DIR || path.join(UPLOAD_DIR, "chat-history");
const PORT = parseInt(process.env.PORT || "4000", 10);
const READ_TIMEOUT_MS = parseInt(process.env.READ_TIMEOUT_MS || "60000", 10);
const DOCUMENT_STORE_ID = process.env.DOCUMENT_STORE_ID || "d21759a2-d263-414e-b5a4-f2e5819d516e";
const DEFAULT_TEXT_SPLITTER = {
  chunkSize: 1000,
  chunkOverlap: 200
};

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

// load API key either from env or from secret file path
let FLOWISE_API_KEY = process.env.FLOWISE_API_KEY || null;
if (!FLOWISE_API_KEY && process.env.FLOWISE_API_KEY_FILE) {
  try {
    FLOWISE_API_KEY = fs.readFileSync(process.env.FLOWISE_API_KEY_FILE, "utf8").trim();
  } catch (e) {
    console.warn("Could not read FLOWISE_API_KEY_FILE", e.message);
  }
}

const chatHistoryStore = new ChatHistoryStore(CHAT_HISTORY_DIR);

const app = express();
app.use(express.json());

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
const upload = multer({ storage });

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

const getStoreIdFromReq = (req) => {
  return (
    pickFirstString(req.params?.storeId) ||
    pickFirstString(req.query?.storeId) ||
    pickFirstString(req.body?.storeId) ||
    DOCUMENT_STORE_ID
  );
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

const mergeFlowiseLoadersWithManifest = (loaders, manifest) => {
  if (!Array.isArray(loaders) || !loaders.length) return [...manifest];
  const manifestMap = new Map(manifest.map((entry) => [entry.docId, entry]));
  const merged = loaders.map((loader) => {
    const manifestEntry = manifestMap.get(loader.id) || {};
    return {
      docId: loader.id,
      ...loader,
      ...manifestEntry
    };
  });

  manifest.forEach((entry) => {
    if (!loaders.some((loader) => loader.id === entry.docId)) {
      merged.push(entry);
    }
  });

  return merged;
};

const loadDocuments = async (storeId) => {
  const manifest = await readManifest(storeId);
  try {
    const storeData = await fetchFlowiseStore(storeId);
    const loaders = Array.isArray(storeData?.loaders) ? storeData.loaders : [];
    const documents = mergeFlowiseLoadersWithManifest(loaders, manifest);
    return { storeData, documents };
  } catch (err) {
    if (!manifest.length) {
      throw err;
    }
    console.warn("Flowise fetch failed, falling back to manifest cache:", err?.message || err);
    return { storeData: null, documents: manifest };
  }
};

const buildUpsertForm = ({ docId, metadata, replaceExisting = false, file }) => {
  const componentPayloads = getComponentPayloads();
  const resolvedFileName =
    file?.originalname ||
    (metadata &&
      typeof metadata === "object" &&
      (metadata.originalFileName || metadata.filename || metadata.fileName || metadata.name));
  if (componentPayloads?.loader?.config) {
    componentPayloads.loader.config = withOmitMetadataRules(componentPayloads.loader.config, resolvedFileName);
  }
  const form = new FormData();
  form.append("replaceExisting", replaceExisting ? "true" : "false");
  if (docId) {
    form.append("docId", docId);
  }
  if (metadata && Object.keys(metadata).length) {
    form.append("metadata", JSON.stringify(metadata));
  }
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

const listChunksHandler = async (req, res) => {
  try {
    const storeId = getStoreIdFromReq(req);
    const loaderId = pickFirstString(req.params?.loaderId);
    if (!loaderId) {
      return res.status(400).json({ error: "loaderId is required" });
    }
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

const uploadAndUpsertHandler = async (req, res) => {
  const storeId = getStoreIdFromReq(req);
  if (!req.file) {
    return res.status(400).json({ error: "file field is required" });
  }

  let metadata = { originalFileName: req.file.originalname };
  try {
    metadata = parseMetadataInput(req.body?.metadata, metadata) || metadata;
  } catch (err) {
    await cleanupUploadedFile(req.file);
    return res.status(err.status || 400).json(err.body || { error: "Invalid metadata" });
  }

  try {
    const form = buildUpsertForm({
      metadata,
      replaceExisting: req.body?.replaceExisting === "true",
      file: req.file
    });
    const result = await sendUpsertForm(storeId, form);
    await upsertManifestEntry(storeId, {
      docId: result.docId,
      filename: req.file.originalname,
      size: req.file.size,
      metadata,
      uploadedAt: new Date().toISOString()
    });
    return res.json({ ...result, storeId });
  } catch (err) {
    console.error("upsert upload error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to upsert document" });
  } finally {
    await cleanupUploadedFile(req.file);
  }
};

const reprocessHandler = async (req, res) => {
  const storeId = getStoreIdFromReq(req);
  const { loaderId } = req.params;
  if (!loaderId) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "loaderId is required" });
  }

  let metadataPatch = null;
  try {
    metadataPatch = parseMetadataInput(req.body?.metadata, null);
  } catch (err) {
    if (req.file) await cleanupUploadedFile(req.file);
    return res.status(err.status || 400).json(err.body || { error: "Invalid metadata" });
  }

  try {
    const form = buildUpsertForm({
      docId: loaderId,
      metadata: metadataPatch || undefined,
      replaceExisting: req.body?.replaceExisting !== "false",
      file: req.file || undefined
    });
    const result = await sendUpsertForm(storeId, form);
    await upsertManifestEntry(storeId, {
      docId: loaderId,
      metadata: metadataPatch || undefined,
      processedAt: new Date().toISOString()
    });
    return res.json({ ...result, storeId });
  } catch (err) {
    console.error("reprocess error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to process document" });
  } finally {
    if (req.file) {
      await cleanupUploadedFile(req.file);
    }
  }
};

const deleteLoaderHandler = async (req, res) => {
  try {
    const storeId = getStoreIdFromReq(req);
    const { loaderId } = req.params;
    if (!loaderId) {
      return res.status(400).json({ error: "loaderId is required" });
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
    return res.json({ ...result, storeId, loaderId });
  } catch (err) {
    console.error("delete loader error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to delete document" });
  }
};

const jsonUpsertHandler = async (req, res) => {
  try {
    const storeId = getStoreIdFromReq(req);
    if (!req.body || !Object.keys(req.body).length) {
      return res.status(400).json({ error: "Request body is required" });
    }
    const pathUrl = `/api/v1/document-store/upsert/${storeId}`;
    const result = await callFlowise("post", pathUrl, req.body);
    return res.json(result);
  } catch (err) {
    console.error("json upsert error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to upsert document" });
  }
};

const refreshHandler = async (req, res) => {
  try {
    const storeId = getStoreIdFromReq(req);
    const body = req.body && Object.keys(req.body).length ? req.body : {};
    const pathUrl = `/api/v1/document-store/refresh/${storeId}`;
    const result = await callFlowise("post", pathUrl, body);
    return res.json(result);
  } catch (err) {
    console.error("refresh error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to refresh document store" });
  }
};

const predictionProxyHandler = async (req, res) => {
  try {
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

    const response = await callFlowise("post", `/api/v1/prediction/${flowId}`, payload);
    const assistantMeta =
      Array.isArray(response?.sourceDocuments) && response.sourceDocuments.length
        ? { sourceDocumentsCount: response.sourceDocuments.length }
        : undefined;

    await chatHistoryStore.appendInteraction({
      flowId,
      sessionId,
      question,
      answer: response,
      meta: {
        user: Object.keys(requestMeta).length ? { payload: requestMeta } : undefined,
        assistant: assistantMeta,
        conversation: userId ? { userId } : undefined
      }
    });

    return res.json({ ...response, sessionId });
  } catch (err) {
    console.error("prediction proxy error:", err);
    return res.status(err.status || 500).json(err.body || { error: "Unable to complete prediction" });
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

app.post("/api/v1/prediction/:flowId", predictionProxyHandler);
app.get("/api/chat/history/:flowId", listChatSessionsHandler);
app.get("/api/chat/history/:flowId/:sessionId", getChatSessionHandler);

app.get("/api/kb", getManifestHandler);
app.get("/api/kb/store/:storeId", getManifestHandler);

app.get("/api/kb/loaders", listDocumentsHandler);
app.get("/api/kb/:storeId/loaders", listDocumentsHandler);
app.get("/api/kb/loaders/:loaderId/chunks", listChunksHandler);
app.get("/api/kb/:storeId/loaders/:loaderId/chunks", listChunksHandler);

app.post("/api/kb/loaders", upload.single("file"), uploadAndUpsertHandler);
app.post("/api/kb/:storeId/loaders", upload.single("file"), uploadAndUpsertHandler);

app.delete("/api/kb/loaders/:loaderId", deleteLoaderHandler);
app.delete("/api/kb/:storeId/loaders/:loaderId", deleteLoaderHandler);

app.post("/api/kb/loaders/:loaderId/process", upload.single("file"), reprocessHandler);
app.post("/api/kb/:storeId/loaders/:loaderId/process", upload.single("file"), reprocessHandler);

app.post("/api/kb/upsert", jsonUpsertHandler);
app.post("/api/kb/:storeId/upsert", jsonUpsertHandler);

app.post("/api/kb/refresh", refreshHandler);
app.post("/api/kb/:storeId/refresh", refreshHandler);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(
    `Flowise-proxy running on ${PORT}. FLOWISE_URL=${FLOWISE_URL}, UPLOAD_DIR=${UPLOAD_DIR}, DOCUMENT_STORE_ID=${DOCUMENT_STORE_ID}`
  );
});
