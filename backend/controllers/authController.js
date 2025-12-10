// backend/controllers/authController.js
const User = require("../models/User");
const PendingUser = require("../models/PendingUser");
const ResetToken = require("../models/ResetToken");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendMail } = require("../utils/mailer");

// ✅ Wrapper so existing code can keep using sendEmail(to, subject, text)
const sendEmail = async (to, subject, text) => {
  try {
    await sendMail({ to, subject, text });
  } catch (err) {
    console.error("sendEmail wrapper error:", err.message);
  }
};

// Helper: remove password before sending user
const sanitizeUser = (user) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
};

// Helper: generate 6-digit verification code
const generateEmailVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Rate limit: minimum delay between resend/reset requests (ms)
const VERIFICATION_RESEND_INTERVAL_MS = 60 * 1000; // 1 minute
const RESET_OTP_EXPIRES_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_EXPIRES_MS = 10 * 60 * 1000; // 10 minutes

/* =========================
   REGISTER (PendingUser)
   ========================= */
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log("🛰️ [LOCAL BACKEND] /auth/register hit");
    console.log("📝 Register body:", req.body);

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Real user already exists?
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      console.log("⚠️ Register blocked: real user already exists");
      return res.status(400).json({ message: "User already exists" });
    }

    // Clear old pending
    await PendingUser.deleteMany({
      $or: [{ email }, { username }],
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const code = generateEmailVerificationCode();
    const now = Date.now();
    const expiresAt = new Date(now + 10 * 60 * 1000);

    console.log("🔐 Generated email verification code (pending):", code);

    const pending = await PendingUser.create({
      username,
      email,
      password: hashedPassword,
      emailVerificationCode: code,
      emailVerificationExpires: expiresAt,
      verificationLastSentAt: new Date(now),
    });

    sendMail({
      to: email,
      subject: "Verify your Chat Mani account",
      text: `Hi ${username},

Your verification code is: ${code}
It expires in 10 minutes.

If you did not create this account, you can ignore this email.
`,
    }).catch((err) => {
      console.warn(
        "⚠️ Failed to send verification email:",
        err?.message || err
      );
    });

    console.log("✅ Pending registration created for", email, "id:", pending._id);

    return res.status(201).json({
      message: "Verification code sent to your email.",
      emailVerificationRequired: true,
    });
  } catch (error) {
    console.error("Register error (raw):", error);

    if (error && error.code === 11000) {
      console.error("⚠️ Duplicate key error:", error.keyValue);
      return res.status(400).json({ message: "User already exists" });
    }

    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   LOGIN
   ========================= */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt:", { email, hasPassword: !!password });

    if (!email || !password) {
      console.log("⚠️ Login blocked: missing email or password");
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.password) {
      console.log("⚠️ Login blocked: user not found for email", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("⚠️ Login blocked: password mismatch for", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (user.emailVerified === false) {
      console.log("⚠️ Login blocked: email not verified for", email);
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    console.log("✅ Login success for", email);

    return res.status(200).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("💥 Login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   FORGOT PASSWORD (STEP 1: send OTP)
   ========================= */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("🔁 Forgot password requested for:", email);

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    // For security: always respond 200, but only create tokens if user exists
    if (!user) {
      console.log("⚠️ Forgot password: no user for", email);
      return res.status(200).json({
        message:
          "If an account exists for this email, you will receive reset instructions shortly.",
      });
    }

    let reset = await ResetToken.findOne({ email });
    const now = Date.now();

    // Rate limit
    if (reset && reset.lastSentAt) {
      const diff = now - reset.lastSentAt.getTime();
      if (diff < VERIFICATION_RESEND_INTERVAL_MS) {
        const remainingMs = VERIFICATION_RESEND_INTERVAL_MS - diff;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        console.log(
          `⚠️ Forgot password blocked by rate limit for ${email}, wait ${remainingSeconds}s`
        );
        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before requesting another reset code.`,
        });
      }
    }

    const code = generateEmailVerificationCode();
    const otpExpiresAt = new Date(now + RESET_OTP_EXPIRES_MS);

    if (!reset) {
      reset = await ResetToken.create({
        email,
        otpCode: code,
        otpExpiresAt,
        verified: false,
        lastSentAt: new Date(now),
      });
    } else {
      reset.otpCode = code;
      reset.otpExpiresAt = otpExpiresAt;
      reset.verified = false;
      reset.resetToken = undefined;
      reset.resetTokenExpiresAt = undefined;
      reset.lastSentAt = new Date(now);
      await reset.save();
    }

    console.log("🔐 Generated password reset OTP:", code, "for", email);

    await sendMail({
      to: email,
      subject: "Reset your Chat Mani password",
      text: `Hi,

You requested to reset your password.

Your reset code is: ${code}
It expires in 10 minutes.

If you did not request this, you can ignore this email.
`,
    });

    return res.status(200).json({
      message:
        "If an account exists for this email, you will receive a reset code shortly.",
    });
  } catch (error) {
    console.error("ForgotPassword error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   VERIFY RESET OTP (STEP 2)
   ========================= */
const verifyResetOtp = async (req, res) => {
  try {
    const { email, code } = req.body;

    console.log("🔍 Verify reset OTP:", { email, code });

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const reset = await ResetToken.findOne({ email });

    if (!reset) {
      return res
        .status(404)
        .json({ message: "No reset request found for this email." });
    }

    if (reset.otpCode !== code) {
      return res.status(400).json({ message: "Invalid reset code." });
    }

    if (!reset.otpExpiresAt || reset.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "Reset code has expired." });
    }

    // Mark OTP verified and issue a short-lived reset token
    reset.verified = true;
    reset.resetToken = crypto.randomBytes(32).toString("hex");
    reset.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);
    await reset.save();

    console.log("✅ Reset OTP verified for", email);

    return res.json({
      message: "Code verified. You can now set a new password.",
      resetToken: reset.resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   RESET PASSWORD (STEP 3: apply new password)
   ========================= */
const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    console.log("🔧 Reset password requested:", {
      email,
      hasToken: !!resetToken,
      hasNewPassword: !!newPassword,
    });

    // Basic validation
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        message: "Email, reset token and new password are required.",
      });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    // Find reset token doc
    const reset = await ResetToken.findOne({ email });

    if (!reset) {
      console.log("⚠️ Reset password: no reset doc for", email);
      return res.status(400).json({
        message: "Invalid or expired reset token.",
      });
    }

    // Check verified + token match
    if (
      !reset.verified ||
      !reset.resetToken ||
      reset.resetToken !== resetToken
    ) {
      console.log(
        "⚠️ Reset password: token mismatch or not verified for",
        email
      );
      return res.status(400).json({
        message: "Invalid or expired reset token.",
      });
    }

    // Check token expiry safely
    if (
      !reset.resetTokenExpiresAt ||
      new Date(reset.resetTokenExpiresAt).getTime() < Date.now()
    ) {
      console.log("⚠️ Reset password: token expired for", email);
      return res.status(400).json({
        message: "Reset token has expired. Please try again.",
      });
    }

    // Find real user
    const user = await User.findOne({ email });

    if (!user) {
      console.log("⚠️ Reset password: user not found for", email);
      return res
        .status(404)
        .json({ message: "User not found for this email." });
    }

    // 🔧 SAFETY: some old users in DB might not have username set
    if (!user.username) {
      // generate a fallback username so validation passes
      const base =
        (email && email.split("@")[0]) || "user";
      user.username = `${base}-${user._id.toString().slice(-4)}`;
      console.log(
        "ℹ️ Reset password: auto-set missing username for",
        email,
        "->",
        user.username
      );
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    // Clean up all reset tokens for this email (one-time use)
    await ResetToken.deleteMany({ email });

    console.log("✅ Password reset successful for", email);

    return res.json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("💥 Reset password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



/* =========================
   VERIFY EMAIL (PendingUser -> User)
   ========================= */
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const pending = await PendingUser.findOne({ email });

    if (!pending) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "Email already verified. Please log in." });
      }
      return res.status(404).json({ message: "No pending registration found." });
    }

    if (pending.emailVerificationCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    if (
      !pending.emailVerificationExpires ||
      pending.emailVerificationExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({ message: "Verification code has expired" });
    }

    const existingUser = await User.findOne({
      $or: [{ email: pending.email }, { username: pending.username }],
    });

    if (existingUser) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res
        .status(400)
        .json({ message: "User already exists. Please log in." });
    }

    const user = await User.create({
      username: pending.username,
      email: pending.email,
      password: pending.password,
      emailVerified: true,
      online: false,
      lastSeen: new Date(),
    });

    await PendingUser.deleteOne({ _id: pending._id });

    console.log("✅ Email verified & user created:", email);

    return res.json({
      message: "Email verified successfully. You can now login.",
    });
  } catch (error) {
    console.error("Verify email error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   RESEND EMAIL VERIFICATION (PendingUser)
   ========================= */
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("📨 Resend verification requested for:", email);

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const pending = await PendingUser.findOne({ email });

    if (!pending) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "Email is already verified. Please log in." });
      }
      console.log("⚠️ Resend blocked: no pending registration for", email);
      return res.status(404).json({ message: "No pending registration found." });
    }

    const now = Date.now();

    if (pending.verificationLastSentAt) {
      const lastSent = pending.verificationLastSentAt.getTime();
      const diff = now - lastSent;

      if (diff < VERIFICATION_RESEND_INTERVAL_MS) {
        const remainingMs = VERIFICATION_RESEND_INTERVAL_MS - diff;
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        console.log(
          `⚠️ Resend blocked by rate limit for ${email}, wait ${remainingSeconds}s`
        );

        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        });
      }
    }

    const code = generateEmailVerificationCode();
    const expiresAt = new Date(now + 10 * 60 * 1000);

    pending.emailVerificationCode = code;
    pending.emailVerificationExpires = expiresAt;
    pending.verificationLastSentAt = new Date(now);
    await pending.save();

    console.log("🔁 Resending NEW verification code:", code, "for", email);

    await sendMail({
      to: email,
      subject: "Your Chat Mani verification code",
      text: `Hi ${pending.username},

Your new verification code is: ${code}
It expires in 10 minutes.

If you did not request this, you can ignore this email.
`,
    });

    return res.json({
      message: "A new verification code has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend verification error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET CURRENT USER
   ========================= */
const getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(sanitizeUser(user));
  } catch (error) {
    console.error("GetMe error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getMe,
};
