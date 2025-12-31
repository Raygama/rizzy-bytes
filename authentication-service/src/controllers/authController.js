import axios from "axios";
import User from "../models/userModel.js";
import OTP from "../models/otpModel.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import jwt from "jsonwebtoken";

const brokerURL = process.env.BROKER_URL || "http://broker-service:3000";

const genOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

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

export const register = async (req, res) => {
  try {
    const { email, usn, password } = req.body;

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
    const { identifier, email, password } = req.body;
    const id = identifier || email;

    const user = await User.findOne({ $or: [{ email: id }, { usn: id }] });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // generate OTP
    const otp = genOTP();

    // save otp to DB
    await OTP.create({
      email: user.email,
      otp,
      purpose: "login",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // send OTP using broker
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
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = genOTP();
    await OTP.create({
      email: user.email,
      otp,
      purpose: "reset",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    await sendOtpEmail({ to: user.email, otp, purpose: "reset", username: user.usn });

    return res.json({ message: "Reset code sent to email" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Unable to start password reset" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "email, otp, and newPassword are required" });
    }

    const otpDoc = await OTP.findOne({ email, otp, purpose: "reset" });
    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    if (otpDoc.expiresAt <= new Date()) {
      return res.status(400).json({ message: "OTP expired" });
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
    const { email, otp } = req.body;

    // cek OTP
    const otpDoc = await OTP.findOne({ email, otp, purpose: "login" });
    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpDoc.expiresAt <= new Date()) {
      return res.status(400).json({ message: "OTP expired" });
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
    const { email, usn, password, role = "student", photoProfile } = req.body;
    if (!email || !usn || !password) {
      return res.status(400).json({ error: "email, usn, and password are required" });
    }
    if (!["student", "staff", "admin", "guest"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
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
    const allowed = ["email", "usn", "role", "password"];
    const patch = {};
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        patch[key] = req.body[key];
      }
    });
    if (patch.password) {
      patch.password = await hashPassword(patch.password);
    }
    if (patch.role && !["student", "staff", "admin", "guest"].includes(patch.role)) {
      return res.status(400).json({ error: "Invalid role" });
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
