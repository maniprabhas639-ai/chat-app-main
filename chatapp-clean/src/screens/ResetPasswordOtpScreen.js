// src/screens/ResetPasswordOtpScreen.js
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

export default function ResetPasswordOtpScreen({ route, navigation }) {
  const email = route?.params?.email || "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [backHovered, setBackHovered] = useState(false);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleVerify = async () => {
    if (!email) {
      showAlert("Error", "Missing email. Please start again.");
      navigation.navigate(ROUTES.FORGOT_PASSWORD);
      return;
    }

    if (!code) {
      showAlert("Validation", "Please enter the reset code.");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/auth/verify-reset-otp", {
        email,
        code,
      });

      const msg =
        res?.data?.message || "Code verified. You can now set a new password.";

      const resetToken = res?.data?.resetToken;
      if (!resetToken) {
        showAlert("Error", "Missing reset token from server.");
        return;
      }

      showAlert("Success", msg);

      navigation.navigate(ROUTES.RESET_PASSWORD_NEW, {
        email,
        resetToken,
      });
    } catch (error) {
      console.error("Verify reset OTP error:", {
        data: error?.response?.data,
        status: error?.response?.status,
        message: error?.message,
      });

      let message =
        error?.response?.data?.message || error?.userFriendlyMessage;

      if (!message) message = "Verification failed";

      showAlert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const goBackToEmailStep = () => {
    navigation.navigate(ROUTES.FORGOT_PASSWORD);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Step indicator */}
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>Step 2 of 3</Text>
        </View>

        <Text style={styles.title}>Enter reset code</Text>

        {/* Spacer instead of email line */}
        <View style={{ marginBottom: 12 }} />

        {/* Code input with focus glow */}
        <View
          style={[
            styles.inputWrapper,
            codeFocused && styles.inputWrapperFocused,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="Reset code"
            placeholderTextColor="#6b7280"
            keyboardType="number-pad"
            autoCapitalize="none"
            value={code}
            onChangeText={setCode}
            maxLength={6}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
          />
        </View>

        <Text style={styles.hintText}>
          • Codes expire after a few minutes. If you requested several, use the
          latest one.
        </Text>

        {/* Main button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Verifying..." : "Verify code"}
          </Text>
        </TouchableOpacity>

        {/* Arrow centered below button */}
        <View style={styles.arrowContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goBackToEmailStep}
            style={[
              styles.backCircle,
              backHovered && styles.backCircleHovered,
            ]}
            onMouseEnter={() => setBackHovered(true)}
            onMouseLeave={() => setBackHovered(false)}
          >
            <Text style={styles.backArrowIcon}>←</Text>
          </TouchableOpacity>
        </View>
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

  stepPill: {
    alignSelf: "flex-start",
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#0b1120",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  stepPillText: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: "#9ca3af",
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 10,
  },

  inputWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#020617",
    marginBottom: 10,
  },
  inputWrapperFocused: {
    borderColor: "#22c55e",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    backgroundColor: "#020617",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#e5e7eb",
    letterSpacing: 2,
    textAlign: "center",
  },

  hintText: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 14,
  },

  button: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#22c55e",
  },
  buttonDisabled: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f9fafb",
  },

  arrowContainer: {
    marginTop: 18,
    alignItems: "center",
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  backCircleHovered: {
    opacity: 0.9,
    transform: [{ scale: 1.05 }],
  },
  backArrowIcon: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f97316",
  },
});
