// src/api/axios.js
import axios from "axios";

// ⚡️ Use your LAN IP (not localhost or 127.0.0.1)
const API = axios.create({
  baseURL: "http://192.168.43.176:5000/api",
  timeout: 10000, // 10 sec timeout
});

export default API;
