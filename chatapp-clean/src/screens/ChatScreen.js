// src/screens/ChatScreen.js
import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
import { LinearGradient } from "expo-linear-gradient";


/* ---------- helpers ---------- */
const toIdString = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v._id || v.id || v);
  return String(v);
};

/**
 * Normalize many server shapes into a stable client message object
 */
const normalizeMessage = (raw) => {
  if (!raw) return null;
  try {
    const m = raw.message ?? raw.msg ?? raw;
    const idCandidate =
      m._id ?? m.id ?? (m._doc && (m._doc._id || m._doc.id));
    const _id = idCandidate
      ? String(idCandidate)
      : `tmp-${Date.now()}-${Math.random()}`;

    const sender =
      typeof m.sender === "object"
        ? String(m.sender._id || m.sender.id || "")
        : String(m.sender || "");
    const receiver =
      typeof m.receiver === "object"
        ? String(m.receiver._id || m.receiver.id || "")
        : String(m.receiver || "");

    const content = (m.content ?? m.text ?? m.body ?? m.message ?? "") + "";
    const text = String(content);

    const seen = Boolean(m.seen || m.read || m.seenAt || m.readAt);
    const delivered = Boolean(m.delivered || m.deliveredAt);

    const createdAt = m.createdAt
      ? new Date(m.createdAt).toISOString()
      : m.timestamp
      ? new Date(m.timestamp).toISOString()
      : new Date().toISOString();

    return {
      _id,
      sender,
      receiver,
      content,
      text,
      delivered,
      seen,
      read: seen,
      createdAt,
      raw: m,
      temp: Boolean(m.temp || String(_id).startsWith("tmp-")),
    };
  } catch (err) {
    console.error("normalizeMessage error:", err?.message || err);
    return null;
  }
};

const formatTime = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); // e.g. 9:00 PM
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
    const name =
      rawParams.username ||
      rawParams.name ||
      rawParams.displayName ||
      rawParams.email ||
      null;

    if (id || name) return { _id: id, username: name, name };

    if (
      rawParams &&
      typeof rawParams === "object" &&
      (rawParams._id || rawParams.username || rawParams.email)
    )
      return rawParams;

    return null;
  }, [rawParams]);

  const otherUserId = useMemo(
    () => toIdString(otherUser?._id || otherUser?.id),
    [otherUser]
  );
  const otherUserName = useMemo(
    () =>
      (otherUser &&
        (otherUser.username || otherUser.name || otherUser.email)) ||
      "Unknown User",
    [otherUser]
  );

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState({
    online: false,
    lastSeen: null,
    username: otherUserName,
  });

  const flatListRef = useRef(null);
  const messageIdsRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);
  const localTypingRef = useRef(false);
  const partnerTypingTimerRef = useRef(null);

  const scrollToEnd = useCallback(() => {
    try {
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch {}
  }, []);

  /* ---------- load messages (initial) ---------- */
  const loadMessages = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const res = await apiFetchMessages(otherUserId);
      const rawMsgs = Array.isArray(res)
        ? res
        : Array.isArray(res?.messages)
        ? res.messages
        : res?.data ?? [];

      const unique = [];
      const ids = new Set();

      for (const r of rawMsgs) {
        const m =
          typeof r === "object" && r._id
            ? r._id && r.content
              ? r
              : normalizeMessage(r)
            : normalizeMessage(r);
        if (!m) continue;
        if (!ids.has(m._id)) {
          ids.add(m._id);
          unique.push(m);
        }
      }

      messageIdsRef.current = new Set(unique.map((m) => m._id));
      setMessages(unique);
    } catch (err) {
      console.error(
        "loadMessages error:",
        err?.response?.data || err?.message || err
      );
    } finally {
      setTimeout(scrollToEnd, 80);
    }
  }, [otherUserId, scrollToEnd]);

  /* ---------- silent refresh to keep ticks in sync ---------- */
  const refreshMessagesSilent = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const res = await apiFetchMessages(otherUserId);
      const rawMsgs = Array.isArray(res)
        ? res
        : Array.isArray(res?.messages)
        ? res.messages
        : res?.data ?? [];

      const unique = [];
      const ids = new Set();

      for (const r of rawMsgs) {
        const m =
          typeof r === "object" && r._id
            ? r._id && r.content
              ? r
              : normalizeMessage(r)
            : normalizeMessage(r);
        if (!m) continue;
        if (!ids.has(m._id)) {
          ids.add(m._id);
          unique.push(m);
        }
      }

      messageIdsRef.current = new Set(unique.map((m) => m._id));
      setMessages(unique);
    } catch (err) {
      console.error(
        "refreshMessagesSilent error:",
        err?.response?.data || err?.message || err
      );
    }
  }, [otherUserId]);


  /* ---------- send message (optimistic, socket-first) ---------- */
