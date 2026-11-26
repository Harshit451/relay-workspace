import { io } from "socket.io-client";
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function createSocket(token, workspaceId) {
  return io(API_BASE_URL || window.location.origin, {
    auth: { token, workspaceId },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10000,
  });
}
