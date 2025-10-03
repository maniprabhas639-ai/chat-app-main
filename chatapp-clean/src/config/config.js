// src/config/config.js
import Constants from "expo-constants";

/**
 * Priority for API URL:
 * 1. process.env.EXPO_PUBLIC_API_URL (set in Vercel)
 * 2. process.env.REACT_APP_API_URL (if present)
 * 3. expo config extra.apiUrl (useful for EAS / app.config.js)
 * 4. local fallback (your dev IP)
 */
const expoExtra = (Constants && (Constants.expoConfig || Constants.manifest) && (Constants.expoConfig || Constants.manifest).extra) || {};

const RAW_API =
  (typeof process !== "undefined" && (process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL)) ||
  expoExtra.apiUrl ||
  "http://192.168.43.176:5000";

export const API_URL = "https://chat-app-backend-sgu2.onrender.com"; ; // e.g. https://chat-app-backend-sgu2.onrender.com or local IP

// Normalize to always return something like ".../api"
export const buildBaseURL = (raw) => {
  const fallback = "https://chat-app-backend-sgu2.onrender.com/api";
  if (!raw || typeof raw !== "string") return fallback;

  const trimmed = raw.trim().replace(/\/+$/, "");

  if (trimmed.endsWith("/api") || trimmed.includes("/api/")) {
    return trimmed;
  }
  return trimmed + "/api";
};

// For axios base
export const API_BASE_URL = buildBaseURL(API_URL);

// For socket.io (strip /api if present)
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");
