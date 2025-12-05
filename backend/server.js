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

// Dynamic CORS: read allowed origins from CLIENT_ORIGIN env (comma-separated)
// If CLIENT_ORIGIN is empty, allow all origins (useful for internal/testing).
const rawOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowAll = rawOrigins.length === 0;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // 🔹 Always allow localhost for dev (8081 for Expo web, any port)
      if (origin.startsWith("http://localhost:")) {
        console.log("CORS: allowing localhost origin:", origin);
        return callback(null, true);
      }

      // 🔹 If CLIENT_ORIGIN is not set, allow all
      if (allowAll) {
        console.log("CORS: allowing origin (no CLIENT_ORIGIN set):", origin);
        return callback(null, true);
      }

      // 🔹 Exact-match allowed origins from CLIENT_ORIGIN
      if (rawOrigins.includes(origin)) {
        console.log("CORS: allowed origin:", origin);
        return callback(null, true);
      }

      console.warn("CORS: blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Optional but helpful: respond to preflight requests
app.options("*", cors());


// ------------------- Database -------------------
(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error("❌ Fatal: database connection failed at startup:", err.message);
    // Give an explicit exit so Render will restart the service (fail-fast)
    process.exit(1);
  }
})();
// ------------------- Route Loader -------------------
/**
 * Dynamically mounts Express routers and logs status
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

// Health check (important for Render)
app.get("/", (req, res) => res.send("✅ API is running..."));
app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

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
const PORT = process.env.PORT || 10000; // Render injects PORT dynamically
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ------------------- Global Error Handlers -------------------
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🔹 SIGTERM received. Closing server...");
  server.clcose(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("🔹 SIGINT received. Closing server...");
  server.close(() => process.exit(0));
});
