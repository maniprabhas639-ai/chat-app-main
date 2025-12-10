// src/screens/RegisterScreen.js
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

export default function RegisterScreen({ navigation }) {
  const { register } = useContext(AuthContext);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleRegister = async () => {
    if (!username || !email || !password) {
      showAlert("Validation", "Please fill all fields");
      return;
    }

    // basic email + length validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert("Validation", "Please enter a valid email address");
      return;
    }

    if (username.length < 3) {
      showAlert("Validation", "Username must be at least 3 characters");
      return;
    }

    if (password.length < 6) {
      showAlert("Validation", "Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/auth/register", {
        username,
        email,
        password,
      });

      const { emailVerificationRequired, message } = res.data || {};

      if (emailVerificationRequired) {
        const finalMsg =
          message ||
          "Registered successfully. We've sent a verification code to your email.";

        showAlert("Success", finalMsg);

        // Navigate to VerifyEmail screen with email
        navigation.navigate(ROUTES.VERIFY_EMAIL, { email });
      } else {
        // If backend didn't set the flag, treat it as an error
        showAlert("Error", "Unexpected response from server.");
      }
    } catch (error) {
      console.error("Register error (full):", {
        data: error?.response?.data,
        status: error?.response?.status,
        message: error?.message,
      });

      let message =
        error?.response?.data?.message || error?.userFriendlyMessage;

      if (!message && error?.response?.data) {
        const data = error.response.data;
        if (typeof data === "string") {
          message = data;
        } else {
          try {
            message = JSON.stringify(data);
          } catch {
            message = "Registration failed";
          }
        }
      }

      if (!message) {
        message = "Registration failed";
      }

      showAlert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Register</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

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

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Registering..." : "Register"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate(ROUTES.LOGIN)}>
          <Text style={styles.link}>
            Already have an account?{" "}
            <Text style={styles.linkHighlight}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#020819",
    borderRadius: 18,
    padding: 24,
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
    marginBottom: 16,
    fontSize: 14,
    color: "#e5e7eb",
  },

  button: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#ec4899",
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
