// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    // 👇 New fields
    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true } // ✅ adds createdAt, updatedAt automatically
);

module.exports = mongoose.model("User", userSchema);
