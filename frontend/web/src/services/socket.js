import { io } from 'socket.io-client';

let activeSocket = null;
let currentToken = null;

export function connectNegotiationSocket(token) {
  if (!token) return null;
  if (activeSocket && currentToken === token) {
    return activeSocket;
  }

  if (activeSocket) {
    activeSocket.disconnect();
    activeSocket = null;
  }

  currentToken = token;
  const origin = import.meta.env.VITE_API_ORIGIN || '';
  activeSocket = io(`${origin}/negotiation`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
  });

  activeSocket.on('connect_error', (err) => {
    console.warn('[Socket /negotiation]:', err.message);
  });

  return activeSocket;
}

export function disconnectNegotiationSocket() {
  if (activeSocket) {
    activeSocket.disconnect();
    activeSocket = null;
    currentToken = null;
  }
}
