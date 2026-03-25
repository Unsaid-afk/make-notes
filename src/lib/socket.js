/**
 * Socket.io client wrapper — disguised payloads
 * All communications use 'autosave_event' / 'document_update' event names
 */
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(serverUrl) {
  if (socket?.connected) return socket;

  socket = io(serverUrl || 'https://make-notes-33qd.onrender.com', {
    transports: ['polling', 'websocket'], // Start with HTTP polling, then upgrade
    rememberUpgrade: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 30000,
    // Add path if server uses one, but usually default /socket.io/ is fine
  });

  return socket;
}

/**
 * Send a disguised payload to the server
 * Wraps data in Base64 JSON named 'autosave_event'
 */
export function sendPayload(data) {
  if (!socket?.connected) return;

  const encoded = btoa(JSON.stringify(data));
  socket.emit('autosave_event', { content: encoded });
}

/**
 * Listen for disguised payloads from the server
 * Decodes from 'document_update' events
 */
export function onPayload(callback) {
  if (!socket) return;

  socket.on('document_update', (payload) => {
    try {
      const decoded = JSON.parse(atob(payload.content));
      callback(decoded);
    } catch (e) {
      // Silent fail
    }
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
