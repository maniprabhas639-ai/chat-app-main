// backend/routes/auth.js
const express = require("express");
const {
  registerUser,
  loginUser,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  getMe,
  verifyEmail,
  resendVerificationEmail,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Forgot password (STEP 1: send OTP)
router.post("/forgot-password", forgotPassword);

// Verify reset OTP (STEP 2)
router.post("/verify-reset-otp", verifyResetOtp);

// Reset password (STEP 3)
router.post("/reset-password", resetPassword);

// Verify email via OTP (registration)
router.post("/verify-email", verifyEmail);

// Resend email verification code
router.post("/resend-verification", resendVerificationEmail);

// Get current logged-in user
router.get("/me", authMiddleware, getMe);

module.exports = router;
