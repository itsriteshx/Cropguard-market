const Negotiation = require('../models/Negotiation');

/**
 * Socket.io Real-Time Negotiation & Live Bidding Gateway
 * Handles live room communication between Farmers and Buyers
 */
const initNegotiationSocket = (io) => {
  const negotiationNamespace = io.of('/negotiation');

  negotiationNamespace.on('connection', (socket) => {
    console.log(`[Socket Connected] Negotiation client: ${socket.id}`);

    // Join dedicated negotiation room
    socket.on('join_room', async ({ negotiationId, userId, userRole }) => {
      try {
        if (!negotiationId) {
          return socket.emit('error', { message: 'negotiationId is required' });
        }

        const roomName = `room_${negotiationId}`;
        socket.join(roomName);
        console.log(`[Socket] User ${userId || 'Unknown'} (${userRole || 'Guest'}) joined ${roomName}`);

        // Acknowledge join to current socket
        socket.emit('room_joined', {
          success: true,
          room: roomName,
          negotiationId
        });

        // Broadcast to other participant that user is online
        socket.to(roomName).emit('participant_status', {
          userId,
          userRole,
          status: 'ONLINE',
          timestamp: new Date()
        });
      } catch (error) {
        console.error('[Socket join_room error]:', error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Send real-time counter-offer / bid
    socket.on('send_counter_offer', async ({ negotiationId, bidderId, bidderRole, pricePerUnit, note }) => {
      try {
        if (!negotiationId || !pricePerUnit) {
          return socket.emit('error', { message: 'negotiationId and pricePerUnit are required' });
        }

        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) {
          return socket.emit('error', { message: 'Negotiation session not found' });
        }

        if (!['OPEN', 'COUNTER_OFFERED'].includes(negotiation.status)) {
          return socket.emit('error', { message: `Cannot bid. Negotiation is already ${negotiation.status}` });
        }

        const nextTurn = bidderRole === 'BUYER' ? 'FARMER' : 'BUYER';

        const newBid = {
          bidder: bidderId,
          bidderRole,
          pricePerUnit: Number(pricePerUnit),
          note: note || `Live counter-offer of ₹${pricePerUnit}`,
          timestamp: new Date()
        };

        negotiation.currentOfferedPrice = Number(pricePerUnit);
        negotiation.currentTurn = nextTurn;
        negotiation.status = 'COUNTER_OFFERED';
        negotiation.bidHistory.push(newBid);

        await negotiation.save();

        const roomName = `room_${negotiationId}`;
        console.log(`[Socket] Counter-offer ₹${pricePerUnit} broadcasted to ${roomName}`);

        // Broadcast live update to all participants in this room (both sender and receiver)
        negotiationNamespace.to(roomName).emit('counter_offer_received', {
          success: true,
          negotiationId,
          latestBid: newBid,
          currentOfferedPrice: negotiation.currentOfferedPrice,
          currentTurn: negotiation.currentTurn,
          status: negotiation.status,
          bidHistory: negotiation.bidHistory
        });
      } catch (error) {
        console.error('[Socket send_counter_offer error]:', error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Accept deal in real-time
    socket.on('accept_deal', async ({ negotiationId, userId, userRole }) => {
      try {
        const negotiation = await Negotiation.findById(negotiationId)
          .populate('listing', 'cropName unit')
          .populate('buyer', 'name phone')
          .populate('farmer', 'name phone');

        if (!negotiation) {
          return socket.emit('error', { message: 'Negotiation session not found' });
        }

        if (!['OPEN', 'COUNTER_OFFERED'].includes(negotiation.status)) {
          return socket.emit('error', { message: `Negotiation is already ${negotiation.status}` });
        }

        const agreedPrice = negotiation.currentOfferedPrice;
        const agreedTotalAmount = Math.round(agreedPrice * negotiation.quantity * 100) / 100;

        negotiation.status = 'ACCEPTED';
        negotiation.agreedPrice = agreedPrice;
        negotiation.agreedTotalAmount = agreedTotalAmount;

        await negotiation.save();

        const roomName = `room_${negotiationId}`;
        console.log(`[Socket] Deal locked in ${roomName} at ₹${agreedPrice}`);

        negotiationNamespace.to(roomName).emit('deal_locked', {
          success: true,
          message: 'Deal locked and accepted by both parties!',
          dealSummary: {
            negotiationId: negotiation._id,
            crop: negotiation.listing?.cropName || 'Produce',
            quantity: negotiation.quantity,
            agreedPricePerUnit: agreedPrice,
            agreedTotalAmount,
            farmer: negotiation.farmer?.name,
            buyer: negotiation.buyer?.name,
            status: 'ACCEPTED',
            acceptedBy: { userId, userRole },
            timestamp: new Date()
          }
        });
      } catch (error) {
        console.error('[Socket accept_deal error]:', error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Reject deal in real-time
    socket.on('reject_deal', async ({ negotiationId, userId, userRole, reason }) => {
      try {
        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) {
          return socket.emit('error', { message: 'Negotiation not found' });
        }

        negotiation.status = 'REJECTED';
        negotiation.bidHistory.push({
          bidder: userId,
          bidderRole: userRole || 'PARTICIPANT',
          pricePerUnit: negotiation.currentOfferedPrice,
          note: reason ? `Rejected: ${reason}` : 'Negotiation closed without agreement',
          timestamp: new Date()
        });

        await negotiation.save();

        const roomName = `room_${negotiationId}`;
        negotiationNamespace.to(roomName).emit('deal_rejected', {
          success: true,
          message: 'Negotiation rejected and closed',
          negotiationId,
          rejectedBy: { userId, userRole },
          reason: reason || 'Offer not accepted'
        });
      } catch (error) {
        console.error('[Socket reject_deal error]:', error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Leave room
    socket.on('leave_room', ({ negotiationId }) => {
      const roomName = `room_${negotiationId}`;
      socket.leave(roomName);
      console.log(`[Socket] Client ${socket.id} left ${roomName}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] Negotiation client: ${socket.id}`);
    });
  });
};

module.exports = initNegotiationSocket;
