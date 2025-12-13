import mongoose from "mongoose";

const KB_ID_PREFIX = "KB-";
const KB_PAD_LENGTH = 3;

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
  },
  { versionKey: false }
);

const knowledgeBaseSchema = new mongoose.Schema(
  {
    kbId: { type: String, required: true, unique: true },
    kbNumericId: { type: Number, required: true, unique: true },
    storeId: { type: String, required: true },
    loaderId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    filename: { type: String, default: null },
    size: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    uploadedAt: { type: Date, default: () => new Date() }
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
  }
);

knowledgeBaseSchema.index({ storeId: 1, loaderId: 1 }, { unique: true });

const CounterModel = mongoose.models.KbCounter || mongoose.model("KbCounter", counterSchema);
const KnowledgeBaseModel =
  mongoose.models.KnowledgeBase || mongoose.model("KnowledgeBase", knowledgeBaseSchema);

const toPlain = (doc) => {
  if (!doc) return null;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
};

const formatKbId = (numericId) => `${KB_ID_PREFIX}${String(numericId).padStart(KB_PAD_LENGTH, "0")}`;

const nextKbId = async () => {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: "kbId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  const kbNumericId = counter?.seq || 1;
  return { kbNumericId, kbId: formatKbId(kbNumericId) };
};

class KnowledgeBaseStore {
  async create(entry) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ids = await nextKbId();
      try {
        const doc = await KnowledgeBaseModel.create({
          ...entry,
          ...ids
        });
        return toPlain(doc);
      } catch (err) {
        lastErr = err;
        if (err?.code === 11000) {
          continue;
        }
        throw err;
      }
    }
    if (lastErr) {
      throw lastErr;
    }
    throw new Error("Unable to create knowledge base entry");
  }

  async findByLoader({ loaderId, storeId = null }) {
    if (!loaderId) return null;
    const query = { loaderId };
    if (storeId) {
      query.storeId = storeId;
    }
    return KnowledgeBaseModel.findOne(query).lean();
  }

  async list(storeId = null) {
    const query = storeId ? { storeId } : {};
    return KnowledgeBaseModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async updateByLoader({ loaderId, storeId = null, patch = {} }) {
    if (!loaderId) return null;
    const update = {};
    Object.entries(patch).forEach(([key, value]) => {
      if (typeof value !== "undefined") {
        update[key] = value;
      }
    });
    if (!Object.keys(update).length) {
      return this.findByLoader({ loaderId, storeId });
    }
    update.updatedAt = new Date();
    const query = storeId ? { loaderId, storeId } : { loaderId };
    return KnowledgeBaseModel.findOneAndUpdate(
      query,
      { $set: update },
      { new: true, upsert: false, lean: true }
    );
  }

  async upsert({ loaderId, storeId, ...rest }) {
    const existing = await this.findByLoader({ loaderId, storeId });
    if (existing) {
      return this.updateByLoader({
        loaderId,
        storeId: storeId || existing.storeId,
        patch: rest
      });
    }
    return this.create({ loaderId, storeId, ...rest });
  }

  async remove({ loaderId, storeId = null }) {
    if (!loaderId) return null;
    const query = storeId ? { loaderId, storeId } : { loaderId };
    return KnowledgeBaseModel.findOneAndDelete(query).lean();
  }
}

export const knowledgeBaseStore = new KnowledgeBaseStore();
export { formatKbId };
