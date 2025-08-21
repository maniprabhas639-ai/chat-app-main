const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    ],
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date }
    }
  },
  { timestamps: true }
);

// Ensure uniqueness of two-participant conversations by sorting participant IDs
conversationSchema.index({ participants: 1 }, { unique: false });

module.exports = mongoose.model('Conversation', conversationSchema);
