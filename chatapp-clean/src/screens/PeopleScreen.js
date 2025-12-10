// src/screens/PeopleScreen.js
import React, { useEffect, useState, useContext, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import api from "../api/axiosInstance";
import { ROUTES } from "../navigation/routes";
import { AuthContext } from "../context/AuthContext";

export default function PeopleScreen({ navigation }) {
  const { user } = useContext(AuthContext) || {};
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // keep requests on top: pending_received -> pending_sent -> accepted -> none
  const sortPeople = (items) => {
    const order = (status) => {
      switch (status) {
        case "pending_received":
          return 0;
        case "pending_sent":
          return 1;
        case "accepted":
          return 2;
        default:
          return 3;
      }
    };

    const arr = [...items];
    arr.sort((a, b) => {
      const sa = order(a.relationshipStatus || "none");
      const sb = order(b.relationshipStatus || "none");
      if (sa !== sb) return sa - sb;

      const nameA = (a.username || a.email || "").toLowerCase();
      const nameB = (b.username || b.email || "").toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
    return arr;
  };

  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      const raw = res.data || [];
      setPeople(sortPeople(raw));
    } catch (err) {
      console.warn(
        "PeopleScreen load error:",
        err.response?.data || err.message
      );
      showAlert(
        "Error",
        err?.response?.data?.message || "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleSendRequest = async (other) => {
    try {
      setActionLoadingId(other._id);
      const res = await api.post("/users/follow/request", {
        userId: other._id,
      });

      const { message } = res.data || {};
      if (message) showAlert("Info", message);

      await fetchPeople();
    } catch (err) {
      console.warn(
        "Send follow request error:",
        err.response?.data || err.message
      );
      showAlert(
        "Error",
        err?.response?.data?.message || "Could not send request."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRespond = async (other, requestId, action) => {
    try {
      setActionLoadingId(other._id);
      const res = await api.post("/users/follow/respond", {
        requestId,
        action,
      });

      const { message } = res.data || {};
      if (message) showAlert("Info", message);

      await fetchPeople();
    } catch (err) {
      console.warn(
        "Respond follow request error:",
        err.response?.data || err.message
      );
      showAlert(
        "Error",
        err?.response?.data?.message || "Could not update request."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // 🔹 NEW: cancel own outgoing request
  const handleCancelRequest = async (other) => {
    try {
      setActionLoadingId(other._id);
      const res = await api.post("/users/follow/cancel", {
        userId: other._id,
      });

      const { message } = res.data || {};
      if (message) showAlert("Info", message);

      await fetchPeople();
    } catch (err) {
      console.warn(
        "Cancel follow request error:",
        err.response?.data || err.message
      );
      showAlert(
        "Error",
        err?.response?.data?.message || "Could not cancel request."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnfollow = async (other) => {
    try {
      setActionLoadingId(other._id);
      const res = await api.post("/users/unfollow", {
        userId: other._id,
      });
      const { message } = res.data || {};
      if (message) showAlert("Info", message);
      await fetchPeople();
    } catch (err) {
      console.warn("Unfollow error:", err.response?.data || err.message);
      showAlert(
        "Error",
        err?.response?.data?.message || "Could not unfollow user."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const openChat = (other) => {
    navigation.navigate(ROUTES.CHAT, { user: other });
  };

  const renderAction = (item) => {
    const status = item.relationshipStatus || "none";
    const isBusy = actionLoadingId === item._id;

    if (status === "accepted") {
      return (
        <View style={styles.actionsRow}>
          <View style={styles.statusPillAccepted}>
            <Text style={styles.statusPillText}>Contact</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButtonSmall}
            onPress={() => openChat(item)}
          >
            <Text style={styles.primaryButtonSmallText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButtonSmall}
            onPress={() => handleUnfollow(item)}
            disabled={isBusy}
          >
            <Text style={styles.secondaryButtonSmallText}>
              {isBusy ? "..." : "Unfollow"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "pending_sent") {
      // 🔹 UPDATED: show "Request sent" + Cancel button
      return (
        <View style={styles.actionsRow}>
          <View style={styles.statusPillMuted}>
            <Text style={styles.statusPillMutedText}>
              {isBusy ? "Updating..." : "Request sent"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButtonSmall}
            onPress={() => handleCancelRequest(item)}
            disabled={isBusy}
          >
            <Text style={styles.secondaryButtonSmallText}>
              {isBusy ? "..." : "Cancel"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "pending_received") {
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.primaryButtonSmall}
            onPress={() => handleRespond(item, item.requestId, "accept")}
            disabled={isBusy}
          >
            <Text style={styles.primaryButtonSmallText}>
              {isBusy ? "..." : "Accept"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButtonSmall}
            onPress={() => handleRespond(item, item.requestId, "reject")}
            disabled={isBusy}
          >
            <Text style={styles.secondaryButtonSmallText}>Reject</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // status === "none"
    return (
      <TouchableOpacity
        style={styles.primaryButtonSmall}
        onPress={() => handleSendRequest(item)}
        disabled={isBusy}
      >
        <Text style={styles.primaryButtonSmallText}>
          {isBusy ? "..." : "Send request"}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    const displayName = item.username || item.email || "Unknown User";
    const isMe = user && item._id === user._id;
    const status = item.relationshipStatus || "none";
    const isIncoming = status === "pending_received";

    return (
      <LinearGradient
        colors={["#22d3ee", "#14b8a6"]} // 🌤 sky teal gradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.rowGradient, isIncoming && styles.rowHighlight]}
      >
        <View style={styles.rowInner}>
          <View style={styles.leftInfo}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.nameText}>
                {displayName} {isMe ? "(You)" : ""}
              </Text>
              {item.email ? (
                <Text style={styles.subText}>{item.email}</Text>
              ) : null}
              {status === "pending_sent" && (
                <Text style={styles.helperText}>Waiting for approval</Text>
              )}
              {status === "pending_received" && (
                <Text style={styles.helperText}>
                  This user wants to chat with you
                </Text>
              )}
            </View>
          </View>

          <View style={styles.rightInfo}>{!isMe && renderAction(item)}</View>
        </View>
      </LinearGradient>
    );
  };

  const pendingReceivedCount = people.filter(
    (p) => p.relationshipStatus === "pending_received"
  ).length;
  const contactCount = people.filter(
    (p) => p.relationshipStatus === "accepted"
  ).length;

  const subtitleText =
    pendingReceivedCount > 0
      ? `You have ${pendingReceivedCount} chat request${
          pendingReceivedCount > 1 ? "s" : ""
        } to review.`
      : "Send chat requests to start conversations.";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find people</Text>
        <Text style={styles.subtitle}>{subtitleText}</Text>

        <View style={styles.headerChipsRow}>
          <View style={styles.headerChip}>
            <View style={styles.headerDotPending} />
            <Text style={styles.headerChipText}>
              Requests: {pendingReceivedCount}
            </Text>
          </View>
          <View style={styles.headerChip}>
            <View style={styles.headerDotContacts} />
            <Text style={styles.headerChipText}>
              Contacts: {contactCount}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#9ca3af",
  },

  headerChipsRow: {
    flexDirection: "row",
    marginTop: 14,
    columnGap: 10,
  },
  headerChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#020819",
    borderWidth: 1,
    borderColor: "#111827",
  },
  headerDotPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f97316",
    marginRight: 6,
  },
  headerDotContacts: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  headerChipText: {
    fontSize: 11,
    color: "#e5e7eb",
    fontWeight: "500",
  },

  loadingWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  rowGradient: {
    borderRadius: 18,
    marginBottom: 12,
    padding: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  rowHighlight: {
    borderWidth: 2,
    borderColor: "#facc15",
  },

  leftInfo: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  rightInfo: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },

  nameText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#ffffff",
  },
  subText: {
    fontSize: 14,
    color: "#CCF4FF",
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: "#FFD966",
    marginTop: 2,
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  primaryButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#3b82f6",
    marginLeft: 8,
  },
  primaryButtonSmallText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f9fafb",
  },
  secondaryButtonSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#020617",
    marginLeft: 8,
  },
  secondaryButtonSmallText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#e5e7eb",
  },

  statusPillAccepted: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#16a34a",
    marginLeft: 8,
  },
  statusPillMuted: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#020617",
    marginLeft: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#f9fafb",
  },
  statusPillMutedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#e5e7eb",
  },
});
