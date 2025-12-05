// backend/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // the receiver
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // the sender who caused the notification
    },
    type: {
      type: String,
      default: "new_message",
    },
    processed: {
      type: Boolean,
      default: false, // becomes true after email is sent
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
