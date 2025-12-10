// src/screens/VerifyEmailScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import api from "../api/axiosInstance";
import { ROUTES } from "../navigation/routes";

export default function VerifyEmailScreen({ route, navigation }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // email passed from RegisterScreen
  const email = route?.params?.email || "";

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleVerify = async () => {
    if (!email) {
      showAlert("Error", "Missing email. Please register again.");
      navigation.navigate(ROUTES.REGISTER);
      return;
    }

    if (!code || code.length < 4) {
      showAlert("Validation", "Please enter the verification code.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/verify-email", {
        email,
        code,
      });

      const msg =
        res?.data?.message || "Email verified successfully. You can now login.";

      showAlert("Success", msg);

      // After verify, go to login
      navigation.navigate(ROUTES.LOGIN);
    } catch (error) {
      console.error("Verify email error:", {
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
            message = "Verification failed";
          }
        }
      }

      if (!message) {
        message = "Verification failed";
      }

      showAlert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      showAlert("Error", "Missing email. Please register again.");
      navigation.navigate(ROUTES.REGISTER);
      return;
    }

    try {
      setResendLoading(true);

      const res = await api.post("/auth/resend-verification", {
        email,
      });

      const msg =
        res?.data?.message || "A new verification code has been sent.";

      showAlert("Success", msg);
    } catch (error) {
      console.error("Resend verification error:", {
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
            message = "Resend failed";
          }
        }
      }

      if (!message) {
        message = "Resend failed";
      }

      showAlert("Error", message);
    } finally {
      setResendLoading(false);
    }
  };

  const handleChangeEmail = () => {
    navigation.navigate(ROUTES.REGISTER);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify your email</Text>

        <Text style={styles.subtitle}>We have sent a verification code to:</Text>
        <Text style={styles.emailText}>{email || "your email"}</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter verification code"
          placeholderTextColor="#6b7280"
          keyboardType="number-pad"
          autoCapitalize="none"
          value={code}
          onChangeText={setCode}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Verifying..." : "Verify"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleResend}
          disabled={resendLoading}
        >
          <Text style={styles.secondaryButtonText}>
            {resendLoading ? "Resending..." : "Resend code"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleChangeEmail}>
          <Text style={styles.link}>
            Wrong email?{" "}
            <Text style={styles.linkHighlight}>Go back to register</Text>
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
    fontSize: 24,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
  },

  emailText: {
    fontSize: 14,
    color: "#e5e7eb",
    marginBottom: 20,
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
    backgroundColor: "#22c55e",
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f9fafb",
  },

  secondaryButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#6b7280",
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#e5e7eb",
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
