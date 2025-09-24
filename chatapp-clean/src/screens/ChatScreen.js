// src/screens/ChatScreen.js
import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { AuthContext } from "../context/AuthContext";
import {
  fetchMessages as apiFetchMessages,
  sendMessage as apiSendMessage,
  markDelivered,
} from "../api/messages.api";
import { connectSocket, getSocket } from "../api/socket";
import { safeOn, safeOff, safeEmit } from "../api/socketUtils";

/* ---------- helpers ---------- */
const toIdString = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v._id || v.id || v);
  return String(v);
};

/**
 * Normalize many server shapes into a stable client message object
 * - content: the canonical message body (matches DB)
 * - text: friendly UI field (mirrors content)
 * - seen/read: both set for compatibility
 */
const normalizeMessage = (raw) => {
  if (!raw) return null;
  try {
    const m = raw.message ?? raw.msg ?? raw;
    const idCandidate = m._id ?? m.id ?? (m._doc && (m._doc._id || m._doc.id));
    const _id = idCandidate ? String(idCandidate) : `tmp-${Date.now()}-${Math.random()}`;

    const sender = typeof m.sender === "object" ? String(m.sender._id || m.sender.id || "") : String(m.sender || "");
    const receiver = typeof m.receiver === "object" ? String(m.receiver._id || m.receiver.id || "") : String(m.receiver || "");

    const content = (m.content ?? m.text ?? m.body ?? m.message ?? "") + "";
    const text = String(content);

    const seen = Boolean(m.seen || m.read || m.seenAt || m.readAt);
    const delivered = Boolean(m.delivered || m.deliveredAt);

    const createdAt = m.createdAt ? new Date(m.createdAt).toISOString() : m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString();

    return {
      _id,
      sender,
      receiver,
      content,
      text,
      delivered,
      seen,
      read: seen, // keep 'read' for UI compatibility
      createdAt,
      raw: m,
      temp: Boolean(m.temp || String(_id).startsWith("tmp-")),
    };
  } catch (err) {
    console.error("normalizeMessage error:", err?.message || err);
    return null;
  }
};

