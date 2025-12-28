import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing Bearer token" });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "Auth not configured" });
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user?.role || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};
