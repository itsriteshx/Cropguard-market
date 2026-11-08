import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import socketService from '../services/socketService';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
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
        // Softly handle connection hiccups without bubbling uncaught emitter errors
        setIsConnected(false);
      };

      if (socket && typeof socket.on === 'function') {
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleError);
        socket.on('error', handleError);

        if (socket.connected) {
          setIsConnected(true);
        }
      }

      return () => {
        if (socket && typeof socket.off === 'function') {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          socket.off('connect_error', handleError);
          socket.off('error', handleError);
        }
        socketService.disconnect();
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
      socketService.joinRoom(negotiationId);
      setActiveRooms((prev) => (prev.includes(negotiationId) ? prev : [...prev, negotiationId]));
    },
    []
  );

  // Leave a negotiation room
  const leaveNegotiationRoom = useCallback((negotiationId) => {
    if (!negotiationId) return;
    socketService.leaveRoom(negotiationId);
    setActiveRooms((prev) => prev.filter((id) => id !== negotiationId));
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socketService,
        isConnected,
        activeRooms,
        latestEvent,
        setLatestEvent,
        joinNegotiationRoom,
        leaveNegotiationRoom
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
