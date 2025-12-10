// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true },

    // user will exist only after email is verified
    emailVerified: { type: Boolean, default: true },

    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    // 👇 NEW: list of users this user can chat with (accepted contacts)
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
