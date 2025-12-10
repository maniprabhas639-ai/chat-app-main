// backend/models/ResetToken.js
const mongoose = require("mongoose");

const resetTokenSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otpCode: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },

    // becomes true after OTP is verified
    verified: { type: Boolean, default: false },

    // short-lived token used to authorize password reset
    resetToken: { type: String },
    resetTokenExpiresAt: { type: Date },

    // rate limiting for sending OTP
    lastSentAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ResetToken", resetTokenSchema);
