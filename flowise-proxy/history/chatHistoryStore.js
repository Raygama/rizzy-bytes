import mongoose from "mongoose";

const nowIso = () => new Date().toISOString();

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    content: { type: String, default: "" },
    timestamp: { type: Date, default: () => new Date() },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const chatHistorySchema = new mongoose.Schema(
  {
    flowId: { type: String, required: true },
    sessionId: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    messages: { type: [messageSchema], default: [] }
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
  }
);

chatHistorySchema.index({ flowId: 1, sessionId: 1 }, { unique: true });

const ChatHistoryModel = mongoose.models.ChatHistory || mongoose.model("ChatHistory", chatHistorySchema);

export class ChatHistoryStore {
  async read(flowId, sessionId) {
    try {
      return await ChatHistoryModel.findOne({ flowId, sessionId }).lean();
    } catch (err) {
      throw err;
    }
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

    const existing = await this.read(flowId, sessionId);
    const normalizedMessages = [];

    messages.forEach((message) => {
      if (!message) return;
      normalizedMessages.push({
        role: message.role || "system",
        content: message.content || "",
        timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
        metadata: message.metadata || null,
        raw: message.raw || null
      });
    });

    let mergedMetadata = existing?.metadata || {};
    if (metadata && typeof metadata === "object" && Object.keys(metadata).length) {
      mergedMetadata = { ...mergedMetadata, ...metadata };
    }

    const update = {
      $setOnInsert: { flowId, sessionId, createdAt: existing?.createdAt || new Date() },
      $set: { metadata: mergedMetadata, updatedAt: new Date() }
    };

    if (normalizedMessages.length) {
      update.$push = { messages: { $each: normalizedMessages } };
    }

    const result = await ChatHistoryModel.findOneAndUpdate({ flowId, sessionId }, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      lean: true
    });

    return result;
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
    const sessions = await ChatHistoryModel.find({ flowId }).sort({ updatedAt: -1 }).lean();
    return sessions.map((session) => {
      const lastMessage =
        Array.isArray(session.messages) && session.messages.length
          ? session.messages[session.messages.length - 1]
          : null;
      return {
        sessionId: session.sessionId,
        flowId: session.flowId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastMessage: lastMessage
          ? {
              role: lastMessage.role,
              content: lastMessage.content,
              timestamp: lastMessage.timestamp
            }
          : null
      };
    });
  }
}
