// backend/routes/users.routes.js
const express = require("express");
const router = express.Router();

const User = require("../models/User");
const FollowRequest = require("../models/FollowRequest");
const auth = require("../middleware/auth");

// Helper to normalize user document into frontend shape
function mapUserForClient(u, relationshipStatus, requestId) {
  return {
    _id: String(u._id),
    username: u.username || u.email || "Unknown User",
    email: u.email || null,
    online: !!u.online,
    isOnline: !!u.online,
    lastSeen: u.lastSeen || null,
    relationshipStatus: relationshipStatus || "none",
    requestId: requestId ? String(requestId) : null,
  };
}

/**
 * GET /api/users
 * 🔹 All users (except me), with relationship status:
 *    - "accepted"         (already contacts)
 *    - "pending_sent"     (I sent request, waiting)
 *    - "pending_received" (they sent request to me)
 *    - "none"
 */
router.get("/", auth, async (req, res) => {
  try {
    const meId = req.user.id;

    const [allUsers, me, pending] = await Promise.all([
      User.find({ _id: { $ne: meId } })
        .select("username email online lastSeen")
        .lean(),
      User.findById(meId).select("contacts").lean(),
      FollowRequest.find({
        status: "pending",
        $or: [{ requester: meId }, { recipient: meId }],
      })
        .select("requester recipient status")
        .lean(),
    ]);

    const contactsSet = new Set(
      (me?.contacts || []).map((id) => id.toString())
    );

    const pendingSent = new Map(); // recipientId -> request
    const pendingReceived = new Map(); // requesterId -> request

    (pending || []).forEach((r) => {
      const requesterId = r.requester.toString();
      const recipientId = r.recipient.toString();
      if (requesterId === meId) {
        pendingSent.set(recipientId, r);
      } else if (recipientId === meId) {
        pendingReceived.set(requesterId, r);
      }
    });

    const result = (allUsers || []).map((u) => {
      const uid = u._id.toString();

      let status = "none";
      let requestId = null;

      if (contactsSet.has(uid)) {
        status = "accepted";
      } else if (pendingSent.has(uid)) {
        status = "pending_sent";
        requestId = pendingSent.get(uid)._id;
      } else if (pendingReceived.has(uid)) {
        status = "pending_received";
        requestId = pendingReceived.get(uid)._id;
      }

      return mapUserForClient(u, status, requestId);
    });

    return res.json(result);
  } catch (err) {
    console.error("❌ Users fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/users/contacts
 * 🔹 Only accepted contacts for current user.
 *    This is what HomeScreen uses.
 */
router.get("/contacts", auth, async (req, res) => {
  try {
    const meId = req.user.id;

    const me = await User.findById(meId).select("contacts").lean();
    const contactIds = (me?.contacts || []).map((id) => id.toString());

    if (contactIds.length === 0) {
      return res.json([]);
    }

    const users = await User.find({ _id: { $in: contactIds } })
      .select("username email online lastSeen")
      .lean();

    const result = (users || []).map((u) =>
      mapUserForClient(u, "accepted", null)
    );

    return res.json(result);
  } catch (err) {
    console.error("❌ Contacts fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/users/follow/request
 * body: { userId }
 * 🔹 Send chat/follow request from current user -> userId
 */
router.post("/follow/request", auth, async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (userId === requesterId) {
      return res.status(400).json({ message: "You cannot request yourself." });
    }

    const [me, other] = await Promise.all([
      User.findById(requesterId).select("contacts").lean(),
      User.findById(userId).select("_id").lean(),
    ]);

    if (!other) {
      return res.status(404).json({ message: "User not found" });
    }

    const contactsSet = new Set(
      (me?.contacts || []).map((id) => id.toString())
    );
    if (contactsSet.has(userId.toString())) {
      return res.json({ status: "accepted", message: "Already contacts." });
    }

    // Check pending requests
    const existing = await FollowRequest.findOne({
      requester: requesterId,
      recipient: userId,
      status: "pending",
    }).lean();

    if (existing) {
      return res.json({
        status: "pending_sent",
        requestId: existing._id,
        message: "Request already sent.",
      });
    }

    // If they already requested me, tell client
    const reverse = await FollowRequest.findOne({
      requester: userId,
      recipient: requesterId,
      status: "pending",
    }).lean();

    if (reverse) {
      return res.json({
        status: "pending_received",
        requestId: reverse._id,
        message: "User has already requested you.",
      });
    }

    const created = await FollowRequest.create({
      requester: requesterId,
      recipient: userId,
      status: "pending",
    });

    return res.status(201).json({
      status: "pending_sent",
      requestId: created._id,
      message: "Request sent.",
    });
  } catch (err) {
    console.error("❌ follow/request error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Cancel my outgoing pending follow request
router.post("/follow/cancel", auth, async (req, res) => {
  try {
    const me = req.user.id;        // current logged-in user (requester)
    const { userId } = req.body;   // the person I sent request to

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const deleted = await FollowRequest.findOneAndDelete({
      requester: me,
      recipient: userId,
      status: "pending",
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ message: "No pending request found to cancel." });
    }

    return res.json({ message: "Follow request cancelled." });
  } catch (err) {
    console.error("Cancel follow request error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});
/**
 * POST /api/users/follow/respond
 * body: { requestId, action: "accept" | "reject" }
 */
router.post("/follow/respond", auth, async (req, res) => {
  try {
    const recipientId = req.user.id;
    const { requestId, action } = req.body;

    if (!requestId || !action) {
      return res
        .status(400)
        .json({ message: "requestId and action are required." });
    }

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action." });
    }

    const request = await FollowRequest.findById(requestId);
    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Request not found." });
    }

    if (request.recipient.toString() !== recipientId) {
      return res.status(403).json({ message: "Not authorized for this request." });
    }

    if (action === "accept") {
      request.status = "accepted";
      await request.save();

      const requesterId = request.requester.toString();

      // Add each other as contacts
      await Promise.all([
        User.findByIdAndUpdate(requesterId, {
          $addToSet: { contacts: recipientId },
        }),
        User.findByIdAndUpdate(recipientId, {
          $addToSet: { contacts: requesterId },
        }),
      ]);

      return res.json({ status: "accepted", message: "Request accepted." });
    }

    // reject
    request.status = "rejected";
    await request.save();

    return res.json({ status: "rejected", message: "Request rejected." });
  } catch (err) {
    console.error("❌ follow/respond error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/users/unfollow
 * body: { userId }
 * 🔹 Remove each other from contacts and clear old follow records,
 *    so a fresh request can be sent later.
 */
router.post("/unfollow", auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (userId === meId) {
      return res.status(400).json({ message: "You cannot unfollow yourself." });
    }

    const other = await User.findById(userId).select("_id").lean();
    if (!other) {
      return res.status(404).json({ message: "User not found" });
    }

    // 1) Remove each other from contacts
    await Promise.all([
      User.findByIdAndUpdate(meId, { $pull: { contacts: userId } }),
      User.findByIdAndUpdate(userId, { $pull: { contacts: meId } }),
    ]);

    // 2) Delete ALL follow records between the two users (any status).
    //    This ensures no unique index conflicts and allows new requests later.
    await FollowRequest.deleteMany({
      $or: [
        { requester: meId, recipient: userId },
        { requester: userId, recipient: meId },
      ],
    });

    return res.json({
      status: "none",
      message:
        "Unfollowed successfully. You are no longer contacts and can send a new request in future.",
    });
  } catch (err) {
    console.error("❌ unfollow error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});



/**
 * GET /api/users/follow/pending-count
 * 🔹 Number of pending requests where *I* am the recipient.
 */
router.get("/follow/pending-count", auth, async (req, res) => {
  try {
    const meId = req.user.id;
    const count = await FollowRequest.countDocuments({
      recipient: meId,
      status: "pending",
    });
    return res.json({ count });
  } catch (err) {
    console.error("❌ pending-count error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/users/:id
 * 🔹 Single user (compat)
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const u = await User.findById(req.params.id)
      .select("username email online lastSeen")
      .lean();

    if (!u) {
      return res.status(404).json({ error: "User not found" });
    }

    const payload = mapUserForClient(u, undefined, null);
    return res.json(payload);
  } catch (err) {
    console.error("❌ User fetch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
