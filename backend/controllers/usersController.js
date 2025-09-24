// backend/controllers/usersController.js

const User = require("../models/User");

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // exclude password
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get a single user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
