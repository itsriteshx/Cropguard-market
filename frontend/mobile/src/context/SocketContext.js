import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import socketService from '../services/socketService';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { token, user, role } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);
  const [latestEvent, setLatestEvent] = useState(null);

  // Initialize socket when token changes
  useEffect(() => {
    if (token) {
      const socket = socketService.connect(token);

      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);
      const handleError = (err) => {
        console.warn('[SocketContext] Socket warning:', err?.message || err);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('error', handleError);

      if (socket.connected) {
        setIsConnected(true);
      }

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('error', handleError);
      };
    } else {
      socketService.disconnect();
      setIsConnected(false);
      setActiveRooms([]);
    }
  }, [token]);

  // Join a negotiation room
  const joinNegotiationRoom = useCallback(
    (negotiationId) => {
      if (!negotiationId) return;
      const userId = user?._id || user?.id || 'demo_user';
      const userRole = role || 'FARMER';
      socketService.joinRoom(negotiationId, userId, userRole);
      setActiveRooms((prev) => (prev.includes(negotiationId) ? prev : [...prev, negotiationId]));
    },
    [user, role]
  );

  // Leave a negotiation room
  const leaveNegotiationRoom = useCallback((negotiationId) => {
    if (!negotiationId) return;
    socketService.leaveRoom(negotiationId);
    setActiveRooms((prev) => prev.filter((id) => id !== negotiationId));
  }, []);

  // Send live counter offer
  const sendLiveCounterOffer = useCallback(
    ({ negotiationId, pricePerUnit, note }) => {
      const bidderId = user?._id || user?.id;
      const bidderRole = role || 'FARMER';
      socketService.sendCounterOffer({
        negotiationId,
        bidderId,
        bidderRole,
        pricePerUnit,
        note
      });
    },
    [user, role]
  );

  // Accept deal in real-time
  const acceptLiveDeal = useCallback(
    (negotiationId) => {
      const userId = user?._id || user?.id;
      const userRole = role || 'FARMER';
      socketService.acceptDeal({
        negotiationId,
        userId,
        userRole
      });
    },
    [user, role]
  );

  // Reject deal in real-time
  const rejectLiveDeal = useCallback(
    (negotiationId, reason) => {
      const userId = user?._id || user?.id;
      const userRole = role || 'FARMER';
      socketService.rejectDeal({
        negotiationId,
        userId,
        userRole,
        reason
      });
    },
    [user, role]
  );

  return (
    <SocketContext.Provider
      value={{
        socketService,
        isConnected,
        activeRooms,
        latestEvent,
        setLatestEvent,
        joinNegotiationRoom,
        leaveNegotiationRoom,
        sendLiveCounterOffer,
        acceptLiveDeal,
        rejectLiveDeal
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
