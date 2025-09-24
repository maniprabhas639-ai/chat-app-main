// backend/controllers/messageController.js
import Message from "../models/Message.js";
import mongoose from "mongoose";
import User from "../models/User.js";

/** deterministic conversation id (smaller_larger) */
function makeConversationId(a, b) {
  if (!a || !b) return null;
  const [x, y] = [a.toString(), b.toString()].sort();
  return `${x}_${y}`;
}

/**
 * POST /api/messages
 * body: { receiver, text, attachments? }
 */
export const createMessage = async (req, res) => {
  try {
    const senderId = req.user?.id || req.user?._id;
    const { receiver, text, attachments } = req.body;

    if (!receiver || (!text && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ message: "receiver and (text or attachments) required" });
    }

    if (!mongoose.Types.ObjectId.isValid(receiver)) {
      return res.status(400).json({ message: "Invalid receiver id" });
    }

    // optional: validate receiver exists
    const receiverUser = await User.findById(receiver).select("_id name email").lean();
    if (!receiverUser) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const conversationId = makeConversationId(senderId, receiver);

    const newMessage = await Message.create({
      sender: senderId,
      receiver,
      text,
      attachments: attachments || [],
      conversationId,
    });

    // populate sender & receiver for returning to client
    await newMessage.populate({ path: "sender", select: "name email" });
    await newMessage.populate({ path: "receiver", select: "name email" });

    // Emit via Socket.IO if available
    try {
      const io = req.app && req.app.get && req.app.get("io");
      if (io) {
        io.to(conversationId).emit("receiveMessage", newMessage);
      }
    } catch (emitErr) {
      console.warn("Socket emit failed (non-fatal):", emitErr.message || emitErr);
    }

    return res.status(201).json(newMessage);
  } catch (error) {
    console.error("createMessage error:", error);
    return res.status(500).json({ message: "Failed to create message" });
  }
};

/**
 * GET /api/messages/:otherUserId
 * Query: ?limit=50 (default)
 * returns last `limit` messages in chronological order
 */
export const getConversation = async (req, res) => {
  try {
    const me = req.user?.id || req.user?._id;
    const otherUserId = req.params.otherUserId;
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const conversationId = makeConversationId(me, otherUserId);

    // prefer the indexed conversationId for fast lookup
    let query;
    if (conversationId) {
      query = { conversationId };
    } else {
      query = {
        $or: [
          { sender: me, receiver: otherUserId },
          { sender: otherUserId, receiver: me },
        ],
      };
    }

    // Fetch latest `limit` messages then reverse to chronological order
    let msgs = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "sender", select: "name email" })
      .populate({ path: "receiver", select: "name email" })
      .lean();

    msgs = msgs.reverse();

    return res.json(msgs);
  } catch (error) {
    console.error("getConversation error:", error);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
};
