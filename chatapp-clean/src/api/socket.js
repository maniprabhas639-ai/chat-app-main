// src/api/socket.js
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SOCKET_URL } from "../config/config";

let socket = null;

export const connectSocket = async (maybeToken) => {
  if (socket && socket.connected) return socket;

  try {
    const tokenFromStorage = maybeToken ?? (await AsyncStorage.getItem("token"));
    if (!tokenFromStorage) return null;

    if (!socket) {
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        auth: { token: tokenFromStorage },
        reconnection: true,
      });

      socket.on("connect", () => {
        console.log("socket connected:", socket.id);
        // Emit authenticate (server also supports handshake auth)
        if (tokenFromStorage) {
          try { socket.emit("authenticate", tokenFromStorage); } catch (e) {}
        }
      });

      socket.on("connect_error", (err) => {
        console.warn("socket connect_error:", err?.message ?? err);
      });

      socket.on("error", (err) => {
        console.warn("socket error:", err);
      });
    } else {
      socket.auth = { token: tokenFromStorage };
      if (!socket.connected) socket.connect();
    }

    return socket;
  } catch (err) {
    console.warn("connectSocket error:", err?.message || err);
    return null;
  }
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }
};
