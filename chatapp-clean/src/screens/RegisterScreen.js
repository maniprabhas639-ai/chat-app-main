// src/screens/RegisterScreen.js
import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,      // 👈 added
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

  const handleRegister = async () => {
    if (!username || !email || !password) {
      const msg = "Please fill all fields";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Validation", msg);
      }
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/auth/register", {
        username,
        email,
        password,
      });

      if (res.data?.user && res.data?.token) {
        await register(res.data.user, res.data.token);
      } else {
        const msg = "Invalid response from server";
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert("Error", msg);
        }
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

      // 👇 same behavior as LoginScreen: window.alert on web
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
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