const sendMsg = useCallback(async () => {
  const trimmed = (text || "").trim();
  if (!trimmed || !otherUserId || !user) {
    return Alert.alert("Error", "Invalid conversation partner or user.");
  }

  const senderId = user?._id || user?.id;
  const tempId = `tmp-${Date.now()}`;

  // Optimistic message (UI)
  const optimistic = {
    _id: tempId,
    sender: senderId,
    receiver: otherUserId,
    content: trimmed,
    text: trimmed,
    delivered: false,
    seen: false,
    read: false,
    createdAt: new Date().toISOString(),
    temp: true,
  };

  // Add optimistic message to UI
  setMessages((prev) => {
    messageIdsRef.current.add(tempId);
    return [...prev, optimistic];
  });
  setText("");

  try {
    // Prefer socket for low-latency send
    const sock = getSocket();
    if (sock && sock.connected) {
      // Emit ONCE via safeEmit
      safeEmit("sendMessage", {
        message: { sender: senderId, receiver: otherUserId, content: trimmed },
      });

      // We do not await an HTTP response here — the server will send back receiveMessage via socket,
      // and your existing "onReceive" handler will replace the optimistic message when the persisted msg arrives.
    } else {
      // Socket not available — fall back to HTTP POST (existing behavior)
      const apiRes = await apiSendMessage({
        receiver: otherUserId,
        content: trimmed,
      });

      // normalize/replace optimistic message with server response (existing flow)
      let normalized = apiRes;
      if (normalized && normalized._id) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m._id === tempId);
          if (idx >= 0) {
            const newArr = [...prev];
            const oldTempId = newArr[idx]._id;
            newArr[idx] = normalized;
            messageIdsRef.current.delete(oldTempId);
            messageIdsRef.current.add(normalized._id);
            return newArr.filter(
              (v, i) => !(i !== idx && String(v._id) === String(normalized._id))
            );
          } else {
            if (messageIdsRef.current.has(normalized._id)) return prev;
            messageIdsRef.current.add(normalized._id);
            return [...prev, normalized];
          }
        });
      } else {
        // unexpected server reply -> leave optimistic (server should emit receiveMessage later)
        console.warn("sendMsg: unexpected HTTP response from apiSendMessage", apiRes);
      }
    }
  } catch (err) {
    console.error(
      "sendMessage error:",
      err?.response?.data || err?.message || err
    );
    // If HTTP failed and socket wasn't available, remove optimistic message
    setMessages((prev) => prev.filter((m) => m._id !== tempId));
    messageIdsRef.current.delete(tempId);
    Alert.alert(
      "Send failed",
      err?.userFriendlyMessage || err?.message || "Could not send message."
    );
  } finally {
    // scroll and stop typing as before
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

      safeEmit("joinRoom", roomId);
      safeEmit("getPresence", otherUserId);

      const onReceive = (raw) => {
        if (!mounted || !raw) return;
        const m = normalizeMessage(raw);
        if (!m) return;

        if (messageIdsRef.current.has(m._id)) return;

        setMessages((prev) => {
          const tempIdx = prev.findIndex(
            (pm) =>
              pm.temp &&
              String(pm.sender) === String(m.sender) &&
              String(pm.receiver) === String(m.receiver) &&
              (String(pm.text) === String(m.text) ||
                String(pm.content) === String(m.content))
          );

          if (tempIdx >= 0) {
            const newArr = [...prev];
            const oldTempId = newArr[tempIdx]._id;
            newArr[tempIdx] = m;
            messageIdsRef.current.delete(oldTempId);
            messageIdsRef.current.add(m._id);
            return newArr.filter(
              (v, i) =>
                !(i !== tempIdx && String(v._id) === String(m._id))
            );
          }

          messageIdsRef.current.add(m._id);
          return [...prev, m];
        });

        const myIdLocal = String(user?._id || user?.id);
        if (String(m.receiver) === myIdLocal) {
          safeEmit("messageDelivered", {
            messageId: m._id,
            to: m.sender,
          });
          markDelivered(m._id).catch(() => {});
        }

        setTimeout(scrollToEnd, 40);
      };

      const onTyping = ({ from }) => {
        if (String(from) === String(otherUserId)) {
          setIsPartnerTyping(true);
          clearTimeout(partnerTypingTimerRef.current);
          partnerTypingTimerRef.current = setTimeout(
            () => setIsPartnerTyping(false),
            2500
          );
        }
      };
      const onStopTyping = ({ from }) => {
        if (String(from) === String(otherUserId)) setIsPartnerTyping(false);
      };
      const onUserStatus = ({ userId, online, lastSeen }) => {
        if (String(userId) !== String(otherUserId)) return;
        setPartnerPresence({
          username: otherUserName,
          online: !!online,
          lastSeen: online ? null : lastSeen || Date.now(),
        });
      };

      const onDelivered = ({ messageId }) => {
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? { ...m, delivered: true }
              : m
          )
        );
      };

      const onSeen = ({ messageId }) => {
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? { ...m, seen: true, read: true }
              : m
          )
        );
      };

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
      if (otherUserId && myId)
        safeEmit(
          "leaveRoom",
          [myId, String(otherUserId)].sort().join("_")
        );

      safeOff("receiveMessage");
      safeOff("typing");
      safeOff("stopTyping");
      safeOff("userStatus");
      safeOff("messageDelivered");
      safeOff("messageSeen");

      clearTimeout(typingTimeoutRef.current);
      clearTimeout(partnerTypingTimerRef.current);
    };
  }, [otherUserId, loadMessages, otherUserName, user, scrollToEnd]);

  /* ---------- mark incoming messages as seen when I'm viewing this chat ---------- */
  useEffect(() => {
    const myId = String(user?._id || user?.id || "");
    if (!myId) return;
    if (!messages || messages.length === 0) return;

    messages.forEach((m) => {
      // if I am the receiver and message is not yet seen/read
      if (
        String(m.receiver) === myId &&
        !m.read &&
        !m.seen &&
        m._id // only persisted messages
      ) {
        safeEmit("messageSeen", { messageId: m._id, to: m.sender });
      }
    });
  }, [messages, user]);




  /* ---------- typing indicator ---------- */
  const onChangeText = useCallback(
    (val) => {
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
    },
    [otherUserId]
  );

