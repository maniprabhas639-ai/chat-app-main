// src/api/axiosInstance.js
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL, API_URL } from "../config/config";
import { getSocket } from "./socket";

/**
 * Determine baseURL:
 */
const resolveBaseURL = () => {
  // prefer explicit API_BASE_URL (expo extra or env)
  if (typeof API_BASE_URL === "string" && API_BASE_URL.length) return API_BASE_URL;
  if (typeof API_URL === "string" && API_URL.length) {
    const t = API_URL.trim().replace(/\/+$/g, "");
    if (/\/api(\/|$)/.test(t)) return t;
    return t + "/api";
  }

  // last resort: runtime env (web builds)
  if (typeof process !== "undefined" && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/g, "");
  }

  return "http://localhost:5000/api";
};

const baseURL = resolveBaseURL();

/**
 * Axios instance
 */
const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* ---------- Token cache & helpers ---------- */
/**
 * We cache token in-memory to avoid AsyncStorage roundtrips on every request.
 * AuthContext (or your login flow) should call setAuthToken(token) after login,
 * and call clearAuthToken() on logout.
 */
let tokenCache = null;

export const setAuthToken = async (token) => {
  try {
    tokenCache = token || null;
    if (token) await AsyncStorage.setItem("token", token);
    else await AsyncStorage.removeItem("token");
  } catch (e) {
    // non-fatal
    console.warn("setAuthToken error:", e?.message || e);
  }
};

export const clearAuthToken = async () => {
  tokenCache = null;
  try {
    await AsyncStorage.removeItem("token");
  } catch (e) {
    // ignore
  }
};

/* ---------- small retry strategy for transient failures ---------- */
api.defaults.retry = 2; // number of retry attempts
api.defaults.retryDelay = (retryCount) => 300 * Math.pow(2, retryCount - 1); // exponential backoff

/* ---------- utilities ---------- */
const getErrorMessage = (err) => {
  if (!err) return "Unknown error";
  if (err.response && err.response.data) {
    const d = err.response.data;
    if (typeof d === "string") return d;
    if (d.message) return d.message;
    if (d.error) return d.error;
    try {
      return JSON.stringify(d);
    } catch {
      return String(d);
    }
  }
  if (err.code) return `${err.code} - ${err.message || String(err)}`;
  return err.message || String(err);
};

/* ---------- clear auth & socket (used on 401) ---------- */
const clearAuthAndSocket = async () => {
  try {
    // Clear in-memory + persistent token
    tokenCache = null;
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
  } catch (e) {
    // ignore
  }

  try {
    const sock = getSocket();
    if (sock) {
      try { sock.emit && sock.emit("logout"); } catch (_) {}
      try { sock.disconnect && sock.disconnect(); } catch (_) {}
    }
  } catch (e) {
    // ignore
  }
};

/* ---------- request interceptor: attach token from cache or storage ---------- */
api.interceptors.request.use(
  async (config) => {
    try {
      // Use cached token when present
      let token = tokenCache;
      if (!token) {
        // fetch once and cache
        token = await AsyncStorage.getItem("token");
        if (token) tokenCache = token;
      }
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      config.headers["X-Client"] = "mobile-app";
    } catch (e) {
      // unreadable token -> continue without auth
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ---------- response interceptor: retry + centralized 401 handling ---------- */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error?.config || {};
    // RETRY logic for network errors / 5xx
    const shouldRetry = (!error.response || (error.response && error.response.status >= 500));
    if (shouldRetry) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < (config.retry ?? api.defaults.retry)) {
        config.__retryCount += 1;
        const delay = (config.retryDelay ?? api.defaults.retryDelay)(config.__retryCount);
        await new Promise((r) => setTimeout(r, delay));
        try {
          return api(config);
        } catch (e) {
          // fall through to next handler
        }
      }
    }

    // 401 handling: clear token and socket (force re-login)
    try {
      const status = error?.response?.status;
      if (status === 401) {
        console.warn("API: 401 Unauthorized received — clearing stored auth.");
        await clearAuthAndSocket();
      }
    } catch (e) {
      // ignore
    }

    // Attach user-friendly message
    try {
      error.userFriendlyMessage = getErrorMessage(error);
    } catch (e) {}

    return Promise.reject(error);
  }
);

export default api;
