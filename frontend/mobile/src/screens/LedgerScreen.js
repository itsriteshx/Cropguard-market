import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  TextInput,
  Image,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../config/api';

const KHATA_STORAGE_KEY = 'cropguard_farmer_khata_records_v2';

const INITIAL_DEMO_BILLS = [
  {
    id: 'BILL-801',
    type: 'SALE',
    partyName: 'Dharwad APMC - Patil Traders',
    partyPhone: '9845123456',
    cropName: 'Red Onion (Garva Special)',
    quantity: '40',
    unit: 'QUINTAL',
    amount: 98000,
    paidStatus: 'PAID',
    date: '2026-11-12',
    category: 'CROP_SALE',
    notes: 'Sold at ₹2,450/qtl benchmark. Direct RTGS payment received.',
    imageUri: null
  },
  {
    id: 'BILL-802',
    type: 'EXPENSE',
    partyName: 'IFFCO Kisan Seva Kendra, Hubballi',
    partyPhone: '9876543210',
    cropName: 'DAP & Urea Fertilizer (10 Bags)',
    quantity: '10',
    unit: 'BAGS',
    amount: 14500,
    paidStatus: 'PAID',
    date: '2026-11-08',
    category: 'FERTILIZER',
    notes: 'Subsidized fertilizer for Rabi wheat sowing season.',
    imageUri: null
  },
  {
    id: 'BILL-803',
    type: 'SALE',
    partyName: 'Hubballi Local Mandi - Mahesh Arhatiya',
    partyPhone: '9448123789',
    cropName: 'Fresh Hybrid Tomato',
    quantity: '25',
    unit: 'CRATE',
    amount: 18750,
    paidStatus: 'UDHAAR',
    date: '2026-11-10',
    category: 'CROP_SALE',
    notes: 'Advance ₹5,000 paid. Balance ₹13,750 promised on upcoming mandi day.',
    imageUri: null
  },
  {
    id: 'BILL-804',
    type: 'EXPENSE',
    partyName: 'Deshmukh Harvester & Tractor Works',
    partyPhone: '9731234567',
    cropName: 'Ploughing & Rotavator (12 Hours)',
    quantity: '12',
    unit: 'HOURS',
    amount: 10800,
    paidStatus: 'PAID',
    date: '2026-11-05',
    category: 'MACHINERY',
    notes: 'Leveling and tractor diesel expense included.',
    imageUri: null
  }
];

