// src/api/socketUtils.js
import { getSocket } from "./socket";

/**
 * Safe socket helpers to avoid repeated try/catch in screens.
 * Usage: safeOn("event", handler), safeOff("event", handler), safeEmit("event", payload)
 */

export const safeOn = (event, handler) => {
  try {
    const sock = getSocket();
    if (sock && typeof sock.on === "function") {
      sock.on(event, handler);
    }
  } catch (e) {
    console.warn("safeOn failed:", event, e && e.message);
  }
};

export const safeOff = (event, handler) => {
  try {
    const sock = getSocket();
    if (sock && typeof sock.off === "function") {
      if (handler) sock.off(event, handler);
      else sock.off(event);
    }
  } catch (e) {
    // ignore
  }
};

export const safeEmit = (event, payload) => {
  try {
    const sock = getSocket();
    if (sock && sock.connected && typeof sock.emit === "function") {
      sock.emit(event, payload);
    }
  } catch (e) {
    console.warn("safeEmit failed:", event, e && e.message);
  }
};