const renderItem = useCallback(
  ({ item }) => {
    const isMe = String(item.sender) === String(user?._id || user?.id);

    // ticks: ✓ when only sent, ✓✓ (blue) when delivered/seen
    const isDeliveredOrSeen = Boolean(
      item.delivered || item.read || item.seen
    );
    const ticks = isDeliveredOrSeen ? "✓✓" : "✓";

    const timeLabel = formatTime(item.createdAt);

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        {isMe ? (
          // 🔹 YOUR messages (right side, white bubble + ticks + time)
          <View style={[styles.messageBubble, styles.myMessage]}>
            <Text style={[styles.messageText, styles.myMessageText]}>
              {item.text}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.timeTextMe}>{timeLabel}</Text>
              <Text
                style={[
                  styles.metaText,
                  isDeliveredOrSeen && styles.metaTextRead,
                ]}
              >
                {ticks}
              </Text>
            </View>
          </View>
        ) : (
          // 🔹 THEIR messages (left side, gradient bubble + time)
          <LinearGradient
            colors={["#C084FC", "#F0ABFC"]} // purple → pink gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.messageBubble, styles.theirMessage]}
          >
            <Text style={[styles.messageText, styles.theirMessageText]}>
              {item.text}
            </Text>
            <View style={styles.metaRowThem}>
              <Text style={styles.timeTextThem}>{timeLabel}</Text>
            </View>
          </LinearGradient>
        )}
      </View>
    );
  },
  [user]
);







  const statusText = partnerPresence.online
    ? "Online"
    : partnerPresence.lastSeen
    ? `Last seen ${new Date(
        partnerPresence.lastSeen
      ).toLocaleString()}`
    : "Offline";

  /* ---------- render ---------- */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <LinearGradient
  colors={["#7c3aed", "#6d28d9"]} 
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.chatSurface}
>

        {/* header */}
        <View style={styles.topBar}>
          <View style={styles.topRow}>
            <Text style={styles.topName}>{partnerPresence.username}</Text>
            <Text
              style={[
                styles.topStatus,
                partnerPresence.online && styles.topStatusOnline,
              ]}
            >
              {statusText}
            </Text>
          </View>
        </View>

        {/* messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item, idx) => String(item._id || idx)}
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
    isPartnerTyping ? (
      <View style={styles.typingRow}>
        <Text style={styles.typingBubble}>
          {partnerPresence.username} is typing...
        </Text>
      </View>
    ) : null
  }
        />

        {/* input */}
        <View style={styles.inputArea}>
          <View style={styles.composer}>
            <Text style={styles.micIcon}>＋</Text>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              value={text}
              onChangeText={onChangeText}
            />
          </View>
          <TouchableOpacity style={styles.sendButton} onPress={sendMsg}>
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  // outer soft background
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  // inner rounded chat surface
  chatSurface: {
    flex: 1,
    marginHorizontal: 12,
    marginVertical: 18,
    borderRadius: 32,
    paddingTop: 16,
    paddingBottom: 10,
    overflow: "hidden",
  },

  topBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f9fafb",
  },
  topStatus: {
    fontSize: 12,
    color: "#e5e7eb",
  },
  topStatusOnline: {
    color: "#bbf7d0",
  },
  typingText: {
    fontSize: 12,
    color: "#e5e7eb",
    marginTop: 4,
  },

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },

  messageRow: {
    width: "100%",
    marginVertical: 4,
  },
  messageRowMe: {
    alignItems: "flex-end",
  },
  messageRowThem: {
    alignItems: "flex-start",
  },

  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  // other user's bubble
  theirMessage: {
    backgroundColor: "transparent",
    color: "#ffffff",
    borderBottomLeftRadius: 4,
  },
  theirMessageText: {
  color: "#4b0082", // deep purple text that fits the gradient
  fontWeight: "500",
},
  // my bubble
  myMessage: {
    backgroundColor: "#ffffff",
    borderBottomRightRadius: 4,
  },

  messageText: {
    fontSize: 14,
    color: "#7A4B00",
  },
  myMessageText: {
    color: "#4c3bcf",
  },

  metaText: {
    marginTop: 4,
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "right",
  },
  metaTextRead: {
    color: "#38bdf8", // blue double ticks
  },

metaRow: {
  marginTop: 4,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
},
metaRowThem: {
  marginTop: 4,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
},

timeTextMe: {
  fontSize: 10,
  color: "#6b7280",
  marginRight: 6,
},
timeTextThem: {
  fontSize: 10,
  color: "#111827",
},

// you can keep metaText / metaTextRead as-is
metaText: {
  marginTop: 0,
  fontSize: 11,
  color: "#9ca3af",
  textAlign: "right",
},
metaTextRead: {
  color: "#38bdf8", // blue double ticks
},

// typing indicator styles (bottom-of-chat)
typingRow: {
  paddingHorizontal: 12,
  paddingTop: 4,
  paddingBottom: 8,
  alignItems: "flex-start",
},
typingBubble: {
  backgroundColor: "rgba(255,255,255,0.9)",
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 6,
  fontSize: 13,
  fontWeight: "700",
  color: "#000", // bold black text like you asked
},


  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  composer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  micIcon: {
    fontSize: 18,
    marginRight: 8,
    color: "#6b21a8",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 4,
    borderWidth: 0,
    outlineStyle: "none",
  },
  sendButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    fontSize: 18,
    color: "#6b21a8",
  },
});
