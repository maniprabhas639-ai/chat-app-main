// backend/models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },

    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },

    seen: { type: Boolean, default: false },
    seenAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });

messageSchema.pre("save", function (next) {
  if (this.isModified("delivered") && this.delivered && !this.deliveredAt) {
    this.deliveredAt = new Date();
  }
  if (this.isModified("seen") && this.seen && !this.seenAt) {
    this.seenAt = new Date();
  }
  next();
});

messageSchema.methods.markDelivered = function () {
  if (!this.delivered) {
    this.delivered = true;
    this.deliveredAt = new Date();
  }
  return this.save();
};

messageSchema.methods.markSeen = function () {
  if (!this.seen) {
    this.seen = true;
    this.seenAt = new Date();
  }
  return this.save();
};

// Guard against model recompilation in dev (nodemon)
const MessageModel =
  mongoose.models && mongoose.models.Message
    ? mongoose.models.Message
    : mongoose.model("Message", messageSchema);

module.exports = MessageModel;
