import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

/**
 * SocketService — Singleton manager for real-time negotiation socket connections
 * Connects to the backend `/negotiation` namespace with room-based multi-turn bargaining
 */
class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.activeRooms = new Set();
  }

  /**
   * Initialize or retrieve socket connection to `/negotiation`
   */
  connect(token = null) {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const namespaceUrl = `${SOCKET_URL}/negotiation`;
    console.log(`[SocketService] Connecting to ${namespaceUrl}...`);

    this.socket = io(namespaceUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: token ? { token } : {}
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log(`[SocketService] Connected successfully (id: ${this.socket.id})`);
      // Re-join any previously active rooms after reconnection
      this.activeRooms.forEach((negotiationId) => {
        this.socket.emit('join_room', { negotiationId });
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log(`[SocketService] Disconnected: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      this.connected = false;
      console.warn(`[SocketService] Connection error:`, error.message);
    });

    return this.socket;
  }

  /**
   * Join dedicated negotiation room
   */
  joinRoom(negotiationId) {
    if (!this.socket) return;
    this.activeRooms.add(negotiationId);
    this.socket.emit('join_room', { negotiationId });
  }

  /**
   * Leave dedicated negotiation room
   */
  leaveRoom(negotiationId) {
    if (!this.socket) return;
    this.activeRooms.delete(negotiationId);
    this.socket.emit('leave_room', { negotiationId });
    console.log(`[SocketService] Emitted leave_room for negotiation: ${negotiationId}`);
  }

  /**
   * Event Listeners
   */
  onNegotiationCreated(callback) {
    if (!this.socket) return () => {};
    this.socket.on('negotiation_created', callback);
    return () => this.socket?.off('negotiation_created', callback);
  }

  onCounterOfferReceived(callback) {
    if (!this.socket) return () => {};
    this.socket.on('counter_offer_received', callback);
    return () => this.socket?.off('counter_offer_received', callback);
  }

  onChatMessageReceived(callback) {
    if (!this.socket) return () => {};
    this.socket.on('chat_message_received', callback);
    return () => this.socket?.off('chat_message_received', callback);
  }

  onChatMessageDeleted(callback) {
    if (!this.socket) return () => {};
    this.socket.on('chat_message_deleted', callback);
    return () => this.socket?.off('chat_message_deleted', callback);
  }

  onNegotiationDeleted(callback) {
    if (!this.socket) return () => {};
    this.socket.on('negotiation_deleted', callback);
    return () => this.socket?.off('negotiation_deleted', callback);
  }

  onDealLocked(callback) {
    if (!this.socket) return () => {};
    this.socket.on('deal_locked', callback);
    return () => this.socket?.off('deal_locked', callback);
  }

  onDealRejected(callback) {
    if (!this.socket) return () => {};
    this.socket.on('deal_rejected', callback);
    return () => this.socket?.off('deal_rejected', callback);
  }

  onParticipantStatus(callback) {
    if (!this.socket) return () => {};
    this.socket.on('participant_status', callback);
    return () => this.socket?.off('participant_status', callback);
  }

  onRoomJoined(callback) {
    if (!this.socket) return () => {};
    this.socket.on('room_joined', callback);
    return () => this.socket?.off('room_joined', callback);
  }

  onError(callback) {
    if (!this.socket) return () => {};
    this.socket.on('error', callback);
    return () => this.socket?.off('error', callback);
  }

  /**
   * Disconnect and clear state
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.activeRooms.clear();
      console.log('[SocketService] Socket disconnected and cleaned up');
    }
  }

  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
export default socketService;
