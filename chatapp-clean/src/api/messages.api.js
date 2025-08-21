// src/api/messages.api.js
import { API_BASE } from "../config";
import { getToken } from "./auth.storage";

export async function getConversation(otherUserId, myUserId) {
  const token = await getToken(); // reads from AsyncStorage
  const url = `${API_BASE}/api/messages/${myUserId}/${otherUserId}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch conversation (${res.status})`);
  }
  return res.json();
}

export async function sendMessage({ sender, receiver, content }) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ sender, receiver, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to send message (${res.status})`);
  }
  return res.json();
}
