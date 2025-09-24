// src/api/messages.api.js
import api from "./axiosInstance";
import { getSocket } from "./socket";
import { safeEmit } from "./socketUtils";

/* ---------- utilities ---------- */
const toId = (v) => {
  if (!v && v !== 0) return null;
  try {
    return typeof v === "string" ? v : String(v._id ?? v.id ?? v);
  } catch {
    return null;
  }
};

const bool = (v) => !!v;

/* ---------- normalizer ---------- */
/**
 * Normalize server shapes into stable client message objects.
 */
const normalizeMessage = (m) => {
  if (!m) return null;
  try {
    const raw = m?.message ?? m?.msg ?? m;
    const idCandidate = raw?._id ?? raw?.id ?? (raw?._doc && (raw._doc._id || raw._doc.id));
    const _id = idCandidate ? String(idCandidate) : `tmp-${Date.now()}-${Math.random()}`;

    const senderObj = raw?.sender && typeof raw.sender === "object" ? raw.sender : null;
    const receiverObj = raw?.receiver && typeof raw.receiver === "object" ? raw.receiver : null;

    const sender = toId(raw?.sender) || (senderObj && toId(senderObj._id)) || null;
    const receiver = toId(raw?.receiver) || (receiverObj && toId(receiverObj._id)) || null;

    const content = (raw?.content ?? raw?.text ?? raw?.body ?? raw?.message ?? "") + "";
    const text = String(content);

    const createdAt = raw?.createdAt ? new Date(raw.createdAt).toISOString()
                      : raw?.timestamp ? new Date(raw.timestamp).toISOString()
                      : new Date().toISOString();

    const delivered = bool(raw?.delivered || raw?.deliveredAt);
    const seen = bool(raw?.seen || raw?.read || raw?.seenAt || raw?.readAt);
    const read = seen;

    return {
      _id,
      sender,
      receiver,
      content,
      text,
      createdAt,
      delivered,
      seen,
      read,
      raw,
      senderObj,
      receiverObj,
      temp: Boolean(raw?.temp || String(_id).startsWith("tmp-")),
    };
  } catch (err) {
    console.error("normalizeMessage error:", err?.message || err);
    return null;
  }
};

/* ---------- response coercion ---------- */
const extractMessageArray = (resData) => {
  if (!resData) return [];
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData.messages)) return resData.messages;
  if (Array.isArray(resData.data)) return resData.data;
  if (resData?.data && Array.isArray(resData.data.messages)) return resData.data.messages;
  if (Array.isArray(resData.message)) return resData.message;
  if (typeof resData === "object") {
    if (resData._id || resData.id || resData.sender) return [resData];
  }
  return [];
};

/* ---------- API: fetchMessages ---------- */
/**
 * Returns an array of normalized messages for the conversation.
 */
export const fetchMessages = async (otherUserId) => {
  if (!otherUserId) return [];
  try {
    const res = await api.get(`/messages/${otherUserId}`);
    const arr = extractMessageArray(res?.data);
    return arr.map(normalizeMessage).filter(Boolean);
  } catch (err) {
    console.error("fetchMessages error:", err?.response?.data ?? err?.message ?? err);
    throw err;
  }
};

/* ---------- API: sendMessage ---------- */
/**
 * messageData: { receiver, content/text, sender?, extra?, clientId? }
 * Returns a normalized message object (server-persisted).
 */
export const sendMessage = async (messageData) => {
  if (!messageData || !messageData.receiver) {
    throw new Error("sendMessage: receiver is required");
  }

  try {
    const payload = {
      receiver: messageData.receiver,
      content: messageData.content ?? messageData.text ?? "",
      ...(messageData.sender ? { sender: messageData.sender } : {}),
      ...(messageData.extra ? { extra: messageData.extra } : {}),
      ...(messageData.clientId ? { clientId: messageData.clientId } : {}),
    };

    const res = await api.post("/messages", payload);

    // server may return { message: {...} } or the message directly
    const rawMsg = res?.data?.message ?? res?.data ?? null;
    const normalized = normalizeMessage(rawMsg);

    if (!normalized) {
      // defensive: if server returned something unexpected, log and throw
      console.error("sendMessage: invalid server response", res?.data);
      throw new Error("Invalid response from server");
    }

    return normalized;
  } catch (err) {
    console.error("sendMessage error:", err?.response?.data ?? err?.message ?? err);
    throw err;
  }
};

/* ---------- API: markDelivered / markSeen ---------- */
/**
 * Use PATCH endpoints (server expects PATCH).
 * If HTTP fails, do a best-effort socket emit fallback.
 */

export const markDelivered = async (messageId, to = null) => {
  if (!messageId) return false;
  try {
    await api.patch(`/messages/${messageId}/delivered`, to ? { to } : {});
    return true;
  } catch (err) {
    console.warn("markDelivered HTTP failed, trying socket emit:", err?.message ?? err);
    try {
      safeEmit("messageDelivered", { messageId, to });
      const s = getSocket();
      if (s && s.connected) s.emit("messageDelivered", { messageId, to });
      return true;
    } catch (emitErr) {
      console.error("markDelivered socket emit failed:", emitErr);
      return false;
    }
  }
};

export const markSeen = async (messageId, to = null) => {
  if (!messageId) return false;
  try {
    await api.patch(`/messages/${messageId}/seen`, to ? { to } : {});
    return true;
  } catch (err) {
    console.warn("markSeen HTTP failed, trying socket emit:", err?.message ?? err);
    try {
      safeEmit("messageSeen", { messageId, to });
      const s = getSocket();
      if (s && s.connected) s.emit("messageSeen", { messageId, to });
      return true;
    } catch (emitErr) {
      console.error("markSeen socket emit failed:", emitErr);
      return false;
    }
  }
};
