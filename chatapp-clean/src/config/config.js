// src/config/config.js

// 🌍 Base API URL for your backend
// For Android emulator use: http://10.0.2.2:5000
// For physical device on same WiFi: http://<your-local-ip>:5000
export const API_URL = "http://192.168.43.176:5000"; // 👈 replace with your local IP

// 🔧 Normalize to always return something like ".../api"
export const buildBaseURL = (raw) => {
  const fallback = "http://localhost:5000/api";
  if (!raw || typeof raw !== "string") return fallback;

  const trimmed = raw.trim().replace(/\/+$/, "");

  if (trimmed.endsWith("/api") || trimmed.includes("/api/")) {
    return trimmed;
  }
  return trimmed + "/api";
};

// ✅ For axios
export const API_BASE_URL = buildBaseURL(API_URL);

// ✅ For socket.io (strip /api if present)
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");
