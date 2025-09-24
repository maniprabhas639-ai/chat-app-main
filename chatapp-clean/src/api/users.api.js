// src/api/users.api.js
import api from "./axiosInstance";

// ✅ Fetch all users with online + lastSeen
export const fetchUsers = async () => {
  try {
    const res = await api.get("/users");
    return res.data; // { users: [...] }
  } catch (err) {
    console.error("fetchUsers error:", err?.response?.data || err.message);
    throw err;
  }
};

// ✅ Get presence (online/lastSeen) for a specific user
export const getPresence = async (userId) => {
  try {
    const res = await api.get(`/users/${userId}/presence`);
    return res.data; // { userId, online, lastSeen }
  } catch (err) {
    console.error("getPresence error:", err?.response?.data || err.message);
    throw err;
  }
};
