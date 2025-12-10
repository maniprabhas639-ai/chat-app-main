// src/screens/HomeScreen.js
import React, { useEffect, useState, useContext, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Pressable,
} from "react-native";
import { AuthContext } from "../context/AuthContext";
import api from "../api/axiosInstance";
import { ROUTES } from "../navigation/routes";
import { getSocket } from "../api/socket";

export default function HomeScreen({ navigation }) {
  const { user, loading, logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);

  // 👇 NEW: number of pending follow requests I have to review
  const [pendingCount, setPendingCount] = useState(0);

  /** 🔹 Fetch *contacts* from API */
  const fetchUsers = useCallback(
    async () => {
      if (!user) return;
      try {
        setRefreshing(true);
        const res = await api.get("/users/contacts"); // contacts only
        const fetched = res.data || [];

        setUsers((prev) => {
          if (!prev || prev.length === 0) return fetched;

          const orderMap = new Map(prev.map((u, idx) => [u._id, idx]));
          const prevMap = new Map(prev.map((u) => [u._id, u]));

          const sorted = [...fetched].sort((a, b) => {
            const ia = orderMap.has(a._id)
              ? orderMap.get(a._id)
              : Number.MAX_SAFE_INTEGER;
            const ib = orderMap.has(b._id)
              ? orderMap.get(b._id)
              : Number.MAX_SAFE_INTEGER;
            return ia - ib;
          });

          return sorted.map((u) => {
            const old = prevMap.get(u._id);
            return old
              ? {
                  ...u,
                  lastMessage: old.lastMessage,
                  hasUnread: old.hasUnread,
                  unreadCount: old.unreadCount,
                }
              : u;
          });
        });
      } catch (err) {
        console.warn(
          "HomeScreen load error:",
          err.response?.data || err.message
        );
        if (err.response?.status === 401) {
          await logout();
        }
      } finally {
        setRefreshing(false);
      }
    },
    [user, logout]
  );

  // 👇 NEW: fetch how many pending requests I have
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await api.get("/users/follow/pending-count");
      setPendingCount(res.data?.count || 0);
    } catch (err) {
      console.warn(
        "pending-count error:",
        err.response?.data || err.message
      );
      // non-fatal, just keep old value
    }
  }, []);

  /** 🔹 Initial fetch when logged in */
  useEffect(() => {
    if (!loading && user) {
      fetchUsers();
      fetchPendingCount(); // 👈 also get pending count
    }
  }, [loading, user, fetchUsers, fetchPendingCount]);

  /** 🔹 Real-time presence updates */
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const handleUserStatus = ({ userId, online, lastSeen }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId
            ? {
                ...u,
                isOnline: online,
                lastSeen: lastSeen !== undefined ? lastSeen : u.lastSeen,
              }
            : u
        )
      );
    };

    const handleOnlineUsers = (ids) => {
      setUsers((prev) =>
        prev.map((u) => ({ ...u, isOnline: ids.includes(u._id) }))
      );
    };

    socket.on("userStatus", handleUserStatus);
    socket.on("onlineUsers", handleOnlineUsers);

    return () => {
      socket.off("userStatus", handleUserStatus);
      socket.off("onlineUsers", handleOnlineUsers);
    };
  }, [user]);

  /** 🔹 Queue + unread when a message is sent/received */
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const handleNewMessage = (msg) => {
      try {
        if (!msg) return;

        const senderId =
          typeof msg.sender === "string"
            ? msg.sender
            : msg.sender?._id || msg.sender?.id;

        const receiverId =
          typeof msg.receiver === "string"
            ? msg.receiver
            : msg.receiver?._id || msg.receiver?.id;

        if (!senderId || !receiverId) return;

        const isOutgoing = senderId === user._id;
        const otherId = isOutgoing ? receiverId : senderId;

        const text =
          msg.content ??
          msg.text ??
          msg.body ??
          (typeof msg.message === "string" ? msg.message : "");

        setUsers((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return prev;
          const idx = prev.findIndex((u) => u._id === otherId);
          if (idx === -1) return prev;

          const updated = [...prev];
          const [target] = updated.splice(idx, 1);

          const currentUnread = target.unreadCount || 0;

          const enhanced = {
            ...target,
            lastMessage: text || target.lastMessage,
            hasUnread: !isOutgoing ? true : target.hasUnread,
            unreadCount: !isOutgoing ? currentUnread + 1 : target.unreadCount,
          };

          updated.unshift(enhanced);
          return updated;
        });
      } catch (e) {
        console.warn("HomeScreen handleNewMessage error:", e?.message || e);
      }
    };

    socket.on("receiveMessage", handleNewMessage);

    return () => {
      socket.off("receiveMessage", handleNewMessage);
    };
  }, [user]);

  /** 🔹 Logout from menu */
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setMenuVisible(false);
      navigation.replace(ROUTES.LOGIN);
    }
  };

  /** 🔹 When you open chat, move to top & clear unread */
  const openChatWithUser = (targetUser) => {
    if (!targetUser || !targetUser._id) {
      setMenuVisible(false);
      navigation.navigate(ROUTES.CHAT, { user: targetUser });
      return;
    }

    setUsers((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      const idx = prev.findIndex((u) => u._id === targetUser._id);
      if (idx === -1) return prev;

      const updated = [...prev];
      const [selected] = updated.splice(idx, 1);

      const cleaned = {
        ...selected,
        hasUnread: false,
        unreadCount: 0,
      };

      updated.unshift(cleaned);
      return updated;
    });

    setMenuVisible(false);
    navigation.navigate(ROUTES.CHAT, { user: targetUser });
  };

  /** 🔹 Filter + sort users (search hits on top, keep queue) */
  const baseUsers = users.filter((u) => u._id !== user?._id);
  const query = searchQuery.trim().toLowerCase();

  const displayedUsers =
    query.length === 0
      ? baseUsers
      : [...baseUsers].sort((a, b) => {
          const aName = (a.username || a.email || "").toLowerCase();
          const bName = (b.username || b.email || "").toLowerCase();
          const aMatch = aName.includes(query);
          const bMatch = bName.includes(query);
          if (aMatch === bMatch) return 0;
          return aMatch ? -1 : 1;
        });

  const formatLastSeen = (u) => {
    if (u.isOnline) return "Online";

    const ts = u.lastSeen;
    if (!ts) return "Last seen recently";

    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / (60 * 60000));
    const diffDay = Math.floor(diffMs / (24 * 60 * 60000));

    if (diffMin < 1) return "Last seen just now";
    if (diffMin < 60) return `Last seen ${diffMin} min ago`;
    if (diffHr < 24) return `Last seen ${diffHr} hr ago`;
    if (diffDay === 1) return "Last seen yesterday";

    return `Last seen ${date.toDateString()}`;
  };

  /** 🔹 Render one user row */
  const renderItem = ({ item }) => {
    const displayName = item.username || item.email || "Unknown User";

    const subtitle =
      item.hasUnread && item.lastMessage
        ? item.lastMessage
        : formatLastSeen(item);

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => openChatWithUser(item)}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={item.isOnline ? styles.onlineDot : styles.offlineDot} />
          </View>

          <View>
            <Text style={styles.userName}>{displayName}</Text>
            <Text
              style={[
                styles.userSubText,
                item.hasUnread && item.lastMessage && styles.userSubTextUnread,
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
        </View>

        {/* Right side: time + unread badge */}
        <View style={styles.rightInfo}>
          <Text style={styles.timeText}>{item.isOnline ? "Now" : ""}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const onRefresh = async () => {
    await fetchUsers();
    await fetchPendingCount();
  };

  return (
    <View style={styles.container}>
      {/* Top purple header with menu + search bar */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            style={styles.menuButton}
            onPress={() => setMenuVisible((prev) => !prev)}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>

          <View style={styles.searchWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#4b5563"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </View>

      {/* Dropdown menu */}
      {menuVisible && (
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Text style={styles.menuItemText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* White content area */}
      <View style={styles.content}>
        <View style={styles.messagesHeaderRow}>
          <View>
            <Text style={styles.messagesTitle}>Messages</Text>
            <Text style={styles.messagesSubtitle}>
              You have {baseUsers.length} chats
            </Text>
          </View>

          {/* Plus button with red badge */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate(ROUTES.PEOPLE)}
          >
            <Text style={styles.addButtonText}>＋</Text>
            {pendingCount > 0 && (
              <View style={styles.addBadge}>
                <Text style={styles.addBadgeText}>
                  {pendingCount > 9 ? "9+" : pendingCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={displayedUsers}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e5e7eb",
  },

  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: "#a855f7",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 20,
    color: "#fff",
  },

  searchWrapper: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: "#f3e8ff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderwidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    borderWidth: 0,
    outlineStyle: "none",
  },

  menuContainer: {
    position: "absolute",
    top: 80,
    left: 16,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  menuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 100,
  },
  menuItemText: {
    fontSize: 14,
    color: "#111827",
  },

  content: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  messagesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  messagesTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  messagesSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  addButtonText: {
    fontSize: 22,
    lineHeight: 22,
    color: "#ffffff",
    fontWeight: "700",
  },
  addBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  addBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },

  listContent: {
    paddingBottom: 16,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },

  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },

  rightInfo: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 40,
  },

  avatarWrapper: {
    marginRight: 12,
    position: "relative",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  onlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  offlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#9ca3af",
    borderWidth: 2,
    borderColor: "#ffffff",
  },

  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  userSubText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    maxWidth: 200,
  },
  userSubTextUnread: {
    color: "#111827",
    fontWeight: "600",
  },

  timeText: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 4,
  },

  unreadBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
});
