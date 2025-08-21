// src/api/socket.js
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SOCKET_URL } from "../config/config";

// ⚡ Create socket instance
export const socket = io(SOCKET_URL, {
  transports: ["websocket"],   // Force WebSocket
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 5000,
  autoConnect: false,          // ⛔ don't auto connect yet
});

// 🔑 Attach token dynamically before connecting
export const connectSocket = async () => {
  try {
    const token = await AsyncStorage.getItem("token"); // 🔥 secure auth
    if (token) {
      socket.auth = { token };
    }
    if (!socket.connected) {
      socket.connect();
    }
  } catch (err) {
    console.warn("[socket] Failed to load token", err);
  }
};

// 🚪 Disconnect helper
export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// ✅ Debug logs only in dev
if (__DEV__) {
  socket.on("connect",       () => console.log("[socket] ✅ connected:", socket.id));
  socket.on("disconnect",    (r) => console.log("[socket] ❌ disconnected:", r));
  socket.on("connect_error", (e) => console.log("[socket] ⚠️ connect_error:", e?.message));
}
