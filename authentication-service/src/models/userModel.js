import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  usn: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "staff", "admin"], default: "student" },
  photoProfile: { type: String }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
