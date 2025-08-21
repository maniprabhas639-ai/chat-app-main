import axios from "axios";
import { API_URL } from "../config/config"; // make sure config/config.js exists

// Example: get all users
export async function getUsers() {
  try {
    const res = await axios.get(`${API_URL}/users`);
    return res.data;
  } catch (err) {
    console.error("[api/users] getUsers error:", err.message);
    throw err;
  }
}
