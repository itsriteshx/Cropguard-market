/**
 * TypingController manages typing state, debouncing, and socket emissions
 * for negotiation rooms.
 */
function createTypingController({ socketService, currentUserId, onTypingStatusChange, debounceMs = 2000 }) {
  // Set of negotiation IDs where typing has been initiated
  const activeRooms = new Set();
  // Map of negotiation ID -> timer ID
  const debounceTimers = new Map();
  let unsubListener = null;

  /**
   * Called when user types into a negotiation input
   */
  function handleTextChange(negotiationId, text) {
    if (!negotiationId) return;
    const trimmed = String(text || '').trim();

    if (trimmed.length > 0) {
      // If not already typing for this room, emit typing_start
      if (!activeRooms.has(negotiationId)) {
        activeRooms.add(negotiationId);
        if (socketService && typeof socketService.startTyping === 'function') {
          socketService.startTyping(negotiationId);
        }
      }

      // Reset / prolong debounce timer
      if (debounceTimers.has(negotiationId)) {
        clearTimeout(debounceTimers.get(negotiationId));
      }

      const timer = setTimeout(() => {
        stopTyping(negotiationId);
      }, debounceMs);

      debounceTimers.set(negotiationId, timer);
    } else {
      // Text was cleared -> immediately stop typing
      stopTyping(negotiationId);
    }
  }

  /**
   * Stop typing for a specific negotiation
   */
  function stopTyping(negotiationId) {
    if (!negotiationId) return;

    if (debounceTimers.has(negotiationId)) {
      clearTimeout(debounceTimers.get(negotiationId));
      debounceTimers.delete(negotiationId);
    }

    if (activeRooms.has(negotiationId)) {
      activeRooms.delete(negotiationId);
      if (socketService && typeof socketService.stopTyping === 'function') {
        socketService.stopTyping(negotiationId);
      }
    }
  }

  /**
   * Called when a message is submitted
   */
  function handleMessageSent(negotiationId) {
    stopTyping(negotiationId);
  }

  /**
   * Subscribe to participant_typing socket event
   */
  function subscribe() {
    if (unsubListener) unsubListener();
    if (socketService && typeof socketService.onParticipantTyping === 'function') {
      unsubListener = socketService.onParticipantTyping((payload) => {
        if (!payload || !payload.negotiationId) return;
        // Never show own typing
        if (currentUserId && payload.userId && String(payload.userId) === String(currentUserId)) {
          return;
        }

        if (typeof onTypingStatusChange === 'function') {
          onTypingStatusChange({
            negotiationId: payload.negotiationId,
            userId: payload.userId,
            userRole: payload.userRole || 'Counterpart',
            isTyping: Boolean(payload.isTyping)
          });
        }
      });
    }
    return unsubListener;
  }

  /**
   * Cleanup all timers and active rooms (on unmount or logout)
   */
  function cleanup() {
    for (const negotiationId of activeRooms) {
      if (socketService && typeof socketService.stopTyping === 'function') {
        socketService.stopTyping(negotiationId);
      }
    }
    activeRooms.clear();

    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();

    if (unsubListener) {
      unsubListener();
      unsubListener = null;
    }
  }

  return {
    handleTextChange,
    stopTyping,
    handleMessageSent,
    subscribe,
    cleanup,
    isTyping: (id) => activeRooms.has(id),
    hasTimer: (id) => debounceTimers.has(id)
  };
}

module.exports = { createTypingController };
