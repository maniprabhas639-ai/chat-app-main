// backend/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// ✅ Local sendEmail stub so app doesn't crash if utils/sendEmail.js is missing.
const sendEmail = async (to, subject, text) => {
  try {
    console.log("📧 sendEmail called:", { to, subject, text });
    // When you add real emailing:
    // const sendEmail = require("../utils/sendEmail");
    // and remove this stub.
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

/* =========================
   REGISTER
   ========================= */
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log("📝 Register body:", req.body);

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check by email
    const existingByEmail = await User.findOne({ email });
    // Check by username too (if unique)
    const existingByUsername = await User.findOne({ username });

    if (existingByEmail || existingByUsername) {
      console.log("⚠️ Register blocked: user already exists");
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    console.log("✅ Register success for", email);

    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error("Register error (raw):", error);

    // Mongo duplicate key error (unique index on email / username)
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

    if (!email || !password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

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

/* =========================
   FORGOT PASSWORD
   ========================= */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists for this email, you will receive password reset instructions shortly.",
      });
    }

    const adminEmail =
      process.env.RESET_REQUEST_EMAIL || process.env.ADMIN_EMAIL;

    if (adminEmail) {
      await sendEmail(
        adminEmail,
        "Password reset requested",
        `User with email ${email} requested a password reset at ${new Date().toISOString()}`
      );
    }

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
  getMe,
};
