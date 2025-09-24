// src/screens/LoginScreen.js
import React, { useState, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { AuthContext } from "../context/AuthContext";
import api from "../api/axiosInstance";
import { ROUTES } from "../navigation/routes";

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert("Validation", "Please enter email and password");
    }

    try {
      setLoading(true);
      const res = await api.post("/auth/login", { email, password });

      if (res.data?.user && res.data?.token) {
        await login(res.data.user, res.data.token);
      } else {
        Alert.alert("Error", "Invalid response from server");
      }
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message);
      Alert.alert("Error", error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"   // ✅ better for email
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry   // ✅ keeps password hidden
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate(ROUTES.REGISTER)}>
        <Text style={styles.link}>Don't have an account? Register</Text>
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