/* ---------- component ---------- */
export default function ChatScreen({ route }) {
  const { user } = useContext(AuthContext);

  const rawParams = route?.params || {};
  const otherUser = useMemo(() => {
    if (rawParams.user) return rawParams.user;
    if (rawParams.recipient) return rawParams.recipient;
    if (rawParams.otherUser) return rawParams.otherUser;
    const id = rawParams.userId || rawParams._id || rawParams.id || null;
    const name = rawParams.username || rawParams.name || rawParams.displayName || rawParams.email || null;
    if (id || name) return { _id: id, username: name, name };
    if (rawParams && typeof rawParams === "object" && (rawParams._id || rawParams.username || rawParams.email)) return rawParams;
    return null;
  }, [rawParams]);

  const otherUserId = useMemo(() => toIdString(otherUser?._id || otherUser?.id), [otherUser]);
  const otherUserName = useMemo(() => (otherUser && (otherUser.username || otherUser.name || otherUser.email)) || "Unknown User", [otherUser]);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState({ online: false, lastSeen: null, username: otherUserName });

  const flatListRef = useRef(null);
  const messageIdsRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);
  const localTypingRef = useRef(false);
  const partnerTypingTimerRef = useRef(null);

  const scrollToEnd = useCallback(() => {
    try { flatListRef.current?.scrollToEnd({ animated: true }); } catch {}
  }, []);

  /* ---------- load messages ---------- */
  const loadMessages = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const res = await apiFetchMessages(otherUserId);
      // apiFetchMessages should return an array of normalized message objects, but support multiple shapes
      const rawMsgs = Array.isArray(res) ? res : Array.isArray(res?.messages) ? res.messages : res?.data ?? [];
      const unique = [];
      const ids = new Set();
      for (const r of rawMsgs) {
        const m = typeof r === "object" && r._id ? (r._id && r.content ? r : normalizeMessage(r)) : normalizeMessage(r);
        if (!m) continue;
        if (!ids.has(m._id)) {
          ids.add(m._id);
          unique.push(m);
        }
      }
      messageIdsRef.current = new Set(unique.map((m) => m._id));
      setMessages(unique);
    } catch (err) {
      console.error("loadMessages error:", err?.response?.data || err?.message || err);
    } finally {
      setTimeout(scrollToEnd, 80);
    }
  }, [otherUserId, scrollToEnd]);

  /* ---------- send message (optimistic) ---------- */
  const sendMsg = useCallback(async () => {
    const trimmed = (text || "").trim();
    if (!trimmed || !otherUserId || !user) return Alert.alert("Error", "Invalid conversation partner or user.");

    const senderId = user?._id || user?.id;
    const tempId = `tmp-${Date.now()}`;

    // Optimistic UI message (content = backend field, text = UI field)
    const optimistic = {
      _id: tempId,
      sender: senderId,
      receiver: otherUserId,
      content: trimmed,                // canonical DB field
      text: trimmed,                   // UI convenience
      delivered: false,
      seen: false,
      read: false,
      createdAt: new Date().toISOString(),
      temp: true,
    };

    // Add optimistic message
    setMessages((prev) => { messageIdsRef.current.add(tempId); return [...prev, optimistic]; });
    setText("");

    try {
      const apiRes = await apiSendMessage({ receiver: otherUserId, content: trimmed });

      // apiSendMessage may return:
      //  - a normalized object { _id, sender, receiver, content, ... }
      //  - or a raw server doc { _id, content, sender: {...}, ... }
      //  - or { message: <doc> }
      let normalized = null;
      if (apiRes && apiRes._id && (apiRes.content || apiRes.text)) {
        // assume already normalized-ish
        // ensure 'text' exists
        if (!apiRes.text && apiRes.content) apiRes.text = String(apiRes.content);
        if (apiRes.seen === undefined && apiRes.read !== undefined) apiRes.seen = Boolean(apiRes.read);
        normalized = apiRes;
      } else {
        const raw = apiRes?.message ?? apiRes?.data ?? apiRes;
        normalized = normalizeMessage(raw);
      }

      if (!normalized || !normalized._id) throw new Error("Invalid response from sendMessage");

      // Replace optimistic temp with server message or append deduped
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m._id === tempId);
        if (idx >= 0) {
          const newArr = [...prev];
          newArr[idx] = normalized;
          messageIdsRef.current.delete(tempId);
          messageIdsRef.current.add(normalized._id);
          // dedupe any other occurrences of same id
          return newArr.filter((v, i) => !(i !== idx && String(v._id) === String(normalized._id)));
        } else {
          // temp not found (socket race) -> append if not duplicate
          if (messageIdsRef.current.has(normalized._id)) return prev;
          messageIdsRef.current.add(normalized._id);
          return [...prev, normalized];
        }
      });
    } catch (err) {
      console.error("sendMessage error:", err?.response?.data || err?.message || err);
      Alert.alert("Send failed", err?.userFriendlyMessage || "Could not send message.");
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      messageIdsRef.current.delete(tempId);
    } finally {
      scrollToEnd();
      if (localTypingRef.current && getSocket()) {
        safeEmit("stopTyping", { to: otherUserId });
        localTypingRef.current = false;
      }
    }
  }, [text, otherUserId, user, scrollToEnd]);

  /* ---------- socket lifecycle ---------- */
  useEffect(() => {
    let mounted = true;
    const sockInit = async () => {
      await loadMessages();
      if (!otherUserId) return;

      const sock = await connectSocket();
      if (!sock) return;

      const myId = String(user?._id || user?.id);
      const roomId = [myId, String(otherUserId)].sort().join("_");

      // Ask server to join the conversation room and fetch presence
      safeEmit("joinRoom", roomId);
      safeEmit("getPresence", otherUserId);

      // Handlers
      const onReceive = (raw) => {
        if (!mounted || !raw) return;
        const m = normalizeMessage(raw);
        if (!m) return;

        // If we already know this ID, ignore
        if (messageIdsRef.current.has(m._id)) return;

        // Try to replace a temp message with matching content/sender/receiver
        setMessages((prev) => {
          const tempIdx = prev.findIndex(
            (pm) =>
              pm.temp &&
              String(pm.sender) === String(m.sender) &&
              String(pm.receiver) === String(m.receiver) &&
              (String(pm.text) === String(m.text) || String(pm.content) === String(m.content))
          );

          if (tempIdx >= 0) {
            const newArr = [...prev];
            const oldTempId = newArr[tempIdx]._id;
            newArr[tempIdx] = m;
            messageIdsRef.current.delete(oldTempId);
            messageIdsRef.current.add(m._id);
            return newArr.filter((v, i) => !(i !== tempIdx && String(v._id) === String(m._id)));
          }

          // otherwise append
          messageIdsRef.current.add(m._id);
          return [...prev, m];
        });

        // If this message was delivered to me, ack delivery
        const myIdLocal = String(user?._id || user?.id);
        if (String(m.receiver) === myIdLocal) {
          // notify sender that message is delivered (socket)
          safeEmit("messageDelivered", { messageId: m._id, to: m.sender });
          // persist delivered in DB as well (best-effort)
          markDelivered(m._id).catch(() => {});
        }

        setTimeout(scrollToEnd, 40);
      };

      const onTyping = ({ from }) => {
        if (String(from) === String(otherUserId)) {
          setIsPartnerTyping(true);
          clearTimeout(partnerTypingTimerRef.current);
          partnerTypingTimerRef.current = setTimeout(() => setIsPartnerTyping(false), 2500);
        }
      };
      const onStopTyping = ({ from }) => {
        if (String(from) === String(otherUserId)) setIsPartnerTyping(false);
      };
      const onUserStatus = ({ userId, online, lastSeen }) => {
        if (String(userId) !== String(otherUserId)) return;
        setPartnerPresence({ username: otherUserName, online: !!online, lastSeen: online ? null : lastSeen || Date.now() });
      };

      const onDelivered = ({ messageId }) => {
        if (!messageId) return;
        setMessages((prev) => prev.map((m) => (String(m._id) === String(messageId) ? { ...m, delivered: true } : m)));
      };

      const onSeen = ({ messageId }) => {
        if (!messageId) return;
        setMessages((prev) => prev.map((m) => (String(m._id) === String(messageId) ? { ...m, seen: true, read: true } : m)));
      };

      // Subscribe
      safeOn("receiveMessage", onReceive);
      safeOn("typing", onTyping);
      safeOn("stopTyping", onStopTyping);
      safeOn("userStatus", onUserStatus);
      safeOn("messageDelivered", onDelivered);
      safeOn("messageSeen", onSeen);
    };

    sockInit();

    return () => {
      mounted = false;
      const myId = String(user?._id || user?.id);
      if (otherUserId && myId) safeEmit("leaveRoom", [myId, String(otherUserId)].sort().join("_"));

      // Unsubscribe
      safeOff("receiveMessage");
      safeOff("typing");
      safeOff("stopTyping");
      safeOff("userStatus");
      safeOff("messageDelivered");
      safeOff("messageSeen");

      clearTimeout(typingTimeoutRef.current);
      clearTimeout(partnerTypingTimerRef.current);
    };
  }, [otherUserId, loadMessages, otherUserName, user]);

  /* ---------- typing indicator ---------- */
  const onChangeText = useCallback((val) => {
    setText(val);
    const sock = getSocket();
    if (!sock || !otherUserId) return;

    if (!localTypingRef.current) {
      localTypingRef.current = true;
      safeEmit("typing", { to: otherUserId });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      safeEmit("stopTyping", { to: otherUserId });
      localTypingRef.current = false;
    }, 900);
  }, [otherUserId]);

  /* ---------- render message ---------- */
  const renderItem = useCallback(({ item }) => {
    const isMe = String(item.sender) === String(user?._id || user?.id);
    return (
      <View style={[styles.message, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe && { color: "#fff" }]}>{item.text}</Text>
        {isMe && <Text style={styles.metaText}>{item.read ? "Seen" : item.delivered ? "Delivered" : "Sent"}</Text>}
      </View>
    );
  }, [user]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={{ padding: 12 }}>
        <Text style={styles.header}>Chat with {partnerPresence.username}</Text>
        <Text style={{ fontSize: 13, color: partnerPresence.online ? "green" : "#666" }}>
          {partnerPresence.online ? "Online" : partnerPresence.lastSeen ? `Last seen ${new Date(partnerPresence.lastSeen).toLocaleString()}` : "Offline"}
        </Text>
        {isPartnerTyping && <Text style={{ color: "#666", fontSize: 13 }}>{partnerPresence.username} is typing...</Text>}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item, idx) => String(item._id || idx)}
        onContentSizeChange={scrollToEnd}
        onLayout={scrollToEnd}
      />

      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Type a message..." value={text} onChangeText={onChangeText} />
        <TouchableOpacity style={styles.sendButton} onPress={sendMsg}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  message: { padding: 10, marginVertical: 5, marginHorizontal: 10, borderRadius: 10, maxWidth: "75%" },
  myMessage: { alignSelf: "flex-end", backgroundColor: "#007AFF" },
  theirMessage: { alignSelf: "flex-start", backgroundColor: "#E5E5EA" },
  messageText: { color: "#000" },
  metaText: { marginTop: 6, fontSize: 11, color: "#eee", textAlign: "right" },
  inputContainer: { flexDirection: "row", padding: 10, borderTopWidth: 1, borderColor: "#ddd", backgroundColor: "#fafafa" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 25, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: "#fff" },
  sendButton: { marginLeft: 10, backgroundColor: "#007AFF", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "bold" },
});
