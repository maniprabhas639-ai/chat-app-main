// backend/routes/auth.js
const express = require("express");
const { registerUser, loginUser, getMe } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Get current logged-in user
router.get("/me", authMiddleware, getMe);

module.exports = router;
