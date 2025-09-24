// backend/server.js
const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db.js");

dotenv.config();

const app = express();

// ------------------- Middleware -------------------
app.use(express.json());
app.use(cors());

// ------------------- Database -------------------
connectDB();

// ------------------- Route Loader -------------------
/**
 * Mounts Express router with robust checks.
 * Logs success or failure for each route.
 */
const mountRoute = (mountPath, modulePath) => {
  try {
    const resolved = path.resolve(__dirname, modulePath);
    const mod = require(resolved);

    let candidate = mod;
    if (mod && typeof mod === "object" && mod.default) candidate = mod.default;
    if (candidate && typeof candidate === "object" && candidate.router)
      candidate = candidate.router;

    const isRouter =
      typeof candidate === "function" ||
      (candidate &&
        (typeof candidate.use === "function" ||
          typeof candidate.handle === "function" ||
          Array.isArray(candidate.stack)));

    if (isRouter) {
      app.use(mountPath, candidate);
      console.log(`✅ Mounted route ${mountPath} -> ${modulePath}`);
    } else {
      console.warn(`⚠️ Route module ${modulePath} did not export an Express router.`);
    }
  } catch (err) {
    console.error(`❌ Failed to mount route ${modulePath}:`, err.message);
  }
};

// ------------------- API Routes -------------------
mountRoute("/api/auth", "./routes/auth");
mountRoute("/api/users", "./routes/users.routes");
mountRoute("/api/messages", "./routes/messages.routes");

// Health check routes
app.get("/", (req, res) => res.send("✅ API is running..."));
app.get("/health", (req, res) => res.json({ ok: true }));

// ------------------- Create HTTP Server -------------------
const server = http.createServer(app);

// ------------------- Socket.IO Integration -------------------
try {
  require("./socket")(server, app);
  console.log("✅ Socket.IO attached successfully");
} catch (err) {
  console.error("❌ Failed to attach Socket.IO:", err.message);
}

// ------------------- Start Server -------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// ------------------- Global Error Handlers -------------------
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  // optional: process.exit(1);
});

// Optional: graceful shutdown on SIGTERM/SIGINT
process.on("SIGTERM", () => {
  console.log("🔹 SIGTERM received. Closing server...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("🔹 SIGINT received. Closing server...");
  server.close(() => process.exit(0));
});

