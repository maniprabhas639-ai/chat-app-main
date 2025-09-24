// src/screens/RegisterScreen.js
import React, { useState, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { AuthContext } from "../context/AuthContext";
import api from "../api/axiosInstance";
import { ROUTES } from "../navigation/routes";

export default function RegisterScreen({ navigation }) {
  const { register } = useContext(AuthContext);

  const [username, setUsername] = useState(""); // ✅ changed from "name"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      return Alert.alert("Validation", "Please fill all fields");
    }

    try {
      setLoading(true);
      // ✅ send "username" instead of "name"
      const res = await api.post("/auth/register", { username, email, password });

      if (res.data?.user && res.data?.token) {
        await register(res.data.user, res.data.token);
      } else {
        Alert.alert("Error", "Invalid response from server");
      }
    } catch (error) {
      console.error("Register error:", error.response?.data || error.message);
      Alert.alert("Error", error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextInput
        style={styles.input}
        placeholder="Username" // ✅ updated label
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Registering..." : "Register"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate(ROUTES.LOGIN)}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 15, borderRadius: 8 },
  button: { backgroundColor: "#007AFF", padding: 15, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold" },
  link: { marginTop: 15, color: "#007AFF", textAlign: "center" },
});
