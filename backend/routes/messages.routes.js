// backend/routes/messages.routes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Message = require("../models/Message");
const auth = require("../middleware/authMiddleware");

/* -------------------
   Helpers
   ------------------- */

const isValidObjectId = (id) => {
  try {
    return mongoose.Types.ObjectId.isValid(String(id));
  } catch {
    return false;
  }
};

const populateMessage = async (input) => {
  if (!input) return input;
  try {
    if (typeof input.exec === "function") {
      return await input
        .populate("sender", "username email")
        .populate("receiver", "username email")
        .exec();
    }
    if (Array.isArray(input)) {
      return await Message.populate(input, [
        { path: "sender", select: "username email" },
        { path: "receiver", select: "username email" },
      ]);
    }
    if (typeof input.populate === "function") {
      await input.populate("sender", "username email");
      await input.populate("receiver", "username email");
      return input;
    }
    return input;
  } catch (err) {
    console.warn("⚠️ populateMessage error:", err?.message || err);
    return input;
  }
};

/* -------------------
   Routes
   ------------------- */

/**
 * POST /api/messages
 * Accepts: { receiver, content } (also accepts text/message variations)
 * Sets sender from req.user (auth middleware)
 */
router.post("/", auth, async (req, res) => {
  try {
    const senderId = req.user?.id || req.user?._id;
    const receiver =
      req.body.receiver ||
      req.body.recipientId ||
      req.body.recipient ||
      req.body.to;
    let content = req.body.content ?? req.body.text ?? req.body.message ?? "";
    content = String(content || "").trim();

    if (!senderId) return res.status(401).json({ error: "Unauthorized" });
    if (!receiver || !content) {
      return res
        .status(400)
        .json({ error: "Receiver and non-empty content are required" });
    }
    if (!isValidObjectId(receiver)) {
      return res.status(400).json({ error: "Invalid receiver ID" });
    }

    const msgDoc = new Message({
      sender: senderId,
      receiver,
      content,
    });

    const saved = await msgDoc.save();
    const populated = await populateMessage(saved);

    // Emit via socket if available so real-time clients get it
    try {
      const io = req.app && req.app.get && req.app.get("io");
      if (io) {
        io.to(`user_${receiver}`).emit("receiveMessage", populated);
        io.to(`user_${String(senderId)}`).emit("receiveMessage", populated);
      }
    } catch (e) {
      console.warn("⚠️ Failed to emit message via io:", e.message);
    }

    return res.status(201).json({ message: populated });
  } catch (err) {
    if (err?.name === "ValidationError" && err.errors) {
      console.error("Validation errors while saving message:");
      for (const k of Object.keys(err.errors)) {
        console.error(` - ${k}:`, err.errors[k].message);
      }
    }
    console.error("Failed to save message:", err?.message || err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * GET /api/messages/:userId
 */
router.get("/:userId", auth, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    if (!otherUserId || !isValidObjectId(otherUserId)) {
      return res.status(400).json({ error: "Valid User ID required" });
    }

    const query = Message.find({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id },
      ],
    }).sort({ createdAt: 1 });

    const messages = await populateMessage(query);
    return res.json({ messages });
  } catch (err) {
    console.error("Fetch messages error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * PATCH /api/messages/:id/delivered
 * Marks delivered in DB and emits delivery event to sender (if connected).
 */
router.patch("/:id/delivered", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: "Invalid message ID" });

    let message = await Message.findByIdAndUpdate(
      id,
      { delivered: true, deliveredAt: new Date() },
      { new: true }
    );

    if (!message) return res.status(404).json({ error: "Message not found" });

    message = await populateMessage(message);

    // emit delivered to sender
    try {
      const io = req.app && req.app.get && req.app.get("io");
      if (io) io.to(`user_${String(message.sender._id || message.sender)}`).emit("messageDelivered", { messageId: message._id });
    } catch (e) {}

    return res.json({ message });
  } catch (err) {
    console.error("Mark delivered error:", err?.message || err);
    return res.status(500).json({ error: "Failed to mark delivered" });
  }
});

/**
 * PATCH /api/messages/:id/seen
 * Marks seen and emits seen event to sender (if connected).
 */
router.patch("/:id/seen", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: "Invalid message ID" });

    let message = await Message.findByIdAndUpdate(
      id,
      { seen: true, seenAt: new Date() },
      { new: true }
    );

    if (!message) return res.status(404).json({ error: "Message not found" });

    message = await populateMessage(message);

    // emit seen to sender
    try {
      const io = req.app && req.app.get && req.app.get("io");
      if (io) io.to(`user_${String(message.sender._id || message.sender)}`).emit("messageSeen", { messageId: message._id });
    } catch (e) {}

    return res.json({ message });
  } catch (err) {
    console.error("Mark seen error:", err?.message || err);
    return res.status(500).json({ error: "Failed to mark seen" });
  }
console.log("[MSG-POST] req.user:", req.user ? { id: req.user.id || req.user._id } : null);
console.log("[MSG-POST] receiver:", receiver, "content:", content);


});

module.exports = router;
