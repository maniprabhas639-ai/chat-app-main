// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const app = express();

// ---------- Middlewares ----------
app.use(express.json());
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

// ---------- Routes ----------
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users.routes")); // already in your project
app.use("/api/messages", require("./routes/messages.routes")); // ⬅️ NEW

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Global Error Handler (keep last)
app.use((err, _req, res, _next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ---------- HTTP + Socket.IO ----------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Optional: private rooms now or later
  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`📌 ${socket.id} joined room: ${room}`);
  });

  socket.on("send_message", ({ room, message, sender }) => {
    console.log(`💬 [${room}] ${sender}: ${message}`);
    io.to(room).emit("receive_message", { room, message, sender });
  });

  socket.on("chat:message", (msg) => {
    io.emit("chat:message", msg);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await connectDB();
    server.listen(PORT, "0.0.0.0", () =>
      console.log(`🚀 Server running at http://0.0.0.0:${PORT}`)
    );
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
