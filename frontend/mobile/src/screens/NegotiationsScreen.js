import React, { useState, useEffect } from 'react';
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
import { apiRequest } from '../config/api';

export default function NegotiationsScreen() {
  const { t, token, user, role } = useAuth();

  const [negotiations, setNegotiations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Counter Offer Modal State
  const [activeSession, setActiveSession] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  useEffect(() => {
    fetchNegotiations();
  }, []);

  const fetchNegotiations = async () => {
    setLoading(true);
    const res = await apiRequest('/negotiations/my', {}, token);
    if (res.success && res.negotiations) {
      setNegotiations(res.negotiations);
    } else {
      setNegotiations([]);
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

    setSubmittingCounter(true);
    const res = await apiRequest(
      `/negotiations/${activeSession._id}/counter`,
      {
        method: 'POST',
        body: JSON.stringify({
          counterPrice: parseFloat(counterPrice),
          note: counterNote || `Counter offer of ₹${counterPrice}/kg`
        })
      },
      token
    );

    setSubmittingCounter(false);
    if (res.success) {
      Alert.alert('Counter Sent! 🤝', `Your counter-offer of ₹${counterPrice}/kg was broadcasted.`);
      setActiveSession(null);
      fetchNegotiations();
    } else {
      Alert.alert('Notice', res.message || 'Could not submit counter-offer');
    }
  };

  const handleAcceptDeal = (session) => {
    Alert.alert(
      'Lock Deal Price? 🔒',
      `Accept ₹${session.currentOfferedPrice}/${session.listing?.unit || 'Kg'} for ${session.quantity} ${session.listing?.unit || 'Kg'}? Total: ₹${Math.round(session.currentOfferedPrice * session.quantity)}`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.negotiations.acceptBtn,
          onPress: async () => {
            const res = await apiRequest(
              `/negotiations/${session._id}/accept`,
              { method: 'POST' },
              token
            );
            if (res.success) {
              Alert.alert('🎉 Deal Accepted & Locked!', res.message || 'Deal locked into digital agreement.');
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
              Alert.alert('Closed', 'Negotiation session has been rejected.');
              fetchNegotiations();
            }
          }
        }
      ]
    );
  };

  const renderNegotiationItem = ({ item }) => {
    const isBuyer = user && String(item.buyer?._id || item.buyer) === String(user._id);
    const myRole = isBuyer ? 'BUYER' : 'FARMER';
    const isMyTurn = item.currentTurn === myRole;
    const isAccepted = item.status === 'ACCEPTED';
    const isRejected = item.status === 'REJECTED';

    const otherPartyName = isBuyer
      ? item.farmer?.name || 'Farmer'
      : item.buyer?.name || 'Buyer';

    return (
      <View style={[styles.card, isAccepted && styles.cardAccepted]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cropTitle}>{item.listing?.cropName || 'Produce Deal'}</Text>
            <Text style={styles.sessionSubtitle}>
              With: <Text style={styles.otherPartyText}>{otherPartyName}</Text>
            </Text>
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
            <Text style={styles.metricValue}>₹{item.originalListingPrice}/kg</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t.negotiations.currentPrice}</Text>
            <Text style={[styles.metricValue, { color: '#10B981', fontWeight: 'bold', fontSize: 16 }]}>
              ₹{item.currentOfferedPrice}/kg
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

        {/* Action Buttons */}
        {!isAccepted && !isRejected && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => handleOpenCounterModal(item)}
            >
              <Text style={styles.counterBtnText}>💬 {t.negotiations.counterBtn}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAcceptDeal(item)}
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.negotiations.title}</Text>
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
              <Text style={styles.emptyText}>{t.negotiations.noNegotiations}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  header: {
    padding: 16,
    paddingTop: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981'
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
  cropTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  sessionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  otherPartyText: {
    color: '#38BDF8',
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
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600'
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    fontSize: 14
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '600'
  },
  submitBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8
  },
  submitBtnText: {
    color: '#0F172A',
    fontWeight: 'bold'
  }
});
