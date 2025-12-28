import express from "express";
import {
  register,
  login,
  verifyLoginOTP,
  logout,
  createUser,
  updateUser,
  deleteUser,
  listUserActivity,
  listUsers,
  getUserById,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { requireAuth, requireRole } from "../utils/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/login/verify", verifyLoginOTP);
router.post("/password/forgot", forgotPassword);
router.post("/password/reset", resetPassword);
router.post("/logout", requireAuth, logout);

// Admin-only user management
router.post("/users", requireAuth, requireRole("admin"), createUser);
router.patch("/users/:id", requireAuth, requireRole("admin"), updateUser);
router.delete("/users/:id", requireAuth, requireRole("admin"), deleteUser);
router.get("/users/activity", requireAuth, requireRole("admin"), listUserActivity);
router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.get("/users/:id", requireAuth, requireRole("admin"), getUserById);

export default router;
