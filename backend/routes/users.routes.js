// backend/routes/users.routes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

// ✅ Get all users (excluding the logged-in user)
router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select("username email online lastSeen")
      .lean();

    const result = (users || []).map((u) => ({
      _id: String(u._id),
      username: u.username || u.email || "Unknown User",
      email: u.email || null,
      online: !!u.online,        // keep DB value
      isOnline: !!u.online,      // alias for frontend
      lastSeen: u.lastSeen || null,
    }));

    return res.json(result);
  } catch (err) {
    console.error("❌ Users fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get a single user by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const u = await User.findById(req.params.id)
      .select("username email online lastSeen")
      .lean();

    if (!u) {
      return res.status(404).json({ error: "User not found" });
    }

    const payload = {
      _id: String(u._id),
      username: u.username || u.email || "Unknown User",
      email: u.email || null,
      online: !!u.online,
      isOnline: !!u.online,
      lastSeen: u.lastSeen || null,
    };

    return res.json(payload);
  } catch (err) {
    console.error("❌ User fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
