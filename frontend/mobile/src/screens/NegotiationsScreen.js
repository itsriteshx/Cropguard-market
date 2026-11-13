import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { apiRequest } from '../config/api';
import { createTypingController } from '../utils/typingController';

export default function NegotiationsScreen({ onNavigateToOrders }) {
  const { t, token, user, role } = useAuth();
  const {
    isConnected,
    joinNegotiationRoom,
    leaveNegotiationRoom,
    socketService
  } = useSocket();

  const [negotiations, setNegotiations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(null);
  const [loadError, setLoadError] = useState('');

  // Counter Offer Modal State
  const [activeSession, setActiveSession] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  // Per-room inline quick chat inputs
  const [chatDrafts, setChatDrafts] = useState({});
  const [sendingChatId, setSendingChatId] = useState(null);

  // Real-time toast state
  const [liveToast, setLiveToast] = useState(null);

  // Celebratory Locked Deal Modal State
  const [lockedDealModal, setLockedDealModal] = useState(null);

  // Online status of counterparts per user ID
  const [onlineUsers, setOnlineUsers] = useState({});

  // Real-time participant typing indicator map { [negotiationId]: userRole }
  const [typingMap, setTypingMap] = useState({});
  const typingControllerRef = useRef(null);

  // Keep track of joined rooms
  const joinedRoomsRef = useRef(new Set());

  useEffect(() => {
    fetchNegotiations();
  }, []);

  // Whenever negotiations list updates, join their isolated socket rooms
  useEffect(() => {
    if (negotiations.length > 0 && isConnected) {
      negotiations.forEach((neg) => {
        if (!joinedRoomsRef.current.has(neg._id)) {
          joinNegotiationRoom(neg._id);
          joinedRoomsRef.current.add(neg._id);
        }
      });
    }
  }, [negotiations, isConnected, joinNegotiationRoom]);

  // Clean up rooms on unmount
  useEffect(() => {
    return () => {
      joinedRoomsRef.current.forEach((id) => {
        leaveNegotiationRoom(id);
      });
      joinedRoomsRef.current.clear();
    };
  }, [leaveNegotiationRoom]);

  // Real-Time Typing Controller lifecycle and listener
  useEffect(() => {
    const controller = createTypingController({
      socketService,
      currentUserId: user?._id,
      onTypingStatusChange: ({ negotiationId, userRole, isTyping }) => {
        setTypingMap((prev) => {
          if (isTyping) {
            return { ...prev, [negotiationId]: userRole };
          }
          const next = { ...prev };
          delete next[negotiationId];
          return next;
        });
      }
    });

    typingControllerRef.current = controller;
    if (isConnected) {
      controller.subscribe();
    }

    return () => {
      controller.cleanup();
      typingControllerRef.current = null;
    };
  }, [socketService, isConnected, user?._id]);

  // Real-Time Socket Event Listeners (Counter Offers, Deal Locked, Deal Rejected, Presence)
  useEffect(() => {
    if (!socketService || !isConnected) return;

    fetchNegotiations();
    const unsubCreated = socketService.onNegotiationCreated(() => fetchNegotiations());

    // 1. Listen for incoming counter offers
    const unsubCounter = socketService.onCounterOfferReceived((data) => {
      console.log('[NegotiationsScreen] Live counter received:', data);
      if (!data || !data.negotiationId) return;

      setNegotiations((prev) =>
        prev.map((item) => {
          if (item._id === data.negotiationId) {
            const updatedBids = data.bidHistory || (item.bidHistory ? [...item.bidHistory, data.latestBid] : [data.latestBid]);
            return {
              ...item,
              currentOfferedPrice: data.currentOfferedPrice,
              currentTurn: data.currentTurn,
              status: data.status || 'COUNTER_OFFERED',
              bidHistory: updatedBids
            };
          }
          return item;
        })
      );

      // Keep open modal in sync
      setActiveSession((prev) => {
        if (prev && prev._id === data.negotiationId) {
          return {
            ...prev,
            currentOfferedPrice: data.currentOfferedPrice,
            currentTurn: data.currentTurn,
            status: data.status || 'COUNTER_OFFERED'
          };
        }
        return prev;
      });

      // Show live toast banner
      const isMyBid = data.latestBid?.bidderRole === (role === 'FARMER' ? 'FARMER' : 'BUYER');
      if (!isMyBid) {
        setLiveToast({
          id: Date.now(),
          type: 'COUNTER',
          title: '⚡ New Live Counter-Offer!',
          message: `Updated to ₹${data.currentOfferedPrice}/kg by ${data.latestBid?.bidderRole || 'Counterpart'}`
        });
        setTimeout(() => setLiveToast(null), 4000);
      }
    });

    // 2. Listen for deal locked event
    const unsubLocked = socketService.onDealLocked((data) => {
      console.log('[NegotiationsScreen] Deal locked event received:', data);
      if (!data || !data.dealSummary) return;

      const summary = data.dealSummary;

      setNegotiations((prev) =>
        prev.map((item) => {
          if (item._id === summary.negotiationId) {
            return {
              ...item,
              status: 'ACCEPTED',
              agreedPrice: summary.agreedPricePerUnit,
              agreedTotalAmount: summary.agreedTotalAmount
            };
          }
          return item;
        })
      );

      // Trigger celebratory deal modal
      setLockedDealModal(summary);
    });

    // 3. Listen for deal rejection
    const unsubRejected = socketService.onDealRejected((data) => {
      console.log('[NegotiationsScreen] Deal rejected event:', data);
      if (!data || !data.negotiationId) return;

      setNegotiations((prev) =>
        prev.map((item) => {
          if (item._id === data.negotiationId) {
            return {
              ...item,
              status: 'REJECTED'
            };
          }
          return item;
        })
      );

      setLiveToast({
        id: Date.now(),
        type: 'REJECTED',
        title: '🛑 Negotiation Closed',
        message: data.reason || 'Offer was declined by counterpart'
      });
      setTimeout(() => setLiveToast(null), 4000);
    });

    // 4. Listen for participant status (online presence)
    const unsubPresence = socketService.onParticipantStatus((data) => {
      if (data && data.userId) {
        setOnlineUsers((prev) => ({
          ...prev,
          [data.userId]: data.status === 'ONLINE'
        }));
      }
    });

    const unsubChat = socketService.onChatMessageReceived
      ? socketService.onChatMessageReceived((data) => {
          if (!data?.negotiationId) return;
          setNegotiations((prev) =>
            prev.map((item) => {
              if (item._id !== data.negotiationId) return item;
              const nextMessages = Array.isArray(data.messages)
                ? data.messages
                : data.message
                ? [...(item.messages || []), data.message]
                : item.messages || [];
              return { ...item, messages: nextMessages };
            })
          );
        })
      : () => {};

    const unsubChatDeleted = socketService.onChatMessageDeleted
      ? socketService.onChatMessageDeleted((data) => {
          if (!data?.negotiationId) return;
          setNegotiations((prev) =>
            prev.map((item) => {
              if (item._id !== data.negotiationId) return item;
              const nextMessages = Array.isArray(data.messages)
                ? data.messages
                : (item.messages || []).filter((m) => String(m._id) !== String(data.messageId));
              return { ...item, messages: nextMessages };
            })
          );
        })
      : () => {};

    const unsubNegDeleted = socketService.onNegotiationDeleted
      ? socketService.onNegotiationDeleted((data) => {
          if (!data?.negotiationId) return;
          setNegotiations((prev) => prev.filter((item) => item._id !== data.negotiationId));
        })
      : () => {};

    return () => {
      unsubCreated();
      unsubCounter();
      unsubLocked();
      unsubRejected();
      unsubPresence();
      unsubChat();
      unsubChatDeleted();
      unsubNegDeleted();
    };
  }, [socketService, role, isConnected]);

  const fetchNegotiations = async () => {
    setLoading(true);
    const res = await apiRequest('/negotiations/my', {}, token);
    if (res.success && res.negotiations) {
      setNegotiations(res.negotiations);
      setLoadError('');
    } else {
      setLoadError(res.message || 'Could not load negotiations. Pull down to retry.');
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNegotiations();
    setRefreshing(false);
  };

  const handleOpenCounterModal = (session) => {
    setActiveSession(session);
    setCounterPrice(String(session.currentOfferedPrice || ''));
    setCounterNote('');
  };

  const handleSubmitCounter = async () => {
    if (!counterPrice) {
      Alert.alert('Required', 'Please enter your counter price per unit');
      return;
    }

    const priceNum = Number(counterPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0.1) {
      Alert.alert('Invalid Price', 'Please enter a valid numeric counter price');
      return;
    }

    setSubmittingCounter(true);

    try {
      const res = await apiRequest(
        `/negotiations/${activeSession._id}/counter`,
        {
          method: 'POST',
          body: JSON.stringify({
            counterPrice: priceNum,
            note: counterNote || `Live counter offer of ₹${counterPrice}/kg`
          })
        },
        token
      );

      setSubmittingCounter(false);
      if (res.success) {
        Alert.alert('Counter Sent! 🤝', `Your counter-offer of ₹${counterPrice}/kg was sent.`);
        setActiveSession(null);
        fetchNegotiations();
      } else {
        Alert.alert('Notice', res.message || 'Could not submit counter-offer');
      }
    } catch (err) {
      setSubmittingCounter(false);
      console.warn('Counter submit error:', err.message);
    }
  };

  const handleAcceptDeal = (session) => {
    const totalAmount = Math.round(session.currentOfferedPrice * session.quantity);
    Alert.alert(
      'Lock Deal Price? 🔒',
      `Accept ₹${session.currentOfferedPrice}/${session.listing?.unit || 'Kg'} for ${session.quantity} ${session.listing?.unit || 'Kg'}? Total: ₹${totalAmount.toLocaleString('en-IN')}`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.negotiations.acceptBtn,
          onPress: async () => {
            const res = await apiRequest(
              `/negotiations/${session._id}/accept`,
              { method: 'POST', body: JSON.stringify({ expectedPrice: session.currentOfferedPrice }) },
              token
            );
            if (res.success) {
              fetchNegotiations();
            } else {
              Alert.alert('Notice', res.message || 'Could not accept deal');
            }
          }
        }
      ]
    );
  };

  const handleRejectDeal = (session) => {
    Alert.alert(
      'Reject Deal?',
      'Are you sure you want to close this negotiation session?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: 'Reject Deal',
          style: 'destructive',
          onPress: async () => {
            const res = await apiRequest(
              `/negotiations/${session._id}/reject`,
              {
                method: 'POST',
                body: JSON.stringify({ reason: 'Price not acceptable' })
              },
              token
            );
            if (res.success) {
              fetchNegotiations();
            } else {
              Alert.alert('Notice', res.message || 'Could not reject deal');
            }
          }
        }
      ]
    );
  };

  const handleSendQuickChat = async (negotiationId, textOverride = null) => {
    const text = String(textOverride ?? chatDrafts[negotiationId] ?? '').trim();
    if (!text || sendingChatId) return;

    // Immediately stop typing indicator when sending
    typingControllerRef.current?.handleMessageSent(negotiationId);

    setSendingChatId(negotiationId);
    const res = await apiRequest(
      `/negotiations/${negotiationId}/message`,
      { method: 'POST', body: JSON.stringify({ text }) },
      token
    );
    setSendingChatId(null);
    if (res?.success && Array.isArray(res.messages)) {
      setNegotiations((prev) =>
        prev.map((item) =>
          item._id === negotiationId ? { ...item, messages: res.messages } : item
        )
      );
      if (textOverride === null) {
        setChatDrafts((prev) => ({ ...prev, [negotiationId]: '' }));
      }
    } else {
      Alert.alert('Message failed', res?.message || 'Unable to send message.');
    }
  };

  const handleDeleteChatMessage = async (negotiationId, messageId) => {
    if (!negotiationId || !messageId) return;
    const res = await apiRequest(
      `/negotiations/${negotiationId}/message/${messageId}`,
      { method: 'DELETE' },
      token
    );
    if (res?.success && Array.isArray(res.messages)) {
      setNegotiations((prev) =>
        prev.map((item) =>
          item._id === negotiationId ? { ...item, messages: res.messages } : item
        )
      );
    } else {
      Alert.alert('Delete failed', res?.message || 'Unable to delete message.');
    }
  };

  const handleDeleteClosedNegotiation = (negotiationId) => {
    Alert.alert('Delete closed chat?', 'Remove this closed negotiation thread permanently?', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await apiRequest(`/negotiations/${negotiationId}`, { method: 'DELETE' }, token);
          if (res?.success) {
            setNegotiations((prev) => prev.filter((item) => item._id !== negotiationId));
          } else {
            Alert.alert('Notice', res?.message || 'Unable to delete negotiation.');
          }
        }
      }
    ]);
  };

  const placeOrder = async (session) => {
    if (creatingOrder) return;
    setCreatingOrder(session._id);
    const response = await apiRequest('/orders', { method: 'POST', body: JSON.stringify({ negotiationId: session._id }) }, token);
    setCreatingOrder(null);
    if (!response.success) {
      Alert.alert('Could not place order', response.message || 'Please try again.');
      return;
    }
    Alert.alert(response.created ? 'Order placed' : 'Order already placed', `Order ${response.order.orderNumber} is ready to track. Payment is simulated.`, [
      { text: 'View orders', onPress: onNavigateToOrders }, { text: 'Close' }
    ]);
  };

  const renderNegotiationItem = ({ item }) => {
    const isBuyer = user && String(item.buyer?._id || item.buyer) === String(user._id);
    const myRole = isBuyer ? 'BUYER' : 'FARMER';
    const isMyTurn = item.currentTurn === myRole;
    const isAccepted = item.status === 'ACCEPTED';
    const isRejected = item.status === 'REJECTED';

    const otherParty = isBuyer ? item.farmer : item.buyer;
    const otherPartyName = otherParty?.name || (isBuyer ? 'Farmer' : 'Buyer');
    const otherPartyId = otherParty?._id || otherParty;
    const isCounterpartOnline = onlineUsers[otherPartyId];

    return (
      <View style={[styles.card, isAccepted && styles.cardAccepted]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.cropTitle}>{item.listing?.cropName || 'Produce Deal'}</Text>
              {isConnected && (
                <View style={styles.liveRoomBadge}>
                  <View style={styles.liveRoomDot} />
                  <Text style={styles.liveRoomText}>Live Room</Text>
                </View>
              )}
            </View>
            <View style={styles.counterpartRow}>
              <Text style={styles.sessionSubtitle}>
                With: <Text style={styles.otherPartyText}>{otherPartyName}</Text>
              </Text>
              {isCounterpartOnline && (
                <View style={styles.presencePill}>
                  <View style={styles.presenceDot} />
                  <Text style={styles.presenceText}>{t.negotiations.liveParticipantOnline}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statusBadge}>
            <Text
              style={[
                styles.statusBadgeText,
                isAccepted && { color: '#10B981' },
                isRejected && { color: '#EF4444' }
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>

        {/* Pricing Metrics */}
        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t.negotiations.originalPrice}</Text>
            <Text style={styles.metricValue}>₹{item.originalListingPrice}/{item.listing?.unit || 'KG'}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t.negotiations.currentPrice}</Text>
            <Text style={[styles.metricValue, { color: '#10B981', fontWeight: 'bold', fontSize: 16 }]}>
              ₹{item.currentOfferedPrice}/{item.listing?.unit || 'KG'}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t.negotiations.quantity}</Text>
            <Text style={styles.metricValue}>{item.quantity} {item.listing?.unit || 'Kg'}</Text>
          </View>
        </View>

        {/* Deal value calculation */}
        <View style={styles.dealTotalRow}>
          <Text style={styles.dealTotalLabel}>Total Deal Value:</Text>
          <Text style={styles.dealTotalAmount}>
            ₹{Math.round(item.currentOfferedPrice * item.quantity).toLocaleString('en-IN')}
          </Text>
        </View>

        {/* Turn Status Banner */}
        {!isAccepted && !isRejected ? (
          <View
            style={[
              styles.turnBanner,
              isMyTurn ? styles.turnBannerMine : styles.turnBannerOther
            ]}
          >
            <Text style={[styles.turnText, isMyTurn ? { color: '#10B981' } : { color: '#F59E0B' }]}>
              {isMyTurn ? `👉 ${t.negotiations.yourTurn}` : `⏳ ${t.negotiations.waitingTurn}`}
            </Text>
          </View>
        ) : isAccepted ? (
          <View style={styles.acceptedBanner}>
            <Text style={styles.acceptedText}>🎉 {t.negotiations.dealLocked} ({t.negotiations.dealAgreedMsg})</Text>
          </View>
        ) : null}

        {isAccepted && isBuyer && (
          <TouchableOpacity style={styles.acceptBtn} onPress={() => placeOrder(item)} disabled={!!creatingOrder} accessibilityRole="button">
            <Text style={styles.acceptBtnText}>{creatingOrder === item._id ? 'Placing order…' : 'Place or view order'}</Text>
          </TouchableOpacity>
        )}

        {/* Live Chat Messages */}
        {Array.isArray(item.messages) && item.messages.length > 0 && (
          <View style={styles.chatBox}>
            <Text style={styles.chatBoxLabel}>💬 Live Chat ({item.messages.length})</Text>
            {item.messages.slice(-4).map((msg, idx) => (
              <View
                key={`${msg._id || idx}`}
                style={[
                  styles.chatBubble,
                  msg.senderRole === myRole ? styles.chatBubbleMine : styles.chatBubbleOther
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.chatSender}>
                    {msg.senderName || msg.senderRole}{msg.isVoice ? ' 🎙️' : ''}
                  </Text>
                  {msg.senderRole === myRole && msg._id && (
                    <TouchableOpacity onPress={() => handleDeleteChatMessage(item._id, msg._id)}>
                      <Text style={{ color: '#F87171', fontSize: 11, fontWeight: '700' }}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.chatText}>{msg.text}</Text>
              </View>
            ))}
          </View>
        )}

        {!isRejected && (
          <>
            {typingMap[item._id] && (
              <View style={styles.typingIndicatorRow}>
                <Text style={styles.typingIndicatorText}>
                  ✍️ {typingMap[item._id] === 'FARMER' ? 'Farmer' : 'Buyer'} is typing...
                </Text>
              </View>
            )}
            <View style={styles.chatComposerRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Send message to farmer/buyer..."
                placeholderTextColor="#64748B"
                value={chatDrafts[item._id] || ''}
                onChangeText={(txt) => {
                  setChatDrafts((prev) => ({ ...prev, [item._id]: txt }));
                  typingControllerRef.current?.handleTextChange(item._id, txt);
                }}
                onSubmitEditing={() => handleSendQuickChat(item._id)}
              />
              <TouchableOpacity
                style={styles.chatSendBtn}
                disabled={sendingChatId === item._id}
                onPress={() => handleSendQuickChat(item._id)}
              >
                <Text style={styles.chatSendText}>{sendingChatId === item._id ? '...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Action Buttons */}
        {!isAccepted && !isRejected && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.counterBtn, !isMyTurn && { opacity: 0.45 }]}
              onPress={() => handleOpenCounterModal(item)}
              disabled={!isMyTurn}
              accessibilityState={{ disabled: !isMyTurn }}
            >
              <Text style={styles.counterBtnText}>💬 {t.negotiations.counterBtn}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptBtn, !isMyTurn && { opacity: 0.45 }]}
              onPress={() => handleAcceptDeal(item)}
              disabled={!isMyTurn}
              accessibilityState={{ disabled: !isMyTurn }}
            >
              <Text style={styles.acceptBtnText}>🤝 {t.negotiations.acceptBtn}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleRejectDeal(item)}
            >
              <Text style={styles.rejectBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {isRejected && !item.order && (
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => handleDeleteClosedNegotiation(item._id)}
          >
            <Text style={styles.rejectBtnText}>🗑️ Delete Closed Chat</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Live Toast Banner */}
      {liveToast && (
        <View
          style={[
            styles.toastContainer,
            liveToast.type === 'REJECTED' && styles.toastRejected
          ]}
        >
          <Text
            style={[
              styles.toastTitle,
              liveToast.type === 'REJECTED' && { color: '#F87171' }
            ]}
          >
            {liveToast.title}
          </Text>
          <Text style={styles.toastMessage}>{liveToast.message}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>{t.negotiations.title}</Text>
          <View style={[styles.headerBeacon, isConnected ? styles.beaconOnline : styles.beaconOffline]}>
            <View style={[styles.beaconDot, isConnected ? styles.beaconDotOnline : styles.beaconDotOffline]} />
            <Text style={styles.beaconText}>
              {isConnected ? 'Socket.io Live' : 'Connecting'}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>{t.negotiations.subtitle}</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>{t.common.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={negotiations}
          keyExtractor={(item) => item._id}
          renderItem={renderNegotiationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#10B981"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>{loadError || t.negotiations.noNegotiations}</Text>
            </View>
          }
        />
      )}

      {/* Counter Offer Modal */}
      <Modal
        visible={!!activeSession}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveSession(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.negotiations.counterModalTitle}</Text>
            <Text style={styles.modalSubtitle}>
              {activeSession?.listing?.cropName} • Current: ₹{activeSession?.currentOfferedPrice}/kg
            </Text>

            <Text style={styles.inputLabel}>{t.negotiations.counterPriceLabel}</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="e.g. 25"
              placeholderTextColor="#64748B"
              value={counterPrice}
              onChangeText={setCounterPrice}
            />

            <Text style={styles.inputLabel}>{t.negotiations.counterNoteLabel}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Can do ₹25/kg for immediate farm loading"
              placeholderTextColor="#64748B"
              value={counterNote}
              onChangeText={setCounterNote}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setActiveSession(null)}
              >
                <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmitCounter}
                disabled={submittingCounter}
              >
                {submittingCounter ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.submitBtnText}>{t.negotiations.sendCounterBtn}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Celebratory Deal Locked Popup Modal */}
      <Modal
        visible={!!lockedDealModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLockedDealModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>🎉🤝🌾</Text>
            <Text style={styles.celebrationTitle}>{t.negotiations.liveDealBannerTitle}</Text>
            <Text style={styles.celebrationSubtitle}>
              {lockedDealModal?.crop || 'Crop Produce'}
            </Text>

            <View style={styles.celebrationSummaryBox}>
              <View style={styles.celebrationRow}>
                <Text style={styles.celebrationLabel}>Agreed Price:</Text>
                <Text style={styles.celebrationHighlight}>
                  ₹{lockedDealModal?.agreedPricePerUnit} / {lockedDealModal?.unit || 'KG'}
                </Text>
              </View>
              <View style={styles.celebrationRow}>
                <Text style={styles.celebrationLabel}>Total Volume:</Text>
                <Text style={styles.celebrationValue}>
                  {lockedDealModal?.quantity} {lockedDealModal?.unit || 'KG'}
                </Text>
              </View>
              <View style={[styles.celebrationRow, styles.celebrationTotalRow]}>
                <Text style={styles.celebrationTotalLabel}>Contract Value:</Text>
                <Text style={styles.celebrationTotalAmount}>
                  ₹{Number(lockedDealModal?.agreedTotalAmount || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            <Text style={styles.celebrationNotice}>
              {t.negotiations.liveDealBannerBody}
            </Text>

            <TouchableOpacity
              style={styles.celebrationBtn}
              onPress={() => {
                setLockedDealModal(null);
                fetchNegotiations();
              }}
            >
              <Text style={styles.celebrationBtnText}>
                {t.negotiations.viewInKhata || 'Continue to Khata'} ✓
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  toastContainer: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4
  },
  toastRejected: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444'
  },
  toastTitle: {
    color: '#34D399',
    fontWeight: 'bold',
    fontSize: 13
  },
  toastMessage: {
    color: '#F8FAFC',
    fontSize: 12,
    marginTop: 2
  },
  header: {
    padding: 16,
    paddingTop: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981'
  },
  headerBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  beaconOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981'
  },
  beaconOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B'
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4
  },
  beaconDotOnline: {
    backgroundColor: '#10B981'
  },
  beaconDotOffline: {
    backgroundColor: '#F59E0B'
  },
  beaconText: {
    fontSize: 10,
    color: '#E2E8F0',
    fontWeight: '600'
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2
  },
  listContent: {
    padding: 14
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardAccepted: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  cropTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  liveRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)'
  },
  liveRoomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#34D399',
    marginRight: 4
  },
  liveRoomText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: 'bold'
  },
  counterpartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2
  },
  sessionSubtitle: {
    fontSize: 12,
    color: '#94A3B8'
  },
  otherPartyText: {
    color: '#38BDF8',
    fontWeight: '600'
  },
  presencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6
  },
  presenceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
    marginRight: 4
  },
  presenceText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '600'
  },
  statusBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  statusBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: 'bold'
  },
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  metricItem: {
    flex: 1,
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2
  },
  metricValue: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '600'
  },
  dealTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  dealTotalLabel: {
    color: '#94A3B8',
    fontSize: 13
  },
  dealTotalAmount: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: 'bold'
  },
  turnBanner: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: 'center'
  },
  turnBannerMine: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981'
  },
  turnBannerOther: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B'
  },
  turnText: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  acceptedBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  acceptedText: {
    color: '#34D399',
    fontWeight: 'bold',
    fontSize: 12
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  counterBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8
  },
  counterBtnText: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 13
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8
  },
  acceptBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13
  },
  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  rejectBtnText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 14
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 14
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    marginBottom: 6,
    fontWeight: '600'
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 14
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: 'bold'
  },
  submitBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  submitBtnText: {
    color: '#0F172A',
    fontWeight: 'bold'
  },
  celebrationCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8
  },
  celebrationEmoji: {
    fontSize: 40,
    marginBottom: 8
  },
  celebrationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4
  },
  celebrationSubtitle: {
    fontSize: 14,
    color: '#34D399',
    fontWeight: '600',
    marginBottom: 16
  },
  celebrationSummaryBox: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  celebrationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  celebrationLabel: {
    fontSize: 12,
    color: '#94A3B8'
  },
  celebrationHighlight: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: 'bold'
  },
  celebrationValue: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '600'
  },
  celebrationTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0
  },
  celebrationTotalLabel: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: 'bold'
  },
  celebrationTotalAmount: {
    fontSize: 17,
    color: '#38BDF8',
    fontWeight: 'black'
  },
  celebrationNotice: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 18
  },
  celebrationBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center'
  },
  celebrationBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14
  },
  chatBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  chatBoxLabel: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  chatBubble: {
    padding: 8,
    borderRadius: 10
  },
  chatBubbleMine: {
    backgroundColor: 'rgba(14, 116, 144, 0.28)',
    alignSelf: 'flex-end',
    maxWidth: '88%'
  },
  chatBubbleOther: {
    backgroundColor: '#1E293B',
    alignSelf: 'flex-start',
    maxWidth: '88%'
  },
  chatSender: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2
  },
  chatText: {
    color: '#F8FAFC',
    fontSize: 12
  },
  chatComposerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 12
  },
  chatSendBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center'
  },
  chatSendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  typingIndicatorRow: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    backgroundColor: '#0F291E',
    borderWidth: 1,
    borderColor: '#166534',
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  typingIndicatorText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#4ADE80',
    fontWeight: '500'
  }
});
