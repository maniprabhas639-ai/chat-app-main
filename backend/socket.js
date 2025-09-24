// backend/socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
let Message;
try {
  Message = require("./models/Message");
} catch {
  Message = null;
  console.warn("⚠️ Message model not found, skipping DB lookups.");
}

module.exports = (server, app) => {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  app.set("io", io);

  const onlineUsers = new Map(); // userId => Set(socketId)
  const lastActivity = new Map(); // userId => timestamp

  const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || "30000", 10);
  const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_CHECK_INTERVAL_MS || "10000", 10);

  async function addSocketForUser(userId, socket) {
    const set = onlineUsers.get(userId) || new Set();
    set.add(socket.id);
    onlineUsers.set(userId, set);
    lastActivity.set(userId, Date.now());
    socket.join(`user_${userId}`);

    try {
      await User.findByIdAndUpdate(userId, { online: true }, { new: true });
    } catch (e) {
      console.warn("⚠️ Failed to set user online:", e.message);
    }

    io.emit("userStatus", { userId, online: true });
  }

  async function removeSocketForUser(userId, socketId) {
    const set = onlineUsers.get(userId);
    if (!set) return;

    set.delete(socketId);
    if (set.size === 0) {
      onlineUsers.delete(userId);
      lastActivity.set(userId, Date.now());
      try {
        await User.findByIdAndUpdate(userId, { online: false, lastSeen: Date.now() });
      } catch {}
      io.emit("userStatus", { userId, online: false });
    } else {
      onlineUsers.set(userId, set);
    }
  }

  setInterval(() => {
    const now = Date.now();
    for (const [userId, last] of lastActivity.entries()) {
      if (now - last > HEARTBEAT_TIMEOUT && onlineUsers.has(userId)) {
        onlineUsers.delete(userId);
        User.findByIdAndUpdate(userId, { online: false, lastSeen: Date.now() }).catch(() => {});
        io.emit("userStatus", { userId, online: false });
      }
    }
  }, HEARTBEAT_INTERVAL);

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // Auto-auth from handshake if present
    (async () => {
      const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
      if (token) {
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          socket.userId = String(payload.id || payload._id || payload.userId);
          await addSocketForUser(socket.userId, socket);
        } catch (err) {
          console.warn("⚠️ Invalid socket token (handshake):", err.message);
        }
      }
    })();

    // Also support 'authenticate' event (some clients emit after connect)
    socket.on("authenticate", async (token) => {
      if (!token) return;
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = String(payload.id || payload._id || payload.userId);
        await addSocketForUser(socket.userId, socket);
      } catch (err) {
        console.warn("⚠️ Invalid socket token (authenticate event):", err.message);
      }
    });

    socket.on("getPresence", async (targetId) => {
      const online = onlineUsers.has(String(targetId));
      let userDoc = null;
      try {
        userDoc = await User.findById(targetId).select("username online lastSeen");
      } catch {}
      socket.emit("userStatus", {
        userId: targetId,
        username: userDoc?.username || null,
        online: online || userDoc?.online || false,
        lastSeen: userDoc?.lastSeen || lastActivity.get(String(targetId)) || null,
      });
    });

    socket.on("joinRoom", (roomId) => { if (roomId) socket.join(roomId); });
    socket.on("leaveRoom", (roomId) => { if (roomId) socket.leave(roomId); });

    socket.on("typing", ({ to }) => { if (to) io.to(`user_${to}`).emit("typing", { from: socket.userId }); });
    socket.on("stopTyping", ({ to }) => { if (to) io.to(`user_${to}`).emit("stopTyping", { from: socket.userId }); });

    socket.on("sendMessage", async (payload) => {
      if (!payload) return;
      const msg = payload.message || payload;

      const sender = String(msg.sender || socket.userId || (msg.sender && (msg.sender._id || msg.sender.id)));
      const receiver = String(msg.receiver || msg.to || (payload.roomId ? payload.roomId.split("_").find((p) => p !== sender) : null));
      if (!sender || !receiver) return;

      // If already persisted, just forward
      if (msg._id) {
        io.to(`user_${receiver}`).emit("receiveMessage", msg);
        io.to(`user_${sender}`).emit("receiveMessage", msg);
        return;
      }

      const content = msg.content ?? msg.text ?? msg.body ?? "";
      if (!content) return;

      if (Message) {
        try {
          const saved = await Message.create({ sender, receiver, content });
          try { await saved.populate("sender", "username email"); await saved.populate("receiver", "username email"); } catch (e) {}
          io.to(`user_${receiver}`).emit("receiveMessage", saved);
          io.to(`user_${sender}`).emit("receiveMessage", saved);
        } catch (e) {
          console.warn("⚠️ Failed to save message in socket:", e.message);
          const raw = { sender, receiver, content, createdAt: Date.now() };
          io.to(`user_${receiver}`).emit("receiveMessage", raw);
          io.to(`user_${sender}`).emit("receiveMessage", raw);
        }
      } else {
        const raw = { sender, receiver, content, createdAt: Date.now() };
        io.to(`user_${receiver}`).emit("receiveMessage", raw);
        io.to(`user_${sender}`).emit("receiveMessage", raw);
      }
    });

    socket.on("messageDelivered", ({ messageId, to }) => { if (messageId && to) io.to(`user_${to}`).emit("messageDelivered", { messageId }); });
    socket.on("messageSeen", ({ messageId, to }) => { if (messageId && to) io.to(`user_${to}`).emit("messageSeen", { messageId }); });

    socket.on("logout", async () => { if (socket.userId) await removeSocketForUser(socket.userId, socket.id); });

    socket.on("disconnect", async () => {
      if (socket.userId) await removeSocketForUser(socket.userId, socket.id);
      console.log("🔌 Socket disconnected:", socket.id);
    });
  });

  return io;
};
