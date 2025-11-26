// src/api/config.js
import Constants from "expo-constants";

/**
 * Resolution order (first found wins):
 * 1. process.env.REACT_APP_API_URL (used by web/build systems like Vercel)
 * 2. Constants.expoConfig?.extra?.API_URL or Constants.manifest?.extra?.API_URL (Expo)
 * 3. fallback to a safe same-origin relative path (useful for web if backend proxied)
 * 4. final hardcoded placeholder - replace with your Render backend URL before deploy
 */

const fromEnv = typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL;
const fromExpoExtra =
  (Constants && (Constants.expoConfig?.extra?.API_URL || Constants.manifest?.extra?.API_URL)) || null;

const fallback = "https://<YOUR_RENDER_BACKEND_DOMAIN>/api"; // ← REPLACE with your Render service URL

export const API_URL = (fromEnv || fromExpoExtra || fallback).replace(/\/+$/, "");
export const API_BASE_URL = API_URL; // axiosInstance logic expects either API_BASE_URL or API_URL
