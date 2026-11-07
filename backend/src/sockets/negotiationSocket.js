const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Negotiation = require('../models/Negotiation');

// Socket connections only subscribe to authorized updates. REST owns all writes.
const initNegotiationSocket = (io) => {
  const namespace = io.of('/negotiation');

  namespace.use(async (socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET || 'cropguard_dev_secret_key_adypu_2026');
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('Unauthorized'));
      socket.data.user = { id: String(user._id), role: user.role };
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  namespace.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user_${id}`);

    socket.on('join_room', async (payload = {}) => {
      try {
        if (!payload || typeof payload.negotiationId !== 'string') return socket.emit('error', { message: 'Invalid negotiation' });
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
      if (payload && typeof payload.negotiationId === 'string') socket.leave(`room_${payload.negotiationId}`);
    });
  });
};

module.exports = initNegotiationSocket;
