import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../config/api';

export default function LedgerScreen() {
  const { t, token, user } = useAuth();

  const [ledger, setLedger] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setLoading(true);
    // Fetch ledger summary
    const ledgerRes = await apiRequest('/orders/farmer-ledger', {}, token);
    if (ledgerRes.success && ledgerRes.ledgerSummary) {
      setLedger(ledgerRes.ledgerSummary);
      setOrders(ledgerRes.recentTransactions || []);
    } else {
      // Fallback: fetch orders
      const ordersRes = await apiRequest('/orders/my-orders', {}, token);
      if (ordersRes.success && ordersRes.orders) {
        setOrders(ordersRes.orders);
        // Calculate on-the-fly
        let settled = 0;
        let volume = 0;
        ordersRes.orders.forEach((o) => {
          if (o.orderStatus === 'SETTLED') {
            settled += o.totalAmount;
            volume += o.quantity;
          }
        });
        setLedger({
          totalEarnings: settled,
          pendingEscrowAmount: 0,
          totalVolumeKg: volume,
          estimatedMiddlemanSavings: Math.round(settled * 0.1),
          currency: 'INR'
        });
      }
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLedgerData();
    setRefreshing(false);
  };

  const handleOpenReceipt = async (orderId) => {
    setLoadingReceipt(true);
    const res = await apiRequest(`/orders/${orderId}/receipt`, {}, token);
    setLoadingReceipt(false);
    if (res.success && res.receipt) {
      setSelectedReceipt(res.receipt);
    } else {
      Alert.alert('Notice', 'Receipt details could not be retrieved.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#10B981"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.ledger.title}</Text>
        <Text style={styles.headerSubtitle}>{t.ledger.subtitle}</Text>
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>💰 {t.ledger.totalEarnings}</Text>
          <Text style={styles.kpiValue}>
            ₹{ledger?.totalEarnings?.toLocaleString('en-IN') || 0}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>🔒 {t.ledger.pendingEscrow}</Text>
          <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
            ₹{ledger?.pendingEscrowAmount?.toLocaleString('en-IN') || 0}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>📦 {t.ledger.volumeSold}</Text>
          <Text style={[styles.kpiValue, { color: '#38BDF8' }]}>
            {ledger?.totalVolumeKg || 0} Kg
          </Text>
        </View>

        {/* Highlight Middleman Savings */}
        <View style={[styles.kpiCard, styles.savingsCard]}>
          <Text style={styles.savingsLabel}>🌟 {t.ledger.middlemanSavings}</Text>
          <Text style={styles.savingsValue}>
            + ₹{ledger?.estimatedMiddlemanSavings?.toLocaleString('en-IN') || 0}
          </Text>
          <Text style={styles.savingsSubtitle}>
            {t.ledger.middlemanNotice}
          </Text>
        </View>
      </View>

      {/* Recent Transactions List */}
      <Text style={styles.sectionTitle}>📋 {t.ledger.recentTransactions}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 30 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📒</Text>
          <Text style={styles.emptyText}>No settled transactions in passbook yet.</Text>
        </View>
      ) : (
        orders.map((item, index) => {
          const orderId = item.orderId || item._id;
          const orderNum = item.orderNumber;
          const crop = item.cropName;
          const qty = item.quantity;
          const amt = item.totalAmount || item.amount;
          const buyer = item.buyerName || item.buyer?.name || 'Retail Buyer';
          const status = item.orderStatus;

          return (
            <View key={orderId || index} style={styles.txCard}>
              <View style={styles.txHeader}>
                <View>
                  <Text style={styles.txOrderNum}>{orderNum}</Text>
                  <Text style={styles.txCrop}>{crop} • {qty}</Text>
                </View>
                <View style={styles.txPriceContainer}>
                  <Text style={styles.txAmount}>₹{amt?.toLocaleString('en-IN')}</Text>
                  <Text
                    style={[
                      styles.txStatus,
                      status === 'SETTLED' ? { color: '#10B981' } : { color: '#F59E0B' }
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </View>

              <View style={styles.txFooter}>
                <Text style={styles.txBuyer}>Buyer: <Text style={{ color: '#E2E8F0' }}>{buyer}</Text></Text>
                <TouchableOpacity
                  style={styles.receiptBtn}
                  onPress={() => handleOpenReceipt(orderId)}
                >
                  <Text style={styles.receiptBtnText}>🧾 {t.ledger.viewReceipt}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Certified Receipt Modal */}
      <Modal
        visible={!!selectedReceipt}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptBadgeHeader}>
              <Text style={styles.receiptBadgeText}>✔ {selectedReceipt?.receiptNumber}</Text>
              <Text style={styles.receiptStatusText}>{selectedReceipt?.orderStatus}</Text>
            </View>

            <Text style={styles.receiptMainTitle}>🌾 {t.ledger.receiptTitle}</Text>
            <Text style={styles.receiptDateText}>
              Date: {new Date(selectedReceipt?.issueDate || Date.now()).toLocaleDateString('en-IN')}
            </Text>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptColLabel}>Farmer (Seller):</Text>
              <Text style={styles.receiptColVal}>{selectedReceipt?.seller?.name}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptColLabel}>Location:</Text>
              <Text style={styles.receiptColVal}>{selectedReceipt?.seller?.location}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptColLabel}>Buyer:</Text>
              <Text style={styles.receiptColVal}>{selectedReceipt?.buyer?.name}</Text>
            </View>

            <View style={styles.receiptDivider} />

            {selectedReceipt?.items?.map((item, idx) => (
              <View key={idx} style={styles.receiptItemRow}>
                <Text style={styles.receiptItemName}>{item.description} ({item.quantity} {item.unit})</Text>
                <Text style={styles.receiptItemTotal}>₹{item.total}</Text>
              </View>
            ))}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Total Paid (Escrow Settled):</Text>
              <Text style={styles.receiptTotalAmount}>₹{selectedReceipt?.financialBreakdown?.grandTotal}</Text>
            </View>

            <View style={styles.middlemanZeroBadge}>
              <Text style={styles.middlemanZeroText}>
                Middleman Commission Deducted: ₹0.00 (100% Direct to Farmer)
              </Text>
            </View>

            <Text style={styles.declarationText}>
              📜 {selectedReceipt?.declaration}
            </Text>

            <TouchableOpacity
              style={styles.closeReceiptBtn}
              onPress={() => setSelectedReceipt(null)}
            >
              <Text style={styles.closeReceiptBtnText}>{t.ledger.closeReceipt}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    marginBottom: 16
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  kpiLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981'
  },
  savingsCard: {
    width: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981'
  },
  savingsLabel: {
    fontSize: 13,
    color: '#34D399',
    fontWeight: 'bold'
  },
  savingsValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981',
    marginVertical: 4
  },
  savingsSubtitle: {
    fontSize: 11,
    color: '#94A3B8'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 12
  },
  txCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8
  },
  txOrderNum: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  txCrop: {
    fontSize: 12,
    color: '#38BDF8',
    marginTop: 2
  },
  txPriceContainer: {
    alignItems: 'flex-end'
  },
  txAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981'
  },
  txStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8
  },
  txBuyer: {
    fontSize: 12,
    color: '#94A3B8'
  },
  receiptBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  receiptBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600'
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 30
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20
  },
  receiptCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  receiptBadgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  receiptBadgeText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: 'bold'
  },
  receiptStatusText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: 'bold'
  },
  receiptMainTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 2
  },
  receiptDateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 10
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2
  },
  receiptColLabel: {
    fontSize: 12,
    color: '#94A3B8'
  },
  receiptColVal: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500'
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  receiptItemName: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '600'
  },
  receiptItemTotal: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: 'bold'
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  receiptTotalLabel: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: 'bold'
  },
  receiptTotalAmount: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: 'bold'
  },
  middlemanZeroBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center'
  },
  middlemanZeroText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: 'bold'
  },
  declarationText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 14
  },
  closeReceiptBtn: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16
  },
  closeReceiptBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14
  }
});
