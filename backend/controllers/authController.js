// backend/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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

    let existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔥 NEW: Get Current Logged-in User
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

module.exports = { registerUser, loginUser, getMe };
