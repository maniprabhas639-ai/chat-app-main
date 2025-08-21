import { API_BASE_URL } from "../config/config";

export async function pingServer() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json();
    return !!data?.ok;
  } catch (e) {
    return false;
  }
}
