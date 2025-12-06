// backend/routes/auth.js
const express = require("express");
const {
  registerUser,
  loginUser,
  forgotPassword,   // 👈 add this
  getMe,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Forgot password
router.post("/forgot-password", forgotPassword); // 👈 new route

// Get current logged-in user
router.get("/me", authMiddleware, getMe);

module.exports = router;
