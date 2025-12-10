// backend/models/PendingUser.js
const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // store hashed password here (same as User.password)
    password: { type: String, required: true },

    emailVerificationCode: { type: String, required: true },
    emailVerificationExpires: { type: Date, required: true },

    // for rate limiting resend
    verificationLastSentAt: { type: Date },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("PendingUser", pendingUserSchema);
