// routes/users.routes.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// Middleware: verify JWT
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret");
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ JWT Error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// ✅ Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("🔥 /me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get all users (protected)
router.get("/", authMiddleware, async (_req, res) => {
  try {
    const users = await User.find().select("-passwordHash");
    res.json(users);
  } catch (err) {
    console.error("🔥 Get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
