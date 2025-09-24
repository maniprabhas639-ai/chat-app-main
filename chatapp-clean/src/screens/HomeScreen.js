// src/screens/HomeScreen.js
import React, { useEffect, useState, useContext, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";
import api from "../api/axiosInstance";
import { ROUTES } from "../navigation/routes";
import { getSocket } from "../api/socket";

export default function HomeScreen({ navigation }) {
  const { user, loading, logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  /** 🔹 Fetch users from API */
  const fetchUsers = useCallback(async () => {
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
  }, [user, logout]);

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

    const handleUserStatus = ({ userId, online }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId ? { ...u, isOnline: online } : u
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

  /** 🔹 Render one user row */
  const renderItem = ({ item }) => {
    const displayName = item.username || item.email || "Unknown User";
    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => navigation.navigate(ROUTES.CHAT, { user: item })}
      >
        <Text>{displayName}</Text>
        <Text style={{ color: item.isOnline ? "green" : "red" }}>
          {item.isOnline ? "Online" : "Offline"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>
        Welcome {user?.username || user?.email || "You"}
      </Text>

      <FlatList
        data={users.filter((u) => u._id !== user?._id)} // exclude self
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={fetchUsers}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  welcome: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  userRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
