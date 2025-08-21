// backend/routes/message.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// Send message
router.post("/", async (req, res) => {
  try {
    const { sender, receiver, content } = req.body;
    const message = await Message.create({ sender, receiver, content });
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get chat between two users
router.get("/:userId/:otherUserId", async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
