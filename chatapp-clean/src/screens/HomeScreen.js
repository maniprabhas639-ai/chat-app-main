// screens/HomeScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export default function HomeScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // 🔹 Fetch current user & all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = await AsyncStorage.getItem("token");

        // ✅ Get current logged-in user
        const meRes = await axios.get("http://10.0.2.2:5000/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCurrentUser(meRes.data);

        // ✅ Get all users (except self)
        const res = await axios.get("http://10.0.2.2:5000/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const filtered = res.data.filter((u) => u._id !== meRes.data._id);
        setUsers(filtered);
      } catch (err) {
        console.error("❌ Failed to load users:", err.message);
      }
    };

    fetchUsers();
  }, []);

  const handleChat = (user) => {
    // ✅ Navigate to ChatScreen with params
    navigation.navigate("Chat", {
      userId: user._id,
      username: user.username,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>
        Welcome, {currentUser?.username} 👋
      </Text>

      <Text style={styles.subtitle}>Available Users:</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => handleChat(item)}
          >
            <Text style={styles.username}>{item.username}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f9f9f9" },
  welcome: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  subtitle: { fontSize: 16, marginBottom: 15 },
  userCard: {
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
  },
  username: { fontSize: 16 },
});
