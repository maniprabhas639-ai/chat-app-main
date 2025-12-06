// src/screens/LoginScreen.js
import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { AuthContext } from "../context/AuthContext";
import api from "../api/axiosInstance";
import { ROUTES } from "../navigation/routes";

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

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

      // Prefer server message (e.g. "Invalid credentials"), with safe fallbacks
      const message =
        error?.response?.data?.message ||
        error?.userFriendlyMessage ||
        "Invalid email or password";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Login failed", message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      return Alert.alert(
        "Forgot password",
        "Please enter your email above first."
      );
    }

    try {
      setForgotLoading(true);

      const res = await api.post("/auth/forgot-password", { email });
      const msg =
        res.data?.message ||
        "If an account exists for this email, you will receive password reset instructions shortly.";

      Alert.alert("Forgot password", msg);
    } catch (error) {
      console.error(
        "Forgot password error:",
        error.response?.data || error.message
      );

      const message =
        error?.response?.data?.message ||
        error?.userFriendlyMessage ||
        "Could not start password reset. Please try again.";

      Alert.alert("Forgot password", message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* Forgot password link (uses email field above) */}
        <TouchableOpacity
          style={styles.forgotButton}
          onPress={handleForgotPassword}
          disabled={forgotLoading || loading}
        >
          <Text style={styles.forgotText}>
            {forgotLoading ? "Sending reset email..." : "Forgot password?"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Logging in..." : "Sign in"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate(ROUTES.REGISTER)}>
          <Text style={styles.link}>
            No account? <Text style={styles.linkHighlight}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // full-screen dark background, center card
  container: {
    flex: 1,
    backgroundColor: "#020617", // very dark blue/black
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  // card similar to the image
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#020819", // slightly lighter than bg
    borderRadius: 18,
    padding: 24,
    // subtle border + shadow
    borderWidth: 1,
    borderColor: "#111827",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 24,
  },

  input: {
    backgroundColor: "#020617",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 14,
    color: "#e5e7eb",
  },

  // "Forgot password?" text aligned right
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 16,
  },

  forgotText: {
    fontSize: 13,
    color: "#93c5fd", // subtle blue to look like link
    textDecorationLine: "underline",
  },

  // fake gradient look with strong pink → purple tone
  button: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    // approximation of gradient using solid color (safe for RN)
    backgroundColor: "#ec4899", // pink-ish
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f9fafb",
  },

  link: {
    marginTop: 18,
    fontSize: 13,
    color: "#e5e7eb",
    textAlign: "left",
  },

  linkHighlight: {
    textDecorationLine: "underline",
  },
});
