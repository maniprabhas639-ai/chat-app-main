// backend/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// ✅ Local sendEmail stub so app doesn't crash if utils/sendEmail.js is missing.
//    Later you can replace this with your real mail util.
const sendEmail = async (to, subject, text) => {
  try {
    console.log("📧 sendEmail called:", { to, subject, text });
    // TODO: replace this with:
    // const sendEmail = require("../utils/sendEmail");
    // and remove this stub when you have the real file.
  } catch (err) {
    console.error("sendEmail error:", err.message);
  }
};

// Helper: remove password before sending user
const sanitizeUser = (user) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
};

// Register
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Get user AND password
    const user = await User.findOne({ email }).select("+password");

    // If user not found OR no password -> invalid
    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare passwords safely
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.status(200).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔥 Forgot Password (simple, admin-driven reset)
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    // Do not reveal whether user exists explicitly
    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists for this email, you will receive password reset instructions shortly.",
      });
    }

    const adminEmail =
      process.env.RESET_REQUEST_EMAIL || process.env.ADMIN_EMAIL;

    // Email to admin so YOU can reset manually
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        "Password reset requested",
        `User with email ${email} requested a password reset at ${new Date().toISOString()}`
      );
    }

    // Optional: confirmation to user
    await sendEmail(
      email,
      "Password reset request received",
      "We have received your password reset request. Our team will contact you with next steps."
    );

    return res.status(200).json({
      message:
        "If an account exists for this email, you will receive password reset instructions shortly.",
    });
  } catch (error) {
    console.error("ForgotPassword error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔥 Get current logged-in user
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
  getMe,
};
