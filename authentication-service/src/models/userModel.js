import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    usn: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "staff", "admin", "guest"], default: "student" },
    status: { type: String, enum: ["ONLINE", "OFFLINE"], default: "OFFLINE" },
    lastStatusChangedAt: { type: Date, default: null },
    totalActiveSeconds: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
