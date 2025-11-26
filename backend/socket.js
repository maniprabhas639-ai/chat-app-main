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

/**
 * Helper: parse origins from env var (comma separated)
 * Priority:
 *  1. SOCKET_CORS_ORIGINS
 *  2. CLIENT_ORIGIN (re-used from server config)
 *  3. empty => allow all (use with caution)
 */
function parseOrigins() {
  const raw = (process.env.SOCKET_CORS_ORIGINS || process.env.CLIENT_ORIGIN || "").trim();
  if (!raw) return []; // empty = allow all (explicit)
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

module.exports = (server, app) => {
  const origins = parseOrigins();

  let originOption;
  if (origins.length === 0) {
    console.warn(
      "⚠️ SOCKET CORS: no origins configured (SOCKET_CORS_ORIGINS or CLIENT_ORIGIN). Allowing all origins. Consider setting SOCKET_CORS_ORIGINS in Render for production."
    );
    originOption = true; // reflect request origin
  } else if (origins.length === 1) {
    originOption = origins[0];
    console.log("🔒 SOCKET CORS: allowing origin:", originOption);
  } else {
    originOption = origins;
    console.log("🔒 SOCKET CORS: allowing origins:", origins);
  }

  const io = new Server(server, {
    cors: {
      origin: originOption,
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
    },
    // sensible socket options
    transports: ["websocket", "polling"],
    maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_HTTP_BUFFER || String(1e6), 10), // 1MB default
  });

  app.set("io", io);

  if (!process.env.JWT_SECRET) {
    console.warn("⚠️ JWT_SECRET is not defined. Socket auth will fail until you set JWT_SECRET in environment.");
  }

  const onlineUsers = new Map(); // userId => Set(socketId)
  const lastActivity = new Map(); // userId => timestamp

  const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || "30000", 10);
  const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_CHECK_INTERVAL_MS || "10000", 10);

  async function addSocketForUser(userId, socket) {
    const set = onlineUsers.get(userId) || new Set();
    set.add(socket.id);
    onlineUsers.set(userId, set);
    lastActivity.set(userId, Date.now());
    try {
      socket.join(`user_${userId}`);
    } catch (e) {
      // ignore non-fatal
    }

    try {
      await User.findByIdAndUpdate(userId, { online: true }, { new: true });
    } catch (e) {
      console.warn("⚠️ Failed to set user online:", e?.message || e);
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
      } catch (e) {
        // ignore
      }
      io.emit("userStatus", { userId, online: false });
    } else {
      onlineUsers.set(userId, set);
    }
  }

  // Heartbeat / stale-user cleanup
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
      if (token && process.env.JWT_SECRET) {
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
      if (!process.env.JWT_SECRET) {
        console.warn("⚠️ authenticate called but JWT_SECRET not set.");
        return;
      }
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
      } catch (e) {
        // ignore
      }
      socket.emit("userStatus", {
        userId: targetId,
        username: userDoc?.username || null,
        online: online || userDoc?.online || false,
        lastSeen: userDoc?.lastSeen || lastActivity.get(String(targetId)) || null,
      });
    });

    socket.on("joinRoom", (roomId) => {
      if (roomId) {
        try {
          socket.join(roomId);
        } catch (e) {}
      }
    });

    socket.on("leaveRoom", (roomId) => {
      if (roomId) {
        try {
          socket.leave(roomId);
        } catch (e) {}
      }
    });

    socket.on("typing", ({ to }) => {
      if (to) io.to(`user_${to}`).emit("typing", { from: socket.userId });
    });

    socket.on("stopTyping", ({ to }) => {
      if (to) io.to(`user_${to}`).emit("stopTyping", { from: socket.userId });
    });

    socket.on("sendMessage", async (payload) => {
      if (!payload) return;
      const msg = payload.message || payload;

      const sender = String(msg.sender || socket.userId || (msg.sender && (msg.sender._id || msg.sender.id)));
      const receiver = String(
        msg.receiver ||
          msg.to ||
          (payload.roomId ? payload.roomId.split("_").find((p) => p !== sender) : null)
      );
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
          try {
            await saved.populate("sender", "username email");
            await saved.populate("receiver", "username email");
          } catch (e) {}
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

    socket.on("messageDelivered", ({ messageId, to }) => {
      if (messageId && to) io.to(`user_${to}`).emit("messageDelivered", { messageId });
    });

    socket.on("messageSeen", ({ messageId, to }) => {
      if (messageId && to) io.to(`user_${to}`).emit("messageSeen", { messageId });
    });

    socket.on("logout", async () => {
      if (socket.userId) await removeSocketForUser(socket.userId, socket.id);
    });

    socket.on("disconnect", async () => {
      if (socket.userId) await removeSocketForUser(socket.userId, socket.id);
      console.log("🔌 Socket disconnected:", socket.id);
    });
  });

  return io;
};
