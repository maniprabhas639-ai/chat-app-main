// backend/models/FollowRequest.js
const mongoose = require("mongoose");

const followRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Not strictly unique, but helps avoid silly duplicates.
// We will also guard in code.
followRequestSchema.index({ requester: 1, recipient: 1, status: 1 });

module.exports = mongoose.model("FollowRequest", followRequestSchema);
