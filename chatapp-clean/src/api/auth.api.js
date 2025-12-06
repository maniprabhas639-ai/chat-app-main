// src/api/auth.api.js
import api from "./axiosInstance";

// Use "username" to match backend (registerUser)
export const register = async (username, email, password) => {
  const res = await api.post("/auth/register", { username, email, password });
  return res.data;
};

export const login = async (email, password) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
};
