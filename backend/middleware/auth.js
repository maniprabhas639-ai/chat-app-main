// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // optional: for validating user existence
const { getIO } = require("../socket"); // helper we’ll add to access Socket.IO instance

module.exports = async (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach decoded user ID to request
    req.user = { id: decoded.id };

    // optionally validate user still exists in DB
    const user = await User.findById(decoded.id).select("_id username");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (err) {
    console.error("JWT auth error:", err.message);

    // ⚡ notify client to force logout if socket exists
    try {
      const io = getIO();
      if (req.user?.id) {
        io.to(req.user.id.toString()).emit("forceLogout", {
          reason: "Invalid or expired token",
        });
      }
    } catch (e) {
      console.warn("Could not emit forceLogout:", e.message);
    }

    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
