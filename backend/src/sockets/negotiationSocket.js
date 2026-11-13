const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Negotiation = require('../models/Negotiation');
const { getJwtSecret } = require('../config/jwtSecret');

// Bounded server-side typing indicator auto-expiry window (5 seconds)
const TYPING_AUTO_EXPIRE_MS = 5000;

// Socket connections only subscribe to authorized updates. REST owns all writes.
const initNegotiationSocket = (io) => {
  const namespace = io.of('/negotiation');

  namespace.use(async (socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token, getJwtSecret());
      if (decoded.scope === 'verification_pending') {
        return next(new Error('Unauthorized: Verification required'));
      }
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('Unauthorized'));
      if (user.isVerified === false) {
        return next(new Error('Unauthorized: Account verification required'));
      }
      socket.data.user = { id: String(user._id), role: user.role };
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  namespace.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user_${id}`);

    // Track active typing sessions and bounded timers per socket
    const activeTypingRooms = new Set();
    const typingTimers = new Map();

    const clearRoomTyping = (negotiationId, emitStop = true) => {
      if (typingTimers.has(negotiationId)) {
        clearTimeout(typingTimers.get(negotiationId));
        typingTimers.delete(negotiationId);
      }
      if (activeTypingRooms.has(negotiationId)) {
        activeTypingRooms.delete(negotiationId);
        if (emitStop) {
          const room = `room_${negotiationId}`;
          socket.to(room).emit('participant_typing', {
            negotiationId,
            userId: id,
            userRole: role,
            isTyping: false
          });
        }
      }
    };

    socket.on('join_room', async (payload = {}) => {
      try {
        if (!payload || typeof payload.negotiationId !== 'string') {
          return socket.emit('error', { message: 'Invalid negotiation' });
        }
        // Strict authorization: verify caller is participant before joining
        const negotiation = await Negotiation.findById(payload.negotiationId).select('buyer farmer');
        if (!negotiation || (String(negotiation.buyer) !== id && String(negotiation.farmer) !== id)) {
          return socket.emit('error', { message: 'Not authorized to join this negotiation' });
        }
        const room = `room_${negotiation._id}`;
        await socket.join(room);
        socket.emit('room_joined', { success: true, room, negotiationId: String(negotiation._id) });
        socket.to(room).emit('participant_status', { userId: id, userRole: role, status: 'ONLINE', timestamp: new Date() });
      } catch (error) {
        socket.emit('error', { message: 'Could not join negotiation' });
      }
    });

    socket.on('leave_room', (payload = {}) => {
      if (payload && typeof payload.negotiationId === 'string') {
        const negId = payload.negotiationId;
        clearRoomTyping(negId, true);
        socket.leave(`room_${negId}`);
      }
    });

    socket.on('typing_start', (payload = {}) => {
      if (!payload || typeof payload.negotiationId !== 'string') return;
      const room = `room_${payload.negotiationId}`;
      // Never broadcast typing to rooms the authenticated socket has not joined
      if (!socket.rooms.has(room)) return;

      activeTypingRooms.add(payload.negotiationId);

      // Reset / start bounded server-side auto-expiry timer
      if (typingTimers.has(payload.negotiationId)) {
        clearTimeout(typingTimers.get(payload.negotiationId));
      }
      const timer = setTimeout(() => {
        clearRoomTyping(payload.negotiationId, true);
      }, TYPING_AUTO_EXPIRE_MS);
      typingTimers.set(payload.negotiationId, timer);

      socket.to(room).emit('participant_typing', {
        negotiationId: payload.negotiationId,
        userId: id,
        userRole: role,
        isTyping: true
      });
    });

    socket.on('typing_stop', (payload = {}) => {
      if (!payload || typeof payload.negotiationId !== 'string') return;
      const room = `room_${payload.negotiationId}`;
      if (!socket.rooms.has(room)) return;

      clearRoomTyping(payload.negotiationId, true);
    });

    socket.on('disconnect', () => {
      // Clean up all active typing indicators upon disconnect
      for (const negotiationId of Array.from(activeTypingRooms)) {
        clearRoomTyping(negotiationId, true);
      }
      for (const timer of typingTimers.values()) {
        clearTimeout(timer);
      }
      typingTimers.clear();
      activeTypingRooms.clear();
    });
  });
};

module.exports = initNegotiationSocket;
