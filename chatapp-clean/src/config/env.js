// src/config/env.js
import Constants from "expo-constants";

const expoExtra = (Constants && (Constants.expoConfig || Constants.manifest) && (Constants.expoConfig || Constants.manifest).extra) || {};

export const API_URL =
  (typeof process !== "undefined" && (process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL)) ||
  expoExtra.apiUrl ||
  'https://chat-app-backend-sgu2.onrender.com';
