import axios from "axios";
import User from "../models/userModel.js";
import OTP from "../models/otpModel.js";
import { hashPassword, comparePassword } from "../utils/hash.js";

const brokerURL = process.env.BROKER_URL || "http://broker-service:3000";

const genOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// =========================
// REGISTER (Tidak ada perubahan besar)
// =========================
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

    const otp = genOTP();
    await axios
      .post(`${brokerURL}/publish/otp`, {
        type: "SEND_OTP",
        to: email,
        otp,
        purpose: "register",
      })
      .catch(() => {});

    res.status(201).json({
      message: "User created, OTP sent",
      user: { email: user.email, usn: user.usn, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// LOGIN STEP 1 — SEND OTP
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
// LOGIN STEP 2 — VERIFY OTP
// =========================
export const verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const otpDoc = await OTP.findOne({ email, otp, purpose: "login" });
    if (!otpDoc) return res.status(400).json({ message: "Invalid OTP" });

    if (otpDoc.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    // delete OTP after use
    await OTP.deleteMany({ email, purpose: "login" });

    res.json({ message: "Login success" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
