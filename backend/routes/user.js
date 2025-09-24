const express = require('express');
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const router = express.Router();

/** Helper: find or create a 1:1 conversation (participants sorted) */
async function findOrCreateConversation(userAId, userBId) {
  const a = String(userAId);
  const b = String(userBId);
  const participants = [a, b].sort();
  let convo = await Conversation.findOne({ participants });
  if (!convo) {
    convo = await Conversation.create({ participants });
  }
  return convo;
}

/**
 * GET /users
 * Returns all users (except me) with online status and last message preview
 */
router.get('/users', auth, async (req, res) => {
  try {
    const me = req.user.id;

    const users = await User.find({ _id: { $ne: me } })
      .select('_id username online lastSeen')
      .sort({ username: 1 });

    // For each user, attach last message & conversationId with me
    const enriched = await Promise.all(
      users.map(async (u) => {
        const convo = await findOrCreateConversation(me, u._id);
        const lastMsg = await Message.findOne({ conversation: convo._id })
          .sort({ createdAt: -1 })
          .select('_id text sender receiver read createdAt');
        return {
          id: u._id,
          username: u.username,
          online: u.online,
          lastSeen: u.lastSeen,
          conversationId: convo._id,
          lastMessage: lastMsg
            ? {
                id: lastMsg._id,
                text: lastMsg.text,
                sender: lastMsg.sender,
                receiver: lastMsg.receiver,
                read: lastMsg.read,
                createdAt: lastMsg.createdAt
              }
            : null
        };
      })
    );

    return res.json(enriched);
  } catch (err) {
    console.error('GET /users error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /conversations/:id/messages
 * Query: ?limit=50&before=<ISO Date or message _id not implemented>  (only limit supported here)
 * Returns latest messages (ascending by createdAt for easy rendering)
 */
router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

    const convo = await Conversation.findById(id);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = convo.participants.map(String).includes(String(req.user.id));
    if (!isParticipant) return res.status(403).json({ message: 'Forbidden' });

    const messages = await Message.find({ conversation: id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .sort({ createdAt: 1 }); // return ascending

    return res.json(messages);
  } catch (err) {
    console.error('GET /conversations/:id/messages error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


