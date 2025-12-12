import axios from "axios";
import User from "../models/userModel.js";
import OTP from "../models/otpModel.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import jwt from "jsonwebtoken";

const brokerURL = process.env.BROKER_URL || "http://broker-service:3000";

const genOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const register = async (req, res) => {
  try {
    const { email, usn, password, role = "student", photoProfile } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { usn }] });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const hashed = await hashPassword(password);
    const user = await User.create({
      email,
      usn,
      password: hashed,
      role,
      photoProfile,
    });

    res.status(201).json({
      message: "User created",
      user: { email: user.email, usn: user.usn, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await axios
      .post(`${brokerURL}/publish/otp`, {
        type: "SEND_OTP",
        to: user.email,
        otp,
        purpose: "login",
        username: user.usn,
      })
      .catch(() => {});

    res.json({
      message: "OTP sent to email",
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    return res.json({
      message: "Login success",
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};
