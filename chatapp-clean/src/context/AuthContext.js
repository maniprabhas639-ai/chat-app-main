// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api/axiosInstance";
import { connectSocket, disconnectSocket } from "../api/socket";
import { safeEmit } from "../api/socketUtils";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isProcessingLogoutRef = useRef(false);
  const socketListenersAttachedRef = useRef(false);

  const setAuthHeader = (token) => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`; // ✅ FIXED
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  };

  // 🔑 Login
  const login = async (userData, token) => {
    try {
      setUser(userData);
      setAuthHeader(token);
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      await AsyncStorage.setItem("token", token);
      await connectSocket();
    } catch (error) {
      console.error("Error saving login state:", error);
    }
  };

  // 🔑 Register
  const register = async (userData, token) => {
    try {
      setUser(userData);
      setAuthHeader(token);
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      await AsyncStorage.setItem("token", token);
      await connectSocket();
    } catch (error) {
      console.error("Error saving register state:", error);
    }
  };

  // 🔑 Logout
  const logout = async () => {
    if (isProcessingLogoutRef.current) return;
    isProcessingLogoutRef.current = true;

    try {
      setUser(null);
      setAuthHeader(null);

      safeEmit("logout");
      disconnectSocket();

      await AsyncStorage.multiRemove(["user", "token"]);
    } catch (error) {
      console.error("Error clearing auth state:", error);
    } finally {
      isProcessingLogoutRef.current = false;
    }
  };

  // 🔑 Restore auth state on app start
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("token"),
        ]);

        if (storedToken) {
          setAuthHeader(storedToken);
          try {
            await api.get("/auth/me"); // validate token
            await connectSocket();
          } catch {
            await AsyncStorage.multiRemove(["user", "token"]);
            setAuthHeader(null);
          }
        }

        if (storedUser && mounted) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            await AsyncStorage.multiRemove(["user", "token"]);
            setAuthHeader(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Error loading auth state:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
