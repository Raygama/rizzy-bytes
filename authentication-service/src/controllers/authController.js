import axios from "axios";
import User from "../models/userModel.js";
import { hashPassword, comparePassword } from "../utils/hash.js";

const brokerURL = process.env.BROKER_URL || "http://broker-service:3000";

const genOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const register = async (req, res) => {
  try {
    const { email, usn, password, role = "student", photoProfile } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { usn }] });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const hashed = await hashPassword(password);
    const user = await User.create({ email, usn, password: hashed, role, photoProfile });

    // publish OTP job (e.g., welcome/verify email)
    const otp = genOTP();
    await axios.post(`${brokerURL}/publish/otp`, {
      type: "SEND_OTP",
      to: email,
      otp,
      purpose: "register"
    }).catch(() => { /* avoid failing the request if broker is down */ });

    res.status(201).json({
      message: "User created, OTP sent",
      user: { email: user.email, usn: user.usn, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    // Accept either { email, password } or { identifier, password }
    const { email, identifier, password } = req.body;
    const id = identifier || email;

    // Find by email or by usn (username) to support both login types
    const user = await User.findOne({ $or: [{ email: id }, { usn: id }] });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // Optionally publish a login log event
    await axios.post(`${brokerURL}/publish/log`, {
      type: "LOG_EVENT",
      service: "authentication-service",
      level: "info",
      message: `User ${id} logged in`
    }).catch(() => {});

    res.json({ message: "Login success", user: { email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
