// src/config/config.js
import Constants from "expo-constants";

/**
 * Priority for API URL:
 * 1. process.env.EXPO_PUBLIC_API_URL  (Vercel / web build / dev)
 * 2. process.env.REACT_APP_API_URL   (CRA style)
 * 3. expo config extra.apiUrl        (app.config.js / eas.json)
 * 4. fallback: your Render backend
 */
const expoExtra =
  (Constants &&
    (Constants.expoConfig || Constants.manifest) &&
    (Constants.expoConfig || Constants.manifest).extra) ||
  {};

const RAW_API =
  (typeof process !== "undefined" &&
    (process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL)) ||
  expoExtra.apiUrl ||
  "https://chat-app-backend-sgu2.onrender.com"; // 👈 fallback = Render backend

export const API_URL = RAW_API;

// Normalize to always end with /api for axios
export const buildBaseURL = (raw) => {
  const fallback = "https://chat-app-backend-sgu2.onrender.com/api";
  if (!raw || typeof raw !== "string") return fallback;

  const trimmed = raw.trim().replace(/\/+$/, "");

  if (trimmed.endsWith("/api") || trimmed.includes("/api/")) {
    return trimmed;
  }
  return trimmed + "/api";
};

// For axios instance
export const API_BASE_URL = buildBaseURL(API_URL);

// For socket.io (strip /api if present)
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");
