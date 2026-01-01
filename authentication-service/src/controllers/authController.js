import axios from "axios";
import User from "../models/userModel.js";
import OTP from "../models/otpModel.js";
import { hashPassword, comparePassword, hashOtp } from "../utils/hash.js";
import {
  validatePayload,
  emailRule,
  passwordRule,
  otpRule,
  usnRule,
} from "../utils/validation.js";
import jwt from "jsonwebtoken";

const brokerURL = process.env.BROKER_URL || "http://broker-service:3000";
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_OTP_TTL_MS = 5 * 60 * 1000;
const RESET_OTP_TTL_MS = 15 * 60 * 1000;
const identifierRule = { type: "string", notEmpty: true, minLength: 3, maxLength: 64 };

const genOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const validationError = (res, errors) =>
  res.status(400).json({ error: "Invalid input", details: errors });

const sendOtpEmail = async ({ to, otp, purpose, username }) => {
  await axios
    .post(`${brokerURL}/publish/otp`, {
      type: "SEND_OTP",
      to,
      otp,
      purpose,
      username
    })
    .catch(() => {});
};

const issueOtp = async ({ email, purpose, ttlMs }) => {
  const otp = genOTP();
  const hashedOtp = await hashOtp(otp);
  await OTP.deleteMany({ email, purpose });
  await OTP.create({
    email,
    otp: hashedOtp,
    purpose,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return otp;
};

const findActiveOtp = async ({ email, purpose }) => {
  const otpDoc = await OTP.findOne({ email, purpose }).sort({ createdAt: -1 });
  if (!otpDoc) return null;
  if (otpDoc.expiresAt <= new Date()) {
    await OTP.deleteMany({ email, purpose });
    return null;
  }
  return otpDoc;
};

const handleOtpFailure = async (otpDoc) => {
  const updated = await OTP.findOneAndUpdate(
    { _id: otpDoc._id },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  const attempts = updated?.attempts ?? ((otpDoc.attempts ?? 0) + 1);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await OTP.deleteMany({ email: otpDoc.email, purpose: otpDoc.purpose });
    return true;
  }
  return false;
};

export const register = async (req, res) => {
  try {
    const { errors, cleaned } = validatePayload(req.body, {
      email: emailRule,
      usn: usnRule,
      password: passwordRule,
    });
    if (errors.length) return validationError(res, errors);

    const { email, usn, password } = cleaned;

    const exists = await User.findOne({ $or: [{ email }, { usn }] });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const hashed = await hashPassword(password);
    const user = await User.create({
      email,
      usn,
      password: hashed,
      role: "student",
      status: "OFFLINE",
      lastStatusChangedAt: null,
      totalActiveSeconds: 0
    });

    res.status(201).json({
      message: "User created",
      user: { email: user.email, usn: user.usn, role: user.role },
    });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Unable to register user" });
  }
};

// =========================
// LOGIN STEP 1 — SEND OTP (TETAP SAMA)
// =========================
export const login = async (req, res) => {
  try {
    const { errors, cleaned } = validatePayload(req.body, {
      identifier: identifierRule,
      email: { ...emailRule, required: false },
      password: passwordRule,
    });
    if (!cleaned.identifier && !cleaned.email) {
      errors.push("identifier or email is required");
    }
    if (errors.length) return validationError(res, errors);

    const { identifier, email, password } = cleaned;
    const id = identifier || email;

    const user = await User.findOne({ $or: [{ email: id }, { usn: id }] });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const otp = await issueOtp({ email: user.email, purpose: "login", ttlMs: LOGIN_OTP_TTL_MS });
    await sendOtpEmail({ to: user.email, otp, purpose: "login", username: user.usn });

    res.json({
      message: "OTP sent to email",
      email: user.email,
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: "Unable to start login" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { errors, cleaned } = validatePayload(req.body, { email: emailRule });
    if (errors.length) return validationError(res, errors);

    const { email } = cleaned;
    const user = await User.findOne({ email });
    if (user) {
      const otp = await issueOtp({ email: user.email, purpose: "reset", ttlMs: RESET_OTP_TTL_MS });
      await sendOtpEmail({ to: user.email, otp, purpose: "reset", username: user.usn });
    }

    // Respond uniformly to avoid account enumeration
    return res.json({ message: "If the account exists, a reset code has been sent" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Unable to start password reset" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { errors, cleaned } = validatePayload(req.body, {
      email: emailRule,
      otp: otpRule,
      newPassword: passwordRule,
    });
    if (errors.length) return validationError(res, errors);

    const { email, otp, newPassword } = cleaned;

    const otpDoc = await findActiveOtp({ email, purpose: "reset" });
    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const validOtp = await comparePassword(otp, otpDoc.otp);
    if (!validOtp) {
      const blocked = await handleOtpFailure(otpDoc);
      return res
        .status(blocked ? 429 : 400)
        .json({ message: blocked ? "Too many invalid OTP attempts. Request a new code." : "Invalid OTP" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = await hashPassword(newPassword);
    await user.save();
    await OTP.deleteMany({ email, purpose: "reset" });

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Unable to reset password" });
  }
};

// =========================
// LOGIN STEP 2 — VERIFY OTP (TETAP SAMA)
// =========================
export const verifyLoginOTP = async (req, res) => {
  try {
    const { errors, cleaned } = validatePayload(req.body, {
      email: emailRule,
      otp: otpRule,
    });
    if (errors.length) return validationError(res, errors);

    const { email, otp } = cleaned;

    const otpDoc = await findActiveOtp({ email, purpose: "login" });
    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const validOtp = await comparePassword(otp, otpDoc.otp);
    if (!validOtp) {
      const blocked = await handleOtpFailure(otpDoc);
      return res
        .status(blocked ? 429 : 400)
        .json({ message: blocked ? "Too many invalid OTP attempts. Request a new code." : "Invalid OTP" });
    }

    // ambil data user berdasarkan email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // hapus semua OTP login untuk email tsb
    await OTP.deleteMany({ email, purpose: "login" });

    // generate JWT
    const payload = {
      usn: user.usn,
      role: user.role,
      sub: user._id?.toString(),
    };

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Auth not configured" });
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    user.status = "ONLINE";
    user.lastStatusChangedAt = new Date();
    await user.save();

    return res.json({
      message: "Login success",
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Unable to verify login" });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(400).json({ message: "Invalid user context" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.status === "ONLINE" && user.lastStatusChangedAt) {
      const seconds = Math.max(0, (Date.now() - new Date(user.lastStatusChangedAt).getTime()) / 1000);
      user.totalActiveSeconds += seconds;
    }
    user.status = "OFFLINE";
    user.lastStatusChangedAt = new Date();
    await user.save();
    return res.json({ message: "Logged out", status: user.status });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ message: "Unable to logout" });
  }
};

export const createUser = async (req, res) => {
  try {
    const { errors, cleaned } = validatePayload(req.body, {
      email: emailRule,
      usn: usnRule,
      password: passwordRule,
      role: { type: "string", oneOf: ["student", "staff", "admin", "guest"], required: false },
      photoProfile: { type: "string", maxLength: 2048, required: false },
    });
    if (errors.length) return validationError(res, errors);

    const { email, usn, password, role = "student", photoProfile } = cleaned;
    const exists = await User.findOne({ $or: [{ email }, { usn }] });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const hashed = await hashPassword(password);
    const user = await User.create({
      email,
      usn,
      password: hashed,
      role,
      photoProfile,
      status: "OFFLINE",
      lastStatusChangedAt: null,
      totalActiveSeconds: 0
    });

    return res.status(201).json({
      message: "User created",
      user: { id: user._id, email: user.email, usn: user.usn, role: user.role }
    });
  } catch (err) {
    console.error("createUser error:", err);
    return res.status(500).json({ error: "Unable to create user" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { errors, cleaned } = validatePayload(req.body, {
      email: { ...emailRule, required: false },
      usn: { ...usnRule, required: false },
      role: { type: "string", oneOf: ["student", "staff", "admin", "guest"], required: false },
      password: { ...passwordRule, required: false },
    });
    if (errors.length) return validationError(res, errors);

    const patch = { ...cleaned };
    if (patch.password) {
      patch.password = await hashPassword(patch.password);
    }
    if (!Object.keys(patch).length) {
      return validationError(res, ["No valid fields to update"]);
    }
    const user = await User.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ message: "User updated", user: { id: user._id, email: user.email, usn: user.usn, role: user.role } });
  } catch (err) {
    console.error("updateUser error:", err);
    return res.status(500).json({ error: "Unable to update user" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return validationError(res, ["id is required"]);
    }
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "User not found" });
    return res.json({ message: "User deleted" });
  } catch (err) {
    console.error("deleteUser error:", err);
    return res.status(500).json({ error: "Unable to delete user" });
  }
};

export const listUserActivity = async (_req, res) => {
  try {
    const users = await User.find({}, { email: 1, usn: 1, role: 1, status: 1, totalActiveSeconds: 1, lastStatusChangedAt: 1 });
    return res.json({ users });
  } catch (err) {
    console.error("listUserActivity error:", err);
    return res.status(500).json({ error: "Unable to load activity" });
  }
};

export const listUsers = async (_req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).lean();
    return res.json({ users });
  } catch (err) {
    console.error("listUsers error:", err);
    return res.status(500).json({ error: "Unable to load users" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id, { password: 0 }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("getUserById error:", err);
    return res.status(500).json({ error: "Unable to load user" });
  }
};
