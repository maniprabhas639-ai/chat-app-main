// backend/routes/messages.routes.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// Send a message
// POST /api/messages
// body: { sender, receiver, content }
router.post("/", async (req, res) => {
  try {
    const { sender, receiver, content } = req.body || {};
    if (!sender || !receiver || !content?.trim()) {
      return res.status(400).json({ message: "sender, receiver, content required" });
    }
    const msg = await Message.create({ sender, receiver, content: content.trim() });
    return res.status(201).json(msg);
  } catch (err) {
    console.error("Send message error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get conversation between two users (ordered oldest -> newest)
// GET /api/messages/:userId/:otherUserId
router.get("/:userId/:otherUserId", async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    const items = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.json(items);
  } catch (err) {
    console.error("Get conversation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
