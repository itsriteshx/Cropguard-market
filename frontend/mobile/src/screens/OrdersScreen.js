import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../config/api';

const labels = {
  PLACED: 'Placed',
  ESCROW_HELD: 'Simulated payment secured',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  SETTLED: 'Simulated settlement',
  CANCELLED: 'Cancelled'
};

const payments = {
  PENDING: 'Pending',
  ESCROW_SECURED: 'Simulated: secured',
  PAID_TO_FARMER: 'Simulated: settled',
  REFUNDED: 'Simulated: refunded'
};

export default function OrdersScreen() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    const response = await apiRequest('/orders/my-orders', {}, token);
    if (response.success && Array.isArray(response.orders)) {
      setOrders(response.orders);
      setError('');
    } else {
      setError(response.message || 'Could not load orders.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleOpenReceipt = async (order) => {
    setLoadingReceipt(true);
    const response = await apiRequest(`/orders/${order._id}/receipt`, {}, token);
    setLoadingReceipt(false);
    if (response.success && response.receipt) setSelectedReceipt(response.receipt);
    else Alert.alert('Receipt unavailable', response.message || 'Please reconnect and try again.');
  };

  const handleShareReceipt = async (receipt) => {
    if (!receipt) return;
    try {
      const item = receipt.items?.[0];
      const shareText = `CropGuard demo order receipt
Ref: ${receipt.receiptNumber}
Farmer: ${receipt.seller?.name || 'Unknown'}
Buyer: ${receipt.buyer?.name || 'Unknown'}
Produce: ${item?.description || 'Unknown'} · ${item?.quantity ?? '?'} ${item?.unit || ''}
Order total: ₹${Number(receipt.financialBreakdown?.grandTotal ?? 0).toLocaleString('en-IN')}
Payment status: ${receipt.paymentStatus || 'Unknown'} (simulated)
Demo only: no payment is transferred.`;

      await Share.share({
        message: shareText,
        title: `Bill ${receipt.receiptNumber}`
      });
    } catch {
      Alert.alert('Notice', 'Unable to open share sheet.');
    }
  };

  const transition = (order, nextStatus, label) => {
    Alert.alert(
      label,
      nextStatus === 'ESCROW_HELD' || nextStatus === 'SETTLED'
        ? 'This is a simulation. No money is transferred. Continue?'
        : 'Update the status of this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            if (updating) return;
            setUpdating(order._id);
            const response = await apiRequest(
              `/orders/${order._id}/status`,
              { method: 'PATCH', body: JSON.stringify({ nextStatus }) },
              token
            );
            setUpdating(null);
            if (!response.success) {
              Alert.alert('Could not update order', response.message || 'Please try again.');
            }
            await load(true);
          }
        }
      ]
    );
  };

  const renderOrder = ({ item }) => {
    const buyer = String(item.buyer?._id || item.buyer) === String(user?._id);
    const farmer = String(item.farmer?._id || item.farmer) === String(user?._id);
    const action =
      item.orderStatus === 'PLACED' && buyer
        ? ['ESCROW_HELD', 'Simulate payment']
        : item.orderStatus === 'ESCROW_HELD' && farmer
        ? ['DISPATCHED', 'Mark Dispatched']
        : item.orderStatus === 'DISPATCHED' && buyer
        ? ['DELIVERED', 'Confirm Delivery']
        : item.orderStatus === 'DELIVERED' && buyer
        ? ['SETTLED', 'Simulate settlement']
        : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.title}>{item.cropName}</Text>
          <Text style={styles.orderNumberBadge}>#{String(item.orderNumber || item._id).slice(-8)}</Text>
        </View>

        <Text style={styles.text}>
          {item.quantity} {item.unit} × ₹{item.unitPrice} = <Text style={styles.totalHighlight}>₹{item.totalAmount.toLocaleString('en-IN')}</Text>
        </Text>
        <Text style={styles.text}>
          {buyer ? 'Farmer' : 'Buyer'}: {(buyer ? item.farmer : item.buyer)?.name || 'Verified Participant'}
        </Text>

        <View style={styles.badgeRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{labels[item.orderStatus] || item.orderStatus}</Text>
          </View>
          <View style={styles.escrowPill}>
            <Text style={styles.escrowPillText}>{payments[item.paymentStatus] || item.paymentStatus}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.receiptButton}
            onPress={() => handleOpenReceipt(item)}
            accessibilityRole="button"
          >
            <Text style={styles.receiptButtonText}>🧾 Demo receipt & share</Text>
          </TouchableOpacity>

          {action && (
            <TouchableOpacity
              style={styles.button}
              disabled={!!updating}
              onPress={() => transition(item, ...action)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{updating === item._id ? 'Updating…' : action[1]}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📦 My orders</Text>
      <Text style={styles.notice}>
        Demo only: payment and settlement states are simulated. No money is transferred.
      </Text>

      {!!error && (
        <TouchableOpacity onPress={() => load()}>
          <Text style={styles.error}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color="#10B981" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#10B981" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {error ? 'Orders could not be loaded.' : 'No active orders yet. Buyers can place orders from accepted deals.'}
            </Text>
          }
        />
      )}

      {/* Certified Invoice Modal */}
      <Modal
        visible={!!selectedReceipt}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.receiptBadgeHeader}>
                <Text style={styles.receiptBadgeText}>🌾 Demo order receipt</Text>
                <Text style={styles.receiptStatusText}>{selectedReceipt?.orderStatus}</Text>
              </View>

              <Text style={styles.receiptRefText}>{selectedReceipt?.receiptNumber}</Text>
              <Text style={styles.receiptSubtext}>Payment status: {selectedReceipt?.paymentStatus || 'Unknown'} (simulated)</Text>

              <View style={styles.receiptDivider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptColLabel}>Producer (Seller):</Text>
                <Text style={styles.receiptColVal}>{selectedReceipt?.seller?.name}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptColLabel}>Location:</Text>
                <Text style={styles.receiptColVal}>{selectedReceipt?.seller?.location || 'Not provided'}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptColLabel}>Buyer:</Text>
                <Text style={styles.receiptColVal}>{selectedReceipt?.buyer?.name}</Text>
              </View>

              <View style={styles.receiptDivider} />

              {selectedReceipt?.items?.map((item, idx) => (
                <View key={idx} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>
                    {item.description} ({item.quantity} {item.unit})
                  </Text>
                  <Text style={styles.receiptItemTotal}>
                    ₹{Number(item.total).toLocaleString('en-IN')}
                  </Text>
                </View>
              ))}

              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>Order total:</Text>
                <Text style={styles.receiptTotalAmount}>₹{Number(selectedReceipt?.financialBreakdown?.grandTotal ?? 0).toLocaleString('en-IN')}</Text>
              </View>
              <Text style={styles.receiptSubtext}>Demo record only. No payment is transferred.</Text>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShareReceipt(selectedReceipt)}
                >
                  <Text style={styles.shareBtnText}>📲 Share Voucher</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedReceipt(null)}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 16 },
  header: { color: '#10B981', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  notice: {
    color: '#34D399',
    backgroundColor: '#064E3B',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 12
  },
  list: { paddingBottom: 24 },
  card: { backgroundColor: '#1E293B', padding: 14, borderRadius: 14, marginBottom: 12, gap: 6 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold', flex: 1 },
  orderNumberBadge: {
    backgroundColor: '#334155',
    color: '#94A3B8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 11,
    fontFamily: 'monospace'
  },
  text: { color: '#CBD5E1', fontSize: 13 },
  totalHighlight: { color: '#34D399', fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  statusPill: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusPillText: { color: '#6EE7B7', fontSize: 11, fontWeight: 'bold' },
  escrowPill: {
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  escrowPillText: { color: '#A5B4FC', fontSize: 11, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  receiptButton: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  receiptButtonText: { color: '#F8FAFC', fontWeight: '600', fontSize: 12 },
  button: {
    flex: 1,
    backgroundColor: '#10B981',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: { color: '#0F172A', fontWeight: 'bold', fontSize: 12 },
  error: { color: '#FCA5A5', marginBottom: 12 },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontSize: 13 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  receiptCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155'
  },
  receiptBadgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  receiptBadgeText: { color: '#10B981', fontWeight: 'bold', fontSize: 13 },
  receiptStatusText: {
    color: '#34D399',
    backgroundColor: '#064E3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold'
  },
  receiptRefText: { color: '#F8FAFC', fontSize: 18, fontWeight: 'black', marginTop: 2 },
  receiptSubtext: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  receiptDivider: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  receiptColLabel: { color: '#94A3B8', fontSize: 12 },
  receiptColVal: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  receiptColValHighlight: { color: '#34D399', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  receiptItemName: { color: '#E2E8F0', fontSize: 13, fontWeight: 'bold' },
  receiptItemTotal: { color: '#34D399', fontSize: 13, fontWeight: 'bold' },
  middlemanZeroBadge: {
    backgroundColor: '#064E3B',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10
  },
  middlemanZeroText: { color: '#6EE7B7', fontSize: 11, fontWeight: 'bold' },
  middlemanSavingsText: { color: '#A7F3D0', fontSize: 11, marginTop: 2 },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8
  },
  receiptTotalLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: 'bold' },
  receiptTotalAmount: { color: '#34D399', fontSize: 18, fontWeight: 'black' },
  hashBox: {
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 6,
    marginVertical: 8
  },
  hashTitle: { color: '#64748B', fontSize: 10, fontWeight: 'bold' },
  hashText: { color: '#94A3B8', fontSize: 9, fontFamily: 'monospace', marginTop: 2 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  shareBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  shareBtnText: { color: '#0F172A', fontWeight: 'bold', fontSize: 13 },
  closeBtn: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  closeBtnText: { color: '#F8FAFC', fontWeight: '600', fontSize: 13 }
});
