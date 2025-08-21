// src/api/users.api.js
import { API_BASE_URL } from "../config/config";
import { getToken } from "./auth.storage";

export async function getUsers() {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/users`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch users (${res.status})`);
  }
  return res.json();
}