export default function LedgerScreen() {
  const { t, token, user } = useAuth();

  // Active Main Tab: 'KHATA' (My Bills) | 'ORDERS' (Platform Orders) | 'SUMMARY' (P&L Analytics)
  const [activeTab, setActiveTab] = useState('KHATA');

  // Backend Platform Orders State
  const [ledger, setLedger] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Farmer Offline / Custom Bills State
  const [khataBills, setKhataBills] = useState([]);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'SALE' | 'EXPENSE' | 'UDHAAR'
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Bill Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [billType, setBillType] = useState('SALE'); // 'SALE' or 'EXPENSE'
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('QUINTAL');
  const [amount, setAmount] = useState('');
  const [paidStatus, setPaidStatus] = useState('PAID'); // 'PAID' | 'UDHAAR'
  const [notes, setNotes] = useState('');
  const [billImage, setBillImage] = useState(null);
  const [savingBill, setSavingBill] = useState(false);

  // View Bill Voucher Modal State
  const [selectedBill, setSelectedBill] = useState(null);

  // Platform Certified Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Load Stored Bills from Device
  const loadLocalBills = async () => {
    try {
      let raw = null;
      if (Platform.OS === 'web') {
        raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KHATA_STORAGE_KEY) : null;
      } else {
        raw = await SecureStore.getItemAsync(KHATA_STORAGE_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKhataBills(parsed);
          return;
        }
      }
      setKhataBills(INITIAL_DEMO_BILLS);
    } catch {
      setKhataBills(INITIAL_DEMO_BILLS);
    }
  };

  const saveLocalBills = async (updated) => {
    setKhataBills(updated);
    try {
      const raw = JSON.stringify(updated);
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(KHATA_STORAGE_KEY, raw);
      } else {
        await SecureStore.setItemAsync(KHATA_STORAGE_KEY, raw);
      }
    } catch (err) {
      console.warn('Could not persist khata records:', err);
    }
  };

  const fetchLedgerData = async () => {
    setLoadingOrders(true);
    const ledgerRes = await apiRequest('/orders/farmer-ledger', {}, token);
    if (ledgerRes.success && ledgerRes.ledgerSummary) {
      setLedger(ledgerRes.ledgerSummary);
      setOrders(ledgerRes.recentTransactions || []);
    } else {
      const ordersRes = await apiRequest('/orders/my-orders', {}, token);
      if (ordersRes.success && ordersRes.orders) {
        setOrders(ordersRes.orders);
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
    setLoadingOrders(false);
  };

  useEffect(() => {
    loadLocalBills();
    fetchLedgerData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLocalBills(), fetchLedgerData()]);
    setRefreshing(false);
  };

  // Pick Bill or Mandi Parchi Image
  const handlePickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setBillImage(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Notice', 'Could not open image gallery.');
    }
  };

  // Add New Khata Bill Entry
  const handleSaveBill = async () => {
    if (!partyName.trim()) {
      Alert.alert('Required', 'Please enter Buyer, Trader or Shop Name.');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Required', 'Please enter a valid bill amount.');
      return;
    }

    setSavingBill(true);
    const newEntry = {
      id: `BILL-${Date.now().toString().slice(-4)}`,
      type: billType,
      partyName: partyName.trim(),
      partyPhone: partyPhone.trim(),
      cropName: cropName.trim() || (billType === 'SALE' ? 'Harvest Produce' : 'Farm Inputs'),
      quantity: quantity.trim() || '1',
      unit: unit || 'UNIT',
      amount: Number(amount),
      paidStatus: paidStatus,
      date: new Date().toISOString().split('T')[0],
      notes: notes.trim(),
      imageUri: billImage
    };

    const updated = [newEntry, ...khataBills];
    await saveLocalBills(updated);
    setSavingBill(false);

    // Reset Form
    setPartyName('');
    setPartyPhone('');
    setCropName('');
    setQuantity('');
    setAmount('');
    setNotes('');
    setBillImage(null);
    setShowAddModal(false);
    Alert.alert('Khata Updated! 📒', `Bill ${newEntry.id} saved securely to your offline khata.`);
  };

  // Delete Bill with Alert
  const handleDeleteBill = (id, name) => {
    Alert.alert(
      'Delete Khata Entry',
      `Are you sure you want to delete bill for "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = khataBills.filter((b) => b.id !== id);
            await saveLocalBills(updated);
            if (selectedBill?.id === id) setSelectedBill(null);
          }
        }
      ]
    );
  };

  // Toggle Bill Paid Status (Mark as Paid / Received)
  const handleTogglePaidStatus = async (id) => {
    const updated = khataBills.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          paidStatus: b.paidStatus === 'PAID' ? 'UDHAAR' : 'PAID'
        };
      }
      return b;
    });
    await saveLocalBills(updated);
    if (selectedBill?.id === id) {
      setSelectedBill((prev) => (prev ? { ...prev, paidStatus: prev.paidStatus === 'PAID' ? 'UDHAAR' : 'PAID' } : null));
    }
  };

  // Share Bill via WhatsApp / SMS Sheet
  const handleShareCustomBill = async (bill) => {
    if (!bill) return;
    try {
      const isSale = bill.type === 'SALE';
      const statusText = bill.paidStatus === 'PAID' ? 'PAID / चुकता ✅' : 'PENDING UDHAAR / बाकी ⏳';
      const text = `🌾 CropGuard Kisan Digital Khata
━━━━━━━━━━━━━━━━━━
📄 Bill Ref: ${bill.id}
📅 Date: ${bill.date}
👤 Party: ${bill.partyName}${bill.partyPhone ? ` (📱 ${bill.partyPhone})` : ''}
📦 Description: ${bill.cropName} (${bill.quantity} ${bill.unit})
💰 Total Amount: ₹${bill.amount.toLocaleString('en-IN')}
📌 Status: ${statusText}
${bill.notes ? `📝 Note: ${bill.notes}\n` : ''}━━━━━━━━━━━━━━━━━━
Saved in CropGuard Direct Mandi Khata.`;

      await Share.share({
        message: text,
        title: `Bill Voucher ${bill.id}`
      });
    } catch {
      Alert.alert('Notice', 'Unable to open share dialog.');
    }
  };

  // Share Platform Certified Receipt
  const handleShareReceipt = async (receipt) => {
    if (!receipt) return;
    try {
      const item = receipt.items?.[0];
      const shareText = `CropGuard Certified Mandi Receipt
Ref: ${receipt.receiptNumber}
Farmer: ${receipt.seller?.name || 'Unknown'}
Buyer: ${receipt.buyer?.name || 'Unknown'}
Produce: ${item?.description || 'Unknown'} · ${item?.quantity ?? '?'} ${item?.unit || ''}
Order Total: ₹${Number(receipt.financialBreakdown?.grandTotal ?? 0).toLocaleString('en-IN')}
Payment Status: ${receipt.paymentStatus || 'Simulated'}
Under Ministry of Agriculture & UASD Guidelines.`;

      await Share.share({
        message: shareText,
        title: `Bill ${receipt.receiptNumber}`
      });
    } catch {
      Alert.alert('Notice', 'Unable to open share sheet.');
    }
  };

  // Open Platform Receipt
  const handleOpenReceipt = async (orderId) => {
    setLoadingReceipt(true);
    const response = await apiRequest(`/orders/${orderId}/receipt`, {}, token);
    setLoadingReceipt(false);
    if (response.success && response.receipt) setSelectedReceipt(response.receipt);
    else Alert.alert('Receipt unavailable', response.message || 'Please reconnect and try again.');
  };

  // Calculations for Farmer Khata
  const khataMetrics = useMemo(() => {
    let totalSales = 0;
    let totalExpenses = 0;
    let totalUdhaar = 0;

    khataBills.forEach((b) => {
      const amt = Number(b.amount) || 0;
      if (b.type === 'SALE') {
        totalSales += amt;
        if (b.paidStatus === 'UDHAAR') totalUdhaar += amt;
      } else {
        totalExpenses += amt;
      }
    });

    const netProfit = totalSales - totalExpenses;
    return { totalSales, totalExpenses, totalUdhaar, netProfit };
  }, [khataBills]);

  // Filtered Bills List
  const filteredBills = useMemo(() => {
    return khataBills.filter((b) => {
      if (filterType === 'SALE' && b.type !== 'SALE') return false;
      if (filterType === 'EXPENSE' && b.type !== 'EXPENSE') return false;
      if (filterType === 'UDHAAR' && b.paidStatus !== 'UDHAAR') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const pName = (b.partyName || '').toLowerCase();
        const cName = (b.cropName || '').toLowerCase();
        const bId = (b.id || '').toLowerCase();
        return pName.includes(query) || cName.includes(query) || bId.includes(query);
      }
      return true;
    });
  }, [khataBills, filterType, searchQuery]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>📒 {t.ledger?.title || 'Farmer Digital Khata'}</Text>
            <Text style={styles.headerSubtitle}>
              {t.ledger?.subtitle || 'Digital Bahi-Khata, Bills, Mandi Receipts & Profit Passbook'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBillHeaderBtn}
            onPress={() => setShowAddModal(true)}
            accessibilityRole="button"
          >
            <Text style={styles.addBillHeaderBtnText}>+ Add Bill</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Top Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'KHATA' && styles.tabBtnActive]}
          onPress={() => setActiveTab('KHATA')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'KHATA' && styles.tabBtnTextActive]}>
            📒 My Bills ({khataBills.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ORDERS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ORDERS')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'ORDERS' && styles.tabBtnTextActive]}>
            🌾 Market Orders ({orders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SUMMARY' && styles.tabBtnActive]}
          onPress={() => setActiveTab('SUMMARY')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'SUMMARY' && styles.tabBtnTextActive]}>
            📊 P&L Report
          </Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* TAB 1: FARMER CUSTOM BILLS & OFFLINE KHATA              */}
      {/* ======================================================== */}
      {activeTab === 'KHATA' && (
        <View style={{ marginTop: 12 }}>
          {/* Quick Metrics Strip */}
          <View style={styles.metricStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>🟢 Total Sales</Text>
              <Text style={styles.metricValGreen}>₹{khataMetrics.totalSales.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>🔴 Total Expenses</Text>
              <Text style={styles.metricValRed}>₹{khataMetrics.totalExpenses.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>⏳ Pending Udhaar</Text>
              <Text style={styles.metricValAmber}>₹{khataMetrics.totalUdhaar.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Search & Filter Bar */}
          <View style={styles.searchFilterContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search trader, crop, or bill ID..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillRow}>
              {[
                { key: 'ALL', label: 'All Records' },
                { key: 'SALE', label: '🟢 Sales' },
                { key: 'EXPENSE', label: '🔴 Expenses' },
                { key: 'UDHAAR', label: '⏳ Udhaar' }
              ].map((pill) => (
                <TouchableOpacity
                  key={pill.key}
                  style={[styles.filterPill, filterType === pill.key && styles.filterPillActive]}
                  onPress={() => setFilterType(pill.key)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      filterType === pill.key && styles.filterPillTextActive
                    ]}
                  >
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bills List */}
          {filteredBills.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📂</Text>
              <Text style={styles.emptyText}>No matching bills found.</Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.emptyActionBtnText}>+ Create Your First Bill</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredBills.map((item) => {
              const isSale = item.type === 'SALE';
              const isPaid = item.paidStatus === 'PAID';

              return (
                <View key={item.id} style={styles.billCard}>
                  <View style={styles.billCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.billIdText}>{item.id}</Text>
                        <View style={[styles.typeBadge, isSale ? styles.badgeSale : styles.badgeExpense]}>
                          <Text style={[styles.typeBadgeText, isSale ? { color: '#34D399' } : { color: '#F87171' }]}>
                            {isSale ? '🟢 BIKRI / SALE' : '🔴 KHARCH / EXPENSE'}
                          </Text>
                        </View>
                        {item.imageUri ? (
                          <View style={styles.photoAttachedBadge}>
                            <Text style={styles.photoAttachedText}>📷 Bill Attached</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.partyNameText}>{item.partyName}</Text>
                      <Text style={styles.billCropText}>
                        {item.cropName} • {item.quantity} {item.unit}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.billAmountText, isSale ? { color: '#34D399' } : { color: '#F87171' }]}>
                        {isSale ? '+' : '-'} ₹{item.amount.toLocaleString('en-IN')}
                      </Text>
                      <TouchableOpacity
                        style={[styles.statusBadge, isPaid ? styles.statusBadgePaid : styles.statusBadgeUdhaar]}
                        onPress={() => handleTogglePaidStatus(item.id)}
                      >
                        <Text style={[styles.statusBadgeText, isPaid ? { color: '#34D399' } : { color: '#F59E0B' }]}>
                          {isPaid ? '✔ PAID' : '⏳ UDHAAR (Tap to pay)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.billCardFooter}>
                    <Text style={styles.billDateText}>📅 {item.date}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.cardActionBtn}
                        onPress={() => setSelectedBill(item)}
                      >
                        <Text style={styles.cardActionBtnText}>🧾 View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cardActionShareBtn}
                        onPress={() => handleShareCustomBill(item)}
                      >
                        <Text style={styles.cardActionShareBtnText}>📲 WhatsApp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cardActionDeleteBtn}
                        onPress={() => handleDeleteBill(item.id, item.partyName)}
                      >
                        <Text style={styles.cardActionDeleteBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MARKETPLACE ESCROW ORDERS (Official Receipts)     */}
      {/* ======================================================== */}
      {activeTab === 'ORDERS' && (
        <View style={{ marginTop: 12 }}>
          {/* KPI Cards Grid */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>💰 Simulated Settled Sales</Text>
              <Text style={styles.kpiValue}>
                ₹{ledger?.totalEarnings?.toLocaleString('en-IN') || 0}
              </Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>🔒 Secured in Escrow</Text>
              <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
                ₹{ledger?.pendingEscrowAmount?.toLocaleString('en-IN') || 0}
              </Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>📦 Total Volume Sold</Text>
              <Text style={[styles.kpiValue, { color: '#38BDF8' }]}>
                {ledger?.totalVolumeKg || 0} Kg
              </Text>
            </View>

            <View style={[styles.kpiCard, styles.savingsCard]}>
              <Text style={styles.savingsLabel}>🌟 Direct Mandi Fee Saved</Text>
              <Text style={styles.savingsValue}>
                + ₹{ledger?.estimatedMiddlemanSavings?.toLocaleString('en-IN') || 0}
              </Text>
              <Text style={styles.savingsSubtitle}>
                Estimated 10% intermediary commission saved directly in farmer's pocket!
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>📋 Marketplace Invoices & Orders</Text>

          {loadingOrders ? (
            <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 30 }} />
          ) : orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>No platform orders found yet.</Text>
            </View>
          ) : (
            orders.map((item, index) => {
              const orderId = item.orderId || item._id;
              const orderNum = item.orderNumber;
              const crop = item.cropName;
              const qty = item.quantity;
              const amt = item.totalAmount || item.amount;
              const buyer = item.buyerName || item.buyer?.name || 'Wholesale Buyer';
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
                    <Text style={styles.txBuyer}>
                      Buyer: <Text style={{ color: '#E2E8F0' }}>{buyer}</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.receiptBtn}
                      onPress={() => handleOpenReceipt(orderId)}
                    >
                      <Text style={styles.receiptBtnText}>🧾 View Voucher</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* TAB 3: P&L SUMMARY & BALANCE SHEET                       */}
      {/* ======================================================== */}
      {activeTab === 'SUMMARY' && (
        <View style={{ marginTop: 12 }}>
          {/* Big Profit Box */}
          <View style={[styles.plCard, khataMetrics.netProfit >= 0 ? styles.plCardProfit : styles.plCardLoss]}>
            <Text style={styles.plTitle}>🌱 Net Farming Profit / शुद्ध मुनाफा</Text>
            <Text style={[styles.plAmount, khataMetrics.netProfit >= 0 ? { color: '#10B981' } : { color: '#F87171' }]}>
              ₹{khataMetrics.netProfit.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.plSubtitle}>
              {khataMetrics.netProfit >= 0
                ? 'Great job! Your farm produce sales exceed total input expenses.'
                : 'Expenses exceed recorded sales. Monitor pending harvests & bills.'}
            </Text>
          </View>

          {/* Breakdown Rows */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownHeader}>📑 Cashflow Breakdown</Text>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>🟢 Produce Sales (Offline + Online)</Text>
              <Text style={[styles.breakdownVal, { color: '#34D399' }]}>
                ₹{khataMetrics.totalSales.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>🔴 Agri Inputs & Farm Expenses</Text>
              <Text style={[styles.breakdownVal, { color: '#F87171' }]}>
                - ₹{khataMetrics.totalExpenses.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.breakdownDivider} />

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownTotalLabel}>Net Savings / Balance</Text>
              <Text style={styles.breakdownTotalVal}>₹{khataMetrics.netProfit.toLocaleString('en-IN')}</Text>
            </View>

            <View style={[styles.breakdownRow, { marginTop: 10, backgroundColor: 'rgba(245,158,11,0.1)', padding: 10, borderRadius: 8 }]}>
              <View>
                <Text style={{ color: '#FCD34D', fontSize: 13, fontWeight: 'bold' }}>⏳ Pending Udhaar to Collect</Text>
                <Text style={{ color: '#94A3B8', fontSize: 11 }}>Outstanding money owed by traders/buyers</Text>
              </View>
              <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: 'bold' }}>
                ₹{khataMetrics.totalUdhaar.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Guidelines info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 Smart Khata Tip</Text>
            <Text style={styles.infoText}>
              Keep photos of paper mandi receipts (*kacha parchi*) and fertilizer bills stored in your Digital Khata. All entries stay safe on your phone and can be shared over WhatsApp instantly.
            </Text>
          </View>
        </View>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD / CREATE KHATA BILL                        */}
      {/* ======================================================== */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.addModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>📝 Add Bill / Khata Entry</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Type Switcher */}
              <View style={styles.typeSwitcherRow}>
                <TouchableOpacity
                  style={[styles.typeSwitchBtn, billType === 'SALE' && styles.typeSwitchBtnSale]}
                  onPress={() => setBillType('SALE')}
                >
                  <Text style={[styles.typeSwitchBtnText, billType === 'SALE' && styles.typeSwitchBtnTextActive]}>
                    🟢 Sale / Bikri (बिक्री)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeSwitchBtn, billType === 'EXPENSE' && styles.typeSwitchBtnExpense]}
                  onPress={() => setBillType('EXPENSE')}
                >
                  <Text style={[styles.typeSwitchBtnText, billType === 'EXPENSE' && styles.typeSwitchBtnTextActive]}>
                    🔴 Expense / Kharch (लागत)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Party Name */}
              <Text style={styles.inputLabel}>
                {billType === 'SALE' ? 'Buyer / Trader / Mandi Name *' : 'Shop / Seller / Vendor Name *'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={billType === 'SALE' ? 'e.g. Patil Traders - Dharwad APMC' : 'e.g. IFFCO Kisan Kendra'}
                placeholderTextColor="#64748B"
                value={partyName}
                onChangeText={setPartyName}
              />

              {/* Phone (Optional) */}
              <Text style={styles.inputLabel}>Trader / Party Mobile Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="10-digit mobile number for WhatsApp reminder"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                value={partyPhone}
                onChangeText={setPartyPhone}
              />

              {/* Crop / Item */}
              <Text style={styles.inputLabel}>
                {billType === 'SALE' ? 'Crop / Produce Sold' : 'Item Description (Seeds, Fertilizer, Diesel)'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={billType === 'SALE' ? 'e.g. Sharbati Wheat, Red Onion' : 'e.g. DAP Fertilizer, Tractor Hire'}
                placeholderTextColor="#64748B"
                value={cropName}
                onChangeText={setCropName}
              />

              {/* Qty & Unit */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 50"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                </View>
                <View style={{ width: 120 }}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Quintal / Kg / Bags"
                    placeholderTextColor="#64748B"
                    value={unit}
                    onChangeText={setUnit}
                  />
                </View>
              </View>

              {/* Total Amount */}
              <Text style={styles.inputLabel}>Total Bill Amount (₹) *</Text>
              <TextInput
                style={[styles.modalInput, { fontSize: 18, color: '#34D399', fontWeight: 'bold' }]}
                placeholder="e.g. 45000"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Paid Status */}
              <Text style={styles.inputLabel}>Payment Status</Text>
              <View style={styles.paidStatusRow}>
                <TouchableOpacity
                  style={[styles.paidStatusBtn, paidStatus === 'PAID' && styles.paidStatusBtnPaid]}
                  onPress={() => setPaidStatus('PAID')}
                >
                  <Text style={[styles.paidStatusBtnText, paidStatus === 'PAID' && { color: '#0F172A' }]}>
                    ✔ Paid / चुकता
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.paidStatusBtn, paidStatus === 'UDHAAR' && styles.paidStatusBtnUdhaar]}
                  onPress={() => setPaidStatus('UDHAAR')}
                >
                  <Text style={[styles.paidStatusBtnText, paidStatus === 'UDHAAR' && { color: '#0F172A' }]}>
                    ⏳ Udhaar / बाकी
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Photo of Mandi Parchi / Bill */}
              <Text style={styles.inputLabel}>Attach Bill Photo / Mandi Parchi (Optional)</Text>
              <View style={{ marginBottom: 12 }}>
                {billImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: billImage }} style={styles.imagePreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setBillImage(null)}>
                      <Text style={{ color: '#F87171', fontSize: 12, fontWeight: 'bold' }}>Remove Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.pickImageBtn} onPress={handlePickImage}>
                    <Text style={styles.pickImageBtnText}>📸 Select Bill Photo from Gallery</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Notes */}
              <Text style={styles.inputLabel}>Remarks / Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="Mention payment terms, moisture %, vehicle number, etc."
                placeholderTextColor="#64748B"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.saveBillBtn}
              onPress={handleSaveBill}
              disabled={savingBill}
            >
              {savingBill ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.saveBillBtnText}>💾 Save Entry to Khata</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: VIEW CUSTOM BILL VOUCHER                      */}
      {/* ======================================================== */}
      <Modal visible={!!selectedBill} transparent animationType="fade" onRequestClose={() => setSelectedBill(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.billVoucherCard}>
            <View style={styles.receiptBadgeHeader}>
              <Text style={styles.receiptBadgeText}>REF: {selectedBill?.id}</Text>
              <Text style={[styles.receiptStatusText, selectedBill?.paidStatus === 'PAID' ? { color: '#34D399' } : { color: '#F59E0B' }]}>
                {selectedBill?.paidStatus === 'PAID' ? '✔ PAID' : '⏳ UDHAAR / PENDING'}
              </Text>
            </View>

            <Text style={styles.receiptMainTitle}>
              {selectedBill?.type === 'SALE' ? '🌾 Farm Produce Sale Voucher' : '🚜 Farm Expense Receipt'}
            </Text>
            <Text style={styles.receiptDateText}>📅 Date: {selectedBill?.date}</Text>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptColLabel}>Party Name:</Text>
              <Text style={styles.receiptColVal}>{selectedBill?.partyName}</Text>
            </View>

            {selectedBill?.partyPhone ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptColLabel}>Mobile:</Text>
                <Text style={styles.receiptColVal}>📱 {selectedBill?.partyPhone}</Text>
              </View>
            ) : null}

            <View style={styles.receiptRow}>
              <Text style={styles.receiptColLabel}>Item / Crop:</Text>
              <Text style={styles.receiptColVal}>{selectedBill?.cropName}</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptColLabel}>Quantity:</Text>
              <Text style={styles.receiptColVal}>{selectedBill?.quantity} {selectedBill?.unit}</Text>
            </View>

            {selectedBill?.notes ? (
              <View style={[styles.receiptRow, { marginTop: 6 }]}>
                <Text style={styles.receiptColLabel}>Notes:</Text>
                <Text style={[styles.receiptColVal, { maxWidth: '70%' }]}>{selectedBill?.notes}</Text>
              </View>
            ) : null}

            {selectedBill?.imageUri ? (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.receiptColLabel, { marginBottom: 6 }]}>Attached Mandi Parchi / Bill:</Text>
                <Image source={{ uri: selectedBill.imageUri }} style={{ width: '100%', height: 160, borderRadius: 8, backgroundColor: '#0F172A' }} resizeMode="cover" />
              </View>
            ) : null}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Total Amount:</Text>
              <Text style={[styles.receiptTotalAmount, selectedBill?.type === 'SALE' ? { color: '#34D399' } : { color: '#F87171' }]}>
                ₹{selectedBill?.amount?.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => handleShareCustomBill(selectedBill)}
              >
                <Text style={{ color: '#0F172A', fontWeight: 'bold', fontSize: 13 }}>📲 WhatsApp Bill</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#334155', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => setSelectedBill(null)}
              >
                <Text style={{ color: '#F8FAFC', fontWeight: 'bold', fontSize: 13 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: PLATFORM CERTIFIED RECEIPT                      */}
      {/* ======================================================== */}
      <Modal visible={!!selectedReceipt} transparent animationType="fade" onRequestClose={() => setSelectedReceipt(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptBadgeHeader}>
              <Text style={styles.receiptBadgeText}>✔ {selectedReceipt?.receiptNumber}</Text>
              <Text style={styles.receiptStatusText}>{selectedReceipt?.orderStatus}</Text>
            </View>

            <Text style={styles.receiptMainTitle}>🌾 Official Order Voucher</Text>
            <Text style={styles.receiptDateText}>
              Payment: {selectedReceipt?.paymentStatus || 'Simulated'} • Date: {new Date(selectedReceipt?.issueDate || Date.now()).toLocaleDateString('en-IN')}
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
                <Text style={styles.receiptItemTotal}>₹{Number(item.total).toLocaleString('en-IN')}</Text>
              </View>
            ))}

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Order Total:</Text>
              <Text style={styles.receiptTotalAmount}>
                ₹{Number(selectedReceipt?.financialBreakdown?.grandTotal || 0).toLocaleString('en-IN')}
              </Text>
            </View>

            <Text style={styles.declarationText}>Direct transaction under UASD Dharwad guidelines.</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: '#10B981', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => handleShareReceipt(selectedReceipt)}
              >
                <Text style={{ color: '#0F172A', fontWeight: 'bold', fontSize: 13 }}>📲 Share Voucher</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#334155', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => setSelectedReceipt(null)}
              >
                <Text style={{ color: '#F8FAFC', fontWeight: 'bold', fontSize: 13 }}>Close</Text>
              </TouchableOpacity>
            </View>
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
    marginBottom: 12
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    maxWidth: 240
  },
  addBillHeaderBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20
  },
  addBillHeaderBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabBtnActive: {
    backgroundColor: '#10B981'
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  tabBtnTextActive: {
    color: '#0F172A'
  },
  metricStrip: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  metricItem: {
    flex: 1,
    alignItems: 'center'
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155'
  },
  metricLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 2
  },
  metricValGreen: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#34D399'
  },
  metricValRed: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F87171'
  },
  metricValAmber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B'
  },
  searchFilterContainer: {
    marginBottom: 14
  },
  searchInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10
  },
  filterPillRow: {
    flexDirection: 'row'
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  filterPillActive: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981'
  },
  filterPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600'
  },
  filterPillTextActive: {
    color: '#34D399',
    fontWeight: 'bold'
  },
  billCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  billCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  billIdText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: 'bold'
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeSale: {
    backgroundColor: 'rgba(16,185,129,0.15)'
  },
  badgeExpense: {
    backgroundColor: 'rgba(239,68,68,0.15)'
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold'
  },
  photoAttachedBadge: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  photoAttachedText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '600'
  },
  partyNameText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 4
  },
  billCropText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  billAmountText: {
    fontSize: 17,
    fontWeight: 'bold'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4
  },
  statusBadgePaid: {
    backgroundColor: 'rgba(16,185,129,0.15)'
  },
  statusBadgeUdhaar: {
    backgroundColor: 'rgba(245,158,11,0.15)'
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  billCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  billDateText: {
    color: '#64748B',
    fontSize: 11
  },
  cardActionBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  cardActionBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: 'bold'
  },
  cardActionShareBtn: {
    backgroundColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  cardActionShareBtnText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: 'bold'
  },
  cardActionDeleteBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  cardActionDeleteBtnText: {
    color: '#F87171',
    fontSize: 11
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
  plCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1
  },
  plCardProfit: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: '#10B981'
  },
  plCardLoss: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: '#EF4444'
  },
  plTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6
  },
  plAmount: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 6
  },
  plSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16
  },
  breakdownCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  breakdownHeader: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 14
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4
  },
  breakdownLabel: {
    color: '#94A3B8',
    fontSize: 12
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: 'bold'
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10
  },
  breakdownTotalLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: 'bold'
  },
  breakdownTotalVal: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: 'bold'
  },
  infoCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  infoTitle: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 12
  },
  emptyActionBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  emptyActionBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 12
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 16
  },
  addModalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  modalCloseText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: 'bold'
  },
  typeSwitcherRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  typeSwitchBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8
  },
  typeSwitchBtnSale: {
    backgroundColor: '#064E3B'
  },
  typeSwitchBtnExpense: {
    backgroundColor: '#7F1D1D'
  },
  typeSwitchBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  typeSwitchBtnTextActive: {
    color: '#FFFFFF'
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    marginTop: 6
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155'
  },
  paidStatusRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4
  },
  paidStatusBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155'
  },
  paidStatusBtnPaid: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  paidStatusBtnUdhaar: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B'
  },
  paidStatusBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  pickImageBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4
  },
  pickImageBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600'
  },
  imagePreviewContainer: {
    marginTop: 4,
    alignItems: 'center'
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8
  },
  removeImageBtn: {
    marginTop: 6
  },
  saveBillBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14
  },
  saveBillBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14
  },
  billVoucherCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  receiptCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
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
    fontWeight: 'bold'
  },
  receiptMainTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 2
  },
  receiptDateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 8
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8
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
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '600'
  },
  receiptItemTotal: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: 'bold'
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  receiptTotalLabel: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: 'bold'
  },
  receiptTotalAmount: {
    fontSize: 17,
    color: '#10B981',
    fontWeight: 'bold'
  },
  declarationText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 14
  }
});
