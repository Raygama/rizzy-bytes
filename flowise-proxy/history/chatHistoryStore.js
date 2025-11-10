import fsp from "fs/promises";
import path from "path";

const sanitizeSegment = (value, fallback = "default") => {
  if (value === null || typeof value === "undefined") return fallback;
  const sanitized = `${value}`.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
  return sanitized || fallback;
};

const nowIso = () => new Date().toISOString();

export class ChatHistoryStore {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  async ensureDir(dir) {
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  flowDir(flowId) {
    return path.join(this.baseDir, sanitizeSegment(flowId, "default"));
  }

  sessionFile(flowId, sessionId) {
    return path.join(this.flowDir(flowId), `${sanitizeSegment(sessionId, "session")}.json`);
  }

  async read(flowId, sessionId) {
    try {
      const raw = await fsp.readFile(this.sessionFile(flowId, sessionId), "utf8");
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  async write(flowId, sessionId, payload) {
    await this.ensureDir(this.flowDir(flowId));
    await fsp.writeFile(this.sessionFile(flowId, sessionId), JSON.stringify(payload, null, 2));
    return payload;
  }

  extractAnswerText(answer) {
    if (answer === null || typeof answer === "undefined") return "";
    if (typeof answer === "string") return answer;
    if (typeof answer === "number" || typeof answer === "boolean") return `${answer}`;
    if (Array.isArray(answer)) {
      return answer.map((entry) => this.extractAnswerText(entry)).join(" ").trim();
    }
    if (typeof answer === "object") {
      if (answer.text) {
        return this.extractAnswerText(answer.text);
      }
      if (answer.message) {
        return this.extractAnswerText(answer.message);
      }
      if (answer.response) {
        return this.extractAnswerText(answer.response);
      }
    }
    return JSON.stringify(answer);
  }

  async appendMessages({ flowId, sessionId, messages = [], metadata = {} }) {
    if (!flowId || !sessionId || !messages.length) {
      return this.read(flowId, sessionId);
    }

    const existing =
      (await this.read(flowId, sessionId)) || {
        sessionId,
        flowId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        metadata: {},
        messages: []
      };

    existing.messages = existing.messages || [];
    messages.forEach((message) => {
      if (!message) return;
      const normalized = {
        role: message.role || "system",
        content: message.content || "",
        timestamp: message.timestamp || nowIso()
      };
      if (message.metadata) {
        normalized.metadata = message.metadata;
      }
      if (message.raw) {
        normalized.raw = message.raw;
      }
      existing.messages.push(normalized);
    });

    if (metadata && typeof metadata === "object" && Object.keys(metadata).length) {
      existing.metadata = { ...(existing.metadata || {}), ...metadata };
    }

    existing.updatedAt = nowIso();
    return this.write(flowId, sessionId, existing);
  }

  async appendInteraction({ flowId, sessionId, question, answer, meta = {} }) {
    const now = nowIso();
    const messages = [];

    if (question) {
      messages.push({
        role: "user",
        content: question,
        timestamp: now,
        metadata: meta.user || null
      });
    }

    if (typeof answer !== "undefined") {
      const responseMessage = {
        role: "assistant",
        content: this.extractAnswerText(answer),
        timestamp: nowIso(),
        metadata: meta.assistant || null
      };
      if (answer && typeof answer === "object") {
        responseMessage.raw = answer;
      }
      messages.push(responseMessage);
    }

    return this.appendMessages({
      flowId,
      sessionId,
      messages,
      metadata: meta.conversation || {}
    });
  }

  async getHistory(flowId, sessionId) {
    return this.read(flowId, sessionId);
  }

  async listSessions(flowId) {
    const dir = this.flowDir(flowId);
    try {
      const entries = await fsp.readdir(dir);
      const summaries = [];

      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;
        const sanitizedSessionId = entry.replace(/\.json$/, "");
        const sessionData = await this.read(flowId, sanitizedSessionId);
        if (!sessionData) continue;
        const lastMessage = Array.isArray(sessionData.messages)
          ? sessionData.messages[sessionData.messages.length - 1] || null
          : null;
        summaries.push({
          sessionId: sessionData.sessionId,
          flowId: sessionData.flowId,
          createdAt: sessionData.createdAt,
          updatedAt: sessionData.updatedAt,
          lastMessage: lastMessage
            ? {
                role: lastMessage.role,
                content: lastMessage.content,
                timestamp: lastMessage.timestamp
              }
            : null
        });
      }

      return summaries.sort((a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }
}
