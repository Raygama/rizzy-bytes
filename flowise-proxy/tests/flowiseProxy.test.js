import assert from "node:assert";
import { after, before, test } from "node:test";
import axios from "axios";
import { randomUUID } from "crypto";

process.env.NODE_ENV = "test";
process.env.FLOWISE_API_KEY = process.env.FLOWISE_API_KEY || "pTnZk73MAtw2YhSYUw28urAeKa4dSTGHlZKwOVPVoy4";
process.env.FLOWISE_URL = process.env.FLOWISE_URL || "http://localhost:3006";
process.env.DOCUMENT_STORE_ID =
  process.env.DOCUMENT_STORE_ID || "d21759a2-d263-414e-b5a4-f2e5819d516e";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/helpdesk";

const FLOW_ID = process.env.TEST_FLOW_ID || "2d844a72-3dc8-4475-8134-9f034015741f";
const API_KEY = process.env.TEST_FLOWISE_API_KEY || process.env.FLOWISE_API_KEY;
const TEST_PORT = parseInt(process.env.TEST_PROXY_PORT || "4100", 10);
const BASE_URL = `http://localhost:${TEST_PORT}`;

let startServer;
let stopServer;
let serverInstance;
let client;

const extractTokensFromSseChunk = (chunk) => {
  const data = chunk?.toString?.("utf8") || "";
  let aggregated = "";
  data.split(/\r?\n/).forEach((line) => {
    if (!line.startsWith("data:")) return;
    const payload = line.replace(/^data:\s*/, "").trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload);
      const token =
        parsed?.token ||
        parsed?.text ||
        parsed?.data?.token ||
        parsed?.data ||
        parsed?.message ||
        parsed?.content;
      if (typeof token === "string") {
        aggregated += token;
      }
    } catch (_err) {
      aggregated += payload;
    }
  });
  return aggregated;
};

before(async () => {
  const serverModule = await import("../server.js");
  startServer = serverModule.startServer;
  stopServer = serverModule.stopServer;
  serverInstance = await startServer(TEST_PORT);

  client = axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true,
    timeout: 120000,
    headers: API_KEY
      ? {
          Authorization: `Bearer ${API_KEY}`,
          "x-api-key": API_KEY
        }
      : {}
  });
});

after(async () => {
  if (stopServer) {
    await stopServer();
  }
});

const askPrediction = async (sessionId, question, extra = {}) => {
  const resp = await client.post(`/api/v1/prediction/${FLOW_ID}`, { question, sessionId, ...extra });
  assert.strictEqual(resp.status, 200, `Prediction failed: ${resp.status} ${resp.data?.error || ""}`);
  assert.ok(resp.data?.sessionId, "sessionId missing in response");
  return resp.data;
};

test(
  "stores multi-round conversations in Mongo and returns full history per session",
  async () => {
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await askPrediction(sessionA, "Hello from session A");
    await askPrediction(sessionA, "Follow up question A");

    await askPrediction(sessionB, "Hello from session B");
    await askPrediction(sessionB, "Another turn for session B");

    const listResp = await client.get(`/api/chat/history/${FLOW_ID}`);
    assert.strictEqual(listResp.status, 200, "Listing sessions failed");
    const sessionIds = (listResp.data?.sessions || []).map((s) => s.sessionId);
    assert.ok(sessionIds.includes(sessionA), "Session A missing from history list");
    assert.ok(sessionIds.includes(sessionB), "Session B missing from history list");

    const historyA = await client.get(`/api/chat/history/${FLOW_ID}/${sessionA}`);
    assert.strictEqual(historyA.status, 200, "Session A history fetch failed");
    assert.ok(
      (historyA.data?.messages || []).length >= 4,
      "Session A should contain both user and assistant messages"
    );

    const historyB = await client.get(`/api/chat/history/${FLOW_ID}/${sessionB}`);
    assert.strictEqual(historyB.status, 200, "Session B history fetch failed");
    assert.ok(
      (historyB.data?.messages || []).length >= 4,
      "Session B should contain both user and assistant messages"
    );
  },
  { timeout: 180000 }
);

test(
  "streams responses and persists streamed assistant text to history",
  async () => {
    const sessionId = randomUUID();
    const streamResp = await client.post(
      `/api/v1/prediction/${FLOW_ID}/stream`,
      { question: "Stream this response please", sessionId, stream: true },
      { responseType: "stream", headers: { Accept: "text/event-stream" } }
    );

    assert.strictEqual(streamResp.status, 200, `Streaming endpoint failed: ${streamResp.status}`);

    let streamedText = "";
    await new Promise((resolve, reject) => {
      streamResp.data.on("data", (chunk) => {
        streamedText += extractTokensFromSseChunk(chunk);
      });
      streamResp.data.on("end", resolve);
      streamResp.data.on("error", reject);
    });

    assert.ok(streamedText.trim().length > 0, "Expected streamed text tokens");

    const history = await client.get(`/api/chat/history/${FLOW_ID}/${sessionId}`);
    assert.strictEqual(history.status, 200, "History fetch after streaming failed");
    const assistantMessages = (history.data?.messages || []).filter((msg) => msg.role === "assistant");
    assert.ok(
      assistantMessages.some((msg) => `${msg.content || ""}`.trim().length > 0),
      "Streamed assistant response not stored"
    );
  },
  { timeout: 180000 }
);
