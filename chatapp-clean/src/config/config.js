// src/config/config.js
import Constants from "expo-constants";

/**
 * Priority for API URL:
 * 1. process.env.EXPO_PUBLIC_API_URL  (Vercel / web build / dev)
 * 2. process.env.REACT_APP_API_URL   (CRA style)
 * 3. expo config extra.apiUrl        (app.config.js / eas.json)
 * 4. fallback:
 *    - DEV:  http://localhost:10000
 *    - PROD: your Render backend
 */

const expoExtra =
  (Constants &&
    (Constants.expoConfig || Constants.manifest) &&
    (Constants.expoConfig || Constants.manifest).extra) ||
  {};

// 1–3: environment / expo config
const envApiUrl =
  (typeof process !== "undefined" &&
    (process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL)) ||
  expoExtra.apiUrl ||
  null;

// 4: fallbacks
const LOCAL_API_URL = "http://localhost:10000"; // 👈 local Node server
const REMOTE_API_URL = "https://chat-app-backend-sgu2.onrender.com"; // 👈 your Render backend

// If nothing is configured explicitly:
// - use localhost in dev
// - use Render in prod
const RAW_API = envApiUrl || (__DEV__ ? LOCAL_API_URL : REMOTE_API_URL);

export const API_URL = RAW_API;

// Normalize to always end with /api for axios
export const buildBaseURL = (raw) => {
  const defaultBase = __DEV__
    ? `${LOCAL_API_URL}/api`
    : `${REMOTE_API_URL}/api`;

  if (!raw || typeof raw !== "string") return defaultBase;

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
