import User from "../models/userModel.js";
import { hashPassword, comparePassword } from "../utils/hash.js";

export const register = async (req, res) => {
  try {
    const { email, usn, password, role, photoProfile } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const hashed = await hashPassword(password);

    const user = await User.create({
      email, usn, password: hashed, role, photoProfile
    });

    res.status(200).json({ message: "User registered", user: { email: user.email, usn: user.usn, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    res.json({ message: "Login success", user: { email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
