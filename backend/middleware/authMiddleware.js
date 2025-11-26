// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "jwt expired" });
      }
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "invalid token" });
      }
      return res.status(401).json({ message: "Unauthorized" });
    }

    // FIXED: use `username` instead of incorrect `name`
    const user = await User.findById(decoded.id).select("_id username email");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email
    };

    req.userId = user._id.toString();

    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(500).json({ message: "Server error in auth" });
  }
};

module.exports = auth;
