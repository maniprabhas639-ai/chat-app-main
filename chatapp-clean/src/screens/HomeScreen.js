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

  /** 🔹 Fetch users from API */
  const fetchUsers = useCallback(
    async () => {
      if (!user) return;
      try {
        setRefreshing(true);
        const res = await api.get("/users");
        setUsers(res.data || []);
      } catch (err) {
        console.warn("HomeScreen load error:", err.response?.data || err.message);
        if (err.response?.status === 401) {
          await logout();
        }
      } finally {
        setRefreshing(false);
      }
    },
    [user, logout]
  );

  /** 🔹 Initial fetch when logged in */
  useEffect(() => {
    if (!loading && user) {
      fetchUsers();
    }
  }, [loading, user, fetchUsers]);

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
            // keep existing lastSeen if socket didn't send one
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

  /** 🔹 Logout from menu */
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setMenuVisible(false);
      // ensure we end up on Login screen
      navigation.replace(ROUTES.LOGIN);
    }
  };

  /** 🔹 Filter + sort users (search hits on top) */
  const baseUsers = users.filter((u) => u._id !== user?._id); // exclude self
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
          return aMatch ? -1 : 1; // matches first
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

  // fallback: simple date string
  return `Last seen ${date.toDateString()}`;
};




  /** 🔹 Render one user row */
  const renderItem = ({ item }) => {
    const displayName = item.username || item.email || "Unknown User";

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => {
          setMenuVisible(false);
          navigation.navigate(ROUTES.CHAT, { user: item });
        }}
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
           <Text style={styles.userSubText} numberOfLines={1}>
  {formatLastSeen(item)}
</Text>

          </View>
        </View>

        <Text style={styles.timeText}>{item.isOnline ? "Now" : ""}</Text>
      </TouchableOpacity>
    );
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

      {/* White content area like the reference */}
      <View style={styles.content}>
        <View style={styles.messagesHeader}>
          <Text style={styles.messagesTitle}>Messages</Text>
          <Text style={styles.messagesSubtitle}>
            You have {baseUsers.length} chats
          </Text>
        </View>

        <FlatList
          data={displayedUsers}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={fetchUsers}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // light outer background
  container: {
    flex: 1,
    backgroundColor: "#e5e7eb",
  },

  // purple header area
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
  backgroundColor: "#111",  // black button
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
  backgroundColor: "#f3e8ff",   // soft lavender (perfect with purple)
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
  searchIcon: {
    marginLeft: 8,
    fontSize: 16,
    color: "#f9fafb",
  },

  // dropdown menu styles
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

  // white sheet with rounded top corners
  content: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  messagesHeader: {
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

  listContent: {
    paddingBottom: 16,
  },

  // each chat row
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
  backgroundColor: "#22c55e",   // green dot
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

  timeText: {
    fontSize: 11,
    color: "#9ca3af",
  },
});
